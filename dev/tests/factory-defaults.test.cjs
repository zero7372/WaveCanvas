const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..', '..', 'app');
const plain = value => JSON.parse(JSON.stringify(value));
function environment(we = false) {
    const app = { console }; app.window = app;
    if (we) app.wallpaperRegisterAudioListener = () => {};
    vm.createContext(app);
    for (const file of ['property-schema.js','layout-schema.js','system-fonts.js','property-compatibility.js','song-info-schema.js','lyrics-schema.js','background-schema.js','inspector-policy.js','factory-defaults-data.js','factory-layout-defaults.js','runtime-adapter.js','presets.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), app, { filename: file });
    }
    return app;
}
test('All supplied factory fields and provenance are retained exactly; missing fields use schema fallback', () => {
    const app = environment(), runtime = app.VisualizerRuntime;
    for (const layout of ['circle','square','linear']) {
        const bytes = fs.readFileSync(path.join(root, '..', 'dev', 'fixtures', 'factory-defaults',layout + '.json'));
        const source = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
        assert.equal(app.VisualizerFactorySources[layout].sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
        const baseline = app.VisualizerFactoryDefaults.get(layout);
        for (const [key, value] of Object.entries(source.properties)) assert.deepEqual(plain(baseline.properties[key]),value,key);
        for (const [section, values] of Object.entries(source.standalone)) {
            if (typeof values === 'number') assert.equal(baseline.standalone[section],values);
            else for (const [key,value] of Object.entries(values)) assert.equal(baseline.standalone[section][key],value,layout + ':' + section + ':' + key);
        }
        runtime.updateStandalone({visualizer:{layout}});
        assert.deepEqual(plain(runtime.getStandalone().visualizer),plain(baseline.standalone.visualizer));
        for (const key of app.VisualizerFactoryDefaults.propertyKeys) assert.deepEqual(plain(runtime.getSettings()[key]),plain(baseline.properties[key]));
    }
    assert.equal(runtime.getStandalone().visualizer.coverShape,'circle');
    assert.equal(runtime.getStandalone().visualizer.coverRotationSpeed,0);
    const we = environment(true).VisualizerRuntime;
    assert.equal(we.getSettings().circleradius.value,64); assert.equal(we.getStandalone().inputGain,1);
});
test('Factory snapshots are deeply frozen and clone-on-use; runtime and presets cannot mutate them', () => {
    const app = environment(), factory = app.VisualizerFactoryDefaults, runtime = app.VisualizerRuntime;
    const original = JSON.stringify(factory.get('linear'));
    const copy = factory.get('linear'); copy.standalone.visualizer.coverX = 99; copy.properties.circleopacity.value = 3;
    assert.ok(Object.isFrozen(app.VisualizerFactorySources.linear.preset.standalone.visualizer));
    runtime.updateStandalone({visualizer:{layout:'linear',coverX:79}});
    const preset = app.VisualizerPresets.create('Edited'); preset.standalone.visualizer.coverY = 81;
    app.VisualizerPresets.import(JSON.stringify(preset)); runtime.restoreDefault('visualizer','coverX');
    assert.equal(runtime.getStandalone().visualizer.coverX,50); assert.equal(runtime.getStandalone().visualizer.coverY,81);
    assert.equal(JSON.stringify(factory.get('linear')),original);
});
test('Layout switching preserves independent geometry, spectrum, center, and song-info positions; shared assets stay', () => {
    const app = environment(), r = app.VisualizerRuntime;
    r.updateProperties({circleradius:{value:189},logoimage:{value:'blob:user-cover'},particlenum:{value:7},resposive:{value:44}});
    r.updateStandalone({text:{positionY:87,title:'User song'},visualizer:{positionX:61}});
    r.updateStandalone({visualizer:{layout:'square',squareSize:350,positionX:42},text:{positionY:84}});
    r.updateProperties({barcolor:{value:'0 1 0'},circleopacity:{value:62}});
    r.updateStandalone({visualizer:{layout:'linear',width:1600,positionY:96,coverX:73}});
    r.updateProperties({circleopacity:{value:80}});
    r.updateStandalone({visualizer:{layout:'circle'}});
    assert.equal(r.getSettings().circleradius.value,189); assert.equal(r.getSettings().circleopacity.value,100);
    assert.equal(r.getStandalone().visualizer.positionX,61); assert.equal(r.getStandalone().text.positionY,87);
    r.updateStandalone({visualizer:{layout:'square'}});
    assert.equal(r.getStandalone().visualizer.squareSize,350); assert.equal(r.getStandalone().text.positionY,84);
    assert.equal(r.getSettings().circleopacity.value,62); assert.equal(r.getSettings().barcolor.value,'0 1 0');
    r.updateStandalone({visualizer:{layout:'linear'}});
    assert.equal(r.getStandalone().visualizer.width,1600); assert.equal(r.getStandalone().visualizer.coverX,73);
    assert.equal(r.getSettings().circleopacity.value,80);
    assert.equal(r.getSettings().logoimage.value,'blob:user-cover'); assert.equal(r.getSettings().particlenum.value,7);
    assert.equal(r.getSettings().resposive.value,44); assert.equal(r.getStandalone().text.title,'User song');
});
test('Single-value restores are context-aware and do not change neighbouring fields; floats compare tolerantly', () => {
    const app = environment(), r = app.VisualizerRuntime;
    for (const layout of ['circle','square','linear']) {
        r.updateStandalone({visualizer:{layout,positionX:76,positionY:66,coverX:71,coverY:72,coverSize:41,coverRotationSpeed:9}});
        for (const key of ['positionX','positionY','coverX','coverY','coverSize','coverRotationSpeed']) {
            const before = r.getStandalone(), expected = app.VisualizerFactoryDefaults.get(layout).standalone.visualizer[key];
            r.restoreDefault('visualizer',key); before.visualizer[key] = expected;
            assert.deepEqual(plain(r.getStandalone()),plain(before));
        }
        r.updateStandalone({text:{positionY:92}}); r.restoreDefault('text','positionY');
        assert.equal(r.getStandalone().text.positionY,{circle:78,square:80,linear:75}[layout]);
        r.updateProperties({barheight:{value:295}}); r.restoreDefault('properties','barheight');
        assert.equal(r.getSettings().barheight.value,layout==='circle'?230:100);
    }
    assert.ok(app.VisualizerFactoryDefaults.equal(.65 + 1e-10,.65));
    assert.ok(!app.VisualizerFactoryDefaults.equal(.651,.65));
    assert.throws(()=>r.restoreDefault('visualizer','coverShape')); assert.throws(()=>r.restoreDefault('properties','logoimage'));
});
test('Preset import targets the destination bank and does not overwrite inactive layouts; resets use current factory', () => {
    const app = environment(), r = app.VisualizerRuntime, p = app.VisualizerPresets;
    r.updateProperties({circleradius:{value:190}});
    p.import(JSON.stringify({format:'audio-visualizer-preset',version:1,properties:{circleopacity:45},standalone:{visualizer:{layout:'linear',coverX:79}}}));
    assert.equal(r.getStandalone().visualizer.width,1920); assert.equal(r.getStandalone().visualizer.coverShape,'circle');
    assert.equal(r.getStandalone().visualizer.positionY,100); assert.equal(r.getStandalone().inputGain,3);
    r.updateStandalone({visualizer:{layout:'circle'}}); assert.equal(r.getSettings().circleradius.value,190);
    r.updateStandalone({visualizer:{layout:'linear'}}); assert.equal(r.getStandalone().visualizer.coverX,79);
    p.reset(); assert.equal(r.getStandalone().visualizer.layout,'linear'); assert.equal(r.getStandalone().visualizer.coverX,50);
    assert.deepEqual(plain(r.getStandalone()),plain(r.getStandaloneDefaults()));
    p.import(JSON.stringify({format:'audio-visualizer-preset',version:1,properties:{}}));
    assert.equal(r.getStandalone().visualizer.layout,'circle'); assert.equal(r.getSettings().circleradius.value,160);
    p.import(JSON.stringify({format:'audio-visualizer-preset',version:1,properties:{},standalone:{visualizer:{layout:'square'}}}));
    assert.equal(r.getStandalone().visualizer.squareSpectrumLayout,'foldedDiagonal');
    assert.equal(r.getStandalone().visualizer.rotation,90);
});
test('Rejected updates are atomic, including inactive state banks', () => {
    const app = environment(),r = app.VisualizerRuntime;
    r.updateProperties({circleradius:{value:181}}); const before = JSON.stringify(r.getStandalone());
    assert.throws(()=>r.updateStandalone({visualizer:{layout:'linear'},inputGain:NaN}));
    assert.throws(()=>r.updateStandalone({visualizer:{layout:'linear',coverSize:NaN}}));
    assert.throws(()=>app.VisualizerPresets.import('{broken'));
    assert.equal(JSON.stringify(r.getStandalone()),before);
    r.updateStandalone({visualizer:{layout:'linear'}}); r.updateStandalone({visualizer:{layout:'circle'}});
    assert.equal(r.getSettings().circleradius.value,181);
});
