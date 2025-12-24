import OpenAI from 'openai';
import fs from 'fs-extra';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

/**
 * 音声認識クラス
 * OpenAI Whisper APIを使用して音声をテキストに変換
 */
export class SpeechRecognizer {
  constructor(config) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
      timeout: 120000, // 2分のタイムアウト
      maxRetries: 2,
    });
    this.maxFileSize = 24 * 1024 * 1024; // 24MB（25MB制限に対して安全マージン）
    this.chunkDuration = 600; // 10分ごとに分割（デフォルト）
  }

  /**
   * ファイルサイズをチェック
   * @param {string} filePath - ファイルパス
   * @returns {number} ファイルサイズ（バイト）
   */
  getFileSize(filePath) {
    return fs.statSync(filePath).size;
  }

  /**
   * 音声ファイルを分割
   * @param {string} audioPath - 音声ファイルパス
   * @param {number} chunkDuration - チャンクの長さ（秒）
   * @returns {Promise<Array>} 分割されたファイルのパス配列
   */
  async splitAudioFile(audioPath, chunkDuration = this.chunkDuration) {
    console.log(`🔪 音声ファイルを分割中... (${chunkDuration}秒ごと)`);

    const chunks = [];
    const outputDir = path.join(path.dirname(audioPath), 'chunks');
    await fs.ensureDir(outputDir);

    // 音声の総時間を取得
    const duration = await this.getAudioDuration(audioPath);
    const numChunks = Math.ceil(duration / chunkDuration);

    console.log(`   総時間: ${duration.toFixed(2)}秒 → ${numChunks}個のチャンクに分割`);

    for (let i = 0; i < numChunks; i++) {
      const startTime = i * chunkDuration;
      const chunkPath = path.join(outputDir, `chunk_${i.toString().padStart(3, '0')}.wav`);

      await this.extractAudioChunk(audioPath, chunkPath, startTime, chunkDuration);
      chunks.push({
        path: chunkPath,
        index: i,
        startTime,
        endTime: Math.min(startTime + chunkDuration, duration),
      });

      console.log(`   ✓ チャンク ${i + 1}/${numChunks} 作成完了`);
    }

    return chunks;
  }

  /**
   * 音声の長さを取得
   * @param {string} audioPath - 音声ファイルパス
   * @returns {Promise<number>} 音声の長さ（秒）
   */
  getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration);
        }
      });
    });
  }

  /**
   * 音声の一部を抽出
   * @param {string} inputPath - 入力ファイルパス
   * @param {string} outputPath - 出力ファイルパス
   * @param {number} startTime - 開始時間（秒）
   * @param {number} duration - 長さ（秒）
   * @returns {Promise<void>}
   */
  extractAudioChunk(inputPath, outputPath, startTime, duration) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * 音声ファイルを文字起こし（タイムスタンプ付き）
   * @param {string} audioPath - 音声ファイルパス
   * @returns {Object} 文字起こし結果とタイムスタンプ
   */
  async transcribe(audioPath) {
    console.log(`🎤 音声認識開始: ${audioPath}`);

    const fileSize = this.getFileSize(audioPath);
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
    console.log(`   ファイルサイズ: ${fileSizeMB}MB`);

    // ファイルサイズチェック：24MBを超える場合は分割処理
    if (fileSize > this.maxFileSize) {
      console.log(`⚠️  ファイルサイズが制限を超えています (${fileSizeMB}MB > 24MB)`);
      console.log(`🔄 自動分割モードに切り替えます...`);
      return await this.transcribeWithSplitting(audioPath);
    }

    // 通常の文字起こし処理
    return await this.transcribeSingleFile(audioPath);
  }

  /**
   * 単一ファイルの文字起こし
   * @param {string} audioPath - 音声ファイルパス
   * @returns {Object} 文字起こし結果
   */
  async transcribeSingleFile(audioPath) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`🔄 リトライ中... (${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // 指数バックオフ
        }

        // Whisper APIで文字起こし
        const transcription = await this.openai.audio.transcriptions.create({
          file: fs.createReadStream(audioPath),
          model: this.config.openai.model,
          language: this.config.openai.language,
          response_format: 'verbose_json',
          timestamp_granularities: ['segment'],
        });

        console.log(`✅ 文字起こし完了: ${transcription.text?.length || 0}文字`);

        return {
          text: transcription.text,
          segments: transcription.segments || [],
          words: transcription.words || [],
          language: transcription.language,
          duration: transcription.duration,
        };
      } catch (error) {
        lastError = error;
        console.error(`❌ 音声認識エラー (試行 ${attempt}/${maxRetries}):`, error.message);

        // リトライ不可能なエラーの場合は即座に終了
        if (error.status === 401 || error.status === 403) {
          console.error('❌ 認証エラー: API Keyを確認してください');
          throw error;
        }
        if (error.status === 413) {
          console.error('❌ ファイルサイズが大きすぎます (最大25MB)');
          throw error;
        }
      }
    }

    // すべてのリトライが失敗した場合
    console.error(`❌ ${maxRetries}回の試行後も失敗しました`);
    throw lastError;
  }

  /**
   * 大きなファイルを分割して文字起こし
   * @param {string} audioPath - 音声ファイルパス
   * @returns {Object} 文字起こし結果
   */
  async transcribeWithSplitting(audioPath) {
    try {
      // 音声ファイルを分割
      const chunks = await this.splitAudioFile(audioPath);
      console.log(`📝 ${chunks.length}個のチャンクを順次処理します...`);

      const allSegments = [];
      const allWords = [];
      let fullText = '';
      let totalDuration = 0;

      // 各チャンクを処理
      for (const chunk of chunks) {
        console.log(`\n🎤 チャンク ${chunk.index + 1}/${chunks.length} を処理中...`);

        const result = await this.transcribeSingleFile(chunk.path);

        // タイムスタンプを調整してマージ
        const adjustedSegments = result.segments.map(seg => ({
          ...seg,
          start: seg.start + chunk.startTime,
          end: seg.end + chunk.startTime,
        }));

        const adjustedWords = result.words.map(word => ({
          ...word,
          start: word.start + chunk.startTime,
          end: word.end + chunk.startTime,
        }));

        allSegments.push(...adjustedSegments);
        allWords.push(...adjustedWords);
        fullText += result.text + ' ';
        totalDuration = Math.max(totalDuration, chunk.endTime);

        // チャンクファイルを削除
        await fs.remove(chunk.path);
      }

      // chunksディレクトリを削除
      const chunksDir = path.join(path.dirname(audioPath), 'chunks');
      await fs.remove(chunksDir);

      console.log(`\n✅ 全チャンクの文字起こし完了: ${fullText.length}文字`);

      return {
        text: fullText.trim(),
        segments: allSegments,
        words: allWords,
        language: chunks.length > 0 ? 'ja' : undefined,
        duration: totalDuration,
      };
    } catch (error) {
      console.error(`❌ 分割処理中にエラーが発生しました:`, error.message);
      throw error;
    }
  }

  /**
   * セグメントをテロップ用に整形
   * @param {Array} segments - Whisperのセグメント配列
   * @returns {Array} テロップデータ [{text, start, end}]
   */
  formatSegmentsForCaptions(segments) {
    const captions = [];
    const maxCharsPerLine = this.config.caption.maxCharsPerLine;
    const minDuration = this.config.caption.minDisplayDuration;

    for (const segment of segments) {
      const text = segment.text.trim();
      const start = segment.start;
      const end = segment.end;
      const duration = end - start;

      // 短すぎるセグメントはスキップ
      if (duration < minDuration) {
        continue;
      }

      // 長いテキストを分割
      if (text.length > maxCharsPerLine) {
        const lines = this.splitTextIntoLines(text, maxCharsPerLine);
        const timePerChar = duration / text.length;

        let currentTime = start;
        for (const line of lines) {
          const lineDuration = line.length * timePerChar;
          captions.push({
            text: line,
            start: currentTime,
            end: currentTime + lineDuration,
            duration: lineDuration,
          });
          currentTime += lineDuration;
        }
      } else {
        captions.push({
          text,
          start,
          end,
          duration,
        });
      }
    }

    return captions;
  }

  /**
   * テキストを指定文字数で分割
   */
  splitTextIntoLines(text, maxChars) {
    const lines = [];
    const sentences = text.split(/([。、！？\n])/);
    let currentLine = '';

    for (const sentence of sentences) {
      if ((currentLine + sentence).length <= maxChars) {
        currentLine += sentence;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = sentence;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    // それでも長い場合は強制分割
    return lines.flatMap(line => {
      if (line.length <= maxChars) {
        return [line];
      }
      const chunks = [];
      for (let i = 0; i < line.length; i += maxChars) {
        chunks.push(line.slice(i, i + maxChars));
      }
      return chunks;
    });
  }

  /**
   * フィラーワードを検出
   * @param {Array} words - 単語配列
   * @returns {Array} フィラーワードの位置 [{word, start, end}]
   */
  detectFillerWords(words) {
    const fillerWords = this.config.autoCut.fillerWords;
    const detected = [];

    for (const wordData of words) {
      const word = wordData.word || wordData.text;
      if (fillerWords.some(filler => word.includes(filler))) {
        detected.push({
          word,
          start: wordData.start,
          end: wordData.end,
        });
      }
    }

    return detected;
  }

  /**
   * 話速を計算（文字/秒）
   */
  calculateSpeakingRate(segments) {
    if (!segments || segments.length === 0) return 0;

    let totalChars = 0;
    let totalDuration = 0;

    for (const segment of segments) {
      totalChars += segment.text.length;
      totalDuration += segment.end - segment.start;
    }

    return totalDuration > 0 ? totalChars / totalDuration : 0;
  }

  /**
   * 統合された音声解析
   */
  async analyzeSpeech(audioPath) {
    const transcription = await this.transcribe(audioPath);
    const captions = this.formatSegmentsForCaptions(transcription.segments);
    const fillerWords = this.detectFillerWords(transcription.words);
    const speakingRate = this.calculateSpeakingRate(transcription.segments);

    return {
      transcription,
      captions,
      fillerWords,
      speakingRate,
      stats: {
        totalWords: transcription.words.length,
        totalSegments: transcription.segments.length,
        totalCaptions: captions.length,
        fillerWordCount: fillerWords.length,
        speakingRate: speakingRate.toFixed(2),
      },
    };
  }
}
