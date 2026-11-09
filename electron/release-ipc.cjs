'use strict';
const { app, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises'), path = require('node:path');
// Chromium 聲明約 20 MB，不讀進 App，改用系統瀏覽器開啟原檔。
const runtimeFile = (packagedName, devName) => path.join(path.dirname(process.execPath), app.isPackaged ? packagedName : devName);
function install(window) {
    const directory = app.isPackaged ? path.join(process.resourcesPath, 'licenses') : path.resolve(__dirname, '../licenses');
    const channel = 'wavecanvas-release:read';
    const infoChannel = 'wavecanvas-release:info';
    ipcMain.handle(infoChannel, event => {
        if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw Error('Release IPC sender invalid');
        return { name: app.getName(), version: app.getVersion() };
    });
    ipcMain.handle(channel, async event => {
        if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw Error('Release IPC sender invalid');
        const files = ['WaveCanvas-LICENSE.txt', 'THIRD_PARTY_NOTICES.md', 'FFmpeg/LICENSE', 'FFmpeg/dependencies/x264-COPYING', 'FFmpeg/SOURCE_INFO.txt'];
        const documents = await Promise.all(files.map(async name => ({ name, text: await fs.readFile(path.join(directory, name), 'utf8') })));
        // Electron 的授權由 electron-builder 放在執行檔旁；開發時位於 node_modules/electron/dist。
        documents.push({ name: 'Electron LICENSE', text: await fs.readFile(runtimeFile('LICENSE.electron.txt', 'LICENSE'), 'utf8') });
        return { name: app.getName(), version: app.getVersion(), license: 'MIT', signed: false, documents };
    });
    const folder = 'wavecanvas-release:openLicenses';
    ipcMain.handle(folder, async event => {
        if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw Error('Release IPC sender invalid');
        const error = await shell.openPath(directory); if (error) throw Error(error); return true;
    });
    const chromium = 'wavecanvas-release:openChromiumNotices';
    ipcMain.handle(chromium, async event => {
        if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw Error('Release IPC sender invalid');
        const error = await shell.openPath(runtimeFile('LICENSES.chromium.html', 'LICENSES.chromium.html')); if (error) throw Error(error); return true;
    });
    window.once('closed', () => { for (const name of [channel, folder, infoChannel, chromium]) ipcMain.removeHandler(name); });
}
module.exports = { install };
