import { useEffect, useState } from 'react';
import defaultCharacters from '../characters/defaultCharacters';
import defaultScenes from '../scenes/defaultScenes';

function App() {
  const [scenes, setScenes] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [selectedProtagonistId, setSelectedProtagonistId] = useState('');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelFiles, setModelFiles] = useState([]);
  const [selectedModelPath, setSelectedModelPath] = useState('');
  const [modelDirectory, setModelDirectory] = useState('');
  const [modelLoadingMessage, setModelLoadingMessage] = useState('');
  const [characterImages, setCharacterImages] = useState({});

  const scene = scenes.find((item) => item.id === selectedSceneId);
  const activeCharacter = characters.find((ch) => ch.id === scene?.activeCharacterId);
  const protagonist = characters.find((ch) => ch.id === selectedProtagonistId);

  useEffect(() => {
    setCharacters(defaultCharacters);
    setScenes(defaultScenes);
    setSelectedSceneId(defaultScenes[0]?.id || '');
    setSelectedProtagonistId(defaultCharacters[0]?.id || '');
  }, []);

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

  useEffect(() => {
    window.electron.invoke('list-character-images').then((result) => {
      setCharacterImages(result?.images || {});
    }).catch((error) => {
      console.error('Failed to load character images:', error);
      setCharacterImages({});
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
    if (!inputText.trim() || !scene || !activeCharacter || !protagonist) return;

    const userMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      characterId: protagonist.id,
      text: inputText
    };
    appendMessage(scene.id, userMessage);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await window.electron.invoke('query-local-llm', {
        character: activeCharacter,
        protagonist,
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
            <h3>主人公</h3>
            <select
              className="protagonist-select"
              value={selectedProtagonistId}
              onChange={(e) => setSelectedProtagonistId(e.target.value)}
            >
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
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
          <div className="input-area input-area-top">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="メッセージを入力してください"
              rows={2}
            />
            <button onClick={handleSend} disabled={isLoading || !inputText.trim()}>
              {isLoading ? '送信中...' : '送信'}
            </button>
          </div>
          <div className="chat-window">
            {[...(scene?.messages || [])].reverse().map((message) => {
              const isUser = message.sender === 'user';
              const isSystem = message.sender === 'system';
              const character = characters.find((ch) => ch.id === message.characterId);
              const displayName = isSystem ? 'System' : isUser ? (character?.name || protagonist?.name || '主人公') : `${character?.name || 'キャラ'}`;
              const speakerId = message.characterId || protagonist?.id || '';
              const displayImage = isSystem ? '' : characterImages[speakerId];
              const fallbackIcon = isSystem ? '⚙' : (character?.icon || displayName.slice(0, 1));
              return (
                <div key={message.id} className={`chat-message ${isUser ? 'user' : isSystem ? 'system' : 'character'}`}>
                  <div className="chat-row">
                    <span className="chat-avatar" aria-hidden="true">
                      {displayImage ? (
                        <img src={displayImage} alt="" className="chat-avatar-image" />
                      ) : fallbackIcon}
                    </span>
                    <div className="chat-content">
                      <div className="chat-meta">
                        <span>{displayName}</span>
                      </div>
                      <div className="chat-body">{message.text}</div>
                    </div>
                  </div>
                </div>
              );
            })}
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