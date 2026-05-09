const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const defaultBinaryPath = process.env.LLM_BINARY_PATH || path.join(__dirname, '..', 'llama.cpp', 'llama-server.exe');
const SERVER_PORT = 8000;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

let serverProcess = null;
let currentModelPath = null;

function isServerReady(timeout = 10000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tryConnect = () => {
      const req = http.get(`${SERVER_URL}/health`, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          resolve(false);
        } else {
          setTimeout(tryConnect, 500);
        }
      });
      req.end();
    };
    tryConnect();
  });
}

function startServer(modelPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(defaultBinaryPath)) {
      console.error('llama-server binary not found:', defaultBinaryPath);
      resolve(false);
      return;
    }

    if (!fs.existsSync(modelPath)) {
      console.error('Model file not found:', modelPath);
      resolve(false);
      return;
    }

    console.log('Starting llama-server with model:', modelPath);

    const args = [
      '-m', modelPath,
      '-p', `${SERVER_PORT}`,
      '-n', '256',
      '--slots', '1'
    ];

    serverProcess = spawn(defaultBinaryPath, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    serverProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('[llama-server]', data.toString().trim());
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[llama-server-error]', data.toString().trim());
    });

    serverProcess.on('error', (error) => {
      console.error('Failed to start llama-server:', error);
      resolve(false);
    });

    serverProcess.on('close', (code) => {
      console.log('llama-server exited with code:', code);
      serverProcess = null;
      currentModelPath = null;
    });

    // Wait for server to be ready
    isServerReady(15000).then((ready) => {
      if (ready) {
        currentModelPath = modelPath;
        console.log('llama-server is ready');
        resolve(true);
      } else {
        console.error('llama-server failed to start');
        if (serverProcess) {
          serverProcess.kill();
          serverProcess = null;
        }
        resolve(false);
      }
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
      currentModelPath = null;
      setTimeout(() => resolve(true), 1000);
    } else {
      resolve(true);
    }
  });
}

function queryServer(prompt) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      prompt: prompt,
      n_predict: 256,
      temperature: 0.7,
      top_p: 0.7,
      repeat_penalty: 1.1
    });

    const options = {
      hostname: '127.0.0.1',
      port: SERVER_PORT,
      path: '/completion',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 120000 // 2 minutes max
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response.content || '');
        } catch (error) {
          console.error('Failed to parse server response:', error);
          resolve('');
        }
      });
    });

    req.on('error', (error) => {
      console.error('Server request error:', error);
      resolve('');
    });

    req.on('timeout', () => {
      req.destroy();
      resolve('');
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  startServer,
  stopServer,
  queryServer,
  isServerRunning: () => serverProcess !== null,
  getCurrentModelPath: () => currentModelPath,
  SERVER_URL
};
