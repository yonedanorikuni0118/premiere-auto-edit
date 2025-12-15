# Premiere Pro 自動編集ツール

MP4/MOV動画を自動でカット・テロップ挿入し、Premiere Proにインポート可能な形式で出力するツールです。

## 特徴

### 🎬 自動カット機能
- **無音検出**: 無駄な沈黙部分を自動削除
- **フィラーワード除去**: 「えー」「あー」などの不要な言葉をカット
- **シーン変化検出**: カメラアングルの変更を検出

### 📝 自動テロップ生成
- **高精度音声認識**: OpenAI Whisper APIで日本語を正確に文字起こし
- **タイムスタンプ付き**: 発話タイミングに合わせた字幕生成
- **自動整形**: 読みやすい長さに自動分割

### 🎓 YouTubeスタイル学習
- **編集スタイルの模倣**: 好きなYouTubeチャンネルのカット感を学習
- **パターン分析**: カット間隔、テロップタイミングを統計的に解析
- **スタイル保存**: 学習したスタイルを保存して再利用

### 🔧 Premiere Pro統合
- **XML/EDLエクスポート**: Premiere Proに直接インポート可能
- **完全な編集情報**: カット位置、テロップ、スタイル情報を保持
- **レポート生成**: 編集内容の詳細なCSVレポート

## インストール

### 1. 前提条件

- **Node.js** (v18以上)
- **FFmpeg** (システムにインストール済み)
- **OpenAI API Key** (Whisper使用のため)

### 2. セットアップ

\`\`\`bash
# リポジトリをクローン
cd premiere-auto-edit

# 依存パッケージをインストール
npm install

# 環境変数を設定
export OPENAI_API_KEY="your-api-key-here"
\`\`\`

## 使い方

### 基本的な使用方法

\`\`\`bash
# シンプルな自動編集
node src/core/index.js ./your-video.mp4

# 出力先を指定
node src/core/index.js ./your-video.mp4 --output-dir ./my-output
\`\`\`

### YouTubeスタイルを学習して使用

#### ステップ1: スタイルを学習

\`\`\`javascript
import AutoEditPipeline from './src/core/index.js';

const pipeline = new AutoEditPipeline();

// YouTubeチャンネルの動画URLから学習
const videoUrls = [
  'https://www.youtube.com/watch?v=VIDEO_ID_1',
  'https://www.youtube.com/watch?v=VIDEO_ID_2',
  'https://www.youtube.com/watch?v=VIDEO_ID_3',
];

await pipeline.learnStyle(videoUrls, 'my-favorite-channel');
\`\`\`

#### ステップ2: 学習したスタイルで編集

\`\`\`bash
node src/core/index.js ./your-video.mp4 --style-name my-favorite-channel
\`\`\`

### プログラムから使用

\`\`\`javascript
import AutoEditPipeline from './src/core/index.js';

const pipeline = new AutoEditPipeline({
  // カスタム設定（オプション）
  autoCut: {
    silenceThreshold: -35, // 無音検出の閾値を調整
    minClipDuration: 1.5,  // 最小クリップ長を調整
  },
  caption: {
    maxCharsPerLine: 25,   // 1行の最大文字数
  },
});

// 動画を処理
const result = await pipeline.processVideo('./video.mp4', {
  styleName: 'my-style',  // 保存済みスタイルを使用
  outputDir: './output',
});

console.log('処理完了:', result);
\`\`\`

## 出力ファイル

処理完了後、以下のファイルが生成されます:

```
output/
├── video_project.xml      # Premiere Pro XMLプロジェクト
├── video_edl.edl          # EDL (Edit Decision List)
├── video_project.json     # JSONプロジェクト（全情報）
└── video_report.csv       # 編集レポート
```

### Premiere Proへのインポート

1. Premiere Proを開く
2. `ファイル` → `読み込み` を選択
3. 生成された `video_project.xml` を選択
4. カット済み映像とテロップが自動的に配置されます

## 設定

`config/default.config.js` で詳細な設定が可能:

### 自動カット設定

\`\`\`javascript
autoCut: {
  silenceThreshold: -40,       // 無音検出の閾値（dB）
  silenceMinDuration: 0.5,     // 無音の最小継続時間（秒）
  cutBuffer: 0.1,              // カット前後のバッファ（秒）
  fillerWords: ['えー', 'あー'], // フィラーワード
  minClipDuration: 1.0,        // 最小クリップ長（秒）
}
\`\`\`

### テロップ設定

\`\`\`javascript
caption: {
  maxCharsPerLine: 20,         // 1行の最大文字数
  maxLines: 2,                 // 最大行数
  defaultStyle: {
    fontSize: 48,
    fontFamily: 'Arial',
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 3,
    position: 'bottom',        // 'top', 'middle', 'bottom'
    yOffset: 100,
  },
}
\`\`\`

## アーキテクチャ

\`\`\`
src/
├── core/
│   └── index.js              # メインパイプライン
├── analyzers/
│   ├── VideoAnalyzer.js      # 動画解析（FFmpeg）
│   └── SpeechRecognizer.js   # 音声認識（Whisper）
├── generators/
│   ├── AutoCutDetector.js    # 自動カット検出
│   └── CaptionGenerator.js   # テロップ生成
├── learners/
│   └── YouTubeStyleLearner.js # スタイル学習
└── premiere/
    └── PremiereIntegration.js # Premiere Pro連携
\`\`\`

## 処理フロー

\`\`\`
1. 動画読み込み
   ↓
2. 動画解析（無音、シーン変化検出）
   ↓
3. 音声認識（Whisper API）
   ↓
4. カット候補生成
   ↓
5. スタイル適用（オプション）
   ↓
6. テロップ生成
   ↓
7. Premiere Pro用ファイル出力
\`\`\`

## トラブルシューティング

### FFmpegが見つからない

\`\`\`bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
# https://ffmpeg.org/download.html からダウンロード
\`\`\`

### OpenAI API Keyエラー

環境変数が設定されているか確認:

\`\`\`bash
echo $OPENAI_API_KEY
\`\`\`

または、コード内で直接設定:

\`\`\`javascript
const pipeline = new AutoEditPipeline({
  openai: {
    apiKey: 'your-api-key-here',
  },
});
\`\`\`

### メモリ不足エラー

大きな動画ファイルの場合、Node.jsのメモリ上限を増やす:

\`\`\`bash
node --max-old-space-size=4096 src/core/index.js video.mp4
\`\`\`

## 今後の拡張予定

- [ ] CEP拡張機能開発（Premiere Proパネル）
- [ ] リアルタイムプレビュー機能
- [ ] GPTによる要約テロップ生成
- [ ] 複数話者の識別
- [ ] BGM・効果音の自動挿入
- [ ] モーショングラフィックステンプレート対応

## ライセンス

MIT License

## クレジット

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Developed with Claude Sonnet 4.5

---

## 例: 完全な使用フロー

\`\`\`javascript
import AutoEditPipeline from './src/core/index.js';

async function main() {
  const pipeline = new AutoEditPipeline();

  // 1. YouTubeチャンネルのスタイルを学習
  console.log('スタイル学習中...');
  await pipeline.learnStyle([
    'https://www.youtube.com/watch?v=EXAMPLE1',
    'https://www.youtube.com/watch?v=EXAMPLE2',
  ], 'my-channel-style');

  // 2. 学習したスタイルで動画を編集
  console.log('動画編集中...');
  const result = await pipeline.processVideo('./raw-video.mp4', {
    styleName: 'my-channel-style',
    outputDir: './edited',
  });

  if (result.success) {
    console.log('✅ 編集完了!');
    console.log('カット数:', result.cutResult.stats.totalCuts);
    console.log('短縮率:', result.cutResult.stats.reductionRate);
    console.log('テロップ数:', result.captionStats.totalCaptions);
  }
}

main();
\`\`\`
