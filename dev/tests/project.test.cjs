'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), vm = require('node:vm'), crypto = require('node:crypto');
const model = require('../../app/project-model.js'), { create, atomicWrite } = require('../../electron/project-store.cjs');
const appRoot = path.resolve(__dirname, '../../app');
function renderer() {
    const app = { console, window: null }; app.window = app; vm.createContext(app);
    for (const file of ['property-schema.js','layout-schema.js','system-fonts.js','property-compatibility.js','song-info-schema.js','lyrics-schema.js','background-schema.js','inspector-policy.js','factory-defaults-data.js','factory-layout-defaults.js','runtime-adapter.js','lrc-parser.js','srt-parser.js','lyrics-import.js','timing-model.js','lyrics-runtime.js','project-model.js']) vm.runInContext(require('node:fs').readFileSync(path.join(appRoot, file), 'utf8'), app);
    const audio = { duration: 120, currentTime: 0, ended: false, addEventListener() {}, removeEventListener() {} };
    app.VisualizerLyrics = app.VisualizerLyricsRuntime.create(audio, () => app.VisualizerRuntime.getStandalone().lyrics.globalOffsetMs);
    vm.runInContext(require('node:fs').readFileSync(path.join(appRoot, 'project-serializer.js'), 'utf8'), app); return app;
}
function project(app = renderer()) { return app.WaveCanvasProjectSerializer.capture({ projectId: crypto.randomUUID(), name: '測試 專案', appVersion: '0.1.0', createdAt: new Date().toISOString(), modifiedAt: null }, Object.fromEntries(model.slots.map(slot => [slot, null]))); }
async function folder(t) { const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'wavecanvas-project-test-')); t.after(() => fs.rm(directory, { recursive: true, force: true })); return directory; }
test('Project format validates version, finite numbers, stable IDs and rejects unsafe media URLs/prototype keys', () => {
    const value = project(); assert.equal(model.parse(model.serialize(value)).format, 'wavecanvas-project');
    assert.throws(() => model.parse('{bad'), /JSON/);
    for (const bad of [{ ...value, format: 'preset' }, { ...value, version: 2 }, { ...value, version: 0 }, { ...value, projectId: '../escape' }]) assert.throws(() => model.validate(bad));
    value.state.media.audio = 'blob:temporary'; assert.throws(() => model.validate(value)); value.state.media.audio = null;
    value.state.settings.standalone.inputGain = NaN; assert.throws(() => model.validate(value));
    assert.throws(() => model.parse('{"__proto__":{}}'), /不安全/);
});
test('Complete three-layout settings, edited bilingual SRT/LRC timing, stable IDs and metadata roundtrip independently of Preset', () => {
    const app = renderer(), r = app.VisualizerRuntime, lyrics = app.VisualizerLyrics;
    r.updateProperties({ circleradius: { value: 181 } });
    r.updateStandalone({ visualizer: { layout: 'square', squareSize: 411, squareSpectrumLayout: 'topBassMirror' } });
    r.updateStandalone({ visualizer: { layout: 'linear', coverX: 73 }, background: { mode: 'bassPulse', opacity: .35, blur: 15 }, text: { title: '歌名', artist: '作者' }, lyrics: { globalOffsetMs: 120, secondaryOffsetMs: -50 } });
    lyrics.load('1\n00:00:01,000 --> 00:00:03,000\n敞開大門\n\n2\n00:00:05,000 --> 00:00:07,000\n...','原始.srt');
    lyrics.loadSecondary('[offset:30]\n[00:01.00]Open the gate', 'secondary.lrc');
    const id = lyrics.getDocument('primary').events[0].id; lyrics.retime('primary', id, 2250);
    const saved = project(app), prepared = app.WaveCanvasProjectSerializer.prepare(model.parse(model.serialize(saved)));
    const fresh = renderer(); fresh.VisualizerRuntime.restoreProjectSettings(prepared.state.settings); fresh.VisualizerLyrics.restoreDocuments(prepared.state.lyrics);
    assert.equal(fresh.VisualizerLyrics.getDocument('primary').events[0].id, id);
    assert.equal(fresh.VisualizerLyrics.getDocument('primary').events[0].timeMs, 2250);
    assert.equal(fresh.VisualizerLyrics.getDocument('primary').events[0].sourceCue.startTimeMs, 1000);
    assert.equal(fresh.VisualizerLyrics.getDocument('primary').events[1].type, 'interlude');
    assert.equal(fresh.VisualizerLyrics.getDocument('secondary').fileOffsetMs, 30);
    assert.equal(fresh.VisualizerRuntime.getStandalone().text.title, '歌名');
    assert.equal(fresh.VisualizerRuntime.getStandalone().background.opacity, .35);
    assert.equal(fresh.VisualizerRuntime.getStandalone().lyrics.globalOffsetMs, 120);
    fresh.VisualizerRuntime.updateStandalone({ visualizer: { layout: 'circle' } }); assert.equal(fresh.VisualizerRuntime.getSettings().circleradius.value, 181);
    fresh.VisualizerRuntime.updateStandalone({ visualizer: { layout: 'square' } }); assert.equal(fresh.VisualizerRuntime.getStandalone().visualizer.squareSize, 411);
    fresh.VisualizerRuntime.updateStandalone({ visualizer: { layout: 'linear' } }); assert.equal(fresh.VisualizerRuntime.getStandalone().visualizer.coverX, 73);
    const restoredDocumentId = fresh.VisualizerLyrics.getDocument('primary').id;
    fresh.VisualizerLyrics.load('[00:01.00]New source', 'new.lrc');
    assert.notEqual(fresh.VisualizerLyrics.getDocument('primary').id, restoredDocumentId, 'new imports have a new identity, so Timing history is cleared');
});
test('Controller owns one configurable scheduler across New/Open, no unsaved writes, clean skip, Off/manual-save/re-enable and pagehide cleanup', async t => {
    const app = renderer(), events = new Map(), intervals = [], cleared = [], writes = [];
    app.crypto = crypto; app.setTimeout = setTimeout; app.clearTimeout = clearTimeout;
    app.setInterval = (callback, ms) => { intervals.push({ callback, ms }); return intervals.length; };
    app.clearInterval = id => cleared.push(id); app.Event = class {};
    app.addEventListener = (name, handler) => events.set(name, handler); app.dispatchEvent = () => {};
    app.document = { querySelector: () => ({ paused: true }), addEventListener() {} };
    app.VisualizerFiles = { getFile: () => null, subscribe() {}, clear() {} };
    app.VisualizerLocalAudio = { getFile: () => null, clear() {} };
    app.WaveCanvasShell = { showView() {} };
    let settings = { ...require('../../app/app-settings.js').defaults.project, askNameOnCreate: false }, settingsListener;
    app.WaveCanvasPreferences = { ready: Promise.resolve(), get: () => ({ ...require('../../app/app-settings.js').normalize(null), project: settings }), subscribe(callback) { settingsListener = callback; callback({ project: settings }); return () => {}; } };
    app.WaveCanvasAutosaveScheduler = require('../../app/autosave-scheduler.js');
    const createScheduler = app.WaveCanvasAutosaveScheduler;
    app.WaveCanvasAutosaveScheduler = callback => createScheduler(callback, app);
    const incoming = project(app);
    app.waveCanvas = { project: { status: async () => {}, confirmUnsaved: async () => 1, onCloseRequested: () => () => {}, newProject: async () => {},
        save: async (value, kind) => { writes.push(kind); return { path: 'C:/saved.waveproj', project: value }; },
        open: async () => ({ project: incoming, path: 'C:/saved.waveproj', media: {}, token: 'test' }), activate: async () => {} } };
    vm.runInContext(require('node:fs').readFileSync(path.join(appRoot, 'project-controller.js'), 'utf8'), app);
    t.after(() => events.get('pagehide')());
    app.VisualizerRuntime.updateStandalone({ inputGain: 2 }); intervals[0].callback(); await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(writes.length, 0);
    await app.WaveCanvasProject.newProject(); await app.WaveCanvasProject.newProject(); await app.WaveCanvasProject.open(); await app.WaveCanvasProject.open();
    assert.equal(intervals.length, 1); assert.equal(intervals[0].ms, 300000);
    intervals[0].callback(); await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(writes.length, 0);
    app.VisualizerRuntime.updateStandalone({ inputGain: 2 }); intervals[0].callback(); await new Promise(resolve => setTimeout(resolve, 10)); assert.deepEqual(writes, ['autosave']); assert.equal(app.WaveCanvasProject.getState().dirty, false);
    settings = { ...settings, autosaveEnabled: false }; settingsListener({ project: settings });
    app.VisualizerRuntime.updateStandalone({ inputGain: 2.5 }); assert.equal(await app.WaveCanvasProject.autosave(), false); assert.deepEqual(writes, ['autosave']);
    assert.equal(await app.WaveCanvasProject.save(), true); assert.deepEqual(writes, ['autosave','save']);
    settings = { ...settings, autosaveEnabled: true, autosaveIntervalMinutes: 1 }; settingsListener({ project: settings }); settingsListener({ project: settings });
    assert.equal(intervals.length, 2); assert.equal(intervals[1].ms, 60000);
    app.VisualizerRuntime.updateStandalone({ inputGain: 3 }); intervals[1].callback(); await new Promise(resolve => setTimeout(resolve, 10)); assert.deepEqual(writes, ['autosave','save','autosave']);
    events.get('pagehide')(); assert.equal(cleared[0], 1);
});
test('Canonical comparison ignores key order and save metadata, strips all temporary image URLs', () => {
    const app = renderer(); app.VisualizerRuntime.updateProperties({ logoimage: { value: 'blob:cover' }, backgroundimage: { value: 'blob:bg' } });
    const value = project(app), reversed = JSON.parse(JSON.stringify(value)); reversed.modifiedAt = 'later'; reversed.name = 'different';
    assert.notEqual(model.comparison(value), model.comparison(reversed), 'rename is dirty project metadata');
    reversed.name = value.name; reversed.state.media = Object.fromEntries(Object.entries(reversed.state.media).reverse());
    assert.equal(model.comparison(value), model.comparison(reversed)); assert.doesNotMatch(model.serialize(value), /blob:/);
    reversed.state.settings.standalone.inputGain = 2; assert.notEqual(model.comparison(value), model.comparison(reversed));
});
test('New/full-bank project normalization keeps global media out of layout banks', () => {
    const app = renderer(), r = app.VisualizerRuntime;
    const layouts = Object.fromEntries(app.VisualizerFactoryDefaults.layouts.map(layout => { const defaults = app.VisualizerFactoryDefaults.get(layout); return [layout, { visualizer: defaults.standalone.visualizer, properties: defaults.properties, text: defaults.standalone.text }]; }));
    r.restoreProjectSettings({ properties: r.getDefaults('circle'), standalone: r.getStandaloneDefaults('circle'), layouts });
    r.updateProperties({ logoimage: { value: 'blob:cover' }, backgroundimage: { value: 'blob:bg' } });
    for (const layout of ['square', 'linear', 'circle']) { r.updateStandalone({ visualizer: { layout } }); assert.equal(r.getSettings().logoimage.value, 'blob:cover'); assert.equal(r.getSettings().backgroundimage.value, 'blob:bg'); }
});
test('Atomic replacement, Unicode/space paths and rename failure preserve original contents', async t => {
    const directory = await folder(t), file = path.join(directory, '中文 空白.waveproj'); await atomicWrite(file, 'original');
    const io = { ...fs, rename: async () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); } };
    await assert.rejects(atomicWrite(file, 'replacement', io)); assert.equal(await fs.readFile(file, 'utf8'), 'original');
    assert.deepEqual(await fs.readdir(directory), ['中文 空白.waveproj']); await atomicWrite(file, 'replacement'); assert.equal(await fs.readFile(file, 'utf8'), 'replacement');
});
test('Autosave backs up previous project, retains newest 10 and separates project identity; backup can open', async t => {
    const directory = await folder(t), store = create(path.join(directory, 'userData')), file = path.join(directory, 'song.waveproj'), value = project();
    await store.save(file, value);
    for (let index = 0; index < 12; index++) { value.state.settings.standalone.inputGain = 1 + index / 100; await store.save(file, value, true); }
    const backups = path.join(directory, 'userData/Backups', value.projectId), names = await fs.readdir(backups); assert.equal(names.length, 10);
    const previous = await store.open(path.join(backups, names.sort().at(-1))); assert.equal(previous.project.state.settings.standalone.inputGain, 1.10);
    const other = project(); await store.save(path.join(directory, 'other.waveproj'), other); await store.save(path.join(directory, 'other.waveproj'), other, true);
    assert.equal((await fs.readdir(path.join(directory, 'userData/Backups'))).length, 2);
});
test('Backup retention cleanup failure warns without blocking save; backup creation failure does not replace project', async t => {
    const directory = await folder(t), file = path.join(directory, 'project.waveproj'), value = project(), userData = path.join(directory, 'data');
    await create(userData).save(file, value); const before = await fs.readFile(file, 'utf8');
    const failed = create(userData, { fs: { ...fs, mkdir: async () => { throw new Error('backup denied'); } }, log: { warn() {} } });
    await assert.rejects(failed.save(file, value, true)); assert.equal(await fs.readFile(file, 'utf8'), before);
    let warnings = 0; const cleanupFailure = create(userData, { fs: { ...fs, readdir: async () => { throw new Error('cleanup denied'); } }, log: { warn() { warnings++; } } });
    value.state.settings.standalone.inputGain = 2; await cleanupFailure.save(file, value, true); assert.equal(warnings, 1); assert.equal((await create(userData).open(file)).project.state.settings.standalone.inputGain, 2);
});
test('Collect copies originals only, handles lyrics filename collision, missing media abort, folder move and relative resolution', async t => {
    const directory = await folder(t), userData = path.join(directory, 'data'), store = create(userData), value = project();
    for (const name of ['A', 'B', 'output']) await fs.mkdir(path.join(directory, name));
    const sources = { audio: 'song.wav', cover: 'cover.png', background: 'bg.webp', primary: 'A/same.lrc', secondary: 'B/same.lrc' };
    for (const [slot, relative] of Object.entries(sources)) { const file = path.join(directory, relative); await fs.writeFile(file, slot); value.state.media[slot] = file; }
    const collected = await store.collect(path.join(directory, 'output'), value, path.join(directory, 'original.waveproj'));
    assert.equal(collected.project.projectId, value.projectId); assert.equal(collected.project.state.media.primary, 'media/lyrics/same.lrc'); assert.equal(collected.project.state.media.secondary, 'media/lyrics/same_2.lrc');
    for (const [slot, relative] of Object.entries(sources)) assert.equal(await fs.readFile(path.join(directory, relative), 'utf8'), slot);
    const moved = path.join(directory, 'moved'); await fs.rename(path.dirname(collected.path), moved); const opened = await store.open(path.join(moved, path.basename(collected.path)));
    for (const entry of Object.values(opened.media)) assert.equal(entry.missing, false);
    value.state.media.cover = path.join(directory, 'missing.png'); await assert.rejects(store.collect(path.join(directory, 'output'), value), /收集已中止/);
    assert.deepEqual(await fs.readdir(path.join(directory, 'output')), []);
    await store.save(path.join(directory, 'missing.waveproj'), value); assert.equal((await store.open(path.join(directory, 'missing.waveproj'))).media.cover.missing, true);
});
test('Recent projects persist, deduplicate path, retain 10, mark missing and remove only on explicit command', async t => {
    const directory = await folder(t), store = create(path.join(directory, 'data')), value = project();
    for (let index = 0; index < 12; index++) await store.save(path.join(directory, index + '.waveproj'), value);
    await store.remember(path.join(directory, '11.waveproj'), value);
    const fresh = create(path.join(directory, 'data')); let recent = await fresh.getRecent(); assert.equal(recent.length, 10); assert.equal(recent[0].path, path.join(directory, '11.waveproj'));
    await fs.unlink(recent[0].path); recent = await fresh.getRecent(); assert.equal(recent[0].missing, true); assert.equal(recent.length, 10);
    await fresh.removeRecent(recent[0].path); assert.equal((await fresh.getRecent()).length, 9);
});
