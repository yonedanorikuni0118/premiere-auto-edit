import 'dotenv/config';
import OpenAI from 'openai';
import fs from 'fs';

async function testWhisper() {
  console.log('🔍 Whisper API接続テスト\n');

  // API Key確認
  const apiKey = process.env.OPENAI_API_KEY;
  console.log(`API Key設定: ${apiKey ? '✓ あり' : '✗ なし'}`);
  console.log(`API Key長さ: ${apiKey?.length || 0}文字`);
  console.log(`API Keyプレフィックス: ${apiKey?.substring(0, 10)}...`);
  console.log('');

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEYが設定されていません');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  try {
    console.log('🔗 OpenAI APIに接続中...');

    // まずモデル一覧を取得してAPI接続を確認
    const models = await openai.models.list();
    console.log('✅ API接続成功');
    console.log(`利用可能なモデル数: ${models.data.length}`);
    console.log('');

    // Whisperモデルがあるか確認
    const whisperModel = models.data.find(m => m.id.includes('whisper'));
    console.log(`Whisperモデル: ${whisperModel ? '✓ 利用可能' : '✗ 見つかりません'}`);
    console.log('');

    // 音声ファイルの確認
    const audioFiles = fs.readdirSync('data/cache').filter(f => f.endsWith('.wav'));
    if (audioFiles.length === 0) {
      console.log('⚠️  テスト用の音声ファイルがありません');
      process.exit(0);
    }

    const audioPath = `data/cache/${audioFiles[audioFiles.length - 1]}`;
    const stats = fs.statSync(audioPath);
    console.log(`📁 テスト用音声ファイル: ${audioPath}`);
    console.log(`ファイルサイズ: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    console.log('');

    // Whisper APIテスト
    console.log('🎤 Whisper API テスト開始...');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      language: 'ja',
    });

    console.log('✅ 文字起こし成功！');
    console.log(`\n📝 テキスト: ${transcription.text}\n`);
    console.log(`文字数: ${transcription.text.length}文字`);

  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    console.error(`エラータイプ: ${error.constructor.name}`);
    console.error(`メッセージ: ${error.message}`);
    console.error(`ステータス: ${error.status || 'N/A'}`);
    console.error(`コード: ${error.code || 'N/A'}`);

    if (error.response) {
      console.error(`レスポンス: ${JSON.stringify(error.response, null, 2)}`);
    }

    console.error('\n詳細:');
    console.error(error);

    process.exit(1);
  }
}

testWhisper();
