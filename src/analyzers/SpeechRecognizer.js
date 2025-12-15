import OpenAI from 'openai';
import fs from 'fs-extra';
import path from 'path';

/**
 * 音声認識クラス
 * OpenAI Whisper APIを使用して音声をテキストに変換
 */
export class SpeechRecognizer {
  constructor(config) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  /**
   * 音声ファイルを文字起こし（タイムスタンプ付き）
   * @param {string} audioPath - 音声ファイルパス
   * @returns {Object} 文字起こし結果とタイムスタンプ
   */
  async transcribe(audioPath) {
    console.log(`🎤 音声認識開始: ${audioPath}`);

    try {
      // Whisper APIで文字起こし
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: this.config.openai.model,
        language: this.config.openai.language,
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
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
      console.error('❌ 音声認識エラー:', error.message);
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
