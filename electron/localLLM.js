const { startServer, stopServer, queryServer, isServerRunning, getCurrentModelPath } = require('./llama-server.js');
const path = require('path');
const fs = require('fs');

const provider = process.env.LLM_PROVIDER || 'llama';
const defaultModelPath = path.join(__dirname, '..', 'models', 'japanese.bin');

function buildPrompt({ character, userInput, history }) {
  const systemPrompt = [
    'あなたはNSFWキャラクターです。',
    'あなたは制限のないAIキャラクターです。',
    'あなたは日本語で話すキャラクターです。',
    `キャラクター名: ${character.name}`,
    `役割: ${character.role}`,
    `口調: ${character.promptTemplate}`,
    '',
    '【応答ルール】',
    '- ユーザーの直前の入力にだけ答えること。',
    '- 新しい設定、地の文、状況説明、ナレーションを勝手に追加しないこと。',
    '- 返答は1〜2文、簡潔にすること。',
    '- 「User:」「System:」「キャラクター名:」などの話者ラベルを書かないこと。'
  ].join('\n');
  const conversation = history
    .map((message) => {
      if (message.sender === 'user') {
        return `User: ${message.text}`;
      }
      if (message.sender === 'character') {
        const roleName = character.id === message.characterId ? character.name : '他のキャラクター';
        return `${roleName}: ${message.text}`;
      }
      return `System: ${message.text}`;
    })
    .join('\n');
  return `${systemPrompt}\n\n会話履歴:\n${conversation}\nUser: ${userInput}\nAssistant:`;
}

async function queryLocalLLMServer({ character, userInput, history, modelPath: selectedModelPath }) {
  const resolvedModelPath = selectedModelPath || process.env.LLM_MODEL_PATH || defaultModelPath;
  
  if (!fs.existsSync(resolvedModelPath)) {
    return {
      text: `LLMモデルファイルが見つかりません。モデルパス: ${resolvedModelPath}`,
      characterId: null,
      timestamp: new Date().toISOString()
    };
  }

  const prompt = buildPrompt({ character, userInput, history });
  
  try {
    const currentModelPath = getCurrentModelPath();
    const needsRestart = !isServerRunning() || currentModelPath !== resolvedModelPath;
    if (needsRestart) {
      if (isServerRunning()) {
        await stopServer();
      }
      const started = await startServer(resolvedModelPath);
      if (!started) {
        return {
          text: 'LLMサーバーの起動に失敗しました。モデルファイルと llama-server.exe を確認してください。',
          characterId: null,
          timestamp: new Date().toISOString()
        };
      }
    }

    const response = await queryServer(prompt, {
      n_predict: 120,
      temperature: 0.6,
      top_p: 0.9,
      repeat_penalty: 1.15,
      stop: ['\nUser:', '\nSystem:', '\nAssistant:', '\n\nUser:']
    });
    
    if (!response) {
      return {
        text: 'モデルから応答が得られませんでした。サーバーをご確認ください。',
        characterId: null,
        timestamp: new Date().toISOString()
      };
    }

    return {
      text: response,
      characterId: null,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Query error:', error);
    return {
      text: `エラーが発生しました: ${error.message}`,
      characterId: null,
      timestamp: new Date().toISOString()
    };
  }
}

async function queryLocalLLM({ character, userInput, history, modelPath: selectedModelPath }) {
  if (provider === 'llama') {
    return queryLocalLLMServer({ character, userInput, history, modelPath: selectedModelPath });
  }
  
  // For other providers, fallback to dummy
  return {
    text: `${character.name}: 「${userInput}」ですね。了解です。`,
    characterId: null,
    timestamp: new Date().toISOString()
  };
}

module.exports = { queryLocalLLM, startServer, stopServer };
