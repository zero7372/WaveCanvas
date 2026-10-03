'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const invoke = async (name, ...args) => {
    const result = await ipcRenderer.invoke('wavecanvas-project:' + name, ...args);
    if (!result.ok) throw new Error(result.error);
    return result.value;
};
const settingsInvoke = async (name, ...args) => {
    const result = await ipcRenderer.invoke('wavecanvas-settings:' + name, ...args);
    if (!result.ok) throw new Error(result.error); return result.value;
};
contextBridge.exposeInMainWorld('waveCanvas', { release: {
    info: () => ipcRenderer.invoke('wavecanvas-release:info'),
    read: () => ipcRenderer.invoke('wavecanvas-release:read'), openLicenses: () => ipcRenderer.invoke('wavecanvas-release:openLicenses')
}, settings: {
    get: () => settingsInvoke('get'), update: (changes, restoringDefaults = false) => settingsInvoke('update', changes, restoringDefaults), reset: () => settingsInvoke('reset'),
    chooseDirectory: () => settingsInvoke('chooseDirectory'), openDataFolder: () => settingsInvoke('openDataFolder'),
    onChanged(callback) { const listener = (_event, value) => callback(value); ipcRenderer.on('wavecanvas-settings:changed', listener); return () => ipcRenderer.removeListener('wavecanvas-settings:changed', listener); }
}, project: {
    open: recentPath => invoke('open', recentPath),
    takeExternal: () => invoke('takeExternal'), openExternal: token => invoke('openExternal', token), discardExternal: token => invoke('discardExternal', token),
    onExternalRequested(callback) { const listener = () => callback(); ipcRenderer.on('wavecanvas-project:externalRequested', listener); return () => ipcRenderer.removeListener('wavecanvas-project:externalRequested', listener); },
    save: (project, kind = 'save') => invoke('save', project, kind),
    collect: project => invoke('collect', project),
    readMedia: (token, slot) => invoke('readMedia', token, slot),
    activate: token => invoke('activate', token),
    registerMedia: (slot, file) => { const name = webUtils.getPathForFile(file); return name ? invoke('registerMedia', slot, name) : Promise.resolve(null); },
    confirmUnsaved: () => invoke('confirmUnsaved'),
    getRecent: () => invoke('getRecent'), removeRecent: file => invoke('removeRecent', file),
    newProject: () => invoke('new'), status: status => invoke('status', status), finishClose: () => invoke('finishClose'),
    onCloseRequested(callback) { const listener = () => callback(); ipcRenderer.on('wavecanvas-project:closeRequested', listener); return () => ipcRenderer.removeListener('wavecanvas-project:closeRequested', listener); }
}, export: {
    selectOutput: name => ipcRenderer.invoke('wavecanvas-export:selectOutput', name),
    start: payload => ipcRenderer.invoke('wavecanvas-export:start', payload),
    cancel: () => ipcRenderer.invoke('wavecanvas-export:cancel'),
    reveal: () => ipcRenderer.invoke('wavecanvas-export:reveal'),
    onProgress(callback) { const listener = (_event, value) => callback(value); ipcRenderer.on('wavecanvas-export:progress', listener); return () => ipcRenderer.removeListener('wavecanvas-export:progress', listener); }
} });
