/**
 * 音声分析クラス
 * 話速度、ポーズ、感情などを分析して高度なカット候補を生成
 */
export class SpeechAnalyzer {
  constructor(config) {
    this.config = config;
  }

  /**
   * 話速度を分析してカット候補を生成
   * @param {Object} speechAnalysis - SpeechRecognizerの解析結果
   * @returns {Array} カット候補配列
   */
  analyzeSpeechRate(speechAnalysis) {
    if (!this.config.advancedDetection?.speechRateAnalysis?.enabled) {
      return [];
    }

    const candidates = [];
    const { minWPM, maxWPM } = this.config.advancedDetection.speechRateAnalysis;

    // セグメントごとに話速度を計算
    for (const segment of speechAnalysis.segments || []) {
      const words = segment.words || [];
      if (words.length === 0) continue;

      const duration = segment.end - segment.start;
      const wordsPerMinute = (words.length / duration) * 60;

      // 異常に早い、または遅い部分をカット候補に
      if (wordsPerMinute < minWPM || wordsPerMinute > maxWPM) {
        candidates.push({
          start: segment.start,
          end: segment.end,
          duration: duration,
          type: 'speech_rate',
          reason: `話速度異常: ${Math.round(wordsPerMinute)} WPM`,
          confidence: this.calculateSpeechRateConfidence(wordsPerMinute, minWPM, maxWPM),
          metadata: {
            wpm: wordsPerMinute,
            wordsCount: words.length,
          },
        });
      }
    }

    return candidates;
  }

  /**
   * 話速度の信頼度を計算
   */
  calculateSpeechRateConfidence(wpm, minWPM, maxWPM) {
    const normalRange = maxWPM - minWPM;

    if (wpm < minWPM) {
      // 遅すぎる場合
      const deviation = minWPM - wpm;
      return Math.min(0.9, 0.5 + (deviation / normalRange) * 0.4);
    } else {
      // 早すぎる場合
      const deviation = wpm - maxWPM;
      return Math.min(0.9, 0.5 + (deviation / normalRange) * 0.4);
    }
  }

  /**
   * ポーズ（間）を検出してカット候補を生成
   * @param {Object} speechAnalysis - SpeechRecognizerの解析結果
   * @returns {Array} カット候補配列
   */
  detectPauses(speechAnalysis) {
    if (!this.config.advancedDetection?.pauseDetection?.enabled) {
      return [];
    }

    const candidates = [];
    const { minDuration, maxDuration, bufferBefore, bufferAfter } =
      this.config.advancedDetection.pauseDetection;

    // 全セグメントの単語を収集
    const allWords = [];
    for (const segment of speechAnalysis.segments || []) {
      for (const word of segment.words || []) {
        allWords.push(word);
      }
    }

    // 単語間の間隔からポーズを検出
    for (let i = 1; i < allWords.length; i++) {
      const prevWord = allWords[i - 1];
      const currentWord = allWords[i];
      const gap = currentWord.start - prevWord.end;

      // 設定範囲内のポーズをカット候補に
      if (gap >= minDuration && gap <= maxDuration) {
        candidates.push({
          start: Math.max(0, prevWord.end - bufferBefore),
          end: currentWord.start + bufferAfter,
          duration: gap + bufferBefore + bufferAfter,
          type: 'pause',
          reason: `不自然な間: ${gap.toFixed(2)}秒`,
          confidence: this.calculatePauseConfidence(gap, minDuration, maxDuration),
          metadata: {
            actualPauseDuration: gap,
            prevWord: prevWord.word,
            nextWord: currentWord.word,
          },
        });
      }
    }

    return candidates;
  }

  /**
   * ポーズの信頼度を計算
   */
  calculatePauseConfidence(duration, minDuration, maxDuration) {
    // 長いポーズほど高い信頼度
    const range = maxDuration - minDuration;
    const normalized = (duration - minDuration) / range;
    return Math.min(0.9, 0.5 + normalized * 0.4);
  }

  /**
   * 音声感情を分析してカット候補を生成
   * @param {Object} speechAnalysis - SpeechRecognizerの解析結果
   * @returns {Array} カット候補配列
   */
  analyzeSentiment(speechAnalysis) {
    if (!this.config.advancedDetection?.sentimentAnalysis?.enabled) {
      return [];
    }

    const candidates = [];

    // 基本的な感情分析（テキストベース）
    // 将来的には音声のトーン・ピッチ分析を追加可能
    for (const segment of speechAnalysis.segments || []) {
      const text = segment.text || '';
      const sentiment = this.estimateSentiment(text);

      // 単調な部分（感情変化が少ない）をカット候補に
      if (sentiment.monotone) {
        candidates.push({
          start: segment.start,
          end: segment.end,
          duration: segment.end - segment.start,
          type: 'sentiment',
          reason: '単調な話し方',
          confidence: sentiment.confidence,
          metadata: {
            sentiment: sentiment.type,
            score: sentiment.score,
          },
        });
      }
    }

    return candidates;
  }

  /**
   * テキストから感情を推定（基本的な実装）
   */
  estimateSentiment(text) {
    // 感嘆符や疑問符の数
    const exclamations = (text.match(/[！!]/g) || []).length;
    const questions = (text.match(/[？?]/g) || []).length;

    // フィラーワードの数
    const fillerWords = ['えー', 'あー', 'えっと', 'まあ', 'そうですね'];
    let fillerCount = 0;
    for (const filler of fillerWords) {
      fillerCount += (text.match(new RegExp(filler, 'g')) || []).length;
    }

    // 文の長さ
    const sentenceLength = text.length;

    // スコア計算（簡易版）
    const emotionalScore = exclamations + questions;
    const fillerRatio = fillerCount / Math.max(1, sentenceLength / 10);

    // 単調かどうか判定
    const monotone = emotionalScore === 0 && fillerRatio > 0.3;

    return {
      type: monotone ? 'monotone' : 'expressive',
      monotone: monotone,
      score: emotionalScore,
      confidence: monotone ? Math.min(0.7, fillerRatio) : 0.3,
    };
  }

  /**
   * すべての高度な分析を実行
   * @param {Object} speechAnalysis - SpeechRecognizerの解析結果
   * @returns {Object} 分析結果
   */
  analyzeAll(speechAnalysis) {
    console.log('🔬 高度な音声分析開始...');

    const speechRateCandidates = this.analyzeSpeechRate(speechAnalysis);
    const pauseCandidates = this.detectPauses(speechAnalysis);
    const sentimentCandidates = this.analyzeSentiment(speechAnalysis);

    const allCandidates = [
      ...speechRateCandidates,
      ...pauseCandidates,
      ...sentimentCandidates,
    ];

    console.log(`   - 話速度異常: ${speechRateCandidates.length}個`);
    console.log(`   - 不自然な間: ${pauseCandidates.length}個`);
    console.log(`   - 単調な部分: ${sentimentCandidates.length}個`);
    console.log(`✅ 高度な分析完了: 合計${allCandidates.length}個の候補を検出`);

    return {
      candidates: allCandidates,
      stats: {
        speechRate: speechRateCandidates.length,
        pauses: pauseCandidates.length,
        sentiment: sentimentCandidates.length,
        total: allCandidates.length,
      },
    };
  }

  /**
   * 統計情報を生成
   */
  generateStatistics(analysisResult) {
    return {
      totalAdvancedCandidates: analysisResult.stats.total,
      speechRateIssues: analysisResult.stats.speechRate,
      pauseIssues: analysisResult.stats.pauses,
      sentimentIssues: analysisResult.stats.sentiment,
    };
  }
}
