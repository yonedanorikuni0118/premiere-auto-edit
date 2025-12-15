# クイックスタートガイド

## セットアップ（5分）

### 1. 前提条件のインストール

#### Node.js
- https://nodejs.org/ から最新版（v18以上）をダウンロード・インストール

#### FFmpeg

**macOS:**
\`\`\`bash
brew install ffmpeg
\`\`\`

**Windows:**
1. https://ffmpeg.org/download.html からダウンロード
2. PATHに追加

**Linux (Ubuntu/Debian):**
\`\`\`bash
sudo apt-get update
sudo apt-get install ffmpeg
\`\`\`

確認:
\`\`\`bash
ffmpeg -version
\`\`\`

### 2. OpenAI API Keyの取得

1. https://platform.openai.com/ にアクセス
2. アカウント作成 / ログイン
3. API Keys セクションから新しいキーを作成
4. キーをコピー

### 3. プロジェクトのセットアップ

\`\`\`bash
# ディレクトリに移動
cd premiere-auto-edit

# 依存パッケージをインストール
npm install

# 環境変数ファイルを作成
cp .env.example .env

# .envファイルを編集してAPIキーを設定
# OPENAI_API_KEY=your_actual_api_key
\`\`\`

### 4. 動作確認

\`\`\`bash
# テスト動画を用意（または既存の動画を使用）
# ./test-video.mp4

# 実行
node src/core/index.js ./test-video.mp4
\`\`\`

## 基本的な使い方

### パターン1: シンプルな自動編集

\`\`\`bash
node src/core/index.js your-video.mp4
\`\`\`

出力:
- `output/your-video_project.xml` - Premiere Proにインポート
- `output/your-video_project.json` - 全情報
- `output/your-video_report.csv` - レポート

### パターン2: YouTubeスタイルを学習

\`\`\`javascript
// learn-style.js を作成
import AutoEditPipeline from './src/core/index.js';

const pipeline = new AutoEditPipeline();

await pipeline.learnStyle([
  'https://www.youtube.com/watch?v=VIDEO_ID_1',
  'https://www.youtube.com/watch?v=VIDEO_ID_2',
  'https://www.youtube.com/watch?v=VIDEO_ID_3',
], 'channel-name');
\`\`\`

実行:
\`\`\`bash
node learn-style.js
\`\`\`

学習したスタイルを使用:
\`\`\`bash
node src/core/index.js your-video.mp4 --style-name channel-name
\`\`\`

### パターン3: Premiere Proへのインポート

1. Premiere Proを開く
2. **ファイル → 読み込み**
3. `output/your-video_project.xml` を選択
4. プロジェクトパネルに追加される
5. タイムラインにドラッグ＆ドロップ

## よくある質問

### Q: エラー「OPENAI_API_KEY is not set」

A: 環境変数が設定されていません。

\`\`\`bash
# 一時的に設定（現在のセッションのみ）
export OPENAI_API_KEY="your-key"

# または .env ファイルに記載
echo "OPENAI_API_KEY=your-key" > .env
\`\`\`

### Q: エラー「ffmpeg not found」

A: FFmpegがインストールされていないか、PATHに追加されていません。

\`\`\`bash
# 確認
which ffmpeg

# macOS
brew install ffmpeg

# Windows
# ffmpeg.exe をダウンロードして PATH に追加
\`\`\`

### Q: 処理に時間がかかりすぎる

A: 動画の長さによります。目安:
- 5分の動画 → 約1-2分
- 20分の動画 → 約5-8分
- 60分の動画 → 約15-25分

OpenAI APIの呼び出しに時間がかかります。

### Q: カットが多すぎる / 少なすぎる

A: 設定を調整してください:

\`\`\`javascript
const pipeline = new AutoEditPipeline({
  autoCut: {
    silenceThreshold: -35,  // デフォルト: -40 (小さいほど敏感)
    minClipDuration: 2.0,   // デフォルト: 1.0 (大きいほど長めに保持)
  },
});
\`\`\`

### Q: テロップの位置やスタイルを変更したい

A: `config/default.config.js` を編集:

\`\`\`javascript
caption: {
  defaultStyle: {
    fontSize: 48,          // フォントサイズ
    color: '#FFFFFF',      // 色
    strokeColor: '#000000', // 縁取り色
    strokeWidth: 3,        // 縁取り幅
    position: 'bottom',    // 位置: 'top', 'middle', 'bottom'
    yOffset: 100,          // オフセット
  },
}
\`\`\`

## 次のステップ

### 学習リソース

1. **公式ドキュメント**: `README.md` を読む
2. **使用例**: `example.js` を参考にする
3. **設定**: `config/default.config.js` をカスタマイズ

### 高度な使い方

- **カスタムスタイル作成**: YouTubeチャンネル分析
- **バッチ処理**: 複数動画を一括処理
- **プログラム統合**: 自分のワークフローに組み込む

## サポート

問題が発生した場合:
1. `logs/app.log` でエラーログを確認
2. GitHubでIssueを報告
3. READMEのトラブルシューティングセクションを確認

---

Happy Editing! 🎬
