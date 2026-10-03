const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('exportData', { read: () => ipcRenderer.invoke('wavecanvas-export:payload') });
