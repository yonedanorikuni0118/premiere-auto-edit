import fs from 'fs-extra';
import path from 'path';

/**
 * Premiere Pro統合クラス
 * カット情報とテロップをPremiere Proにインポート可能な形式で出力
 */
export class PremiereIntegration {
  constructor(config) {
    this.config = config;
  }

  /**
   * プロジェクトXMLを生成（カット + テロップ）
   */
  generateProjectXML(videoPath, keepClips, captions) {
    const { width, height, frameRate } = this.config.premiere.project;
    const videoName = path.basename(videoPath);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <project>
    <name>Auto Edited Project</name>
    <children>
      <sequence>
        <name>Edited Sequence</name>
        <rate>
          <timebase>${frameRate}</timebase>
          <ntsc>FALSE</ntsc>
        </rate>
        <timecode>
          <rate>
            <timebase>${frameRate}</timebase>
            <ntsc>FALSE</ntsc>
          </rate>
          <string>00:00:00:00</string>
          <frame>0</frame>
        </timecode>
        <media>
          <video>
            <format>
              <samplecharacteristics>
                <width>${width}</width>
                <height>${height}</height>
                <pixelaspectratio>Square</pixelaspectratio>
                <rate>
                  <timebase>${frameRate}</timebase>
                  <ntsc>FALSE</ntsc>
                </rate>
              </samplecharacteristics>
            </format>
`;

    // ビデオトラック1: カットされた映像クリップ
    xml += `            <track>\n`;

    let sequenceTime = 0;
    for (let i = 0; i < keepClips.length; i++) {
      const clip = keepClips[i];
      const startFrame = Math.floor(clip.start * frameRate);
      const endFrame = Math.floor(clip.end * frameRate);
      const duration = endFrame - startFrame;

      xml += `              <clipitem id="clip-${i + 1}">
                <name>${videoName} - Clip ${i + 1}</name>
                <start>${Math.floor(sequenceTime * frameRate)}</start>
                <end>${Math.floor((sequenceTime + clip.duration) * frameRate)}</end>
                <in>${startFrame}</in>
                <out>${endFrame}</out>
                <file>
                  <name>${videoName}</name>
                  <pathurl>file://localhost${videoPath.replace(/\\/g, '/')}</pathurl>
                </file>
              </clipitem>
`;

      sequenceTime += clip.duration;
    }

    xml += `            </track>\n`;

    // ビデオトラック2: テロップ
    xml += `            <track>\n`;

    for (const caption of captions) {
      const startFrame = Math.floor((caption.start || 0) * frameRate);
      const endFrame = Math.floor((caption.end || 0) * frameRate);
      const duration = endFrame - startFrame;

      // スタイル情報の安全な取得
      const style = caption.style || {};
      const fontFamily = style.fontFamily || 'Arial';
      const fontSize = style.fontSize || 48;
      const color = style.color || '#FFFFFF';

      xml += `              <clipitem id="caption-${caption.id}">
                <name>Caption ${caption.id}</name>
                <start>${startFrame}</start>
                <end>${endFrame}</end>
                <in>0</in>
                <out>${duration}</out>
                <effect>
                  <name>Text</name>
                  <parameter>
                    <parameterid>str</parameterid>
                    <value>${this.escapeXml(caption.text || '')}</value>
                  </parameter>
                  <parameter>
                    <parameterid>font</parameterid>
                    <value>${fontFamily}</value>
                  </parameter>
                  <parameter>
                    <parameterid>size</parameterid>
                    <value>${fontSize}</value>
                  </parameter>
                  <parameter>
                    <parameterid>color</parameterid>
                    <value>${color}</value>
                  </parameter>
                </effect>
              </clipitem>
`;
    }

    xml += `            </track>
          </video>
        </media>
      </sequence>
    </children>
  </project>
</xmeml>`;

    return xml;
  }

  /**
   * EDL (Edit Decision List) 形式でエクスポート
   */
  generateEDL(keepClips, videoName = 'SOURCE') {
    const frameRate = this.config.premiere.project.frameRate;
    let edl = `TITLE: Auto Edited Sequence\n`;
    edl += `FCM: NON-DROP FRAME\n\n`;

    for (let i = 0; i < keepClips.length; i++) {
      const clip = keepClips[i];
      const editNumber = String(i + 1).padStart(3, '0');

      const sourceIn = this.framesToTimecode(Math.floor(clip.start * frameRate), frameRate);
      const sourceOut = this.framesToTimecode(Math.floor(clip.end * frameRate), frameRate);

      const recordIn = this.framesToTimecode(Math.floor(i * clip.duration * frameRate), frameRate);
      const recordOut = this.framesToTimecode(Math.floor((i + 1) * clip.duration * frameRate), frameRate);

      edl += `${editNumber}  ${videoName}       V     C        ${sourceIn} ${sourceOut} ${recordIn} ${recordOut}\n`;
    }

    return edl;
  }

  /**
   * フレーム数をタイムコードに変換 (HH:MM:SS:FF)
   */
  framesToTimecode(frames, frameRate) {
    const hours = Math.floor(frames / (frameRate * 3600));
    const minutes = Math.floor((frames % (frameRate * 3600)) / (frameRate * 60));
    const seconds = Math.floor((frames % (frameRate * 60)) / frameRate);
    const remainingFrames = frames % frameRate;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(Math.floor(remainingFrames)).padStart(2, '0')}`;
  }

  /**
   * CSVレポートを生成（編集ログ）
   */
  generateEditReport(keepClips, cutCandidates, captions) {
    let csv = 'Type,Start,End,Duration,Text/Reason\n';

    // カットされた部分
    const actualCuts = cutCandidates.filter(c => !c.isMarker);
    for (const cut of actualCuts) {
      csv += `Cut,${cut.start.toFixed(2)},${cut.end.toFixed(2)},${cut.duration.toFixed(2)},"${cut.reason}"\n`;
    }

    // 保持されたクリップ
    for (const clip of keepClips) {
      csv += `Keep,${clip.start.toFixed(2)},${clip.end.toFixed(2)},${clip.duration.toFixed(2)},Kept Clip\n`;
    }

    // テロップ
    for (const caption of captions) {
      csv += `Caption,${caption.start.toFixed(2)},${caption.end.toFixed(2)},${caption.duration.toFixed(2)},"${caption.text}"\n`;
    }

    return csv;
  }

  /**
   * JSONプロジェクトファイルを生成
   */
  generateProjectJSON(videoPath, keepClips, cutCandidates, captions, stats) {
    return {
      project: {
        name: 'Auto Edited Project',
        sourceVideo: videoPath,
        createdAt: new Date().toISOString(),
        settings: this.config.premiere,
      },
      edits: {
        keepClips: keepClips,
        cutCandidates: cutCandidates,
        stats: stats,
      },
      captions: captions,
    };
  }

  /**
   * すべてのファイルをエクスポート
   */
  async exportAll(outputDir, videoPath, keepClips, cutCandidates, captions, stats) {
    await fs.ensureDir(outputDir);

    const baseName = path.basename(videoPath, path.extname(videoPath));
    const files = {};

    // 1. Premiere Pro XML
    const xml = this.generateProjectXML(videoPath, keepClips, captions);
    const xmlPath = path.join(outputDir, `${baseName}_project.xml`);
    await fs.writeFile(xmlPath, xml, 'utf-8');
    files.xml = xmlPath;

    // 2. EDL
    const edl = this.generateEDL(keepClips, baseName);
    const edlPath = path.join(outputDir, `${baseName}_edl.edl`);
    await fs.writeFile(edlPath, edl, 'utf-8');
    files.edl = edlPath;

    // 3. JSONプロジェクト
    const json = this.generateProjectJSON(videoPath, keepClips, cutCandidates, captions, stats);
    const jsonPath = path.join(outputDir, `${baseName}_project.json`);
    await fs.writeJson(jsonPath, json, { spaces: 2 });
    files.json = jsonPath;

    // 4. 編集レポート (CSV)
    const csv = this.generateEditReport(keepClips, cutCandidates, captions);
    const csvPath = path.join(outputDir, `${baseName}_report.csv`);
    await fs.writeFile(csvPath, csv, 'utf-8');
    files.csv = csvPath;

    console.log('\n📦 エクスポート完了:');
    console.log(`   - XML: ${xmlPath}`);
    console.log(`   - EDL: ${edlPath}`);
    console.log(`   - JSON: ${jsonPath}`);
    console.log(`   - CSV Report: ${csvPath}`);

    return files;
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
}
