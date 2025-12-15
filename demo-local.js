/**
 * ローカルWhisperを使用したデモスクリプト
 * OpenAI API不要で完全無料で動作
 */

import config from './config/default.config.js';
import { VideoAnalyzer } from './src/analyzers/VideoAnalyzer.js';
import { LocalWhisperRecognizer } from './src/analyzers/LocalWhisperRecognizer.js';
import { AutoCutDetector } from './src/generators/AutoCutDetector.js';
import { CaptionGenerator } from './src/generators/CaptionGenerator.js';
import { PremiereIntegration } from './src/premiere/PremiereIntegration.js';

async function demo() {
  console.log('🎬 Premiere Pro 自動編集ツール - ローカルWhisper版\n');
  console.log('✅ OpenAI API不要 - 完全無料で動作します\n');

  const videoPath = process.argv[2];

  if (!videoPath) {
    console.log('使い方: node demo-local.js <動画ファイルパス>');
    console.log('例: node demo-local.js ./my-video.mp4\n');
    process.exit(1);
  }

  console.log('処理を開始します...\n');
  console.log('このデモでは、以下の処理を行います:');
  console.log('1. 動画の解析（無音、シーン変化検出）');
  console.log('2. 音声認識（ローカルWhisper - 初回は数分かかります）');
  console.log('3. 自動カット候補の生成');
  console.log('4. テロップの自動生成');
  console.log('5. Premiere Pro用ファイルの出力\n');

  const startTime = Date.now();

  try {
    // モジュール初期化
    const videoAnalyzer = new VideoAnalyzer(config);
    const speechRecognizer = new LocalWhisperRecognizer(config);
    const autoCutDetector = new AutoCutDetector(config);
    const captionGenerator = new CaptionGenerator(config);
    const premiereIntegration = new PremiereIntegration(config);

    // 1. 動画解析
    console.log('\n🎬 ====== 自動編集開始 ======\n');
    console.log(`📹 入力動画: ${videoPath}\n`);
    console.log('【ステップ 1/5】動画解析');
    const videoAnalysis = await videoAnalyzer.analyzeVideo(videoPath);

    // 2. 音声抽出と認識
    console.log('\n【ステップ 2/5】音声認識・文字起こし（ローカルWhisper）');
    const audioPath = await videoAnalyzer.extractAudio(videoPath);
    const speechAnalysis = await speechRecognizer.analyzeSpeech(audioPath);

    console.log(`\n📊 音声解析統計:`);
    console.log(`   - 総単語数: ${speechAnalysis.stats.totalWords}`);
    console.log(`   - セグメント数: ${speechAnalysis.stats.totalSegments}`);
    console.log(`   - フィラーワード: ${speechAnalysis.stats.fillerWordCount}個`);
    console.log(`   - 話速: ${speechAnalysis.stats.speakingRate}文字/秒`);

    // 3. 自動カット検出
    console.log('\n【ステップ 3/5】自動カット検出');
    const cutResult = autoCutDetector.detectCuts(videoAnalysis, speechAnalysis);

    console.log(`\n✂️  カット統計:`);
    console.log(`   - 元の長さ: ${cutResult.stats.totalDuration}秒`);
    console.log(`   - カット数: ${cutResult.stats.totalCuts}`);
    console.log(`   - 保持クリップ数: ${cutResult.stats.totalKeepClips}`);
    console.log(`   - 短縮率: ${cutResult.stats.reductionRate}`);
    console.log(`   - 最終長さ: ${cutResult.stats.finalDuration}秒`);

    // 4. テロップ生成
    console.log('\n【ステップ 4/5】テロップ生成');
    const captions = captionGenerator.generateCaptions(speechAnalysis.captions);
    const captionStats = captionGenerator.generateStatistics(captions);

    console.log(`\n📝 テロップ統計:`);
    console.log(`   - 総数: ${captionStats.totalCaptions}`);
    console.log(`   - 平均長さ: ${captionStats.avgTextLength}文字`);
    console.log(`   - 平均表示時間: ${captionStats.avgDuration}秒`);

    // 5. Premiere Pro用にエクスポート
    console.log('\n【ステップ 5/5】Premiere Proファイル生成');
    const outputDir = './output';
    const exportedFiles = await premiereIntegration.exportAll(
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
    await videoAnalyzer.cleanup();

    // 結果サマリー
    console.log('\n✨ ====== 結果サマリー ======\n');
    console.log(`📊 処理時間: ${elapsedTime}秒`);
    console.log(`✂️  カット数: ${cutResult.stats.totalCuts}`);
    console.log(`📏 短縮率: ${cutResult.stats.reductionRate}`);
    console.log(`📝 テロップ数: ${captionStats.totalCaptions}`);
    console.log(`\n📦 出力ファイル:`);
    console.log(`   - XML: ${exportedFiles.xml}`);
    console.log(`   - JSON: ${exportedFiles.json}`);
    console.log(`   - CSV: ${exportedFiles.csv}`);
    console.log(`\n🎉 完了！Premiere Proでインポートできます。`);

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    console.error('\nヒント:');
    console.error('- Whisperがインストールされているか確認してください');
    console.error('- 動画ファイルのパスが正しいか確認してください');
    console.error('- FFmpegがインストールされているか確認してください');
    process.exit(1);
  }
}

demo();
