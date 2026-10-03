'use strict';
const { ipcMain, dialog, app } = require('electron');
const path = require('node:path'), fs = require('node:fs/promises'), crypto = require('node:crypto');
const model = require('../app/project-model.js'), { create, extensions, identity } = require('./project-store.cjs');
const { sanitizeProjectFilename } = require('../app/project-names.js');
function install(window) {
    let store, storeDirectory;
    function storage() {
        const directory = app.getPath('userData');
        if (directory !== storeDirectory) { storeDirectory = directory; store = create(directory, { getRecentLimit: async () => (await window.waveCanvasSettings().get()).project.recentProjectsLimit }); }
        return store;
    }
    let current = null, pending = new Map(), registered = new Map(), queue = Promise.resolve(), projectReady = false, closeAllowed = false;
    window.waveCanvasProjectPath = () => current?.path || null;
    window.waveCanvasTrimRecent = limit => storage().trimRecent(limit);
    const prefix = 'wavecanvas-project:';
    function sender(event) { if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Project IPC sender 無效。'); }
    function bind(name, handler) {
        ipcMain.handle(prefix + name, async (event, ...args) => {
            try { sender(event); return { ok: true, value: await handler(...args) }; }
            catch (error) { console.error('[Project]', error.message); return { ok: false, error: error.message }; }
        });
    }
    function exclusive(operation) { const result = queue.then(operation); queue = result.catch(() => {}); return result; }
    function grant(result) { const token = crypto.randomUUID(); pending.clear(); pending.set(token, result); return { ...result, token }; }
    async function checkReferences(project) {
        model.validate(project);
        for (const slot of model.slots) {
            const reference = project.state.media[slot]; if (!reference) continue;
            const file = path.resolve(current ? path.dirname(current.path) : process.cwd(), reference);
            if (!extensions[slot].test(file) || !(registered.get(slot)?.has(identity(file)) || current?.media[slot]?.path && identity(current.media[slot].path) === identity(file))) throw new Error('媒體 reference 未經匯入授權：' + slot);
        }
    }
    bind('registerMedia', async (slot, file) => {
        if (!model.slots.includes(slot) || typeof file !== 'string' || !path.isAbsolute(file) || !extensions[slot].test(file)) throw new Error('媒體 reference 無效。');
        if (!(await fs.stat(file)).isFile()) throw new Error('媒體不是檔案。');
        if (!registered.has(slot)) registered.set(slot, new Set()); registered.get(slot).add(identity(file)); return file;
    });
    bind('open', recentPath => exclusive(async () => {
        let file;
        if (recentPath !== undefined) {
            const recent = await storage().getRecent(); file = recent.find(item => item.path === recentPath)?.path;
            if (!file) throw new Error('專案不在最近使用清單。');
        } else { const choice = await dialog.showOpenDialog(window, { title: '開啟 WaveCanvas 專案', properties: ['openFile'], filters: [{ name: 'WaveCanvas Project', extensions: ['waveproj'] }] }); if (choice.canceled) return null; file = choice.filePaths[0]; }
        return grant(await storage().open(file));
    }));
    bind('readMedia', async (token, slot) => {
        const entry = pending.get(token)?.media[slot];
        if (!model.slots.includes(slot) || !entry || entry.missing) return null;
        const size = (await fs.stat(entry.path)).size;
        const limit = slot === 'audio' ? 1024 * 1024 * 1024 : ['primary', 'secondary'].includes(slot) ? 1024 * 1024 : 100 * 1024 * 1024;
        if (size > limit) throw new Error('媒體檔案過大：' + slot);
        return { name: entry.name, bytes: new Uint8Array(await fs.readFile(entry.path)) };
    });
    bind('activate', async token => {
        const result = pending.get(token); if (!result) throw new Error('Project transaction 已失效。');
        current = result; pending.clear(); registered.clear(); await storage().remember(current.path, current.project); return current.path;
    });
    bind('save', (project, kind) => exclusive(async () => {
        if (!['save', 'saveAs', 'autosave'].includes(kind)) throw new Error('Save operation 無效。');
        await checkReferences(project); let file = current?.path;
        if (kind === 'autosave' && !file) return null;
        if (!file || kind === 'saveAs') {
            const filename = sanitizeProjectFilename(project.name) + '.waveproj';
            const choice = await dialog.showSaveDialog(window, { title: '另存 WaveCanvas 專案', defaultPath: file ? path.join(path.dirname(file), filename) : filename, filters: [{ name: 'WaveCanvas Project', extensions: ['waveproj'] }] });
            if (choice.canceled) return null; file = choice.filePath; if (!/\.waveproj$/i.test(file)) file += '.waveproj';
        }
        // Save As must rebase relative references without redirecting them to another folder.
        project = model.validate(project);
        for (const slot of model.slots) if (project.state.media[slot] && !path.isAbsolute(project.state.media[slot])) {
            project.state.media[slot] = path.relative(path.dirname(file), path.resolve(path.dirname(current.path), project.state.media[slot])).replace(/\\/g, '/');
        }
        const result = await storage().save(file, project, kind === 'autosave');
        current = { ...result, media: await storage().media(result.project, result.path) }; return result;
    }));
    bind('collect', project => exclusive(async () => {
        await checkReferences(project);
        const choice = await dialog.showOpenDialog(window, { title: '選擇收集專案的目的位置', properties: ['openDirectory', 'createDirectory'] });
        if (choice.canceled) return null;
        const result = await storage().collect(choice.filePaths[0], project, current?.path);
        const answer = await dialog.showMessageBox(window, { type: 'question', message: '專案已收集完成。是否切換至收集後的專案？', detail: result.path,
            buttons: ['切換', '繼續目前專案'], defaultId: 1, cancelId: 1 });
        return { path: result.path, switch: answer.response === 0, loaded: answer.response === 0 ? grant(result) : null };
    }));
    bind('confirmUnsaved', async () => (await dialog.showMessageBox(window, { type: 'question', message: '是否儲存目前專案？', buttons: ['儲存', '不儲存', '取消'], defaultId: 0, cancelId: 2 })).response);
    bind('getRecent', () => storage().getRecent());
    bind('removeRecent', async file => {
        if (!(await storage().getRecent()).some(item => item.path === file)) throw new Error('Recent entry 無效。');
        await storage().removeRecent(file); return true;
    });
    bind('new', () => { current = null; pending.clear(); registered.clear(); return true; });
    bind('status', status => {
        if (!status || typeof status.dirty !== 'boolean' || typeof status.name !== 'string') throw new Error('Project status 無效。');
        projectReady = true; window.setTitle(status.name.slice(0, 256) + (status.dirty ? ' *' : '') + ' — WaveCanvas'); return true;
    });
    bind('finishClose', async () => { await window.waveCanvasSaveWindowState?.(); closeAllowed = true; window.close(); return true; });
    // Ask the controller even for a reported-clean session: it drains pending media refs and
    // compares the latest snapshot, avoiding an IPC status/OS-close race after an edit.
    window.on('close', event => { if (!closeAllowed && projectReady) { event.preventDefault(); window.webContents.send(prefix + 'closeRequested'); } });
    window.on('closed', () => { for (const name of ['registerMedia', 'open', 'readMedia', 'activate', 'save', 'collect', 'confirmUnsaved', 'getRecent', 'removeRecent', 'new', 'status', 'finishClose']) ipcMain.removeHandler(prefix + name); });
}
module.exports = { install };
