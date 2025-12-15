/**
 * セットアップ確認スクリプト
 * 動画ファイルなしで、必要なモジュールが正しく動作するか確認
 */

import 'dotenv/config';

console.log('🔍 セットアップ確認中...\n');

// 1. 環境変数の確認
console.log('【1】環境変数');
if (process.env.OPENAI_API_KEY) {
  const masked = process.env.OPENAI_API_KEY.substring(0, 10) + '***';
  console.log(`✅ OPENAI_API_KEY: ${masked}`);
} else {
  console.log('❌ OPENAI_API_KEY が設定されていません');
}

// 2. FFmpegの確認
console.log('\n【2】FFmpeg');
try {
  const ffmpegPath = await import('@ffmpeg-installer/ffmpeg');
  console.log(`✅ FFmpeg: ${ffmpegPath.path}`);
} catch (error) {
  console.log('❌ FFmpeg パッケージが見つかりません');
}

// 3. 必要なモジュールの読み込み確認
console.log('\n【3】モジュール');
try {
  const { VideoAnalyzer } = await import('./src/analyzers/VideoAnalyzer.js');
  console.log('✅ VideoAnalyzer');

  const { SpeechRecognizer } = await import('./src/analyzers/SpeechRecognizer.js');
  console.log('✅ SpeechRecognizer');

  const { AutoCutDetector } = await import('./src/generators/AutoCutDetector.js');
  console.log('✅ AutoCutDetector');

  const { CaptionGenerator } = await import('./src/generators/CaptionGenerator.js');
  console.log('✅ CaptionGenerator');

  const { YouTubeStyleLearner } = await import('./src/learners/YouTubeStyleLearner.js');
  console.log('✅ YouTubeStyleLearner');

  const { PremiereIntegration } = await import('./src/premiere/PremiereIntegration.js');
  console.log('✅ PremiereIntegration');

  const AutoEditPipeline = await import('./src/core/index.js');
  console.log('✅ AutoEditPipeline');
} catch (error) {
  console.log('❌ モジュール読み込みエラー:', error.message);
}

console.log('\n【4】設定ファイル');
try {
  const config = await import('./config/default.config.js');
  console.log('✅ 設定ファイル読み込み成功');
  console.log(`   - 音声認識モデル: ${config.default.openai.model}`);
  console.log(`   - 言語: ${config.default.openai.language}`);
  console.log(`   - 無音閾値: ${config.default.autoCut.silenceThreshold}dB`);
} catch (error) {
  console.log('❌ 設定ファイルエラー:', error.message);
}

console.log('\n✅ セットアップ確認完了！');
console.log('\n📝 次のステップ:');
console.log('   1. MP4またはMOVファイルを用意');
console.log('   2. node demo.js ファイルパス で実行');
console.log('\n例:');
console.log('   node demo.js ~/Desktop/my-video.mp4');
