'use strict';
const { app, BrowserWindow, screen, dialog, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'app', 'index.html');
const entryURL = pathToFileURL(entry).href;
const dev = !app.isPackaged && process.argv.includes('--dev');
let mainWindow = null, failing = false;
const { projectArgument } = require('./external-project.cjs');
const externalProjects = [];
const initialProject = projectArgument(process.argv.slice(1));
if (initialProject) externalProjects.push(initialProject);
app.setName('WaveCanvas');
app.setAppUserModelId('com.wavecanvas.desktop');
function fatal(label, error) {
    console.error('[WaveCanvas] ' + label, error);
    if (failing) return;
    failing = true;
    if (app.isReady()) dialog.showErrorBox('WaveCanvas', label + '\n' + String(error?.message || error));
    app.exit(1);
}
process.on('uncaughtException', error => fatal('Main Process 發生錯誤', error));
process.on('unhandledRejection', error => fatal('Main Process 非同步錯誤', error));
const preferences = { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false,
    sandbox: true, webSecurity: true, allowRunningInsecureContent: false, devTools: true, webviewTag: false };
async function createWindow() {
    const stateModule = require('./application-state.cjs');
    const initialSettings = await require('./settings-store.cjs').create(app.getPath('userData')).get();
    const initialState = await stateModule.create(app.getPath('userData')).get();
    const bounds = stateModule.windowBounds(initialState.window, screen.getAllDisplays(), initialSettings.general.rememberWindowBounds);
    const area = screen.getPrimaryDisplay().workAreaSize;
    mainWindow = new BrowserWindow({ title: 'WaveCanvas', ...(bounds ? { x: bounds.x, y: bounds.y } : {}), width: bounds?.width || Math.min(1560, area.width), height: bounds?.height || Math.min(960, area.height),
        minWidth: Math.min(1000, bounds?.width || area.width), minHeight: Math.min(680, bounds?.height || area.height),
        backgroundColor: '#17191e', show: false, frame: true, autoHideMenuBar: true,
        icon: path.join(root, 'app', 'assets', 'wavecanvas.png'), webPreferences: preferences });
    mainWindow.setMenu(null);
    const window = mainWindow;
    let stateStore, stateDirectory;
    window.waveCanvasApplicationState = () => { const directory = app.getPath('userData'); if (directory !== stateDirectory) { stateDirectory = directory; stateStore = stateModule.create(directory); } return stateStore; };
    require('./project-ipc.cjs').install(window);
    require('./settings-ipc.cjs').install(window);
    require('./release-ipc.cjs').install(window);
    for (const file of externalProjects.splice(0)) window.waveCanvasQueueExternalProject(file);
    window.waveCanvasSaveWindowState = async () => {
        try { if ((await window.waveCanvasSettings().get()).general.rememberWindowBounds && !window.isDestroyed()) await window.waveCanvasApplicationState().update({ window: { ...window.getNormalBounds(), maximized: window.isMaximized() } }); }
        catch (error) { console.error('Window state:', error.message); }
    };
    window.waveCanvasExportController = require('./export-controller.cjs').install(window);
    window.once('ready-to-show', () => { if (bounds?.maximized) window.maximize(); window.show(); if (dev) window.webContents.openDevTools({ mode: 'detach' }); });
    window.on('closed', () => { if (mainWindow === window) { mainWindow = null; app.quit(); } });
    window.webContents.on('will-navigate', (event, url) => { if (url.split('#')[0] !== entryURL) event.preventDefault(); });
    window.webContents.on('will-redirect', event => event.preventDefault());
    window.webContents.setWindowOpenHandler(({ url }) => {
        // The existing Help link can read the bundled README, without granting Node access.
        if (url === pathToFileURL(path.join(root, 'README.md')).href) return { action: 'allow',
            overrideBrowserWindowOptions: { title: 'WaveCanvas — 使用說明', width: 900, height: 700, webPreferences: preferences } };
        return { action: 'deny' };
    });
    window.webContents.on('did-create-window', child => {
        child.setMenu(null); child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        child.webContents.on('will-navigate', event => event.preventDefault());
    });
    window.webContents.on('console-message', details => {
        const { level, message } = details;
        if (dev || level === 'error') console.error('[Renderer ' + level + '] ' + message);
    });
    window.webContents.on('render-process-gone', (_event, details) => fatal('Renderer 意外停止', details.reason));
    window.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
        if (isMainFrame && code !== -3) fatal('無法載入 WaveCanvas', description + ' (' + url + ')');
    });
    window.loadFile(entry).catch(error => fatal('無法載入 WaveCanvas', error));
    return window;
}
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
else {
    app.on('second-instance', (_event, argv) => {
        const file = projectArgument(argv.slice(1));
        if (file) { if (mainWindow) mainWindow.waveCanvasQueueExternalProject(file); else externalProjects.push(file); }
        if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }
    });
    app.whenReady().then(async () => {
        const localFontsAllowed = (contents, permission, url) => permission === 'local-fonts' && contents === mainWindow?.webContents && contents?.getURL() === entryURL && (!url || url.split('#')[0] === entryURL);
        session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(details?.isMainFrame !== false && localFontsAllowed(contents, permission, details?.requestingUrl)));
        session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) => details?.isMainFrame !== false && localFontsAllowed(contents, permission, details?.requestingUrl));
        // This local-only app has no runtime network dependency.
        session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
        await createWindow();
        app.on('activate', () => { if (!mainWindow) createWindow().catch(error => fatal('無法建立視窗', error)); else mainWindow.focus(); });
    }).catch(error => fatal('無法啟動 WaveCanvas', error));
    app.on('window-all-closed', () => app.quit());
}
