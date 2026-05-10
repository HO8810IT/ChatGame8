let currentLogFile = null;
let currentLogData = null;

async function refreshLogs() {
  try {
    const result = await window.electron.invoke('list-logs');
    if (!result.success) {
      console.error(result.message);
      return;
    }

    const logsList = document.getElementById('logsList');
    logsList.innerHTML = '';

    if (result.logs.length === 0) {
      logsList.innerHTML = '<div class="empty-message">ログはありません</div>';
      return;
    }

    result.logs.forEach((log) => {
      const item = document.createElement('div');
      item.className = `log-item ${log.name === currentLogFile ? 'active' : ''}`;
      item.innerHTML = `
        <div class="log-item-name">${log.name}</div>
        <div class="log-item-size">${(log.size / 1024).toFixed(2)} KB</div>
      `;
      item.onclick = () => loadLog(log.name);
      logsList.appendChild(item);
    });
  } catch (error) {
    console.error('Failed to refresh logs:', error);
  }
}

async function loadLog(fileName) {
  try {
    const result = await window.electron.invoke('load-log', fileName);
    if (!result.success) {
      alert(result.message);
      return;
    }

    currentLogFile = fileName;
    currentLogData = result.data;
    displayLog(result.data);
    refreshLogs();
  } catch (error) {
    console.error('Failed to load log:', error);
    alert('ログの読込に失敗しました');
  }
}

function displayLog(logData) {
  const viewerTitle = document.getElementById('viewerTitle');
  const viewerContent = document.getElementById('viewerContent');

  viewerTitle.textContent = logData.sceneTitle || 'シーン';

  let html = `
    <div class="metadata">
      保存日時: ${new Date(logData.savedAt).toLocaleString('ja-JP')}
    </div>
  `;

  if (!logData.messages || logData.messages.length === 0) {
    html += '<div class="empty-message">メッセージはありません</div>';
    viewerContent.innerHTML = html;
    return;
  }

  logData.messages.forEach((message) => {
    const messageType = message.sender || 'system';
    const displayName = getDisplayName(message, messageType);
    const avatar = displayName.slice(0, 1);

    html += `
      <div class="message ${messageType}">
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
          <div class="message-name">${displayName}</div>
          <div class="message-text">${escapeHtml(message.text || '')}</div>
        </div>
      </div>
    `;
  });

  viewerContent.innerHTML = html;
}

function getDisplayName(message, messageType) {
  if (messageType === 'system') return 'システム';
  if (messageType === 'user') return 'ユーザー';
  return 'キャラクター';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function deleteCurrentLog() {
  if (!currentLogFile) {
    alert('ログが選択されていません');
    return;
  }

  if (!confirm(`${currentLogFile} を削除しますか？`)) {
    return;
  }

  try {
    const result = await window.electron.invoke('delete-log', currentLogFile);
    if (!result.success) {
      alert(result.message);
      return;
    }

    currentLogFile = null;
    currentLogData = null;
    document.getElementById('viewerTitle').textContent = 'ログを選択';
    document.getElementById('viewerContent').innerHTML = '<div class="empty-message">ログを選択してください</div>';
    await refreshLogs();
  } catch (error) {
    console.error('Failed to delete log:', error);
    alert('ログの削除に失敗しました');
  }
}

function exportJson() {
  if (!currentLogData) {
    alert('ログが選択されていません');
    return;
  }

  const dataStr = JSON.stringify(currentLogData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = currentLogFile || 'log.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

window.addEventListener('DOMContentLoaded', () => {
  refreshLogs();
  setInterval(refreshLogs, 5000);
});
