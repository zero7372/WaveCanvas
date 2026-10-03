'use strict';
const fs = require('node:fs/promises'), path = require('node:path');
const schema = require('../app/app-settings.js'), { atomicWrite } = require('./project-store.cjs');
function create(userData, options = {}) {
    const io = options.fs || fs, log = options.log || console, file = path.join(userData, 'settings.json');
    let queue = Promise.resolve();
    async function read() {
        try {
            const value = JSON.parse(await io.readFile(file, 'utf8')), normalized = schema.normalize(value);
            if (JSON.stringify(value) !== JSON.stringify(normalized)) log.warn('Preferences 無效或未知欄位已使用預設值。');
            return normalized;
        } catch (error) { if (error.code !== 'ENOENT') log.warn('Preferences 無法讀取，使用預設值：', error.message); return schema.normalize(null); }
    }
    function mutate(work) {
        const operation = queue.then(async () => { const value = work(await read()); await io.mkdir(userData, { recursive: true }); await atomicWrite(file, JSON.stringify(value, null, 2) + '\n', io); return value; });
        queue = operation.catch(() => {}); return operation;
    }
    return { file, get: async () => { await queue; return read(); }, update: changes => mutate(value => schema.patch(value, changes)), reset: () => mutate(() => schema.normalize(null)) };
}
module.exports = { create };
