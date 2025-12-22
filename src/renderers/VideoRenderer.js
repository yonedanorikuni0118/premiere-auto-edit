import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs-extra';
import path from 'path';

// FFmpegのパスを設定
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * 動画レンダリングクラス
 * カット後の動画セグメントを結合してプレビュー動画を生成
 */
export class VideoRenderer {
  constructor(config) {
    this.config = config;
  }

  /**
   * プレビュー動画を生成
   * @param {string} videoPath - 元動画のパス
   * @param {Array} keepClips - 保持するクリップ [{start, end, duration}]
   * @param {Object} options - オプション
   * @returns {Promise<string>} 生成された動画のパス
   */
  async renderPreview(videoPath, keepClips, options = {}) {
    console.log('🎬 プレビュー動画生成開始...');

    const {
      outputPath = null,
      format = 'mp4',
      withCaptions = false,
      captions = [],
    } = options;

    // 出力パスの決定
    const baseName = path.basename(videoPath, path.extname(videoPath));
    const outputDir = outputPath || './output';
    await fs.ensureDir(outputDir);

    const finalOutputPath = path.join(
      outputDir,
      `${baseName}_preview.${format}`
    );

    try {
      // ステップ1: セグメントをカット・結合
      console.log('   📹 セグメントをカット・結合中...');
      const concatenatedVideo = await this.concatenateSegments(
        videoPath,
        keepClips,
        outputDir
      );

      // ステップ2: テロップを焼き込み（オプション）
      let finalVideo = concatenatedVideo;
      if (withCaptions && captions.length > 0) {
        console.log('   📝 テロップを焼き込み中...');
        finalVideo = await this.burnCaptions(
          concatenatedVideo,
          captions,
          outputDir
        );

        // 一時ファイルを削除
        await fs.remove(concatenatedVideo);
      }

      // 最終ファイル名にリネーム
      await fs.move(finalVideo, finalOutputPath, { overwrite: true });

      console.log(`✅ プレビュー動画生成完了: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      console.error('❌ プレビュー動画生成エラー:', error.message);
      throw error;
    }
  }

  /**
   * 複数セグメントをカット・結合
   * @param {string} videoPath - 元動画のパス
   * @param {Array} segments - セグメント配列
   * @param {string} outputDir - 出力ディレクトリ
   * @returns {Promise<string>} 結合された動画のパス
   */
  async concatenateSegments(videoPath, segments, outputDir) {
    const tempDir = path.join(outputDir, 'temp');
    await fs.ensureDir(tempDir);

    try {
      // ステップ1: 各セグメントを個別にカット
      console.log(`   - ${segments.length}個のセグメントをカット中...`);
      const segmentPaths = [];

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentPath = path.join(tempDir, `segment_${i}.mp4`);

        await this.cutSegment(videoPath, segment, segmentPath);
        segmentPaths.push(segmentPath);

        // 進捗表示
        const progress = Math.round(((i + 1) / segments.length) * 100);
        process.stdout.write(`\r   - 進捗: ${progress}% (${i + 1}/${segments.length})`);
      }
      console.log(''); // 改行

      // ステップ2: セグメントを結合
      console.log('   - セグメントを結合中...');
      const concatenatedPath = path.join(tempDir, 'concatenated.mp4');
      await this.mergeSegments(segmentPaths, concatenatedPath);

      // 一時セグメントファイルを削除
      for (const segmentPath of segmentPaths) {
        await fs.remove(segmentPath);
      }

      return concatenatedPath;
    } catch (error) {
      // エラー時は一時ディレクトリをクリーンアップ
      await fs.remove(tempDir);
      throw error;
    }
  }

  /**
   * 1つのセグメントをカット
   * @param {string} inputPath - 入力動画のパス
   * @param {Object} segment - セグメント {start, end}
   * @param {string} outputPath - 出力パス
   * @returns {Promise<void>}
   */
  cutSegment(inputPath, segment, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(segment.start)
        .setDuration(segment.duration || segment.end - segment.start)
        .outputOptions([
          '-c:v', 'libx264',    // ビデオコーデック
          '-c:a', 'aac',        // オーディオコーデック
          '-b:a', '192k',       // オーディオビットレート
          '-movflags', '+faststart', // Web最適化
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * 複数セグメントを結合
   * @param {Array<string>} segmentPaths - セグメントファイルパス配列
   * @param {string} outputPath - 出力パス
   * @returns {Promise<void>}
   */
  mergeSegments(segmentPaths, outputPath) {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // 各セグメントを入力として追加
      for (const segmentPath of segmentPaths) {
        command.input(segmentPath);
      }

      // フィルター: すべてのセグメントを連結
      const filterComplex = [];
      for (let i = 0; i < segmentPaths.length; i++) {
        filterComplex.push(`[${i}:v] [${i}:a]`);
      }
      filterComplex.push(`concat=n=${segmentPaths.length}:v=1:a=1 [v] [a]`);

      command
        .complexFilter(filterComplex.join(' '))
        .outputOptions(['-map', '[v]', '-map', '[a]'])
        .outputOptions([
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-b:a', '192k',
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * テロップを動画に焼き込み
   * @param {string} inputPath - 入力動画のパス
   * @param {Array} captions - テロップ配列 [{text, start, end}]
   * @param {string} outputDir - 出力ディレクトリ
   * @returns {Promise<string>} 焼き込み後の動画パス
   */
  async burnCaptions(inputPath, captions, outputDir) {
    const outputPath = path.join(outputDir, 'temp', 'with_captions.mp4');

    // drawtextフィルターを生成
    const drawTextFilters = [];
    for (const caption of captions) {
      const style = caption.style || this.config.caption.defaultStyle;

      // テキストのエスケープ
      const escapedText = this.escapeTextForFFmpeg(caption.text);

      // タイムスタンプ
      const startTime = caption.start || 0;
      const endTime = caption.end || 0;

      drawTextFilters.push({
        filter: 'drawtext',
        options: {
          text: escapedText,
          fontfile: this.getFontPath(style.fontFamily),
          fontsize: style.fontSize || 48,
          fontcolor: style.color || 'white',
          borderw: style.strokeWidth || 3,
          bordercolor: style.strokeColor || 'black',
          x: '(w-text_w)/2', // 中央揃え
          y: `h-${style.yOffset || 100}`, // 画面下部
          enable: `between(t,${startTime},${endTime})`, // 表示時間
        },
      });
    }

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath);

      // すべてのdrawtextフィルターを適用
      if (drawTextFilters.length > 0) {
        command.videoFilters(drawTextFilters);
      }

      command
        .outputOptions(['-c:a', 'copy']) // オーディオはコピー
        .output(outputPath)
        .on('progress', (progress) => {
          if (progress.percent) {
            process.stdout.write(`\r   - 進捗: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log(''); // 改行
          resolve(outputPath);
        })
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * FFmpeg用にテキストをエスケープ
   */
  escapeTextForFFmpeg(text) {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:')
      .replace(/\n/g, '\\n');
  }

  /**
   * フォントファイルのパスを取得
   * システムフォントのパスを返す（簡易実装）
   */
  getFontPath(fontFamily) {
    // macOSのシステムフォント
    if (process.platform === 'darwin') {
      if (fontFamily === 'Arial' || !fontFamily) {
        return '/System/Library/Fonts/Supplemental/Arial.ttf';
      }
      // YuGothicなど日本語フォント
      return '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc';
    }

    // Windowsのシステムフォント
    if (process.platform === 'win32') {
      return 'C:\\Windows\\Fonts\\arial.ttf';
    }

    // Linuxのシステムフォント
    return '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  }

  /**
   * 一時ファイルをクリーンアップ
   */
  async cleanup(outputDir) {
    const tempDir = path.join(outputDir, 'temp');
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
      console.log('🧹 一時ファイルをクリーンアップしました');
    }
  }

  /**
   * ディスク容量をチェック
   * @param {string} outputDir - 出力ディレクトリ
   * @param {number} estimatedSize - 推定ファイルサイズ（バイト）
   * @returns {Promise<boolean>} 十分な容量があるか
   */
  async checkDiskSpace(outputDir, estimatedSize) {
    // 簡易実装: 実際にはdiskusageライブラリなどを使用
    // ここでは常にtrueを返す
    return true;
  }
}
