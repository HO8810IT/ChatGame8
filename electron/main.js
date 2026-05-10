const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const { app, BrowserWindow, ipcMain } = require('electron');
const { queryLLM, startServer, stopServer } = require('./localLLM.js');

const DEV_SERVER_URL = 'http://127.0.0.1:5173';
const MODELS_DIR = path.join(__dirname, '..', 'models');
const CHARACTER_IMAGE_DIR = path.join(__dirname, '..', 'character_image');
const LOGS_DIR = path.join(__dirname, '..', 'logs');

function ensureModelsDir() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }
}

function ensureCharacterImageDir() {
  if (!fs.existsSync(CHARACTER_IMAGE_DIR)) {
    fs.mkdirSync(CHARACTER_IMAGE_DIR, { recursive: true });
  }
}

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function getMimeTypeByExt(ext) {
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return '';
}

function waitForDevServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryLoad = () => {
      const request = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      request.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Dev server not ready after ${timeoutMs}ms`));
        } else {
          setTimeout(tryLoad, 200);
        }
      });
    };
    tryLoad();
  });
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1680,
    height: 960,
    minWidth: 1420,
    minHeight: 820,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  } else {
    try {
      await waitForDevServer(DEV_SERVER_URL);
      await mainWindow.loadURL(DEV_SERVER_URL);
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } catch (error) {
      console.error(error);
      mainWindow.loadURL('data:text/html,<h1>Dev server failed to start</h1><p>Check the terminal for errors.</p>');
    }
  }
}

function setConsoleUtf8() {
  if (process.platform === 'win32' && process.stdout.isTTY) {
    exec('chcp 65001 > nul', (error) => {
      if (error) {
        console.error('Failed to set console code page to UTF-8:', error);
      }
    });
  }
}

app.whenReady().then(() => {
  setConsoleUtf8();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('query-local-llm', async (event, payload) => {
  return queryLLM(payload);
});

ipcMain.handle('list-models', async () => {
  try {
    ensureModelsDir();
    const files = fs.readdirSync(MODELS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => ({
        name: entry.name,
        path: path.join(MODELS_DIR, entry.name)
      }));
    return { models: files, modelDirectory: MODELS_DIR };
  } catch (error) {
    console.error('Failed to list models:', error);
    return { models: [], modelDirectory: MODELS_DIR };
  }
});

ipcMain.handle('load-model', async (event, modelPath) => {
  try {
    console.log('Loading model:', modelPath);
    await stopServer();
    const success = await startServer(modelPath);
    return { success, message: success ? 'モデルをロードしました' : 'モデルのロードに失敗しました' };
  } catch (error) {
    console.error('Failed to load model:', error);
    return { success: false, message: `エラー: ${error.message}` };
  }
});

ipcMain.handle('list-character-images', async () => {
  try {
    ensureCharacterImageDir();
    const allowedExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
    const images = {};
    const files = fs.readdirSync(CHARACTER_IMAGE_DIR, { withFileTypes: true });

    for (const entry of files) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedExts.has(ext)) continue;

      const id = path.basename(entry.name, ext);
      const filePath = path.join(CHARACTER_IMAGE_DIR, entry.name);
      const base64 = fs.readFileSync(filePath).toString('base64');
      const mimeType = getMimeTypeByExt(ext);
      if (!mimeType) continue;
      images[id] = `data:${mimeType};base64,${base64}`;
    }

    return { images, imageDirectory: CHARACTER_IMAGE_DIR };
  } catch (error) {
    console.error('Failed to list character images:', error);
    return { images: {}, imageDirectory: CHARACTER_IMAGE_DIR };
  }
});

ipcMain.handle('save-log', async (event, logData) => {
  try {
    ensureLogsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `log-${timestamp}.json`;
    const filePath = path.join(LOGS_DIR, fileName);
    const jsonData = {
      savedAt: new Date().toISOString(),
      sceneTitle: logData.sceneTitle || 'シーン',
      messages: logData.messages || []
    };
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf-8');
    return { success: true, fileName, filePath };
  } catch (error) {
    console.error('Failed to save log:', error);
    return { success: false, message: `ログ保存エラー: ${error.message}` };
  }
});

ipcMain.handle('list-logs', async () => {
  try {
    ensureLogsDir();
    const files = fs.readdirSync(LOGS_DIR)
      .filter((file) => file.startsWith('log-') && file.endsWith('.json'))
      .map((file) => ({
        name: file,
        path: path.join(LOGS_DIR, file),
        size: fs.statSync(path.join(LOGS_DIR, file)).size
      }))
      .sort((a, b) => b.name.localeCompare(a.name));
    return { success: true, logs: files, logsDir: LOGS_DIR };
  } catch (error) {
    console.error('Failed to list logs:', error);
    return { success: false, logs: [], message: `ログ一覧取得エラー: ${error.message}` };
  }
});

ipcMain.handle('load-log', async (event, fileName) => {
  try {
    ensureLogsDir();
    const filePath = path.join(LOGS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return { success: false, message: 'ファイルが見つかりません' };
    }
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return { success: true, data: jsonData };
  } catch (error) {
    console.error('Failed to load log:', error);
    return { success: false, message: `ログ読込エラー: ${error.message}` };
  }
});

ipcMain.handle('delete-log', async (event, fileName) => {
  try {
    ensureLogsDir();
    const filePath = path.join(LOGS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return { success: false, message: 'ファイルが見つかりません' };
    }
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete log:', error);
    return { success: false, message: `ログ削除エラー: ${error.message}` };
  }
});

ipcMain.handle('open-logs-viewer', async (event) => {
  const logsWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'logs-viewer-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (app.isPackaged) {
    logsWindow.loadFile(path.join(__dirname, '../dist/renderer/logs-viewer.html'));
  } else {
    logsWindow.loadFile(path.join(__dirname, '../electron/logs-viewer.html'));
  }
});

