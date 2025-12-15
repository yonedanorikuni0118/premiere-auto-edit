/**
 * デモスクリプト - シンプルな使用例
 */

import AutoEditPipeline from './src/core/index.js';

async function demo() {
  console.log('🎬 Premiere Pro 自動編集ツール - デモ\n');

  // パイプラインを初期化
  const pipeline = new AutoEditPipeline({
    // カスタム設定（オプション）
    autoCut: {
      silenceThreshold: -40,
      minClipDuration: 1.0,
    },
    caption: {
      maxCharsPerLine: 20,
      defaultStyle: {
        fontSize: 48,
        color: '#FFFFFF',
        position: 'bottom',
      },
    },
  });

  // デモ用の説明
  console.log('このデモでは、以下の処理を行います:');
  console.log('1. 動画の解析（無音、シーン変化検出）');
  console.log('2. 音声認識（Whisper API）');
  console.log('3. 自動カット候補の生成');
  console.log('4. テロップの自動生成');
  console.log('5. Premiere Pro用ファイルの出力\n');

  // 動画ファイルのパスを指定
  const videoPath = process.argv[2];

  if (!videoPath) {
    console.log('使い方: node demo.js <動画ファイルパス>');
    console.log('例: node demo.js ./my-video.mp4\n');
    console.log('⚠️  動画ファイルのパスを指定してください');
    process.exit(1);
  }

  try {
    // 処理を実行
    const result = await pipeline.processVideo(videoPath, {
      outputDir: './output',
    });

    if (result.success) {
      console.log('\n✨ ====== 結果サマリー ======\n');
      console.log(`📊 処理時間: ${result.processingTime}秒`);
      console.log(`✂️  カット数: ${result.cutResult.stats.totalCuts}`);
      console.log(`📏 短縮率: ${result.cutResult.stats.reductionRate}`);
      console.log(`📝 テロップ数: ${result.captionStats.totalCaptions}`);
      console.log(`\n📦 出力ファイル:`);
      console.log(`   - XML: ${result.exportedFiles.xml}`);
      console.log(`   - JSON: ${result.exportedFiles.json}`);
      console.log(`   - CSV: ${result.exportedFiles.csv}`);
      console.log(`\n🎉 完了！Premiere Proでインポートできます。`);
    } else {
      console.error('\n❌ エラーが発生しました:', result.error);
    }
  } catch (error) {
    console.error('\n❌ エラー:', error.message);
    console.error('\nヒント:');
    console.error('- OpenAI API Keyが設定されているか確認してください');
    console.error('- 動画ファイルのパスが正しいか確認してください');
    console.error('- FFmpegがインストールされているか確認してください');
  }
}

demo();
