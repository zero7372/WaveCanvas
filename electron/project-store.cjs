'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const model = require('../app/project-model.js');
const extensions = { audio: /\.(wav|mp3|flac|ogg|m4a|aac|opus)$/i, cover: /\.(png|jpe?g|webp)$/i,
    background: /\.(png|jpe?g|webp)$/i, primary: /\.(lrc|srt)$/i, secondary: /\.(lrc|srt)$/i };
const identity = file => path.resolve(file).toLowerCase();
function safeName(name) { return (name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 150) || 'Untitled').replace(/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i, '_$1$2'); }
async function atomicWrite(file, text, io = fs) {
    const temporary = path.join(path.dirname(file), '.' + path.basename(file) + '.' + crypto.randomUUID() + '.tmp');
    let handle;
    try {
        handle = await io.open(temporary, 'wx'); await handle.writeFile(text, 'utf8'); await handle.sync(); await handle.close(); handle = null;
        // Never unlink/truncate the destination. A failed replacement leaves the old project intact.
        await io.rename(temporary, file);
    } finally { if (handle) await handle.close().catch(() => {}); await io.unlink(temporary).catch(() => {}); }
}
function create(userData, options = {}) {
    const io = options.fs || fs, log = options.log || console;
    const recentFile = path.join(userData, 'recent-projects.json');
    let recentQueue = Promise.resolve();
    let lastBackupTime = 0;
    async function readRecent() {
        try {
            const data = JSON.parse(await io.readFile(recentFile, 'utf8'));
            return Array.isArray(data) ? data.filter(item => item && typeof item.path === 'string' && typeof item.name === 'string'
                && typeof item.lastOpenedAt === 'string' && ['circle', 'square', 'linear'].includes(item.layout)).slice(0, 10) : [];
        } catch (error) { if (error.code !== 'ENOENT') log.warn('Recent Projects 無法讀取', error.message); return []; }
    }
    function recentMutation(change) {
        const result = recentQueue.then(async () => { const list = change(await readRecent()); await io.mkdir(userData, { recursive: true }); await atomicWrite(recentFile, JSON.stringify(list, null, 2), io); return list; });
        recentQueue = result.catch(() => {}); return result;
    }
    async function remember(file, project) {
        try { await recentMutation(list => [{ path: path.resolve(file), name: project.name, lastOpenedAt: new Date().toISOString(), layout: project.state.settings.standalone.visualizer.layout }, ...list.filter(item => identity(item.path) !== identity(file))].slice(0, 10)); }
        catch (error) { log.warn('Recent Projects 無法更新', error.message); }
    }
    async function media(project, projectPath) {
        const result = {};
        for (const slot of model.slots) {
            const reference = project.state.media[slot];
            if (!reference) { result[slot] = null; continue; }
            const file = path.resolve(path.dirname(projectPath), reference);
            if (!extensions[slot].test(file)) throw new Error('不支援的媒體格式：' + slot);
            let missing = false;
            try { missing = !(await io.stat(file)).isFile(); } catch (error) { if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) missing = true; else throw error; }
            result[slot] = { path: file, reference, name: path.basename(file), missing };
        }
        return result;
    }
    async function open(file) {
        if (!/\.waveproj$/i.test(file)) throw new Error('請選擇 .waveproj 專案。');
        if ((await io.stat(file)).size > 16 * 1024 * 1024) throw new Error('專案檔案過大。');
        const project = model.parse(await io.readFile(file, 'utf8'));
        return { project, path: path.resolve(file), media: await media(project, file) };
    }
    async function backup(file, projectId) {
        if (!/^[a-f0-9-]{36}$/i.test(projectId)) throw new Error('Backup identity 無效。');
        const directory = path.join(userData, 'Backups', projectId);
        await io.mkdir(directory, { recursive: true });
        lastBackupTime = Math.max(Date.now(), lastBackupTime + 1);
        const name = new Date(lastBackupTime).toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID().slice(0, 8) + '.waveproj';
        const previous = model.parse(await io.readFile(file, 'utf8'));
        // A backup lives in userData, so relative references must retain the original project base.
        for (const slot of model.slots) if (previous.state.media[slot] && !path.isAbsolute(previous.state.media[slot])) previous.state.media[slot] = path.resolve(path.dirname(file), previous.state.media[slot]);
        await atomicWrite(path.join(directory, name), model.serialize(previous), io);
        try {
            const files = (await io.readdir(directory)).filter(name => /^\d{4}-\d{2}-\d{2}T.*\.waveproj$/.test(name)).sort();
            for (const old of files.slice(0, Math.max(0, files.length - 10))) await io.unlink(path.join(directory, old));
        } catch (error) { log.warn('Backup cleanup 失敗', error.message); }
    }
    async function save(file, project, autosave = false) {
        project = model.validate(project);
        if (!/\.waveproj$/i.test(file)) throw new Error('專案副檔名必須是 .waveproj。');
        if (autosave) await backup(file, project.projectId); // Failure aborts before replacing the project.
        project.modifiedAt = new Date().toISOString();
        await atomicWrite(file, model.serialize(project), io); await remember(file, project);
        return { path: path.resolve(file), project };
    }
    async function collect(parent, project, currentPath) {
        project = model.validate(project);
        const sources = await media(project, currentPath || path.join(process.cwd(), 'Untitled.waveproj'));
        const missing = Object.entries(sources).filter(([, entry]) => entry?.missing);
        if (missing.length) throw new Error('收集已中止，找不到媒體：\n' + missing.map(([slot, entry]) => slot + ': ' + entry.path).join('\n'));
        const name = safeName(project.name); let directory;
        for (let suffix = 0; suffix < 1000; suffix++) {
            directory = path.join(parent, name + (suffix ? '_' + (suffix + 1) : ''));
            try { await io.mkdir(directory); break; } catch (error) { if (error.code !== 'EEXIST' || suffix === 999) throw error; }
        }
        const categories = { audio: 'audio', cover: 'artwork', background: 'background', primary: 'lyrics', secondary: 'lyrics' };
        const used = new Set(), copied = new Map();
        try {
            for (const [slot, entry] of Object.entries(sources)) {
                if (!entry) continue;
                const key = categories[slot] + ':' + identity(entry.path);
                let relative = copied.get(key);
                if (!relative) {
                    const filename = safeName(path.basename(entry.path)), parsed = path.parse(filename);
                    let final = filename, suffix = 2;
                    while (used.has((categories[slot] + '/' + final).toLowerCase())) final = parsed.name + '_' + suffix++ + parsed.ext;
                    used.add((categories[slot] + '/' + final).toLowerCase());
                    relative = 'media/' + categories[slot] + '/' + final;
                    await io.mkdir(path.dirname(path.join(directory, relative)), { recursive: true });
                    await io.copyFile(entry.path, path.join(directory, relative), 1); copied.set(key, relative);
                }
                project.state.media[slot] = relative;
            }
            const file = path.join(directory, name + '.waveproj'); project.modifiedAt = new Date().toISOString();
            await atomicWrite(file, model.serialize(project), io);
            return { path: file, project, media: await media(project, file) };
        } catch (error) {
            // Remove only the new folder exclusively created by this operation, never a user's existing folder.
            const relative = path.relative(path.resolve(parent), path.resolve(directory));
            if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
                await io.rm(path.resolve(directory), { recursive: true, force: true }).catch(cleanup => log.warn('收集失敗的新增資料夾無法清理', cleanup.message));
            }
            throw error;
        }
    }
    return { open, save, collect, remember, media, backup, getRecent: async () => {
        await recentQueue; return Promise.all((await readRecent()).map(async item => ({ ...item, missing: !(await io.stat(item.path).catch(() => null))?.isFile() })));
    }, removeRecent: file => recentMutation(list => list.filter(item => identity(item.path) !== identity(file))) };
}
module.exports = { create, atomicWrite, safeName, identity, extensions };
