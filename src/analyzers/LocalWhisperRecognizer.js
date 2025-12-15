import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

/**
 * ローカルWhisper音声認識クラス
 * ローカルにインストールされたWhisperを使用（OpenAI API不要）
 */
export class LocalWhisperRecognizer {
  constructor(config) {
    this.config = config;
    this.whisperPath = '/Users/norikuni/Library/Python/3.9/bin/whisper';
  }

  /**
   * 音声ファイルを文字起こし（タイムスタンプ付き）
   */
  async transcribe(audioPath) {
    console.log(`🎤 音声認識開始（ローカルWhisper）: ${audioPath}`);

    const outputDir = path.dirname(audioPath);
    const baseName = path.basename(audioPath, path.extname(audioPath));

    try {
      // FFmpegのパスを取得
      const ffmpegDir = path.resolve('./node_modules/@ffmpeg-installer/darwin-arm64');

      // Whisperコマンドを実行（JSON形式で出力）
      // PATHにFFmpegのディレクトリを追加
      const command = `PATH="${ffmpegDir}:$PATH" ${this.whisperPath} "${audioPath}" \
        --model base \
        --language ja \
        --output_format json \
        --output_dir "${outputDir}"`;

      console.log('   処理中... (これには数分かかる場合があります)');

      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });

      // JSON結果を読み込み
      const jsonPath = path.join(outputDir, `${baseName}.json`);
      const result = await fs.readJson(jsonPath);

      console.log(`✅ 文字起こし完了: ${result.text?.length || 0}文字`);

      // OpenAI API形式に変換
      const segments = result.segments || [];
      const words = this.extractWords(segments);

      return {
        text: result.text,
        segments: segments.map(seg => ({
          text: seg.text,
          start: seg.start,
          end: seg.end,
        })),
        words: words,
        language: result.language || 'ja',
        duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
      };
    } catch (error) {
      console.error('❌ 音声認識エラー:', error.message);
      throw error;
    }
  }

  /**
   * セグメントから単語を抽出
   */
  extractWords(segments) {
    const words = [];

    for (const segment of segments) {
      // セグメントのテキストを単語に分割
      const text = segment.text.trim();
      const wordTexts = text.split(/\s+/);

      if (wordTexts.length === 0) continue;

      const duration = segment.end - segment.start;
      const timePerWord = duration / wordTexts.length;

      for (let i = 0; i < wordTexts.length; i++) {
        words.push({
          word: wordTexts[i],
          start: segment.start + (i * timePerWord),
          end: segment.start + ((i + 1) * timePerWord),
        });
      }
    }

    return words;
  }

  /**
   * セグメントをテロップ用に整形
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

      if (duration < minDuration) {
        continue;
      }

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
   * 話速を計算
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
