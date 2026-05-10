const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  onLogLoaded: (callback) => ipcRenderer.on('log-loaded', (event, data) => callback(data))
});
