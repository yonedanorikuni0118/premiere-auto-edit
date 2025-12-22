#!/usr/bin/env node
/**
 * Premiere Auto Edit - CLI Interface
 * 動画の自動カット・テロップ生成ツール
 */

import AutoEditPipeline from './src/core/index.js';
import fs from 'fs-extra';
import path from 'path';

// CLIヘルプ表示
function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🎬 Premiere Auto Edit - 動画自動編集ツール                    ║
╚═══════════════════════════════════════════════════════════════╝

動画を自動でカット・テロップ挿入し、Premiere Proにインポート可能な
XMLファイルを生成します。

【使い方】
  node cli.js <動画ファイルパス> [オプション]

【オプション】
  -o, --output <ディレクトリ>    出力先ディレクトリ (デフォルト: ./output)
  -s, --style <スタイル名>        保存済みのYouTubeスタイルを使用
  -t, --threshold <dB>           無音検出の閾値 (デフォルト: -40dB)
  -c, --chars <数>               テロップの1行最大文字数 (デフォルト: 20)
  -p, --preview                  プレビュー動画を生成
  --with-captions                プレビューに字幕を焼き込む (--previewと併用)
  --output-format <形式>         出力形式 (mp4/mov/avi, デフォルト: mp4)
  -h, --help                     ヘルプを表示

【例】
  # 基本的な使い方
  node cli.js ./my-video.mp4

  # 出力先を指定
  node cli.js ./my-video.mp4 --output ./edited

  # 無音検出の閾値を調整（より多くカット）
  node cli.js ./my-video.mp4 --threshold -35

  # テロップの長さを調整
  node cli.js ./my-video.mp4 --chars 25

  # YouTubeスタイルを使用
  node cli.js ./my-video.mp4 --style my-channel-style

  # プレビュー動画を生成
  node cli.js ./my-video.mp4 --preview

  # 字幕を焼き込んだプレビューを生成
  node cli.js ./my-video.mp4 --preview --with-captions

【出力ファイル】
  ✓ <動画名>_project.xml  - Premiere Pro XMLプロジェクト
  ✓ <動画名>_edl.edl      - EDL (Edit Decision List)
  ✓ <動画名>_project.json - JSONプロジェクト（全情報）
  ✓ <動画名>_report.csv   - 編集レポート
  ✓ <動画名>_preview.mp4  - プレビュー動画 (--previewオプション使用時)

【Premiere Proでの使い方】
  1. Premiere Proを開く
  2. ファイル → 読み込み
  3. 生成された XML ファイルを選択
  4. タイムラインにドラッグ

【必要な設定】
  ✓ OpenAI API Key (.envファイルに設定済み)
  ✓ FFmpeg (npm installで自動インストール)

【トラブルシューティング】
  - API Keyエラー → .envファイルのOPENAI_API_KEYを確認
  - カットが多すぎる → --threshold を -45 など大きくする
  - カットが少なすぎる → --threshold を -35 など小さくする

---
💡 ヒント: config/default.config.js で詳細設定をカスタマイズできます
`);
}

// コマンドライン引数をパース
function parseArgs(args) {
  const options = {
    videoPath: null,
    outputDir: './output',
    styleName: null,
    silenceThreshold: -40,
    maxCharsPerLine: 20,
    generatePreview: false,
    withCaptions: false,
    outputFormat: 'mp4',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      showHelp();
      process.exit(0);
    } else if (arg === '-o' || arg === '--output') {
      options.outputDir = args[++i];
    } else if (arg === '-s' || arg === '--style') {
      options.styleName = args[++i];
    } else if (arg === '-t' || arg === '--threshold') {
      options.silenceThreshold = parseFloat(args[++i]);
    } else if (arg === '-c' || arg === '--chars') {
      options.maxCharsPerLine = parseInt(args[++i], 10);
    } else if (arg === '--preview' || arg === '-p') {
      options.generatePreview = true;
    } else if (arg === '--with-captions') {
      options.withCaptions = true;
    } else if (arg === '--output-format') {
      options.outputFormat = args[++i];
    } else if (!arg.startsWith('-')) {
      options.videoPath = arg;
    }
  }

  return options;
}

// メイン処理
async function main() {
  const args = process.argv.slice(2);

  // 引数がない場合はヘルプを表示
  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const options = parseArgs(args);

  // 動画ファイルが指定されているか確認
  if (!options.videoPath) {
    console.error('\n❌ エラー: 動画ファイルのパスを指定してください\n');
    console.log('使い方: node cli.js <動画ファイルパス> [オプション]');
    console.log('詳細: node cli.js --help\n');
    process.exit(1);
  }

  // ファイルが存在するか確認
  if (!await fs.pathExists(options.videoPath)) {
    console.error(`\n❌ エラー: ファイルが見つかりません: ${options.videoPath}\n`);
    process.exit(1);
  }

  // パイプラインを初期化
  const pipeline = new AutoEditPipeline({
    autoCut: {
      silenceThreshold: options.silenceThreshold,
    },
    caption: {
      maxCharsPerLine: options.maxCharsPerLine,
    },
  });

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🎬 Premiere Auto Edit - 処理開始                              ║
╚═══════════════════════════════════════════════════════════════╝
`);

  console.log('📋 設定:');
  console.log(`   入力動画: ${path.basename(options.videoPath)}`);
  console.log(`   出力先: ${options.outputDir}`);
  console.log(`   無音閾値: ${options.silenceThreshold}dB`);
  console.log(`   テロップ文字数: ${options.maxCharsPerLine}文字/行`);
  if (options.styleName) {
    console.log(`   スタイル: ${options.styleName}`);
  }
  if (options.generatePreview) {
    console.log(`   プレビュー生成: 有効`);
    if (options.withCaptions) {
      console.log(`   字幕焼き込み: 有効`);
    }
    console.log(`   出力形式: ${options.outputFormat}`);
  }
  console.log('');

  try {
    // 処理を実行
    const result = await pipeline.processVideo(options.videoPath, {
      outputDir: options.outputDir,
      styleName: options.styleName,
      generatePreview: options.generatePreview,
      withCaptions: options.withCaptions,
      outputFormat: options.outputFormat,
    });

    if (result.success) {
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  ✅ 処理完了！                                                 ║
╚═══════════════════════════════════════════════════════════════╝

📊 処理結果:
   処理時間: ${result.processingTime}秒
   元の長さ: ${Number(result.cutResult.stats.totalDuration || 0).toFixed(1)}秒
   最終長さ: ${Number(result.cutResult.stats.finalDuration || 0).toFixed(1)}秒
   短縮率: ${result.cutResult.stats.reductionRate || '0%'}
   カット数: ${result.cutResult.stats.totalCuts || 0}
   テロップ数: ${result.captionStats.totalCaptions || 0}

📦 生成されたファイル:
   ✓ ${path.basename(result.exportedFiles.xml)}
   ✓ ${path.basename(result.exportedFiles.edl)}
   ✓ ${path.basename(result.exportedFiles.json)}
   ✓ ${path.basename(result.exportedFiles.csv)}${result.previewVideo ? `\n   ✓ ${path.basename(result.previewVideo)} (プレビュー動画)` : ''}

🎬 次のステップ:${result.previewVideo ? `\n   0. プレビュー動画で確認: ${path.basename(result.previewVideo)}` : ''}
   1. Premiere Proを開く
   2. ファイル → 読み込み
   3. ${path.basename(result.exportedFiles.xml)} を選択

`);
      process.exit(0);
    } else {
      console.error(`\n❌ エラーが発生しました: ${result.error}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ エラーが発生しました: ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 実行
main();
