import { SpeechAnalyzer } from '../analyzers/SpeechAnalyzer.js';

/**
 * 自動カット検出クラス
 * 動画解析と音声認識の結果を統合して、最適なカット位置を決定
 */
export class AutoCutDetector {
  constructor(config) {
    this.config = config;
    this.speechAnalyzer = new SpeechAnalyzer(config);
  }

  /**
   * カット候補を生成
   * @param {Object} videoAnalysis - VideoAnalyzerの解析結果
   * @param {Object} speechAnalysis - SpeechRecognizerの解析結果
   * @returns {Array} カット候補配列 [{start, end, reason, confidence}]
   */
  generateCutCandidates(videoAnalysis, speechAnalysis) {
    const candidates = [];

    // 1. 無音区間からカット候補を生成
    for (const silence of videoAnalysis.silences) {
      if (silence.duration >= this.config.autoCut.silenceMinDuration) {
        candidates.push({
          start: silence.start,
          end: silence.end,
          duration: silence.duration,
          type: 'silence',
          reason: '無音',
          confidence: this.calculateSilenceConfidence(silence.duration),
        });
      }
    }

    // 2. フィラーワードからカット候補を生成
    for (const filler of speechAnalysis.fillerWords) {
      candidates.push({
        start: Math.max(0, filler.start - this.config.autoCut.cutBuffer),
        end: filler.end + this.config.autoCut.cutBuffer,
        duration: filler.end - filler.start,
        type: 'filler',
        reason: `フィラーワード: ${filler.word}`,
        confidence: 0.7,
      });
    }

    // 3. シーン変化からカット候補を生成
    // 設定に応じて実際のカットまたはマーカーとして記録
    for (const sceneTime of videoAnalysis.sceneChanges) {
      const useAscut = this.config.autoCut.useSceneChangesForCuts;
      const buffer = this.config.autoCut.sceneChangeBuffer || 0.05;

      candidates.push({
        start: useAscut ? Math.max(0, sceneTime - buffer) : sceneTime,
        end: useAscut ? sceneTime + buffer : sceneTime,
        duration: useAscut ? buffer * 2 : 0,
        type: 'scene_change',
        reason: 'シーン変化',
        confidence: 0.6,
        isMarker: !useAscut, // useAscut=true なら isMarker=false（実際のカット）
      });
    }

    // カット候補をソート
    return candidates.sort((a, b) => a.start - b.start);
  }

  /**
   * 無音の信頼度を計算
   * より長い無音ほど高い信頼度
   */
  calculateSilenceConfidence(duration) {
    if (duration < 0.5) return 0.3;
    if (duration < 1.0) return 0.6;
    if (duration < 2.0) return 0.8;
    return 0.95;
  }

  /**
   * カット候補をマージ（重複・近接しているものを統合）
   */
  mergeCutCandidates(candidates, mergeThreshold = 0.3) {
    if (candidates.length === 0) return [];

    const merged = [];
    let current = { ...candidates[0] };

    for (let i = 1; i < candidates.length; i++) {
      const next = candidates[i];

      // マーカーはマージせずそのまま保持
      if (current.isMarker) {
        merged.push(current);
        current = { ...next };
        continue;
      }

      // 近接しているか重複している場合はマージ
      if (next.start - current.end <= mergeThreshold) {
        current.end = Math.max(current.end, next.end);
        current.duration = current.end - current.start;
        current.confidence = Math.max(current.confidence, next.confidence);
        current.reason += ` + ${next.reason}`;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * カット候補をフィルタリング（信頼度の低いものを除外）
   */
  filterCutCandidates(candidates, minConfidence = 0.5) {
    return candidates.filter(candidate => {
      // マーカーは保持
      if (candidate.isMarker) return true;
      // 信頼度が閾値以上のもの
      return candidate.confidence >= minConfidence;
    });
  }

  /**
   * 保持すべきクリップを生成（カット候補の逆）
   * @returns {Array} 保持クリップ [{start, end, duration}]
   */
  generateKeepClips(cutCandidates, totalDuration) {
    const keepClips = [];
    let currentTime = 0;

    // カット候補のうち、実際にカットする部分のみ抽出（マーカーを除外）
    const actualCuts = cutCandidates.filter(c => !c.isMarker);

    // カットが1つもない場合は、動画全体を1つのクリップとして保持
    if (actualCuts.length === 0) {
      keepClips.push({
        start: 0,
        end: totalDuration,
        duration: totalDuration,
      });
      return keepClips;
    }

    for (const cut of actualCuts) {
      // カット前の部分を保持
      if (cut.start > currentTime) {
        const duration = cut.start - currentTime;
        // 最小クリップ長以上の場合のみ保持
        if (duration >= this.config.autoCut.minClipDuration) {
          keepClips.push({
            start: currentTime,
            end: cut.start,
            duration: duration,
          });
        }
      }
      currentTime = cut.end;
    }

    // 最後のクリップ
    if (currentTime < totalDuration) {
      const duration = totalDuration - currentTime;
      if (duration >= this.config.autoCut.minClipDuration) {
        keepClips.push({
          start: currentTime,
          end: totalDuration,
          duration: duration,
        });
      }
    }

    return keepClips;
  }

  /**
   * スタイル適用: YouTubeスタイルのカットパターンを適用
   */
  applyCutStyle(cutCandidates, learnedStyle) {
    if (!learnedStyle || !learnedStyle.cutPattern) {
      return cutCandidates;
    }

    const pattern = learnedStyle.cutPattern;
    const styled = [];

    for (const candidate of cutCandidates) {
      const adjusted = { ...candidate };

      // 学習したカット間隔の中央値を参考に調整
      if (pattern.avgCutInterval) {
        // カット位置の微調整ロジックをここに追加
        // 例: リズムを学習したパターンに合わせる
      }

      // シーン変化との相関を考慮
      if (pattern.sceneChangeCorrelation && candidate.type === 'scene_change') {
        adjusted.confidence *= pattern.sceneChangeCorrelation;
      }

      styled.push(adjusted);
    }

    return styled;
  }

  /**
   * 統計情報の生成
   */
  generateStatistics(cutCandidates, keepClips, totalDuration) {
    const actualCuts = cutCandidates.filter(c => !c.isMarker);
    const totalCutDuration = actualCuts.reduce((sum, cut) => sum + cut.duration, 0);
    const totalKeepDuration = keepClips.reduce((sum, clip) => sum + clip.duration, 0);

    return {
      totalDuration: totalDuration.toFixed(2),
      totalCuts: actualCuts.length,
      totalKeepClips: keepClips.length,
      totalCutDuration: totalCutDuration.toFixed(2),
      totalKeepDuration: totalKeepDuration.toFixed(2),
      reductionRate: ((totalCutDuration / totalDuration) * 100).toFixed(2) + '%',
      finalDuration: totalKeepDuration.toFixed(2),
      cutTypes: {
        silence: actualCuts.filter(c => c.type === 'silence').length,
        filler: actualCuts.filter(c => c.type === 'filler').length,
      },
    };
  }

  /**
   * メイン処理: 自動カット検出
   */
  detectCuts(videoAnalysis, speechAnalysis, learnedStyle = null) {
    console.log('✂️  自動カット検出開始...');

    // 1. カット候補を生成
    const rawCandidates = this.generateCutCandidates(videoAnalysis, speechAnalysis);
    console.log(`   - ${rawCandidates.length}個の候補を検出`);

    // 1.5. 高度な分析を実行（有効な場合）
    let advancedCandidates = [];
    if (this.isAdvancedDetectionEnabled()) {
      const advancedResult = this.speechAnalyzer.analyzeAll(speechAnalysis);
      advancedCandidates = advancedResult.candidates;
    }

    // すべてのカット候補を統合
    const allCandidates = [...rawCandidates, ...advancedCandidates];

    // 2. カット候補をマージ
    const mergedCandidates = this.mergeCutCandidates(allCandidates);
    console.log(`   - ${mergedCandidates.length}個にマージ`);

    // 3. フィルタリング
    const filteredCandidates = this.filterCutCandidates(mergedCandidates);
    console.log(`   - ${filteredCandidates.length}個にフィルタリング`);

    // 4. スタイル適用（オプション）
    const styledCandidates = learnedStyle
      ? this.applyCutStyle(filteredCandidates, learnedStyle)
      : filteredCandidates;

    // 5. 保持クリップを生成
    const keepClips = this.generateKeepClips(styledCandidates, videoAnalysis.duration);
    console.log(`   - ${keepClips.length}個のクリップを保持`);

    // 6. 統計情報
    const stats = this.generateStatistics(styledCandidates, keepClips, videoAnalysis.duration);

    console.log(`✅ カット検出完了: ${stats.reductionRate}短縮`);

    return {
      cutCandidates: styledCandidates,
      keepClips,
      stats,
    };
  }

  /**
   * 高度な検出機能が有効かチェック
   */
  isAdvancedDetectionEnabled() {
    const config = this.config.advancedDetection;
    if (!config) return false;

    return (
      config.speechRateAnalysis?.enabled ||
      config.pauseDetection?.enabled ||
      config.sentimentAnalysis?.enabled
    );
  }
}
