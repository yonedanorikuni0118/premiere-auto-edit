import { youtubePreset } from './presets/youtube.js';
import { newsPreset } from './presets/news.js';
import { vlogPreset } from './presets/vlog.js';
import { gamingPreset } from './presets/gaming.js';
import { minimalPreset } from './presets/minimal.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * テロップスタイル管理クラス
 * プリセット管理、アニメーション適用、カスタムスタイル保存
 */
export class CaptionStyleManager {
  constructor(config) {
    this.config = config;
    this.presets = this.loadPresets();
  }

  /**
   * 組み込みプリセットを読み込み
   */
  loadPresets() {
    return {
      youtube: youtubePreset,
      news: newsPreset,
      vlog: vlogPreset,
      gaming: gamingPreset,
      minimal: minimalPreset,
    };
  }

  /**
   * プリセット一覧を取得
   */
  listPresets() {
    return Object.values(this.presets).map(preset => ({
      name: preset.name,
      displayName: preset.displayName,
      description: preset.description,
    }));
  }

  /**
   * プリセットを名前で取得
   */
  getPreset(presetName) {
    const preset = this.presets[presetName];
    if (!preset) {
      console.warn(`⚠️  プリセット '${presetName}' が見つかりません。デフォルトを使用します。`);
      return this.presets.youtube;
    }
    return preset;
  }

  /**
   * スタイルをマージ（デフォルト + プリセット + カスタム）
   */
  mergeStyles(baseStyle = {}, presetName = null, customStyle = {}) {
    let finalStyle = { ...this.config.caption.defaultStyle, ...baseStyle };

    // プリセット適用
    if (presetName) {
      const preset = this.getPreset(presetName);
      finalStyle = { ...finalStyle, ...preset.style };
    }

    // カスタムスタイル適用
    finalStyle = { ...finalStyle, ...customStyle };

    return finalStyle;
  }

  /**
   * アニメーション効果を生成（FFmpeg drawtext用）
   */
  generateAnimation(animation, startTime, endTime, duration) {
    if (!animation) return {};

    const animDuration = duration || 0.3;

    switch (animation) {
      case 'fade-in':
        return {
          alpha: `if(lt(t-${startTime},${animDuration}),(t-${startTime})/${animDuration},1)`,
        };

      case 'fade-out':
        return {
          alpha: `if(gt(t,${endTime - animDuration}),1-((t-(${endTime}-${animDuration}))/${animDuration}),1)`,
        };

      case 'fade-in-out':
        return {
          alpha: `if(lt(t-${startTime},${animDuration}),(t-${startTime})/${animDuration},if(gt(t,${endTime - animDuration}),1-((t-(${endTime}-${animDuration}))/${animDuration}),1))`,
        };

      case 'slide-in-bottom':
        return {
          y: `if(lt(t-${startTime},${animDuration}),h+(h-y)*((${animDuration}-(t-${startTime}))/${animDuration}),y)`,
        };

      case 'slide-in-top':
        return {
          y: `if(lt(t-${startTime},${animDuration}),y-h+(h*((t-${startTime})/${animDuration})),y)`,
        };

      case 'slide-in-left':
        return {
          x: `if(lt(t-${startTime},${animDuration}),x-w+(w*((t-${startTime})/${animDuration})),x)`,
        };

      case 'slide-in-right':
        return {
          x: `if(lt(t-${startTime},${animDuration}),w+(w-x)*((${animDuration}-(t-${startTime}))/${animDuration}),x)`,
        };

      case 'zoom-in':
        return {
          fontsize: `if(lt(t-${startTime},${animDuration}),fontsize*((t-${startTime})/${animDuration}),fontsize)`,
        };

      case 'typewriter':
        // 文字を1文字ずつ表示（簡易実装）
        return {
          // FFmpegのdrawtextでは完全なタイプライター効果は難しい
          // フェードインで代替
          alpha: `if(lt(t-${startTime},${animDuration}),(t-${startTime})/${animDuration},1)`,
        };

      default:
        console.warn(`⚠️  未知のアニメーション: ${animation}`);
        return {};
    }
  }

  /**
   * スタイルをFFmpeg drawtextオプションに変換
   */
  styleToDrawTextOptions(style, text, startTime, endTime) {
    const options = {
      text: this.escapeText(text),
      fontsize: style.fontSize || 48,
      fontcolor: style.fontColor || 'white',
    };

    // フォント
    if (style.fontFamily) {
      const fontPath = this.getFontPath(style.fontFamily);
      if (fontPath) {
        options.fontfile = fontPath;
      }
    }

    // 縁取り（アウトライン）
    if (style.strokeWidth && style.strokeWidth > 0) {
      options.borderw = style.strokeWidth;
      options.bordercolor = style.strokeColor || 'black';
    }

    // 影
    if (style.shadowX || style.shadowY) {
      options.shadowx = style.shadowX || 0;
      options.shadowy = style.shadowY || 0;
      if (style.shadowColor) {
        options.shadowcolor = style.shadowColor;
      }
    }

    // 位置
    const xPos = style.xOffset || '(w-text_w)/2'; // デフォルトは中央
    const yPos = this.calculateYPosition(style);
    options.x = typeof xPos === 'number' ? xPos : xPos;
    options.y = typeof yPos === 'number' ? yPos : yPos;

    // 背景ボックス
    if (style.backgroundColor) {
      options.box = 1;
      options.boxcolor = style.backgroundColor;
      options.boxborderw = style.backgroundPadding || 5;
    }

    // アニメーション
    if (style.animation) {
      const animOptions = this.generateAnimation(
        style.animation,
        startTime,
        endTime,
        style.animationDuration
      );
      Object.assign(options, animOptions);
    }

    // 表示時間
    options.enable = `between(t,${startTime},${endTime})`;

    return options;
  }

  /**
   * Y座標を計算
   */
  calculateYPosition(style) {
    const position = style.position || 'bottom';
    const yOffset = style.yOffset || 100;

    switch (position) {
      case 'top':
        return yOffset;
      case 'middle':
        return '(h-text_h)/2';
      case 'bottom':
      default:
        return `h-${yOffset}`;
    }
  }

  /**
   * テキストをFFmpeg用にエスケープ
   */
  escapeText(text) {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:')
      .replace(/\n/g, '\\n');
  }

  /**
   * フォントファイルのパスを取得
   */
  getFontPath(fontFamily) {
    // macOSのシステムフォント
    if (process.platform === 'darwin') {
      const fontMap = {
        'Arial': '/System/Library/Fonts/Supplemental/Arial.ttf',
        'Helvetica': '/System/Library/Fonts/Helvetica.ttc',
        'Impact': '/System/Library/Fonts/Supplemental/Impact.ttf',
        'YuGothic': '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
        'ヒラギノ角ゴシック': '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
        'ヒラギノ明朝': '/System/Library/Fonts/ヒラギノ明朝 ProN.ttc',
      };
      return fontMap[fontFamily] || fontMap['Arial'];
    }

    // Windowsのシステムフォント
    if (process.platform === 'win32') {
      const fontMap = {
        'Arial': 'C:\\Windows\\Fonts\\arial.ttf',
        'Impact': 'C:\\Windows\\Fonts\\impact.ttf',
        'Helvetica': 'C:\\Windows\\Fonts\\arial.ttf',
        'YuGothic': 'C:\\Windows\\Fonts\\YuGothM.ttc',
      };
      return fontMap[fontFamily] || fontMap['Arial'];
    }

    // Linuxのシステムフォント
    return '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  }

  /**
   * カスタムスタイルを保存
   */
  async saveCustomStyle(name, style) {
    const stylesDir = path.join(process.cwd(), 'data', 'styles');
    await fs.ensureDir(stylesDir);

    const stylePath = path.join(stylesDir, `${name}.json`);
    await fs.writeJson(stylePath, style, { spaces: 2 });

    console.log(`✅ カスタムスタイル '${name}' を保存しました: ${stylePath}`);
  }

  /**
   * カスタムスタイルを読み込み
   */
  async loadCustomStyle(name) {
    const stylePath = path.join(process.cwd(), 'data', 'styles', `${name}.json`);

    if (!(await fs.pathExists(stylePath))) {
      throw new Error(`カスタムスタイル '${name}' が見つかりません: ${stylePath}`);
    }

    const style = await fs.readJson(stylePath);
    console.log(`✅ カスタムスタイル '${name}' を読み込みました`);
    return style;
  }

  /**
   * 利用可能なアニメーション一覧
   */
  getAvailableAnimations() {
    return [
      { name: 'fade-in', description: 'フェードイン' },
      { name: 'fade-out', description: 'フェードアウト' },
      { name: 'fade-in-out', description: 'フェードイン&アウト' },
      { name: 'slide-in-bottom', description: 'スライドイン（下から）' },
      { name: 'slide-in-top', description: 'スライドイン（上から）' },
      { name: 'slide-in-left', description: 'スライドイン（左から）' },
      { name: 'slide-in-right', description: 'スライドイン（右から）' },
      { name: 'zoom-in', description: 'ズームイン' },
      { name: 'typewriter', description: 'タイプライター（簡易）' },
    ];
  }
}
