'use strict';
const { app, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises'), path = require('node:path');
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
        const files = ['WaveCanvas-LICENSE.txt', 'THIRD_PARTY_NOTICES.md', 'FFmpeg/LICENSE', 'FFmpeg/SOURCE_INFO.txt'];
        return { name: app.getName(), version: app.getVersion(), license: 'MIT', signed: false,
            documents: await Promise.all(files.map(async name => ({ name, text: await fs.readFile(path.join(directory, name), 'utf8') }))) };
    });
    const folder = 'wavecanvas-release:openLicenses';
    ipcMain.handle(folder, async event => {
        if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw Error('Release IPC sender invalid');
        const error = await shell.openPath(directory); if (error) throw Error(error); return true;
    });
    window.once('closed', () => { ipcMain.removeHandler(channel); ipcMain.removeHandler(folder); ipcMain.removeHandler(infoChannel); });
}
module.exports = { install };
