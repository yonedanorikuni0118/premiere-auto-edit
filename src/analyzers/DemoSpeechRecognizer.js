/**
 * デモ用音声認識クラス
 * OpenAI API不要で動作するサンプル実装
 * ネットワークエラーのフォールバックやデモ用途に使用
 */
export class DemoSpeechRecognizer {
  constructor(config) {
    this.config = config;
  }

  /**
   * デモ用の文字起こし（サンプルデータ生成）
   */
  async transcribe(audioPath) {
    console.log(`🎤 デモモード: サンプル文字起こしを生成中...`);

    // ダミーの文字起こし結果を生成
    const sampleText = `こんにちは。これはデモ用のサンプル音声認識結果です。実際の動画の音声認識はOpenAI Whisper APIを使用して行われます。現在はネットワークの問題でAPIに接続できないため、このサンプルデータを使用しています。自動カット機能とテロップ生成機能の動作確認ができます。Premiere ProにインポートできるXMLファイルが生成されます。無音部分の検出やシーン変化の検出も正常に動作しています。`;

    const segments = [
      {
        text: 'こんにちは。これはデモ用のサンプル音声認識結果です。',
        start: 0.0,
        end: 3.5,
      },
      {
        text: '実際の動画の音声認識はOpenAI Whisper APIを使用して行われます。',
        start: 3.5,
        end: 7.2,
      },
      {
        text: '現在はネットワークの問題でAPIに接続できないため、',
        start: 7.2,
        end: 10.5,
      },
      {
        text: 'このサンプルデータを使用しています。',
        start: 10.5,
        end: 13.0,
      },
      {
        text: '自動カット機能とテロップ生成機能の動作確認ができます。',
        start: 13.0,
        end: 16.8,
      },
      {
        text: 'Premiere ProにインポートできるXMLファイルが生成されます。',
        start: 16.8,
        end: 20.5,
      },
      {
        text: '無音部分の検出やシーン変化の検出も正常に動作しています。',
        start: 20.5,
        end: 24.0,
      },
    ];

    const words = [];
    for (const segment of segments) {
      const text = segment.text.trim();
      const chars = text.split('');
      const duration = segment.end - segment.start;
      const timePerChar = duration / chars.length;

      for (let i = 0; i < chars.length; i++) {
        words.push({
          word: chars[i],
          start: segment.start + (i * timePerChar),
          end: segment.start + ((i + 1) * timePerChar),
        });
      }
    }

    console.log(`✅ デモ文字起こし完了: ${sampleText.length}文字`);

    return {
      text: sampleText,
      segments,
      words,
      language: 'ja',
      duration: 24.0,
    };
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
   * フィラーワードを検出（デモ用）
   */
  detectFillerWords(words) {
    // デモモードでは空の配列を返す
    return [];
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
    console.log('\n⚠️  デモモード: OpenAI APIへの接続が失敗したため、サンプルデータを使用します');
    console.log('   実際の音声は認識されませんが、XML生成機能は正常に動作します\n');

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
