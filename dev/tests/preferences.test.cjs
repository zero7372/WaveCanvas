'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const schema = require('../../app/app-settings.js'), { create } = require('../../electron/settings-store.cjs'), names = require('../../app/project-names.js'), scheduler = require('../../app/autosave-scheduler.js');
async function folder(t) { const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'wavecanvas-settings-')); t.after(() => fs.rm(directory, { recursive: true, force: true })); return directory; }
test('Missing settings loads canonical defaults without creating any files', async t => {
    const directory = await folder(t); assert.deepEqual(await create(directory).get(), schema.normalize(null)); assert.deepEqual(await fs.readdir(directory), []);
});
test('Versioned settings validates valid/partial fields and recovers invalid JSON and unknown versions', async t => {
    const directory = await folder(t), file = path.join(directory, 'settings.json'), warnings = [], store = create(directory, { log: { warn: (...args) => warnings.push(args) } });
    await fs.writeFile(file, JSON.stringify({ ...schema.defaults, project: { askNameOnCreate: false, autosaveEnabled: 'bad', autosaveIntervalMinutes: 3, unknown: true } }));
    assert.deepEqual((await store.get()).project, { askNameOnCreate: false, autosaveEnabled: true, autosaveIntervalMinutes: 3 });
    await fs.writeFile(file, '{broken'); assert.deepEqual(await store.get(), schema.normalize(null)); assert.equal(await fs.readFile(file, 'utf8'), '{broken');
    await fs.writeFile(file, JSON.stringify({ ...schema.defaults, version: 99 })); assert.deepEqual(await store.get(), schema.normalize(null));
    for (const value of [0, 2, 20, '5', NaN]) assert.equal(schema.normalize({ ...schema.defaults, project: { autosaveIntervalMinutes: value } }).project.autosaveIntervalMinutes, schema.defaults.project.autosaveIntervalMinutes);
    assert.ok(warnings.length >= 3);
});
test('Atomic settings update persists across restart, serializes concurrent patches and resets only preferences', async t => {
    const directory = await folder(t), store = create(directory); await fs.writeFile(path.join(directory, 'recent-projects.json'), 'retain');
    await Promise.all([store.update({ project: { askNameOnCreate: false } }), store.update({ project: { autosaveEnabled: false, autosaveIntervalMinutes: 1 } })]);
    assert.deepEqual((await create(directory).get()).project, { askNameOnCreate: false, autosaveEnabled: false, autosaveIntervalMinutes: 1 });
    assert.equal(await fs.readFile(path.join(directory, 'recent-projects.json'), 'utf8'), 'retain');
    await store.reset(); assert.deepEqual(await create(directory).get(), schema.normalize(null));
    assert.deepEqual((await fs.readdir(directory)).sort(), ['recent-projects.json', 'settings.json']);
});
test('Failed atomic rename leaves old settings intact, cleans temp and never applies invalid patches', async t => {
    const directory = await folder(t); await create(directory).update({ project: { askNameOnCreate: false } }); const file = path.join(directory, 'settings.json'), original = await fs.readFile(file, 'utf8');
    const failing = create(directory, { fs: { ...fs, rename: async () => { throw Error('denied'); } } }); await assert.rejects(failing.update({ project: { autosaveEnabled: false } }));
    assert.equal(await fs.readFile(file, 'utf8'), original); assert.deepEqual(await fs.readdir(directory), ['settings.json']);
    for (const changes of [{ project: { autosaveIntervalMinutes: 2 } }, { project: { autosaveEnabled: 'false' } }, { path: '/unsafe' }, { project: { unknown: true } }]) await assert.rejects(create(directory).update(changes));
    assert.equal(await fs.readFile(file, 'utf8'), original);
});
test('Display names trim, reject blank/control/overlong input, retain punctuation and Unicode', () => {
    assert.equal(names.normalize('  My Song: Final?  '), 'My Song: Final?');
    for (const value of ['', '   ', 'a'.repeat(129), 'bad\nname']) assert.throws(() => names.normalize(value));
    assert.equal(names.normalize('中文專案 🎵'), '中文專案 🎵'); assert.equal(names.normalize('🎵'.repeat(128)).length, 256);
});
test('Filename sanitization handles Windows reserved names, invalid characters, trailing dot/space and Unicode without changing display names', () => {
    for (const [input, expected] of [['My Song','My Song'],['My:Song?','MySong'],['My Song: Final?','My Song Final'],['CON','_CON'],['AUX','_AUX'],['con.txt','_con.txt'],['LPT1','_LPT1'],['song.','song'],['song ','song'],['<test>','test'],['中文專案名稱','中文專案名稱'],['emoji project 🎵','emoji project 🎵'],['<>:"/\\|?*','WaveCanvas Project']]) {
        assert.equal(names.sanitizeProjectFilename(input), expected); assert.doesNotMatch(expected, /[<>:"/\\|?*]|[. ]$/); assert.ok((expected + '.waveproj').endsWith('.waveproj'));
    }
    assert.equal(names.sanitizeProjectFilename('🎵'.repeat(128)).length, 128, 'filename is bounded in UTF-16 units and never splits a surrogate pair');
});
test('Autosave scheduler replaces one timer on interval change, stops/re-enables safely and disposes once', () => {
    let id = 0, writes = 0; const active = new Map(), cleared = [];
    const timer = scheduler(() => writes++, { setInterval: (callback, ms) => { active.set(++id, { callback, ms }); return id; }, clearInterval: i => { active.delete(i); cleared.push(i); } });
    timer.configure(schema.defaults.project); timer.configure(schema.defaults.project); assert.equal(active.size, 1); assert.equal(active.get(1).ms, 300000);
    timer.configure({ autosaveEnabled: true, autosaveIntervalMinutes: 1 }); assert.equal(active.size, 1); assert.equal(active.get(2).ms, 60000); active.get(2).callback(); assert.equal(writes, 1);
    timer.configure({ autosaveEnabled: false, autosaveIntervalMinutes: 1 }); assert.equal(active.size, 0);
    timer.configure({ autosaveEnabled: true, autosaveIntervalMinutes: 15 }); assert.equal(active.size, 1); timer.dispose(); timer.dispose(); assert.equal(active.size, 0); assert.deepEqual(cleared, [1,2,3]);
    timer.configure(schema.defaults.project); assert.equal(active.size, 0);
});
