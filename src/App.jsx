import { useEffect, useState } from 'react';

const defaultCharacters = [
  {
    id: 'hero',
    name: 'アリア',
    role: '主人公の親友',
    promptTemplate: '明るく前向きに話す',
    color: '#7c4dff'
  },
  {
    id: 'mentor',
    name: 'セリス',
    role: '案内役',
    promptTemplate: '落ち着いて丁寧に説明する',
    color: '#0288d1'
  },
  {
    id: 'mystic',
    name: 'ルーク',
    role: '謎めいた予言者',
    promptTemplate: '少し抽象的に語る',
    color: '#d32f2f'
  },
  {
    id: '001',
    name: 'シェリー',
    role: 'えっち大好きセクシーお姉さん。経験人数500人以上',
    promptTemplate: 'セクハラを好むお姉さん',
    color: '#d32f2f'
  }
];

const initialScenes = [
  {
    id: 'scene-1',
    title: 'はじまりの街',
    description: 'ユーザーは3人のキャラクターと出会い、冒険の種をまく。',
    activeCharacterId: 'hero',
    messages: [
      {
        id: 'm0',
        sender: 'system',
        text: 'シーン「はじまりの街」が開始されました。キャラクターを選んで会話を始めてください。'
      }
    ]
  }
];

function App() {
  const [scenes, setScenes] = useState(initialScenes);
  const [characters] = useState(defaultCharacters);
  const [selectedSceneId, setSelectedSceneId] = useState('scene-1');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelFiles, setModelFiles] = useState([]);
  const [selectedModelPath, setSelectedModelPath] = useState('');
  const [modelDirectory, setModelDirectory] = useState('');
  const [modelLoadingMessage, setModelLoadingMessage] = useState('');

  const scene = scenes.find((item) => item.id === selectedSceneId);
  const activeCharacter = characters.find((ch) => ch.id === scene?.activeCharacterId);

  useEffect(() => {
    window.electron.invoke('list-models').then((result) => {
      if (result?.models?.length) {
        setModelFiles(result.models);
        setModelDirectory(result.modelDirectory);
        const initialModelPath = result.models[0].path;
        setSelectedModelPath(initialModelPath);
        handleModelChange(initialModelPath);
      }
    }).catch((error) => {
      console.error('Failed to load model files:', error);
    });
  }, []);

  const handleModelChange = async (newModelPath) => {
    setSelectedModelPath(newModelPath);
    setModelLoadingMessage('モデルをロード中...');
    try {
      const result = await window.electron.invoke('load-model', newModelPath);
      setModelLoadingMessage(result.success ? '✅ モデルをロードしました' : `❌ ${result.message}`);
      setTimeout(() => setModelLoadingMessage(''), 3000);
    } catch (error) {
      setModelLoadingMessage(`❌ エラー: ${error.message}`);
      setTimeout(() => setModelLoadingMessage(''), 3000);
    }
  };

  const appendMessage = (sceneId, message) => {
    setScenes((prev) =>
      prev.map((item) =>
        item.id === sceneId
          ? { ...item, messages: [...item.messages, message] }
          : item
      )
    );
  };

  const handleSend = async () => {
    if (!inputText.trim() || !scene || !activeCharacter) return;

    const userMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: inputText
    };
    appendMessage(scene.id, userMessage);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await window.electron.invoke('query-local-llm', {
        character: activeCharacter,
        userInput: inputText,
        history: scene.messages,
        modelPath: selectedModelPath
      });

      appendMessage(scene.id, {
        id: `c-${Date.now()}`,
        sender: 'character',
        characterId: activeCharacter.id,
        text: response.text
      });
    } catch (error) {
      appendMessage(scene.id, {
        id: `err-${Date.now()}`,
        sender: 'system',
        text: 'LLM呼び出しに失敗しました。'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectScene = (sceneId) => {
    setSelectedSceneId(sceneId);
  };

  const changeActiveCharacter = (characterId) => {
    if (!scene) return;
    setScenes((prev) =>
      prev.map((item) =>
        item.id === scene.id ? { ...item, activeCharacterId: characterId } : item
      )
    );
  };

  return (
    <div className="app-container">
      <div className="model-selector-header">
        <div className="model-selector-content">
          <label htmlFor="model-select">モデル選択:</label>
          <select
            id="model-select"
            value={selectedModelPath}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={isLoading}
          >
            {modelFiles.map((model) => (
              <option key={model.path} value={model.path}>
                {model.name}
              </option>
            ))}
          </select>
          {modelLoadingMessage && (
            <div className="model-loading-message">{modelLoadingMessage}</div>
          )}
        </div>
      </div>

      <div className="layout">
        <aside className="panel panel-left">
          <div className="panel-header">シーン一覧</div>
          {scenes.map((item) => (
            <button
              key={item.id}
              className={`scene-button ${item.id === selectedSceneId ? 'active' : ''}`}
              onClick={() => selectScene(item.id)}
            >
              {item.title}
            </button>
          ))}
          <div className="panel-section">
            <h3>キャラクター</h3>
            {characters.map((character) => (
              <button
                key={character.id}
                className={`character-button ${character.id === activeCharacter?.id ? 'active' : ''}`}
                style={{ borderColor: character.color }}
                onClick={() => changeActiveCharacter(character.id)}
              >
                {character.name}
              </button>
            ))}
          </div>
        </aside>

        <main className="panel panel-center">
          <div className="panel-header">会話シーン</div>
          <div className="scene-info">
            <h2>{scene?.title}</h2>
            <p>{scene?.description}</p>
          </div>
          <div className="chat-window">
            {scene?.messages.map((message) => {
              const isUser = message.sender === 'user';
              const isSystem = message.sender === 'system';
              const character = characters.find((ch) => ch.id === message.characterId);
              return (
                <div key={message.id} className={`chat-message ${isUser ? 'user' : isSystem ? 'system' : 'character'}`}>
                  <div className="chat-meta">
                    {isSystem ? 'System' : isUser ? 'You' : `${character?.name || 'キャラ'}`}
                  </div>
                  <div className="chat-body">{message.text}</div>
                </div>
              );
            })}
          </div>
          <div className="input-area">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="メッセージを入力してください"
              rows={3}
            />
            <button onClick={handleSend} disabled={isLoading || !inputText.trim()}>
              {isLoading ? '送信中...' : '送信'}
            </button>
          </div>
        </main>

        <aside className="panel panel-right">
          <div className="panel-header">キャラクタープロンプト</div>
          {activeCharacter ? (
            <div className="character-detail">
              <div className="character-name" style={{ borderColor: activeCharacter.color }}>
                {activeCharacter.name}
              </div>
              <p><strong>役割:</strong> {activeCharacter.role}</p>
              <p><strong>プロンプト:</strong></p>
              <pre>{activeCharacter.promptTemplate}</pre>
            </div>
          ) : (
            <div>キャラクターを選択してください。</div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;