/**
 * 使用例: Premiere Pro自動編集ツール
 */

import AutoEditPipeline from './src/core/index.js';

// 例1: 基本的な使用方法
async function basicExample() {
  console.log('\n=== 例1: 基本的な自動編集 ===\n');

  const pipeline = new AutoEditPipeline();

  // 動画を処理（デフォルト設定）
  const result = await pipeline.processVideo('./test-video.mp4', {
    outputDir: './output',
  });

  if (result.success) {
    console.log('\n✅ 成功!');
    console.log('処理時間:', result.processingTime, '秒');
    console.log('エクスポートファイル:', result.exportedFiles);
  }
}

// 例2: カスタム設定で使用
async function customConfigExample() {
  console.log('\n=== 例2: カスタム設定での編集 ===\n');

  const pipeline = new AutoEditPipeline({
    autoCut: {
      silenceThreshold: -35,  // より敏感な無音検出
      minClipDuration: 2.0,   // 最小クリップ長を長めに
      fillerWords: ['えー', 'あー', 'えっと', 'その', 'まあ'],
    },
    caption: {
      maxCharsPerLine: 25,
      defaultStyle: {
        fontSize: 56,
        color: '#FFFF00',  // 黄色
        strokeColor: '#000000',
        strokeWidth: 4,
        position: 'bottom',
      },
    },
  });

  const result = await pipeline.processVideo('./test-video.mp4');

  if (result.success) {
    console.log('カット数:', result.cutResult.stats.totalCuts);
    console.log('短縮率:', result.cutResult.stats.reductionRate);
  }
}

// 例3: YouTubeスタイル学習
async function youtubeStyleExample() {
  console.log('\n=== 例3: YouTubeスタイル学習と適用 ===\n');

  const pipeline = new AutoEditPipeline();

  // ステップ1: YouTubeチャンネルのスタイルを学習
  console.log('📚 スタイル学習中...');

  const sampleVideos = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',  // サンプルURL
    // 実際には分析したいYouTubeチャンネルのURLを追加
  ];

  try {
    const style = await pipeline.learnStyle(sampleVideos, 'my-youtube-style');
    console.log('学習完了:', style);

    // ステップ2: 学習したスタイルを適用して編集
    console.log('\n🎬 学習したスタイルで編集中...');
    const result = await pipeline.processVideo('./test-video.mp4', {
      styleName: 'my-youtube-style',
      outputDir: './output-styled',
    });

    if (result.success) {
      console.log('✅ スタイル適用編集完了!');
    }
  } catch (error) {
    console.error('エラー:', error.message);
    console.log('ℹ️  YouTube動画のダウンロードには時間がかかる場合があります');
  }
}

// 例4: 詳細な解析結果の確認
async function detailedAnalysisExample() {
  console.log('\n=== 例4: 詳細解析 ===\n');

  const pipeline = new AutoEditPipeline();

  const result = await pipeline.processVideo('./test-video.mp4');

  if (result.success) {
    console.log('\n📊 動画解析結果:');
    console.log('---');
    console.log('総時間:', result.videoAnalysis.duration, '秒');
    console.log('無音区間数:', result.videoAnalysis.silences.length);
    console.log('シーン変化数:', result.videoAnalysis.sceneChanges.length);

    console.log('\n🎤 音声認識結果:');
    console.log('---');
    console.log('総単語数:', result.speechAnalysis.stats.totalWords);
    console.log('フィラーワード数:', result.speechAnalysis.stats.fillerWordCount);
    console.log('話速:', result.speechAnalysis.stats.speakingRate, '文字/秒');

    console.log('\n✂️ カット結果:');
    console.log('---');
    console.log('カット数:', result.cutResult.stats.totalCuts);
    console.log('保持クリップ数:', result.cutResult.stats.totalKeepClips);
    console.log('短縮率:', result.cutResult.stats.reductionRate);
    console.log('最終長さ:', result.cutResult.stats.finalDuration, '秒');

    console.log('\n📝 テロップ統計:');
    console.log('---');
    console.log('総数:', result.captionStats.totalCaptions);
    console.log('平均文字数:', result.captionStats.avgTextLength);
    console.log('平均表示時間:', result.captionStats.avgDuration, '秒');

    // 最初の5つのテロップを表示
    console.log('\nテロップサンプル（最初の5つ）:');
    result.captions.slice(0, 5).forEach(caption => {
      console.log(`  [${caption.start.toFixed(2)}s - ${caption.end.toFixed(2)}s] ${caption.text}`);
    });
  }
}

// 例5: バッチ処理
async function batchProcessExample() {
  console.log('\n=== 例5: 複数動画のバッチ処理 ===\n');

  const pipeline = new AutoEditPipeline();

  const videos = [
    './video1.mp4',
    './video2.mp4',
    './video3.mp4',
  ];

  const results = [];

  for (const video of videos) {
    console.log(`\n処理中: ${video}`);
    try {
      const result = await pipeline.processVideo(video, {
        outputDir: `./output/${video.replace('.mp4', '')}`,
      });
      results.push({ video, success: result.success });
    } catch (error) {
      console.error(`エラー (${video}):`, error.message);
      results.push({ video, success: false, error: error.message });
    }
  }

  console.log('\n📋 バッチ処理結果:');
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`  ${status} ${r.video}`);
  });
}

// メイン実行
async function main() {
  const examples = {
    '1': basicExample,
    '2': customConfigExample,
    '3': youtubeStyleExample,
    '4': detailedAnalysisExample,
    '5': batchProcessExample,
  };

  // コマンドライン引数から例を選択
  const exampleNum = process.argv[2] || '1';

  if (examples[exampleNum]) {
    try {
      await examples[exampleNum]();
    } catch (error) {
      console.error('\n❌ エラー:', error.message);
      console.error(error.stack);
    }
  } else {
    console.log(`
使用方法:
  node example.js [例番号]

利用可能な例:
  1 - 基本的な自動編集
  2 - カスタム設定での編集
  3 - YouTubeスタイル学習と適用
  4 - 詳細な解析結果の確認
  5 - 複数動画のバッチ処理

例:
  node example.js 1
  node example.js 3
`);
  }
}

// 実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
