'use strict';
const { t } = require('../app/i18n.js');
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
    const external = new Map();
    window.waveCanvasQueueExternalProject = file => {
        const token = crypto.randomUUID(); external.set(token, file);
        if (projectReady) window.webContents.send('wavecanvas-project:externalRequested');
    };
    const prefix = 'wavecanvas-project:';
    function sender(event) { if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error(t('Project IPC sender 無效。')); }
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
            if (!extensions[slot].test(file) || !(registered.get(slot)?.has(identity(file)) || current?.media[slot]?.path && identity(current.media[slot].path) === identity(file))) throw new Error(t('媒體 reference 未經匯入授權：{slot}', { slot }));
        }
    }
    bind('registerMedia', async (slot, file) => {
        if (!model.slots.includes(slot) || typeof file !== 'string' || !path.isAbsolute(file) || !extensions[slot].test(file)) throw new Error(t('媒體 reference 無效。'));
        if (!(await fs.stat(file)).isFile()) throw new Error(t('媒體不是檔案。'));
        if (!registered.has(slot)) registered.set(slot, new Set()); registered.get(slot).add(identity(file)); return file;
    });
    bind('open', recentPath => exclusive(async () => {
        let file;
        if (recentPath !== undefined) {
            const recent = await storage().getRecent(); file = recent.find(item => item.path === recentPath)?.path;
            if (!file) throw new Error(t('專案不在最近使用清單。'));
        } else { const choice = await dialog.showOpenDialog(window, { title: t('開啟 WaveCanvas 專案'), properties: ['openFile'], filters: [{ name: 'WaveCanvas Project', extensions: ['waveproj'] }] }); if (choice.canceled) return null; file = choice.filePaths[0]; }
        return grant(await storage().open(file));
    }));
    bind('takeExternal', () => { const token = external.keys().next().value; return token || null; });
    bind('openExternal', token => exclusive(async () => {
        const file = external.get(token); if (!file) throw Error('External project authorization expired');
        external.delete(token); return grant(await storage().open(file));
    }));
    bind('discardExternal', token => external.delete(token));
    bind('readMedia', async (token, slot) => {
        const entry = pending.get(token)?.media[slot];
        if (!model.slots.includes(slot) || !entry || entry.missing) return null;
        const size = (await fs.stat(entry.path)).size;
        const limit = slot === 'audio' ? 1024 * 1024 * 1024 : ['primary', 'secondary'].includes(slot) ? 1024 * 1024 : 100 * 1024 * 1024;
        if (size > limit) throw new Error(t('媒體檔案過大：{slot}', { slot }));
        return { name: entry.name, bytes: new Uint8Array(await fs.readFile(entry.path)) };
    });
    bind('activate', async token => {
        const result = pending.get(token); if (!result) throw new Error(t('Project transaction 已失效。'));
        pending.clear(); registered.clear();
        if (result.recovery) {
            // 復原的專案仍是未存檔的新專案：不指向復原檔，也不加入最近使用。
            // 原本就由使用者匯入的素材（含暫時找不到的）視為已授權，之後仍可存檔。
            current = null;
            for (const [slot, entry] of Object.entries(result.media)) if (entry) { if (!registered.has(slot)) registered.set(slot, new Set()); registered.get(slot).add(identity(entry.path)); }
            return null;
        }
        current = result; await storage().remember(current.path, current.project); return current.path;
    });
    bind('writeRecovery', project => exclusive(async () => {
        if (current) return false; // 已有專案檔的專案由自動儲存與備份處理。
        await checkReferences(project); return storage().writeRecovery(project);
    }));
    bind('clearRecovery', () => storage().clearRecovery());
    bind('takeRecovery', () => exclusive(async () => {
        const result = await storage().readRecovery(); if (!result) return null;
        return grant({ ...result, path: null, recovery: true });
    }));
    bind('save', (project, kind) => exclusive(async () => {
        if (!['save', 'saveAs', 'autosave'].includes(kind)) throw new Error(t('Save operation 無效。'));
        await checkReferences(project); let file = current?.path;
        if (kind === 'autosave' && !file) return null;
        if (!file || kind === 'saveAs') {
            const filename = sanitizeProjectFilename(project.name) + '.waveproj';
            const choice = await dialog.showSaveDialog(window, { title: t('另存 WaveCanvas 專案'), defaultPath: file ? path.join(path.dirname(file), filename) : filename, filters: [{ name: 'WaveCanvas Project', extensions: ['waveproj'] }] });
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
        const choice = await dialog.showOpenDialog(window, { title: t('選擇收集專案的目的位置'), properties: ['openDirectory', 'createDirectory'] });
        if (choice.canceled) return null;
        const result = await storage().collect(choice.filePaths[0], project, current?.path);
        const answer = await dialog.showMessageBox(window, { type: 'question', message: t('專案已收集完成。是否切換至收集後的專案？'), detail: result.path,
            buttons: [t('切換'), t('繼續目前專案')], defaultId: 1, cancelId: 1 });
        return { path: result.path, switch: answer.response === 0, loaded: answer.response === 0 ? grant(result) : null };
    }));
    bind('confirmUnsaved', async () => (await dialog.showMessageBox(window, { type: 'question', message: t('是否儲存目前專案？'), buttons: [t('儲存'), t('不儲存'), t('取消')], defaultId: 0, cancelId: 2 })).response);
    bind('getRecent', () => storage().getRecent());
    bind('removeRecent', async file => {
        if (!(await storage().getRecent()).some(item => item.path === file)) throw new Error(t('Recent entry 無效。'));
        await storage().removeRecent(file); return true;
    });
    bind('new', () => { current = null; pending.clear(); registered.clear(); return true; });
    bind('status', status => {
        if (!status || typeof status.dirty !== 'boolean' || typeof status.name !== 'string') throw new Error(t('Project status 無效。'));
        projectReady = true; window.setTitle(status.name.slice(0, 256) + (status.dirty ? ' *' : '') + ' — WaveCanvas'); return true;
    });
    // 正常關閉（已存檔或選擇不存檔）一律清掉復原資料，下次啟動才不會誤跳提示。
    bind('finishClose', async () => { await window.waveCanvasSaveWindowState?.(); await storage().clearRecovery().catch(error => console.error('[Recovery]', error.message)); closeAllowed = true; window.close(); return true; });
    // Ask the controller even for a reported-clean session: it drains pending media refs and
    // compares the latest snapshot, avoiding an IPC status/OS-close race after an edit.
    window.on('close', event => { if (!closeAllowed && projectReady) { event.preventDefault(); window.webContents.send(prefix + 'closeRequested'); } });
    window.on('closed', () => { for (const name of ['registerMedia', 'open', 'readMedia', 'activate', 'save', 'collect', 'confirmUnsaved', 'getRecent', 'removeRecent', 'new', 'status', 'finishClose', 'takeExternal', 'openExternal', 'discardExternal', 'writeRecovery', 'clearRecovery', 'takeRecovery']) ipcMain.removeHandler(prefix + name); });
}
module.exports = { install };
