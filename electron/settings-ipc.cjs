'use strict';
const { app, ipcMain, dialog, shell } = require('electron'), { create } = require('./settings-store.cjs');
function install(window) {
    let store, directory;
    window.waveCanvasSettings = () => { const next = app.getPath('userData'); if (directory !== next) { directory = next; store = create(directory); } return store; };
    for (const operation of ['get', 'update', 'reset', 'chooseDirectory', 'openDataFolder']) ipcMain.handle('wavecanvas-settings:' + operation, async (event, changes, restoringDefaults = false) => {
        try {
            if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw Error('Settings IPC sender 無效。');
            if (typeof restoringDefaults !== 'boolean') throw Error('Settings reset mode 無效。');
            if (operation === 'chooseDirectory') { const result = await dialog.showOpenDialog(window, { title: '選擇預設輸出資料夾', properties: ['openDirectory', 'createDirectory'] }); return { ok: true, value: result.canceled ? null : result.filePaths[0] }; }
            if (operation === 'openDataFolder') { const error = await shell.openPath(app.getPath('userData')); if (error) throw Error(error); return { ok: true, value: true }; }
            const value = await window.waveCanvasSettings()[operation](changes);
            if (operation === 'update' && !restoringDefaults) await window.waveCanvasTrimRecent?.(value.project.recentProjectsLimit).catch(error => console.error('Recent trim:', error.message));
            if (operation !== 'get') window.webContents.send('wavecanvas-settings:changed', value);
            return { ok: true, value };
        } catch (error) { return { ok: false, error: error.message }; }
    });
    window.once('closed', () => { for (const operation of ['get', 'update', 'reset', 'chooseDirectory', 'openDataFolder']) ipcMain.removeHandler('wavecanvas-settings:' + operation); });
}
module.exports = { install };
