const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname, '..', '..', 'app');
function policy() {const app={window:{}};for(const file of ['property-schema.js','property-compatibility.js','layout-schema.js','inspector-policy.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),app);return app.window;}
test('Inspector classifies every active visualizer control without duplicating schema values',()=>{
    const app=policy(),p=app.VisualizerInspectorPolicy;
    const elsewhere=new Set(['normalize','noise','resposive','logoimage','backgroundsource','backgroundcolor','backgroundimage','backgroundimagef','imageoptions1','horizontal','vertical']);
    for(const [key,field]of Object.entries(app.VisualizerPropertySchema.properties)) {
        if(field.type==='text'||!app.VisualizerPropertyCompatibility.visible(key)||elsewhere.has(key))continue;
        assert.ok(p.propertySections[key],key+' must have a section');
    }
    assert.deepEqual(Object.keys(p.geometrySections).sort(),Object.keys(app.VisualizerLayoutSettings.properties).sort());
    for(const key of Object.keys(p.propertySections).filter(key=>p.propertySections[key]==='spectrum'))for(const layout of ['circle','square','linear'])assert.equal(p.propertyApplies(key,layout),true);
});
test('Inspector scopes follow actual renderers and particle conditions',()=>{
    const p=policy().VisualizerInspectorPolicy;
    for(const key of ['audiocount','barwidth','barheight','barsarc','userspectrumrotation','circleradius','circlearc','circlerotate','reverseright','eqpositionx','eqpositiony'])for(const layout of ['circle','square','linear'])assert.equal(p.propertyApplies(key,layout),layout==='circle');
    for(const key of ['secondcircle','circlecolor','autobarsrotate','autologorotate','barcircledistance','bbassmultiplier','c1bassmultiplier'])for(const layout of ['circle','square','linear'])assert.equal(p.propertyApplies(key,layout),layout!=='linear');
    for(const key of ['cbassmultiplier','circleopacity'])for(const layout of ['circle','square','linear'])assert.equal(p.propertyApplies(key,layout),true);
    for(const key of ['squareSize','squareSpectrumLayout','direction'])for(const layout of ['circle','square','linear'])assert.equal(p.geometryApplies(key,layout),layout==='square');
    for(const key of ['orientation','width','anchor','mirror','amplitudeDirection'])for(const layout of ['circle','square','linear'])assert.equal(p.geometryApplies(key,layout),layout==='linear');
    assert.equal(p.condition('particlecolor','original'),'particlestyle.value == 2 || particlerainbow.value == false');
    assert.equal(p.condition('autologorotatespeed','original'),'logoimage.value && autologorotate.value');
});
test('Inspector protected Circle renderer, FFT, listener and audio remain byte-identical',()=>{
    const hashes=JSON.parse(fs.readFileSync(path.join(root,'../dev/tests/artifacts/inspector-protected-hashes.json'),'utf8').replace(/^\uFEFF/,''));
    for(const[file,expected]of Object.entries(hashes)) {
        // Linear artwork intentionally extends these two files; targeted tests compare the old geometry.
        // Factory defaults intentionally change runtime/preset handling; factory-defaults.test.cjs covers it.
        // Template/media UI intentionally changes shell; templates.test.cjs protects all other modules.
        // SRT import intentionally extends runtime source metadata; its renderer remains hash-protected.
        if (['visualizer-geometry.js','layout-schema.js','runtime-adapter.js','presets.js','wavecanvas-shell.js','lyrics-runtime.js'].includes(file)) continue;
        assert.equal(crypto.createHash('sha256').update(require('./project-baseline.cjs')(file,fs.readFileSync(path.join(root,file)))).digest('hex'),expected,file);
    }
});
