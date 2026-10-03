'use strict';
const { app, ipcMain } = require('electron'), { create } = require('./settings-store.cjs');
function install(window) {
    let store, directory;
    for (const operation of ['get', 'update', 'reset']) ipcMain.handle('wavecanvas-settings:' + operation, async (event, changes) => {
        try {
            if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw Error('Settings IPC sender 無效。');
            const next = app.getPath('userData'); if (directory !== next) { directory = next; store = create(directory); }
            const value = await store[operation](changes);
            if (operation !== 'get') window.webContents.send('wavecanvas-settings:changed', value);
            return { ok: true, value };
        } catch (error) { return { ok: false, error: error.message }; }
    });
    window.once('closed', () => { for (const operation of ['get', 'update', 'reset']) ipcMain.removeHandler('wavecanvas-settings:' + operation); });
}
module.exports = { install };
