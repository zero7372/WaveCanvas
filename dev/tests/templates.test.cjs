const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname, '..', '..', 'app');
const plain=value=>JSON.parse(JSON.stringify(value));
function environment(){
    const app={console};app.window=app;vm.createContext(app);
    for(const file of ['property-schema.js','layout-schema.js','system-fonts.js','property-compatibility.js','song-info-schema.js','lyrics-schema.js','background-schema.js','inspector-policy.js','factory-defaults-data.js','factory-layout-defaults.js','runtime-adapter.js','presets.js','builtin-templates.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),app,{filename:file});
    return app;
}
test('Template definitions retain exact requested copy, existing PNGs and null video metadata',()=>{
    const app=environment(),definitions=app.VisualizerTemplates.definitions;
    const copy=[['Circle','環形頻譜','以封面為中心的環形音訊頻譜，適合主視覺置中的構圖。'],['Square','方形頻譜','圍繞封面的方形頻譜框架，適合對稱、穩定的視覺配置。'],['Linear','直線頻譜','橫向或直向的直線頻譜，搭配可獨立配置的封面位置與樣式。']];
    assert.equal(definitions.length,3);assert.ok(Object.isFrozen(definitions));
    definitions.forEach((item,i)=>{
        assert.deepEqual([item.name,item.subtitle,item.description],copy[i]); assert.equal(item.previewVideo,null);
        assert.ok(fs.existsSync(path.join(root,item.thumbnail)));assert.ok(Object.isFrozen(item));
        const manifest=JSON.parse(fs.readFileSync(path.join(root,'../dev/notes/repository-file-manifest.json'),'utf8').replace(/^\uFEFF/,''));
        const source=manifest.find(entry=>entry.destination==='app/'+item.thumbnail);
        assert.equal(source.sha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,item.thumbnail))).digest('hex'));
    });
});
test('Template launchers apply complete target visual defaults and preserve all media, audio and Lyrics settings',()=>{
    const app=environment(),r=app.VisualizerRuntime,t=app.VisualizerTemplates;
    r.updateProperties({logoimage:{value:'blob:cover'},backgroundimage:{value:'blob:background'},backgroundsource:{value:2},resposive:{value:55},normalize:{value:false}});
    r.updateStandalone({inputGain:1.25,lyrics:{globalOffsetMs:351,fontSize:55},text:{title:'User title',artist:'User artist'}});
    const original=JSON.stringify(app.VisualizerFactoryDefaults.get('linear'));
    for(const definition of t.definitions){
        r.updateStandalone({visualizer:{layout:definition.layout,positionY:20,coverX:77,rotation:45}});
        t.apply(definition.id);const baseline=app.VisualizerFactoryDefaults.get(definition.layout),state=r.getStandalone();
        assert.deepEqual(plain(state.visualizer),plain(baseline.standalone.visualizer));
        assert.deepEqual(plain(state.background),plain(baseline.standalone.background));
        for(const key of app.VisualizerFactoryDefaults.propertyKeys)assert.deepEqual(plain(r.getSettings()[key]),plain(baseline.properties[key]),key);
        assert.equal(r.getSettings().logoimage.value,'blob:cover');assert.equal(r.getSettings().backgroundimage.value,'blob:background');assert.equal(r.getSettings().backgroundsource.value,2);
        assert.equal(r.getSettings().resposive.value,55);assert.equal(r.getSettings().normalize.value,false);
        assert.equal(state.inputGain,1.25);assert.equal(state.lyrics.globalOffsetMs,351);assert.equal(state.lyrics.fontSize,55);
        assert.equal(state.text.title,'User title');assert.equal(state.text.artist,'User artist');
    }
    assert.equal(JSON.stringify(app.VisualizerFactoryDefaults.get('linear')),original);
});
test('Templates reject unknown ids, retain inactive edits and leave Preset/Factory restore semantics intact',()=>{
    const app=environment(),r=app.VisualizerRuntime,p=app.VisualizerPresets;
    r.updateProperties({circleradius:{value:181}});const before=JSON.stringify(r.getStandalone());
    assert.throws(()=>app.VisualizerTemplates.apply('missing'));
    assert.equal(JSON.stringify(r.getStandalone()),before);
    app.VisualizerTemplates.apply('square-default');r.updateStandalone({visualizer:{layout:'circle'}});
    assert.equal(r.getSettings().circleradius.value,181);
    app.VisualizerTemplates.apply('linear-default');r.updateStandalone({visualizer:{coverX:79}});
    const preset=p.create('Saved');p.reset();p.import(JSON.stringify(preset));r.restoreDefault('visualizer','coverX');
    assert.equal(r.getStandalone().visualizer.coverX,50);assert.equal(r.getStandalone().visualizer.coverShape,'circle');
});
test('Template and media UI scope does not modify renderers, audio, factory/preset, Lyrics or Timing modules',()=>{
    const hashes=JSON.parse(fs.readFileSync(path.join(root,'../dev/tests/artifacts/template-protected-hashes.json'),'utf8').replace(/^\uFEFF/,''));
    for(const [file,hash] of Object.entries(hashes)) {
        // SRT import intentionally extends source/runtime/UI; srt.test.cjs covers metadata and protects renderer.
        if (['lyrics-runtime.js','lyrics-ui.js','timing-model.js'].includes(file)) continue;
        assert.equal(crypto.createHash('sha256').update(require('./project-baseline.cjs')(file,fs.readFileSync(path.join(root,file)))).digest('hex'),hash,file);
    }
    const ui=fs.readFileSync(path.join(root,'template-selection-ui.js'),'utf8');
    assert.doesNotMatch(ui,/createElement\(['"]video|\.play\(|confirm\(/);
    assert.doesNotMatch(fs.readFileSync(path.join(root,'wavecanvas-shell.js'),'utf8'),/confirm\(/);
});
