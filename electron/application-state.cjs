'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), { atomicWrite } = require('./project-store.cjs');
function create(directory) {
    const file = path.join(directory, 'application-state.json'); let queue = Promise.resolve();
    async function read() {
        try { const value = JSON.parse(await fs.readFile(file, 'utf8')); return { window: value.window || null, lastExportDirectory: typeof value.lastExportDirectory === 'string' ? value.lastExportDirectory : null }; }
        catch (error) { if (error.code !== 'ENOENT') console.warn('Application state:', error.message); return { window: null, lastExportDirectory: null }; }
    }
    return { get: async () => { await queue; return read(); }, update(changes) {
        const operation = queue.then(async () => { const value = { ...await read(), ...changes }; await fs.mkdir(directory, { recursive: true }); await atomicWrite(file, JSON.stringify(value, null, 2) + '\n'); return value; });
        queue = operation.catch(() => {}); return operation;
    } };
}
function windowBounds(saved, displays, remember = true) {
    if (!remember || !saved || !['x','y','width','height'].every(k => Number.isInteger(saved[k])) || saved.width < 600 || saved.height < 400) return null;
    const area = displays.map(d => d.workArea).find(a => saved.x >= a.x && saved.y >= a.y && saved.x < a.x + a.width && saved.y < a.y + a.height);
    if (!area) return null;
    const width = Math.min(saved.width, area.width), height = Math.min(saved.height, area.height);
    return { x: Math.max(area.x, Math.min(saved.x, area.x + area.width - width)), y: Math.max(area.y, Math.min(saved.y, area.y + area.height - height)), width, height, maximized: saved.maximized === true };
}
async function exportDirectory(preferences, state, projectPath, io = fs) {
    const choices = [];
    if (preferences.defaultDirectoryMode === 'custom') choices.push(preferences.customDirectory);
    if (preferences.defaultDirectoryMode === 'project-folder' && projectPath) choices.push(path.dirname(projectPath));
    choices.push(state.lastExportDirectory);
    for (const directory of choices) if (typeof directory === 'string' && path.isAbsolute(directory) && (await io.stat(directory).catch(() => null))?.isDirectory()) return directory;
    return null;
}
module.exports = { create, windowBounds, exportDirectory };
