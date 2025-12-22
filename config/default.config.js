import 'dotenv/config';

export default {
  // OpenAI Whisper API設定
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'whisper-1',
    language: 'ja', // 日本語に最適化
  },

  // 動画解析設定
  video: {
    // サポートする形式
    supportedFormats: ['.mp4', '.mov', '.avi', '.mkv'],
    // 一時ファイルの保存先
    tempDir: './data/cache',
  },

  // 自動カット設定
  autoCut: {
    // 無音検出の閾値（デシベル）
    silenceThreshold: -40,
    // 無音の最小継続時間（秒）
    silenceMinDuration: 0.5,
    // カット前後のバッファ（秒）
    cutBuffer: 0.1,
    // フィラーワード検出
    fillerWords: ['えー', 'あー', 'えっと', 'まあ', 'そうですね'],
    // 最小クリップ長（秒）- これより短いクリップは削除
    minClipDuration: 1.0,
    // シーン変化をカットとして使用するか（true=使用, false=マーカーのみ）
    useSceneChangesForCuts: true,
    // シーン変化カットの前後バッファ（秒）
    sceneChangeBuffer: 0.05,
  },

  // 高度なカット検出設定（実験的機能）
  advancedDetection: {
    // 話速度分析
    speechRateAnalysis: {
      enabled: false, // デフォルトはOFF（実験的機能）
      minWPM: 150, // 最小話速度（Words Per Minute）
      maxWPM: 250, // 最大話速度
    },
    // ポーズ（間）検出
    pauseDetection: {
      enabled: false, // デフォルトはOFF（実験的機能）
      minDuration: 1.0, // 検出する最小ポーズ時間（秒）
      maxDuration: 3.0, // 検出する最大ポーズ時間（秒）
      bufferBefore: 0.2, // ポーズ前のバッファ（秒）
      bufferAfter: 0.2, // ポーズ後のバッファ（秒）
    },
    // 感情分析（基本的な実装）
    sentimentAnalysis: {
      enabled: false, // デフォルトはOFF（実験的機能）
    },
  },

  // テロップ設定
  caption: {
    // 最大文字数（1行あたり）
    maxCharsPerLine: 20,
    // 最大行数
    maxLines: 2,
    // デフォルトスタイル
    defaultStyle: {
      fontSize: 48,
      fontFamily: 'Arial',
      color: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 3,
      position: 'bottom', // 'top', 'middle', 'bottom'
      yOffset: 100, // 画面下端からのオフセット（ピクセル）
    },
    // 表示タイミング調整（秒）
    displayOffset: 0,
    // 最小表示時間（秒）
    minDisplayDuration: 1.0,
    // YouTubeスタイル（句読点を削除）
    youtubeStyle: true,
    // 削除する句読点リスト
    punctuationToRemove: ['。', '、', '，', '．', '！', '？'],
  },

  // YouTubeスタイル学習設定
  styleLearn: {
    // 分析するサンプル動画数
    sampleVideos: 5,
    // カットパターン分析
    cutPattern: {
      // カット間隔のヒストグラム分析
      intervalBins: 20,
      // シーンチェンジ検出の感度
      sceneChangeThreshold: 0.3,
    },
    // テロップスタイル分析
    captionPattern: {
      // OCRを使用してテロップを検出
      useOCR: false, // 将来の拡張用
      // タイミング分析
      timingAnalysis: true,
      // 位置分析
      positionAnalysis: true,
    },
  },

  // Premiere Pro連携設定
  premiere: {
    // エクスポート形式
    exportFormat: 'xml', // 'xml' or 'edl'
    // プロジェクト設定
    project: {
      frameRate: 30,
      width: 1920,
      height: 1080,
    },
  },

  // プレビュー動画レンダリング設定
  rendering: {
    // デフォルト出力形式
    defaultFormat: 'mp4',
    // サポートする出力形式
    supportedFormats: ['mp4', 'mov', 'avi'],
    // ビデオエンコード設定
    video: {
      codec: 'libx264',
      preset: 'medium', // ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
      crf: 23, // 品質 (0-51, 低いほど高品質)
    },
    // オーディオエンコード設定
    audio: {
      codec: 'aac',
      bitrate: '192k',
    },
    // テロップ焼き込み設定
    burnCaptions: {
      enabled: false, // デフォルトはOFF
      fontPath: null, // nullの場合はシステムフォントを使用
    },
  },

  // ログ設定
  logging: {
    level: 'info', // 'error', 'warn', 'info', 'debug'
    file: './logs/app.log',
  },
};
