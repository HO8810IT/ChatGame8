const { startServer, stopServer, queryServer } = require('./llama-server.js');
const path = require('path');
const fs = require('fs');
const os = require('os');

const provider = process.env.LLM_PROVIDER || 'llama';
const defaultModelPath = path.join(__dirname, '..', 'models', 'japanese.bin');

function buildPrompt({ character, userInput, history }) {
  const systemPrompt = `あなたは日本語で話すキャラクターです。次の性格に沿って返答してください。\n\nキャラクター名: ${character.name}\n役割: ${character.role}\n口調: ${character.promptTemplate}\n\n`;
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
  return `${systemPrompt}会話履歴:\n${conversation}\nUser: ${userInput}\n${character.name}: `;
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
    const response = await queryServer(prompt);
    
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
