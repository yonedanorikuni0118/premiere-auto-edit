import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import fs from 'fs-extra';
import path from 'path';

ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

/**
 * 動画解析クラス
 * FFmpegを使用して動画・音声の詳細な解析を行う
 */
export class VideoAnalyzer {
  constructor(config) {
    this.config = config;
    this.tempDir = config.video.tempDir;
  }

  /**
   * 動画のメタデータを取得
   */
  async getMetadata(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });
  }

  /**
   * 音声を抽出してWAVファイルとして保存
   */
  async extractAudio(videoPath) {
    await fs.ensureDir(this.tempDir);
    const audioPath = path.join(
      this.tempDir,
      `audio_${Date.now()}.wav`
    );

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', () => resolve(audioPath))
        .on('error', reject)
        .run();
    });
  }

  /**
   * 無音部分を検出
   * @returns {Array} 無音区間の配列 [{start, end, duration}]
   */
  async detectSilence(videoPath, threshold = -40, duration = 0.5) {
    const silences = [];

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .audioFilters(`silencedetect=noise=${threshold}dB:d=${duration}`)
        .format('null')
        .on('stderr', (stderrLine) => {
          // silence_start と silence_end を解析
          const startMatch = stderrLine.match(/silence_start: ([\d.]+)/);
          const endMatch = stderrLine.match(/silence_end: ([\d.]+)/);

          if (startMatch) {
            silences.push({ start: parseFloat(startMatch[1]) });
          }
          if (endMatch && silences.length > 0) {
            const lastSilence = silences[silences.length - 1];
            if (!lastSilence.end) {
              lastSilence.end = parseFloat(endMatch[1]);
              lastSilence.duration = lastSilence.end - lastSilence.start;
            }
          }
        })
        .on('end', () => resolve(silences))
        .on('error', reject)
        .output('-')
        .run();
    });
  }

  /**
   * シーン変化を検出
   * @returns {Array} シーン変化のタイムスタンプ配列
   */
  async detectSceneChanges(videoPath, threshold = 0.3) {
    const scenes = [];

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .videoFilters(`select='gt(scene,${threshold})',showinfo`)
        .format('null')
        .on('stderr', (stderrLine) => {
          // pts_time を抽出してシーン変化の時刻を取得
          const match = stderrLine.match(/pts_time:([\d.]+)/);
          if (match) {
            scenes.push(parseFloat(match[1]));
          }
        })
        .on('end', () => resolve(scenes))
        .on('error', reject)
        .output('-')
        .run();
    });
  }

  /**
   * 音声のボリュームレベルを時系列で取得
   */
  async getAudioLevels(videoPath, interval = 0.1) {
    const levels = [];

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .audioFilters('astats=metadata=1:reset=1,ametadata=print:file=-')
        .format('null')
        .on('stderr', (stderrLine) => {
          // RMS レベルを解析
          const match = stderrLine.match(/lavfi\.astats\.Overall\.RMS_level=([-\d.]+)/);
          if (match) {
            levels.push(parseFloat(match[1]));
          }
        })
        .on('end', () => resolve(levels))
        .on('error', reject)
        .output('-')
        .run();
    });
  }

  /**
   * 動画の総時間を取得（秒）
   */
  async getDuration(videoPath) {
    const metadata = await this.getMetadata(videoPath);
    return metadata.format.duration;
  }

  /**
   * 解析結果の統合
   */
  async analyzeVideo(videoPath) {
    console.log(`🎬 動画解析開始: ${videoPath}`);

    const [metadata, silences, sceneChanges, duration] = await Promise.all([
      this.getMetadata(videoPath),
      this.detectSilence(videoPath, this.config.autoCut.silenceThreshold, this.config.autoCut.silenceMinDuration),
      this.detectSceneChanges(videoPath, this.config.styleLearn.cutPattern.sceneChangeThreshold),
      this.getDuration(videoPath),
    ]);

    console.log(`✅ 解析完了: ${silences.length}個の無音区間, ${sceneChanges.length}個のシーン変化を検出`);

    return {
      metadata,
      duration,
      silences,
      sceneChanges,
      videoPath,
    };
  }

  /**
   * クリーンアップ: 一時ファイルの削除
   */
  async cleanup() {
    await fs.emptyDir(this.tempDir);
  }
}
