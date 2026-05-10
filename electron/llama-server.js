const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const defaultBinaryPath = process.env.LLM_BINARY_PATH || path.join(__dirname, '..', 'llama.cpp', 'llama-server.exe');
const DEFAULT_SERVER_PORT = Number(process.env.LLM_SERVER_PORT || 8000);
const FALLBACK_SERVER_PORT = 8080;
const CANDIDATE_PORTS = Array.from(new Set([DEFAULT_SERVER_PORT, FALLBACK_SERVER_PORT]));

let serverProcess = null;
let currentModelPath = null;
let currentServerPort = null;

function isServerReady(timeout = 10000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tryConnect = () => {
      let pending = CANDIDATE_PORTS.length;
      let matched = false;

      CANDIDATE_PORTS.forEach((port) => {
        const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
          res.resume();
          if (!matched) {
            matched = true;
            resolve(port);
          }
        });
        req.on('error', () => {
          pending -= 1;
          if (pending === 0 && !matched) {
            if (Date.now() - start > timeout) {
              resolve(null);
            } else {
              setTimeout(tryConnect, 500);
            }
          }
        });
        req.end();
      });
    };
    tryConnect();
  });
}

function getServerUrl() {
  const port = currentServerPort || DEFAULT_SERVER_PORT;
  return `http://127.0.0.1:${port}`;
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

    // Keep startup args minimal for broad llama-server compatibility.
    const args = ['-m', modelPath];

    serverProcess = spawn(defaultBinaryPath, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout.setEncoding('utf8');
    serverProcess.stderr.setEncoding('utf8');

    let stdout = '';
    serverProcess.stdout.on('data', (data) => {
      stdout += data;
      console.log('[llama-server]', data.trim());
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
      currentServerPort = null;
    });

    // Wait for server to be ready
    isServerReady(15000).then((readyPort) => {
      if (readyPort) {
        currentModelPath = modelPath;
        currentServerPort = readyPort;
        console.log(`llama-server is ready on port: ${readyPort}`);
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
      currentServerPort = null;
      setTimeout(() => resolve(true), 1000);
    } else {
      resolve(true);
    }
  });
}

function queryServer(prompt, generationOptions = {}) {
  return new Promise((resolve) => {
    const {
      n_predict = 256,
      temperature = 0.7,
      top_p = 0.7,
      repeat_penalty = 1.1,
      stop = []
    } = generationOptions;

    const payload = JSON.stringify({
      prompt: prompt,
      n_predict,
      temperature,
      top_p,
      repeat_penalty,
      stop
    });

    console.log('[LLM REQUEST PAYLOAD]');
    console.log(payload);

    const options = {
      hostname: '127.0.0.1',
      port: currentServerPort || DEFAULT_SERVER_PORT,
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
        console.log('[LLM RAW RESPONSE BODY]');
        console.log(data);
        try {
          const response = JSON.parse(data);
          console.log('[LLM PARSED RESPONSE CONTENT]');
          console.log(response.content || '');
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
  getCurrentServerPort: () => currentServerPort,
  getServerUrl
};
