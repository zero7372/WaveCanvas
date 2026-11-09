'use strict';
const { app, ipcMain, shell } = require('electron');
const { create, RELEASE_PAGE } = require('./update-check.cjs');
// 更新檢查只提示新版，連結一律由 Main 開啟，且只開本專案的 Release 頁面。
function install(window) {
    const checker = create({ userData: app.getPath('userData'), version: app.getVersion() });
    const prefix = 'wavecanvas-update:', names = ['check', 'openRelease', 'skip'];
    function handle(name, handler) {
        ipcMain.handle(prefix + name, async (event, ...args) => {
            if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw Error('Update IPC sender invalid');
            return handler(...args);
        });
    }
    handle('check', manual => checker.check({ manual: manual === true }));
    handle('openRelease', async () => {
        const url = checker.latest()?.url || RELEASE_PAGE + 'latest';
        if (!url.startsWith(RELEASE_PAGE)) throw Error('Unexpected release URL');
        await shell.openExternal(url); return true;
    });
    handle('skip', version => checker.skip(version));
    window.once('closed', () => { for (const name of names) ipcMain.removeHandler(prefix + name); });
}
module.exports = { install };
