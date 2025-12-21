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
   * プロジェクトXMLを生成（テスト7.xmlと同じ構造）
   */
  generateProjectXML(videoPath, keepClips, captions) {
    const { width, height, frameRate } = this.config.premiere.project;
    const videoName = path.basename(videoPath);
    const fileId = path.basename(videoPath, path.extname(videoPath));

    // 総秒数を計算
    const totalDuration = keepClips.reduce((sum, clip) => sum + clip.duration, 0);

    let xml = `<?xml version='1.0' encoding='utf-8'?>
<xmeml version="5">
  <sequence id="video">
    <duration>${totalDuration.toFixed(3)}</duration>
    <name>${this.escapeXml(fileId)}</name>
    <rate>
      <timebase>${frameRate.toFixed(1)}</timebase>
      <ntsc>false</ntsc>
      </rate>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${width}</width>
            <height>${height}</height>
            <anamorphic>false</anamorphic>
            <pixelaspectratio>square</pixelaspectratio>
            <fielddominance>none</fielddominance>
            </samplecharacteristics>
          </format>
        <track>
`;

    // ビデオトラック: すべてのクリップ
    let sequenceTime = 0;
    for (let i = 0; i < keepClips.length; i++) {
      const clip = keepClips[i];
      const label = i % 2 === 0 ? 'Rose' : 'Cerulean';

      xml += `          <clipitem>
            <labels>
              <label2>${label}</label2>
              </labels>
            <name>${this.escapeXml(videoName)}</name>
            <enabled>true</enabled>
            <rate>
              <timebase>${frameRate.toFixed(1)}</timebase>
              <ntsc>false</ntsc>
              </rate>
            <in>${clip.start.toFixed(3)}</in>
            <out>${clip.end.toFixed(3)}</out>
            <start>${sequenceTime.toFixed(3)}</start>
            <end>${(sequenceTime + clip.duration).toFixed(3)}</end>
            <file id="${fileId}">
              <name>${this.escapeXml(videoName)}</name>
              <pathurl>${videoName}</pathurl>
              <media>
                <video>
                  <samplecharacteristics>
                    <width>${width}</width>
                    <height>${height}</height>
                    <anamorphic>false</anamorphic>
                    <pixelaspectratio>square</pixelaspectratio>
                    <fielddominance>none</fielddominance>
                    </samplecharacteristics>
                  </video>
                <audio>
                  <samplecharacteristics />
                  <channelcount>2</channelcount>
                  </audio>
                </media>
              </file>
            <link>
              <mediatype>video</mediatype>
              <trackindex>1</trackindex>
              <clipindex>${i + 1}</clipindex>
              <groupindex>${i + 1}</groupindex>
              </link>
            <link>
              <mediatype>audio</mediatype>
              <trackindex>1</trackindex>
              <clipindex>${i + 1}</clipindex>
              <groupindex>${i + 1}</groupindex>
              </link>
            <link>
              <mediatype>audio</mediatype>
              <trackindex>2</trackindex>
              <clipindex>${i + 1}</clipindex>
              <groupindex>${i + 1}</groupindex>
              </link>
            <link>
              <mediatype>text</mediatype>
              <trackindex>3</trackindex>
              <clipindex>${i + 1}</clipindex>
              <groupindex>${i + 1}</groupindex>
              </link>
            </clipitem>
`;

      sequenceTime += clip.duration;
    }

    xml += `          </track>
        <track>
`;

    // Second video track: Captions with GraphicAndType effect
    for (let i = 0; i < captions.length; i++) {
      const caption = captions[i];
      const captionId = `caption-${i + 1}`;

      // Generate Base64 encoded caption data
      const captionData = this.generateCaptionBase64(caption.text);

      xml += `          <clipitem id="${captionId}">
            <name>${this.escapeXml(caption.text)}</name>
            <duration>${(caption.duration * frameRate).toFixed(6)}</duration>
            <rate>
              <timebase>${frameRate.toFixed(1)}</timebase>
              <ntsc>false</ntsc>
              </rate>
            <start>${caption.start.toFixed(3)}</start>
            <end>${caption.end.toFixed(3)}</end>
            <in>${caption.start.toFixed(3)}</in>
            <out>${caption.end.toFixed(3)}</out>
            <enabled>true</enabled>
            <anamorphic>false</anamorphic>
            <alphatype>black</alphatype>
            <masterclipid>${captionId}</masterclipid>
            <file id="caption-file-${i + 1}">
              <name>Graphic</name>
              <mediaSource>GraphicAndType</mediaSource>
              <rate>
                <timebase>${frameRate.toFixed(1)}</timebase>
                <ntsc>false</ntsc>
                </rate>
              <timecode>
                <rate>
                  <timebase>${frameRate.toFixed(1)}</timebase>
                  <ntsc>false</ntsc>
                  </rate>
                <string>00:00:00:00</string>
                <frame />
                <displayformat>NDF</displayformat>
                </timecode>
              <media>
                <video>
                  <samplecharacteristics>
                    <width>${width}</width>
                    <height>${height}</height>
                    <anamorphic>false</anamorphic>
                    <pixelaspectratio>square</pixelaspectratio>
                    <fielddominance>none</fielddominance>
                    </samplecharacteristics>
                  </video>
                </media>
              </file>
            <filter>
              <effect>
                <name>${this.escapeXml(caption.text)}</name>
                <effectid>GraphicAndType</effectid>
                <effectcategory>graphic</effectcategory>
                <effecttype>filter</effecttype>
                <mediatype>video</mediatype>
                <parameter>
                  <parameterid>1</parameterid>
                  <name>ソーステキスト</name>
                  <value>${captionData}</value>
                  </parameter>
                <parameter>
                  <parameterid>2</parameterid>
                  <name>トランスフォーム</name>
                  <IsTimeVarying>false</IsTimeVarying>
                  <ParameterControlType>11</ParameterControlType>
                  <LowerBound>false</LowerBound>
                  <UpperBound>false</UpperBound>
                  <value>-91445760000000000,false,0,0,0,0,0,0</value>
                  </parameter>
                <parameter>
                  <parameterid>3</parameterid>
                  <name>位置</name>
                  <IsTimeVarying>false</IsTimeVarying>
                  <value>-91445760000000000,0.5:0.95569800000000005,0,0,0,0,0,0,5,4,0,0,0,0</value>
                  </parameter>
                </effect>
              </filter>
            <sourcetrack>
              <mediatype>video</mediatype>
              </sourcetrack>
            <link>
              <mediatype>video</mediatype>
              <trackindex>1</trackindex>
              <clipindex>${i + 1}</clipindex>
              <groupindex>${i + 1}</groupindex>
              </link>
            <link>
              <mediatype>audio</mediatype>
              <trackindex>1</trackindex>
              <clipindex>${i + 1}</clipindex>
              <groupindex>${i + 1}</groupindex>
              </link>
            <link>
              <mediatype>audio</mediatype>
              <trackindex>2</trackindex>
              <clipindex>${i + 1}</clipindex>
              <groupindex>${i + 1}</groupindex>
              </link>
            <link>
              <mediatype>text</mediatype>
              <trackindex>3</trackindex>
              <clipindex>${i + 1}</clipindex>
              <groupindex>${i + 1}</groupindex>
              </link>
            </clipitem>
`;
    }

    xml += `          </track>
        </video>
      <audio>
        <channelcount>2</channelcount>
        <track>
`;

    // オーディオトラック: ビデオトラックと同じクリップを繰り返す
    sequenceTime = 0;
    for (let i = 0; i < keepClips.length; i++) {
      const clip = keepClips[i];
      const label = i % 2 === 0 ? 'Rose' : 'Cerulean';

      xml += `          <clipitem>
            <labels>
              <label2>${label}</label2>
              </labels>
            <name>${this.escapeXml(videoName)}</name>
            <enabled>true</enabled>
            <rate>
              <timebase>${frameRate.toFixed(1)}</timebase>
              <ntsc>false</ntsc>
              </rate>
            <in>${clip.start.toFixed(3)}</in>
            <out>${clip.end.toFixed(3)}</out>
            <start>${sequenceTime.toFixed(3)}</start>
            <end>${(sequenceTime + clip.duration).toFixed(3)}</end>
            <file id="${fileId}">
              <name>${this.escapeXml(videoName)}</name>
              <pathurl>${videoName}</pathurl>
              <media>
                <video>
                  <samplecharacteristics>
                    <width>${width}</width>
                    <height>${height}</height>
                    <anamorphic>false</anamorphic>
                    <pixelaspectratio>square</pixelaspectratio>
                    <fielddominance>none</fielddominance>
                    </samplecharacteristics>
                  </video>
                <audio>
                  <samplecharacteristics />
                  <channelcount>2</channelcount>
                  </audio>
                </media>
              </file>
            <link>
              <mediatype>video</mediatype>
              <trackindex>1</trackindex>
              <clipindex>${i + 1}</clipindex>
              <groupindex>${i + 1}</groupindex>
              </link>
            <link>
              <mediatype>audio</mediatype>
              <trackindex>1</trackindex>
              <clipindex>${i + 1}</clipindex>
              <groupindex>${i + 1}</groupindex>
              </link>
            <link>
              <mediatype>audio</mediatype>
              <trackindex>2</trackindex>
              <clipindex>${i + 1}</clipindex>
              <groupindex>${i + 1}</groupindex>
              </link>
            <link>
              <mediatype>text</mediatype>
              <trackindex>3</trackindex>
              <clipindex>${i + 1}</clipindex>
              <groupindex>${i + 1}</groupindex>
              </link>
            </clipitem>
`;

      sequenceTime += clip.duration;
    }

    xml += `          </track>
        </audio>
      </media>
    </sequence>
  </xmeml>`;

    return xml;
  }

  /**
   * SRT字幕ファイルを生成（Premiere Proで別途インポート可能）
   */
  generateSRT(captions) {
    let srt = '';

    for (let i = 0; i < captions.length; i++) {
      const caption = captions[i];
      const startTime = this.secondsToSRTTime(caption.start || 0);
      const endTime = this.secondsToSRTTime(caption.end || 0);

      srt += `${i + 1}\n`;
      srt += `${startTime} --> ${endTime}\n`;
      srt += `${caption.text}\n\n`;
    }

    return srt;
  }

  /**
   * 秒をSRT形式のタイムコードに変換 (HH:MM:SS,mmm)
   */
  secondsToSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
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

    // 4. SRT字幕ファイル
    const srt = this.generateSRT(captions);
    const srtPath = path.join(outputDir, `${baseName}_captions.srt`);
    await fs.writeFile(srtPath, srt, 'utf-8');
    files.srt = srtPath;

    // 5. 編集レポート (CSV)
    const csv = this.generateEditReport(keepClips, cutCandidates, captions);
    const csvPath = path.join(outputDir, `${baseName}_report.csv`);
    await fs.writeFile(csvPath, csv, 'utf-8');
    files.csv = csvPath;

    console.log('\n📦 エクスポート完了:');
    console.log(`   - XML: ${xmlPath}`);
    console.log(`   - EDL: ${edlPath}`);
    console.log(`   - SRT: ${srtPath}`);
    console.log(`   - JSON: ${jsonPath}`);
    console.log(`   - CSV Report: ${csvPath}`);

    return files;
  }

  /**
   * Generate Base64 encoded caption data for GraphicAndType effect
   * Based on exact binary structure from working Premiere Pro XML files
   *
   * Structure (total 668 bytes):
   * - Header: 240 bytes (font metadata, YuGothic-Bold)
   * - Text section: 302 bytes (UTF-8 text + zero padding)
   * - Footer: 126 bytes (effect parameters)
   */
  generateCaptionBase64(text) {
    // Fixed header (240 bytes) - includes font styling metadata for YuGothic-Bold
    const headerBase64 = 'kAIAAAAAAABEMyIRDAAAAAAABgAKAAQABgAAAGQAAAAAAF4AJAAUABAAAAAAACAAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAgAAAAAABsABwBeAAAAAAAAARwAAAAAAAABJAAAADwAAAAAAAAAAgAAAAIAAAAQ/v//FP7//xj+//8c/v//AQAAAAQAAAANAAAAWXVHb3RoaWMtQm9sZAAAAAEAAAAMAAAACAAMAAQACAAIAAAACAAAAGwBAAAsAQAA';

    // Fixed footer (126 bytes) - effect parameters
    const footerBase64 = 'NgAgAAAAHAAAAAAAGAAXABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAIAAQANgAAAAIAAAAYAAAAHAAAAAAAEEAAAAABIAAAAAAAkELg////BAAGAAQAAAAAAAoACAAFAAYABwAKAAAAAAAAAAQABAAEAAAA';

    // Convert header and footer to buffers
    const headerBuffer = Buffer.from(headerBase64, 'base64');
    const footerBuffer = Buffer.from(footerBase64, 'base64');

    // Encode text to UTF-8
    const textBuffer = Buffer.from(text, 'utf-8');

    // Text section must be exactly 302 bytes (text + zero padding)
    const TEXT_SECTION_SIZE = 302;
    const textSection = Buffer.alloc(TEXT_SECTION_SIZE);
    textBuffer.copy(textSection, 0);
    // Remaining bytes are already zeros (from Buffer.alloc)

    // Combine all parts: header (240) + text section (302) + footer (126) = 668 bytes total
    const finalBuffer = Buffer.concat([headerBuffer, textSection, footerBuffer]);

    return finalBuffer.toString('base64');
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
