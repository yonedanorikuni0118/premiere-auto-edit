import config from '../../config/default.config.js';
import { VideoAnalyzer } from '../analyzers/VideoAnalyzer.js';
import { SpeechRecognizer } from '../analyzers/SpeechRecognizer.js';
import { AutoCutDetector } from '../generators/AutoCutDetector.js';
import { CaptionGenerator } from '../generators/CaptionGenerator.js';
import { YouTubeStyleLearner } from '../learners/YouTubeStyleLearner.js';
import { PremiereIntegration } from '../premiere/PremiereIntegration.js';

/**
 * メインの自動編集パイプライン
 */
export class AutoEditPipeline {
  constructor(customConfig = {}) {
    this.config = { ...config, ...customConfig };

    // 各モジュールを初期化
    this.videoAnalyzer = new VideoAnalyzer(this.config);
    this.speechRecognizer = new SpeechRecognizer(this.config);
    this.autoCutDetector = new AutoCutDetector(this.config);
    this.captionGenerator = new CaptionGenerator(this.config);
    this.styleLearner = new YouTubeStyleLearner(this.config);
    this.premiereIntegration = new PremiereIntegration(this.config);
  }

  /**
   * 完全自動編集パイプライン
   * @param {string} videoPath - 入力動画パス
   * @param {Object} options - オプション
   * @returns {Object} 編集結果
   */
  async processVideo(videoPath, options = {}) {
    console.log('\n🎬 ====== 自動編集開始 ======\n');
    console.log(`📹 入力動画: ${videoPath}\n`);

    const startTime = Date.now();

    try {
      // 1. 動画解析
      console.log('【ステップ 1/5】動画解析');
      const videoAnalysis = await this.videoAnalyzer.analyzeVideo(videoPath);

      // 2. 音声抽出と認識
      console.log('\n【ステップ 2/5】音声認識・文字起こし');
      const audioPath = await this.videoAnalyzer.extractAudio(videoPath);
      const speechAnalysis = await this.speechRecognizer.analyzeSpeech(audioPath);

      console.log(`\n📊 音声解析統計:`);
      console.log(`   - 総単語数: ${speechAnalysis.stats.totalWords}`);
      console.log(`   - セグメント数: ${speechAnalysis.stats.totalSegments}`);
      console.log(`   - フィラーワード: ${speechAnalysis.stats.fillerWordCount}個`);
      console.log(`   - 話速: ${speechAnalysis.stats.speakingRate}文字/秒`);

      // 3. スタイル学習（オプション）
      console.log('\n【ステップ 3/5】スタイル適用');
      let learnedStyle = null;
      if (options.styleUrls && options.styleUrls.length > 0) {
        console.log(`   YouTubeスタイル学習: ${options.styleUrls.length}本の動画から学習`);
        learnedStyle = await this.styleLearner.learnFromVideos(options.styleUrls);
      } else if (options.styleName) {
        console.log(`   保存済みスタイル読み込み: ${options.styleName}`);
        learnedStyle = await this.styleLearner.loadStyle(options.styleName);
      } else {
        console.log('   デフォルトスタイルを使用');
      }

      // 4. 自動カット検出
      console.log('\n【ステップ 4/5】自動カット検出');
      const cutResult = this.autoCutDetector.detectCuts(
        videoAnalysis,
        speechAnalysis,
        learnedStyle
      );

      console.log(`\n✂️  カット統計:`);
      console.log(`   - 元の長さ: ${cutResult.stats.totalDuration}秒`);
      console.log(`   - カット数: ${cutResult.stats.totalCuts}`);
      console.log(`   - 保持クリップ数: ${cutResult.stats.totalKeepClips}`);
      console.log(`   - 短縮率: ${cutResult.stats.reductionRate}`);
      console.log(`   - 最終長さ: ${cutResult.stats.finalDuration}秒`);

      // 5. テロップ生成
      console.log('\n【ステップ 5/5】テロップ生成');
      const captions = this.captionGenerator.generateCaptions(
        speechAnalysis.captions,
        learnedStyle
      );

      const captionStats = this.captionGenerator.generateStatistics(captions);
      console.log(`\n📝 テロップ統計:`);
      console.log(`   - 総数: ${captionStats.totalCaptions}`);
      console.log(`   - 平均長さ: ${captionStats.avgTextLength}文字`);
      console.log(`   - 平均表示時間: ${captionStats.avgDuration}秒`);

      // 6. Premiere Pro用にエクスポート
      console.log('\n【エクスポート】Premiere Proファイル生成');
      const outputDir = options.outputDir || './output';
      const exportedFiles = await this.premiereIntegration.exportAll(
        outputDir,
        videoPath,
        cutResult.keepClips,
        cutResult.cutCandidates,
        captions,
        cutResult.stats
      );

      // 完了
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✅ ====== 処理完了 (${elapsedTime}秒) ======\n`);

      // 一時ファイルのクリーンアップ
      await this.cleanup();

      return {
        success: true,
        videoAnalysis,
        speechAnalysis,
        cutResult,
        captions,
        captionStats,
        exportedFiles,
        processingTime: elapsedTime,
      };
    } catch (error) {
      console.error('\n❌ エラーが発生しました:', error.message);
      console.error(error.stack);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * YouTubeスタイルを学習して保存
   */
  async learnStyle(videoUrls, styleName = 'default') {
    console.log(`\n🎓 スタイル学習: ${styleName}`);
    const style = await this.styleLearner.learnFromVideos(videoUrls);
    await this.styleLearner.saveStyle(style, styleName);
    return style;
  }

  /**
   * 一時ファイルのクリーンアップ
   */
  async cleanup() {
    await this.videoAnalyzer.cleanup();
  }
}

// CLIから直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.log(`
使い方:
  node src/core/index.js <動画ファイルパス> [オプション]

オプション:
  --style-name <名前>    保存済みスタイルを使用
  --output-dir <パス>    出力ディレクトリ

例:
  node src/core/index.js ./video.mp4
  node src/core/index.js ./video.mp4 --style-name youtube-style --output-dir ./output
`);
      process.exit(0);
    }

    const videoPath = args[0];
    const options = {};

    // オプションをパース
    for (let i = 1; i < args.length; i += 2) {
      const key = args[i].replace(/^--/, '');
      const value = args[i + 1];
      options[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }

    // パイプライン実行
    const pipeline = new AutoEditPipeline();
    const result = await pipeline.processVideo(videoPath, options);

    process.exit(result.success ? 0 : 1);
  })();
}

export default AutoEditPipeline;
