/**
 * テロップ生成クラス
 * 音声認識結果からPremiere Pro用のテロップデータを生成
 */
export class CaptionGenerator {
  constructor(config) {
    this.config = config;
  }

  /**
   * テロップをスタイルに基づいて生成
   * @param {Array} captions - SpeechRecognizerから得たテロップ配列
   * @param {Object} learnedStyle - 学習したスタイル（オプション）
   * @returns {Array} スタイル適用済みテロップ
   */
  generateCaptions(captions, learnedStyle = null) {
    console.log('📝 テロップ生成開始...');

    const styledCaptions = captions.map((caption, index) => {
      const style = this.determineStyle(caption, index, learnedStyle);

      const start = caption.start + (this.config.caption.displayOffset || 0);
      const end = caption.end + (this.config.caption.displayOffset || 0);

      return {
        id: index + 1,
        text: caption.text,
        start: start,
        end: end,
        duration: caption.duration,
        style: style,
      };
    });

    console.log(`✅ ${styledCaptions.length}個のテロップを生成`);
    return styledCaptions;
  }

  /**
   * テロップのスタイルを決定
   */
  determineStyle(caption, index, learnedStyle) {
    // デフォルトスタイルから開始
    const style = { ...this.config.caption.defaultStyle };

    // スタイルプロパティの確実な初期化
    style.fontSize = style.fontSize || 48;
    style.fontFamily = style.fontFamily || 'Arial';
    style.color = style.color || '#FFFFFF';

    // 学習したスタイルがあれば適用
    if (learnedStyle && learnedStyle.captionPattern) {
      // 将来的にスタイル学習機能を実装
      // 例: フォント、色、位置などを学習結果から適用
    }

    // 特殊ケース: 短いテキストは大きめのフォントに
    if (caption.text && caption.text.length < 10) {
      style.fontSize = Math.floor(style.fontSize * 1.2);
    }

    // 長いテキストは小さめのフォントに
    if (caption.text && caption.text.length > 30) {
      style.fontSize = Math.floor(style.fontSize * 0.85);
    }

    return style;
  }

  /**
   * 強調表現を検出してスタイルを変更
   */
  detectEmphasis(text) {
    const emphasisPatterns = [
      { pattern: /!+$/, style: { color: '#FF4444', fontSize: 1.2 } }, // 感嘆符
      { pattern: /\?+$/, style: { color: '#44AAFF' } }, // 疑問符
      { pattern: /「.*」/, style: { color: '#FFAA44' } }, // カギ括弧
    ];

    for (const { pattern, style } of emphasisPatterns) {
      if (pattern.test(text)) {
        return style;
      }
    }

    return null;
  }

  /**
   * Premiere Pro XML形式でエクスポート
   */
  exportToPremiereXML(captions, videoInfo) {
    const { width, height, frameRate } = this.config.premiere.project;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmeml version="5">
  <sequence>
    <name>Auto Generated Captions</name>
    <duration>${Math.ceil(videoInfo.duration * frameRate)}</duration>
    <rate>
      <timebase>${frameRate}</timebase>
    </rate>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${width}</width>
            <height>${height}</height>
          </samplecharacteristics>
        </format>
        <track>
`;

    for (const caption of captions) {
      const startFrame = Math.floor(caption.start * frameRate);
      const endFrame = Math.floor(caption.end * frameRate);
      const duration = endFrame - startFrame;

      xml += `          <clipitem>
            <name>Caption ${caption.id}</name>
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>0</in>
            <out>${duration}</out>
            <file>
              <name>${this.escapeXml(caption.text)}</name>
            </file>
            <sourcetrack>
              <mediatype>video</mediatype>
            </sourcetrack>
          </clipitem>
`;
    }

    xml += `        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;

    return xml;
  }

  /**
   * JSON形式でエクスポート（汎用）
   */
  exportToJSON(captions, videoInfo) {
    return {
      videoInfo,
      captions: captions.map(caption => ({
        id: caption.id,
        text: caption.text,
        timeRange: {
          start: caption.start,
          end: caption.end,
          duration: caption.duration,
        },
        style: caption.style,
      })),
      config: this.config.caption,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * SRT字幕形式でエクスポート
   */
  exportToSRT(captions) {
    let srt = '';

    for (const caption of captions) {
      const start = this.formatSRTTime(caption.start);
      const end = this.formatSRTTime(caption.end);

      srt += `${caption.id}\n`;
      srt += `${start} --> ${end}\n`;
      srt += `${caption.text}\n\n`;
    }

    return srt;
  }

  /**
   * WebVTT形式でエクスポート
   */
  exportToWebVTT(captions) {
    let vtt = 'WEBVTT\n\n';

    for (const caption of captions) {
      const start = this.formatWebVTTTime(caption.start);
      const end = this.formatWebVTTTime(caption.end);

      vtt += `${caption.id}\n`;
      vtt += `${start} --> ${end}\n`;
      vtt += `${caption.text}\n\n`;
    }

    return vtt;
  }

  /**
   * SRT時刻フォーマット (HH:MM:SS,mmm)
   */
  formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  }

  /**
   * WebVTT時刻フォーマット (HH:MM:SS.mmm)
   */
  formatWebVTTTime(seconds) {
    return this.formatSRTTime(seconds).replace(',', '.');
  }

  /**
   * XML特殊文字をエスケープ
   */
  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * テロップの統計情報を生成
   */
  generateStatistics(captions) {
    const totalDuration = captions.reduce((sum, c) => sum + c.duration, 0);
    const avgDuration = totalDuration / captions.length;
    const avgTextLength = captions.reduce((sum, c) => sum + c.text.length, 0) / captions.length;

    return {
      totalCaptions: captions.length,
      totalDuration: totalDuration.toFixed(2),
      avgDuration: avgDuration.toFixed(2),
      avgTextLength: avgTextLength.toFixed(1),
      shortestCaption: Math.min(...captions.map(c => c.text.length)),
      longestCaption: Math.max(...captions.map(c => c.text.length)),
    };
  }
}
