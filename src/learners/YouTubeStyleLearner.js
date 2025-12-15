import ytdl from 'ytdl-core';
import fs from 'fs-extra';
import path from 'path';
import { VideoAnalyzer } from '../analyzers/VideoAnalyzer.js';

/**
 * YouTubeスタイル学習クラス
 * YouTubeチャンネルの動画からカット・テロップのスタイルを学習
 */
export class YouTubeStyleLearner {
  constructor(config) {
    this.config = config;
    this.videoAnalyzer = new VideoAnalyzer(config);
    this.dataDir = './data/styles';
  }

  /**
   * YouTube動画をダウンロード
   */
  async downloadVideo(videoUrl, outputPath) {
    console.log(`📥 動画ダウンロード中: ${videoUrl}`);

    return new Promise((resolve, reject) => {
      const video = ytdl(videoUrl, {
        quality: 'highest',
        filter: 'videoandaudio',
      });

      const writeStream = fs.createWriteStream(outputPath);

      video.pipe(writeStream);

      writeStream.on('finish', () => {
        console.log(`✅ ダウンロード完了: ${outputPath}`);
        resolve(outputPath);
      });

      video.on('error', reject);
      writeStream.on('error', reject);
    });
  }

  /**
   * チャンネルの動画URLリストから学習
   * @param {Array} videoUrls - YouTube動画URLの配列
   */
  async learnFromVideos(videoUrls) {
    console.log(`🎓 スタイル学習開始: ${videoUrls.length}本の動画から学習`);

    await fs.ensureDir(this.dataDir);

    const analyses = [];

    for (let i = 0; i < videoUrls.length; i++) {
      const url = videoUrls[i];
      console.log(`\n[${i + 1}/${videoUrls.length}] 処理中...`);

      try {
        // 動画をダウンロード
        const videoPath = path.join(this.dataDir, `sample_${i + 1}.mp4`);
        await this.downloadVideo(url, videoPath);

        // 動画を解析
        const analysis = await this.videoAnalyzer.analyzeVideo(videoPath);
        analyses.push(analysis);

        // ダウンロードした動画を削除（容量節約）
        await fs.remove(videoPath);
      } catch (error) {
        console.error(`❌ エラー: ${url}`, error.message);
      }
    }

    // スタイルパターンを抽出
    const style = this.extractStylePattern(analyses);

    // スタイルを保存
    await this.saveStyle(style);

    console.log('\n✅ スタイル学習完了');
    return style;
  }

  /**
   * 複数の解析結果からスタイルパターンを抽出
   */
  extractStylePattern(analyses) {
    console.log('\n📊 スタイルパターン抽出中...');

    const cutPattern = this.analyzeCutPattern(analyses);
    const timingPattern = this.analyzeTimingPattern(analyses);

    return {
      cutPattern,
      timingPattern,
      sampleCount: analyses.length,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * カットパターンを分析
   */
  analyzeCutPattern(analyses) {
    const allSceneChanges = [];
    const cutIntervals = [];

    for (const analysis of analyses) {
      allSceneChanges.push(...analysis.sceneChanges);

      // カット間隔を計算
      const changes = analysis.sceneChanges;
      for (let i = 1; i < changes.length; i++) {
        cutIntervals.push(changes[i] - changes[i - 1]);
      }
    }

    // 統計値を計算
    const sortedIntervals = cutIntervals.sort((a, b) => a - b);
    const median = this.calculateMedian(sortedIntervals);
    const mean = this.calculateMean(sortedIntervals);
    const stdDev = this.calculateStdDev(sortedIntervals, mean);

    // ヒストグラム生成
    const histogram = this.createHistogram(cutIntervals, 20);

    return {
      totalSceneChanges: allSceneChanges.length,
      cutIntervalStats: {
        median: parseFloat(median.toFixed(2)),
        mean: parseFloat(mean.toFixed(2)),
        stdDev: parseFloat(stdDev.toFixed(2)),
        min: parseFloat(Math.min(...sortedIntervals).toFixed(2)),
        max: parseFloat(Math.max(...sortedIntervals).toFixed(2)),
      },
      histogram,
      avgCutInterval: mean,
    };
  }

  /**
   * タイミングパターンを分析
   */
  analyzeTimingPattern(analyses) {
    const allSilences = [];
    const silenceDurations = [];

    for (const analysis of analyses) {
      allSilences.push(...analysis.silences);
      silenceDurations.push(...analysis.silences.map(s => s.duration));
    }

    const sortedDurations = silenceDurations.sort((a, b) => a - b);

    return {
      totalSilences: allSilences.length,
      silenceDurationStats: {
        median: this.calculateMedian(sortedDurations).toFixed(2),
        mean: this.calculateMean(sortedDurations).toFixed(2),
        min: Math.min(...sortedDurations).toFixed(2),
        max: Math.max(...sortedDurations).toFixed(2),
      },
    };
  }

  /**
   * ヒストグラムを作成
   */
  createHistogram(data, bins) {
    if (data.length === 0) return [];

    const min = Math.min(...data);
    const max = Math.max(...data);
    const binWidth = (max - min) / bins;

    const histogram = new Array(bins).fill(0);

    for (const value of data) {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
      histogram[binIndex]++;
    }

    return histogram.map((count, i) => ({
      start: (min + i * binWidth).toFixed(2),
      end: (min + (i + 1) * binWidth).toFixed(2),
      count,
    }));
  }

  /**
   * 中央値を計算
   */
  calculateMedian(sortedArray) {
    if (sortedArray.length === 0) return 0;
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[mid - 1] + sortedArray[mid]) / 2
      : sortedArray[mid];
  }

  /**
   * 平均値を計算
   */
  calculateMean(array) {
    if (array.length === 0) return 0;
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }

  /**
   * 標準偏差を計算
   */
  calculateStdDev(array, mean) {
    if (array.length === 0) return 0;
    const variance = array.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / array.length;
    return Math.sqrt(variance);
  }

  /**
   * スタイルを保存
   */
  async saveStyle(style, name = 'default') {
    const stylePath = path.join(this.dataDir, `${name}.json`);
    await fs.writeJson(stylePath, style, { spaces: 2 });
    console.log(`💾 スタイル保存: ${stylePath}`);
    return stylePath;
  }

  /**
   * 保存されたスタイルを読み込み
   */
  async loadStyle(name = 'default') {
    const stylePath = path.join(this.dataDir, `${name}.json`);

    if (!(await fs.pathExists(stylePath))) {
      console.warn(`⚠️  スタイルファイルが見つかりません: ${stylePath}`);
      return null;
    }

    const style = await fs.readJson(stylePath);
    console.log(`📂 スタイル読み込み: ${stylePath}`);
    return style;
  }

  /**
   * YouTube動画情報を取得
   */
  async getVideoInfo(videoUrl) {
    try {
      const info = await ytdl.getInfo(videoUrl);
      return {
        title: info.videoDetails.title,
        author: info.videoDetails.author.name,
        duration: parseInt(info.videoDetails.lengthSeconds),
        viewCount: parseInt(info.videoDetails.viewCount),
        uploadDate: info.videoDetails.uploadDate,
      };
    } catch (error) {
      console.error('動画情報取得エラー:', error.message);
      return null;
    }
  }

  /**
   * URLからビデオIDを抽出
   */
  extractVideoId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  }
}
