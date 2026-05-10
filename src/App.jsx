import { useEffect, useState } from 'react';
import defaultCharacters from '../characters/defaultCharacters';
import defaultScenes from '../scenes/defaultScenes';

const AVAILABLE_API_SERVICES = [
  { id: 'openai', name: 'OpenAI API' },
  { id: 'huggingface', name: 'Hugging Face Inference API' },
  { id: 'grok', name: 'Grok (xAI)' }
];

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
  const [selectedProvider, setSelectedProvider] = useState('api');
  const [selectedApiService, setSelectedApiService] = useState(AVAILABLE_API_SERVICES[0].id);
  const [characterIdDraft, setCharacterIdDraft] = useState('');
  const [characterManageMessage, setCharacterManageMessage] = useState('');
  const [characterDraft, setCharacterDraft] = useState({ name: '', role: '', promptTemplate: '' });
  const [sceneDraft, setSceneDraft] = useState({
    title: '',
    description: '',
    activeCharacterId: '',
    initialSystemMessage: ''
  });
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([]);
  const [editorState, setEditorState] = useState({
    open: false,
    targetType: '',
    field: '',
    title: '',
    value: ''
  });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [logMessage, setLogMessage] = useState('');

  const scene = scenes.find((item) => item.id === selectedSceneId);
  const participants = characters.filter((ch) => selectedParticipantIds.includes(ch.id));
  const activeCharacter = characters.find((ch) => ch.id === scene?.activeCharacterId) || participants[0];
  const protagonist = characters.find((ch) => ch.id === selectedProtagonistId);

  useEffect(() => {
    if (!activeCharacter) return;
    setCharacterDraft({
      name: activeCharacter.name || '',
      role: activeCharacter.role || '',
      promptTemplate: activeCharacter.promptTemplate || ''
    });
    setCharacterIdDraft(activeCharacter.id || '');
  }, [activeCharacter?.id]);

  useEffect(() => {
    if (!scene) return;
    setSceneDraft({
      title: scene.title || '',
      description: scene.description || '',
      activeCharacterId: scene.activeCharacterId || '',
      initialSystemMessage: scene.initialSystemMessage || ''
    });
  }, [scene?.id]);

  const toggleParticipantSelection = (characterId) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(characterId)
        ? prev.filter((id) => id !== characterId)
        : [...prev, characterId]
    );
  };

  const addScene = () => {
    const createdAt = Date.now();
    const newScene = {
      id: `scene-${createdAt}`,
      title: '新しいシーン',
      description: '',
      activeCharacterId: characters[0]?.id || '',
      initialSystemMessage: 'シーン「新しいシーン」が開始されました。',
      messages: [
        {
          id: `m-${createdAt}`,
          sender: 'system',
          text: 'シーン「新しいシーン」が開始されました。'
        }
      ]
    };
    setScenes((prev) => [...prev, newScene]);
    setSelectedSceneId(newScene.id);
  };

  const deleteScene = () => {
    if (!scene) return;
    if (scenes.length <= 1) return;
    setScenes((prev) => prev.filter((item) => item.id !== scene.id));
    const remainingScenes = scenes.filter((item) => item.id !== scene.id);
    setSelectedSceneId(remainingScenes[0]?.id || '');
  };

  const parseAssistantResponse = (text, participants) => {
    const participantNames = participants.map((participant) => participant.name);
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const parsedMessages = [];
    let activeSpeaker = null;
    let currentMessage = null;

    const createSystemMessage = (content) => {
      const msg = {
        id: `sys-${Date.now()}-${parsedMessages.length}`,
        sender: 'system',
        text: content
      };
      parsedMessages.push(msg);
      return msg;
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const labelMatch = line.match(/^(.+?)[:：]\s*(.*)$/);
      if (labelMatch) {
        const label = labelMatch[1].trim();
        const body = labelMatch[2].trim();
        const participant = participants.find((p) => p.name === label);
        if (participant) {
          if (currentMessage && currentMessage.sender === 'character' && currentMessage.characterId === participant.id) {
            currentMessage.text += body ? `\n${body}` : '';
          } else {
            currentMessage = {
              id: `c-${Date.now()}-${parsedMessages.length}`,
              sender: 'character',
              characterId: participant.id,
              text: body
            };
            parsedMessages.push(currentMessage);
          }
          activeSpeaker = participant;
          continue;
        }
        if (label.toLowerCase() === 'system' || label === 'System' || label === '地の文') {
          currentMessage = createSystemMessage(body);
          activeSpeaker = null;
          continue;
        }
      }
      if (activeSpeaker && currentMessage && currentMessage.sender === 'character') {
        currentMessage.text += `\n${line}`;
      } else if (parsedMessages.length && parsedMessages[parsedMessages.length - 1].sender === 'system') {
        parsedMessages[parsedMessages.length - 1].text += `\n${line}`;
      } else {
        createSystemMessage(line);
      }
    }

    return parsedMessages.length > 0
      ? parsedMessages
      : [
          {
            id: `sys-${Date.now()}`,
            sender: 'system',
            text
          }
        ];
  };

  const saveLog = async () => {
    if (!scene || !scene.messages || scene.messages.length === 0) {
      setLogMessage('セーブするメッセージがありません');
      setTimeout(() => setLogMessage(''), 3000);
      return;
    }

    try {
      const result = await window.electron.invoke('save-log', {
        sceneTitle: scene.title,
        messages: scene.messages
      });

      if (result.success) {
        setLogMessage(`✅ ログを保存しました: ${result.fileName}`);
      } else {
        setLogMessage(`❌ ${result.message}`);
      }
      setTimeout(() => setLogMessage(''), 3000);
    } catch (error) {
      setLogMessage(`❌ エラー: ${error.message}`);
      setTimeout(() => setLogMessage(''), 3000);
    }
  };

  const loadLog = async () => {
    try {
      const result = await window.electron.invoke('list-logs');
      if (!result.success || result.logs.length === 0) {
        setLogMessage('保存されたログがありません');
        setTimeout(() => setLogMessage(''), 3000);
        return;
      }

      const latestLog = result.logs[0];
      const logResult = await window.electron.invoke('load-log', latestLog.name);
      if (!logResult.success) {
        setLogMessage(`❌ ${logResult.message}`);
        setTimeout(() => setLogMessage(''), 3000);
        return;
      }

      const logData = logResult.data;
      setScenes((prev) =>
        prev.map((item) =>
          item.id === scene.id
            ? {
                ...item,
                messages: logData.messages,
                title: logData.sceneTitle || item.title
              }
            : item
        )
      );
      setLogMessage(`✅ ログを読込しました: ${latestLog.name}`);
      setTimeout(() => setLogMessage(''), 3000);
    } catch (error) {
      setLogMessage(`❌ エラー: ${error.message}`);
      setTimeout(() => setLogMessage(''), 3000);
    }
  };

  const openLogsViewer = async () => {
    try {
      await window.electron.invoke('open-logs-viewer');
    } catch (error) {
      console.error('Failed to open logs viewer:', error);
    }
  };

  useEffect(() => {
    setCharacters(defaultCharacters);
    setScenes(defaultScenes);
    setSelectedSceneId(defaultScenes[0]?.id || '');
    setSelectedProtagonistId(defaultCharacters[0]?.id || '');
    setSelectedParticipantIds(defaultCharacters.map((character) => character.id));
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  useEffect(() => {
    window.electron.invoke('list-models').then((result) => {
      if (result?.models?.length) {
        setModelFiles(result.models);
        setModelDirectory(result.modelDirectory);
        const initialModelPath = result.models[0].path;
        setSelectedModelPath(initialModelPath);
        if (selectedProvider === 'local') {
          handleModelChange(initialModelPath);
        }
      }
    }).catch((error) => {
      console.error('Failed to load model files:', error);
    });
  }, [selectedProvider]);

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
    const selectedParticipants = participants.length ? participants : [activeCharacter].filter(Boolean);
    if (!inputText.trim() || !scene || selectedParticipants.length === 0 || !protagonist) return;

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
        provider: selectedProvider,
        apiService: selectedApiService,
        participants: selectedParticipants,
        protagonist,
        userInput: inputText,
        history: scene.messages,
        modelPath: selectedModelPath
      });

      const assistantMessages = parseAssistantResponse(response.text, selectedParticipants);
      assistantMessages.forEach((message) => appendMessage(scene.id, message));
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

  const updateSceneSettings = (field, value) => {
    if (!scene) return;
    setScenes((prev) =>
      prev.map((item) =>
        item.id === scene.id ? { ...item, [field]: value } : item
      )
    );
  };

  const refreshConversation = async () => {
    if (!scene) return;
    const resetMessage = scene.initialSystemMessage || `シーン「${scene.title}」が開始されました。キャラクターを選んで会話を始めてください。`;
    setScenes((prev) =>
      prev.map((item) =>
        item.id === scene.id
          ? {
              ...item,
              messages: [
                {
                  id: `m-reset-${Date.now()}`,
                  sender: 'system',
                  text: resetMessage
                }
              ]
            }
          : item
      )
    );
    if (selectedModelPath) {
      await window.electron.invoke('load-model', selectedModelPath);
    }
  };

  const updateActiveCharacter = (field, value) => {
    if (!activeCharacter) return;
    setCharacters((prev) =>
      prev.map((item) =>
        item.id === activeCharacter.id ? { ...item, [field]: value } : item
      )
    );
  };

  const saveCharacterSettings = () => {
    if (!activeCharacter) return;
    updateActiveCharacter('name', characterDraft.name);
    updateActiveCharacter('role', characterDraft.role);
    updateActiveCharacter('promptTemplate', characterDraft.promptTemplate);
  };

  const showCharacterManageMessage = (message) => {
    setCharacterManageMessage(message);
    setTimeout(() => setCharacterManageMessage(''), 2500);
  };

  const addCharacter = () => {
    const createdAt = Date.now();
    const newCharacter = {
      id: `char-${createdAt}`,
      name: '新しいキャラクター',
      role: '新規キャラクター',
      promptTemplate: '自由に会話する',
      color: '#8b5cf6',
      icon: '🙂'
    };
    setCharacters((prev) => [...prev, newCharacter]);
    setSelectedParticipantIds((prev) => [...prev, newCharacter.id]);
    if (!scene) {
      setSelectedProtagonistId(newCharacter.id);
      showCharacterManageMessage('キャラクターを追加しました');
      return;
    }
    setScenes((prev) =>
      prev.map((item) =>
        item.id === scene.id ? { ...item, activeCharacterId: newCharacter.id } : item
      )
    );
    setSelectedProtagonistId((prev) => prev || newCharacter.id);
    setCharacterIdDraft(newCharacter.id);
    showCharacterManageMessage('キャラクターを追加しました');
  };

  const changeCharacterId = () => {
    if (!activeCharacter) return;
    const nextId = characterIdDraft.trim();
    if (!nextId) {
      showCharacterManageMessage('IDを入力してください');
      return;
    }
    if (nextId === activeCharacter.id) {
      showCharacterManageMessage('IDは変更されていません');
      return;
    }
    if (characters.some((character) => character.id === nextId)) {
      showCharacterManageMessage('そのIDは既に使われています');
      return;
    }

    const oldId = activeCharacter.id;
    setCharacters((prev) =>
      prev.map((item) =>
        item.id === oldId ? { ...item, id: nextId } : item
      )
    );
    setScenes((prev) =>
      prev.map((item) => ({
        ...item,
        activeCharacterId: item.activeCharacterId === oldId ? nextId : item.activeCharacterId,
        messages: item.messages.map((message) =>
          message.characterId === oldId ? { ...message, characterId: nextId } : message
        )
      }))
    );
    setSelectedProtagonistId((prev) => (prev === oldId ? nextId : prev));
    setSceneDraft((prev) => ({
      ...prev,
      activeCharacterId: prev.activeCharacterId === oldId ? nextId : prev.activeCharacterId
    }));
    showCharacterManageMessage('キャラクターIDを変更しました');
  };

  const deleteCharacter = () => {
    if (!activeCharacter) return;
    if (characters.length <= 1) {
      showCharacterManageMessage('最後の1人は削除できません');
      return;
    }

    const deletingId = activeCharacter.id;
    const fallback = characters.find((character) => character.id !== deletingId);
    if (!fallback) return;

    setCharacters((prev) => prev.filter((item) => item.id !== deletingId));
    setScenes((prev) =>
      prev.map((item) => ({
        ...item,
        activeCharacterId: item.activeCharacterId === deletingId ? fallback.id : item.activeCharacterId,
        messages: item.messages.map((message) =>
          message.characterId === deletingId ? { ...message, characterId: fallback.id } : message
        )
      }))
    );
    setSelectedProtagonistId((prev) => (prev === deletingId ? fallback.id : prev));
    setSceneDraft((prev) => ({
      ...prev,
      activeCharacterId: prev.activeCharacterId === deletingId ? fallback.id : prev.activeCharacterId
    }));
    setCharacterIdDraft(fallback.id);
    showCharacterManageMessage('キャラクターを削除しました');
  };

  const saveSceneSettings = () => {
    if (!scene) return;
    updateSceneSettings('title', sceneDraft.title);
    updateSceneSettings('description', sceneDraft.description);
    updateSceneSettings('activeCharacterId', sceneDraft.activeCharacterId);
    updateSceneSettings('initialSystemMessage', sceneDraft.initialSystemMessage);
  };

  const openEditor = ({ targetType, field, title, value }) => {
    setEditorState({
      open: true,
      targetType,
      field,
      title,
      value: value || ''
    });
  };

  const closeEditor = () => {
    setEditorState({
      open: false,
      targetType: '',
      field: '',
      title: '',
      value: ''
    });
  };

  const saveEditor = () => {
    if (!editorState.open) return;
    if (editorState.targetType === 'scene') {
      setSceneDraft((prev) => ({ ...prev, [editorState.field]: editorState.value }));
    }
    if (editorState.targetType === 'character') {
      setCharacterDraft((prev) => ({ ...prev, [editorState.field]: editorState.value }));
    }
    closeEditor();
  };

  return (
    <div className="app-container">
      <div className="model-selector-header">
        <div className="model-selector-content">
          <div className="theme-selector">
            <label>
              <input
                type="radio"
                name="theme"
                value="light"
                checked={!isDarkMode}
                onChange={() => setIsDarkMode(false)}
              />
              通常モード
            </label>
            <label>
              <input
                type="radio"
                name="theme"
                value="dark"
                checked={isDarkMode}
                onChange={() => setIsDarkMode(true)}
              />
              ダークモード
            </label>
          </div>
          <div className="provider-selector">
            <label>
              <input
                type="radio"
                name="provider"
                value="api"
                checked={selectedProvider === 'api'}
                onChange={() => setSelectedProvider('api')}
              />
              APIモード
            </label>
            <label>
              <input
                type="radio"
                name="provider"
                value="local"
                checked={selectedProvider === 'local'}
                onChange={() => setSelectedProvider('local')}
              />
              ローカルLLM
            </label>
          </div>
          {selectedProvider === 'api' && (
            <div className="api-service-selector">
              <label htmlFor="api-service-select">API サービス:</label>
              <select
                id="api-service-select"
                value={selectedApiService}
                onChange={(e) => setSelectedApiService(e.target.value)}
              >
                {AVAILABLE_API_SERVICES.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label htmlFor="model-select">モデル選択:</label>
          <select
            id="model-select"
            value={selectedModelPath}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={isLoading || selectedProvider !== 'local'}
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
          <div className="log-controls">
            <button className="secondary-button" onClick={saveLog}>💾 保存</button>
            <button className="secondary-button" onClick={loadLog}>📂 開く</button>
            <button className="secondary-button" onClick={openLogsViewer}>📋 ログビューア</button>
          </div>
          {logMessage && (
            <div className="log-message">{logMessage}</div>
          )}
        </div>
      </div>

      <div className="layout">
        <aside className="panel panel-left">
          <div className="panel-header">会話参加キャラクター</div>
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
            <h3>参加キャラクター</h3>
            <div className="participant-checkboxes">
              {characters.map((character) => (
                <label key={character.id} className="participant-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedParticipantIds.includes(character.id)}
                    onChange={() => toggleParticipantSelection(character.id)}
                  />
                  {character.name}
                </label>
              ))}
            </div>
            <button className="secondary-button character-manage-button" onClick={addCharacter}>
              + キャラクター追加
            </button>
          </div>
        </aside>

        <main className="panel panel-center">
          <div className="panel-header-row">
            <div className="panel-header">会話シーン</div>
            <button className="secondary-button" onClick={refreshConversation} disabled={isLoading}>
              ログをリフレッシュ
            </button>
          </div>
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

        <aside className="panel panel-scene-list">
          <div className="panel-header-row">
            <div className="panel-header">シーン一覧</div>
            <div className="scene-list-actions">
              <button className="secondary-button" onClick={addScene}>追加</button>
              <button className="secondary-button" onClick={deleteScene} disabled={scenes.length <= 1}>削除</button>
            </div>
          </div>
          {scenes.map((item) => (
            <button
              key={item.id}
              className={`scene-button ${item.id === selectedSceneId ? 'active' : ''}`}
              onClick={() => selectScene(item.id)}
            >
              {item.title}
            </button>
          ))}
        </aside>

        <aside className="panel panel-right">
          <div className="panel-header-row">
            <div className="panel-header">キャラクタープロンプト</div>
            <button className="secondary-button" onClick={saveCharacterSettings}>保存</button>
          </div>
          {activeCharacter ? (
            <div className="character-detail">
              <div className="character-id-editor">
                <label htmlFor="character-name-input">キャラ名</label>
                <input
                  id="character-name-input"
                  value={characterDraft.name}
                  onChange={(e) => setCharacterDraft((prev) => ({ ...prev, name: e.target.value }))}
                />
                <label htmlFor="character-id-input">キャラクターID</label>
                <div className="character-id-row">
                  <input
                    id="character-id-input"
                    value={characterIdDraft}
                    onChange={(e) => setCharacterIdDraft(e.target.value)}
                  />
                  <button className="secondary-button" onClick={changeCharacterId}>ID変更</button>
                </div>
                <button className="secondary-button delete-button" onClick={deleteCharacter}>
                  このキャラを削除
                </button>
                {characterManageMessage ? (
                  <div className="character-manage-message">{characterManageMessage}</div>
                ) : null}
              </div>
              <div className="character-header-block">
                <div className="character-name" style={{ borderColor: activeCharacter.color }}>
                  {characterDraft.name || activeCharacter.name}
                </div>
                {characterImages[activeCharacter.id] ? (
                  <img
                    src={characterImages[activeCharacter.id]}
                    alt={characterDraft.name || activeCharacter.name}
                    className="character-profile-image"
                  />
                ) : null}
              </div>
              <button
                className="field-label-button"
                onClick={() => openEditor({
                  targetType: 'character',
                  field: 'role',
                  title: 'キャラクター役割を編集',
                  value: characterDraft.role
                })}
              >
                役割を編集
              </button>
              <div className="field-preview">{characterDraft.role}</div>
              <button
                className="field-label-button"
                onClick={() => openEditor({
                  targetType: 'character',
                  field: 'promptTemplate',
                  title: 'キャラクタープロンプトを編集',
                  value: characterDraft.promptTemplate
                })}
              >
                プロンプトを編集
              </button>
              <div className="field-preview">{characterDraft.promptTemplate}</div>
            </div>
          ) : (
            <div>キャラクターを選択してください。</div>
          )}
        </aside>

        <aside className="panel panel-right panel-scene-settings">
          <div className="panel-header-row">
            <div className="panel-header">シーン設定</div>
            <button className="secondary-button" onClick={saveSceneSettings}>保存</button>
          </div>
          {scene ? (
            <div className="scene-settings-form">
              <label htmlFor="scene-title">シーン名</label>
              <input
                id="scene-title"
                value={sceneDraft.title}
                onChange={(e) => setSceneDraft((prev) => ({ ...prev, title: e.target.value }))}
              />

              <button
                className="field-label-button"
                onClick={() => openEditor({
                  targetType: 'scene',
                  field: 'description',
                  title: 'シーン説明を編集',
                  value: sceneDraft.description
                })}
              >
                説明を編集
              </button>
              <div className="field-preview">{sceneDraft.description}</div>

              <label htmlFor="scene-active-character">初期会話キャラ</label>
              <select
                id="scene-active-character"
                value={sceneDraft.activeCharacterId}
                onChange={(e) => setSceneDraft((prev) => ({ ...prev, activeCharacterId: e.target.value }))}
              >
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>

              <button
                className="field-label-button"
                onClick={() => openEditor({
                  targetType: 'scene',
                  field: 'initialSystemMessage',
                  title: '初期システムメッセージを編集',
                  value: sceneDraft.initialSystemMessage || ''
                })}
              >
                初期システムメッセージを編集
              </button>
              <div className="field-preview">{sceneDraft.initialSystemMessage || '未設定'}</div>
            </div>
          ) : (
            <div>シーンを選択してください。</div>
          )}
        </aside>
      </div>

      {editorState.open && (
        <div className="editor-modal-overlay" role="dialog" aria-modal="true">
          <div className="editor-modal">
            <div className="editor-modal-title">{editorState.title}</div>
            <textarea
              className="editor-modal-textarea"
              value={editorState.value}
              onChange={(e) => setEditorState((prev) => ({ ...prev, value: e.target.value }))}
              rows={10}
            />
            <div className="editor-modal-actions">
              <button className="secondary-button" onClick={closeEditor}>キャンセル</button>
              <button onClick={saveEditor}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;