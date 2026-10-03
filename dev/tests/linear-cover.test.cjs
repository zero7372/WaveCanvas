const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname, '..', '..', 'app');
function environment(before=false) {
    const app={window:null,performance:{now:()=>0}};app.window=app;vm.createContext(app);
    vm.runInContext(fs.readFileSync(path.join(root,'layout-schema.js'),'utf8'),app);
    let config={...app.VisualizerLayoutSettings.defaults(),layout:'linear'},opacity=100;const callbacks=[];
    const notify=()=>callbacks.forEach(fn=>fn({circleopacity:{value:opacity}},{visualizer:config}));
    app.VisualizerRuntime={mode:'standalone',getStandalone:()=>({visualizer:config}),subscribe(fn){callbacks.push(fn);notify();}};
    if(!before)vm.runInContext(fs.readFileSync(path.join(root,'linear-cover.js'),'utf8'),app);
    vm.runInContext(fs.readFileSync(path.join(root,before?'../dev/tests/artifacts/linear-cover-geometry-before.js':'visualizer-geometry.js'),'utf8'),app);
    return {app,config:()=>config,set(patch,newOpacity=opacity){config={...config,...patch};opacity=newOpacity;notify();}};
}
function context() {
    const calls=[],stack=[],target={globalAlpha:1};
    const ctx=new Proxy(target,{get(t,k){if(k in t)return t[k];return (...args)=>{
        calls.push([k,...args]);if(k==='save')stack.push({...t});if(k==='restore'){const saved=stack.pop();Object.keys(t).forEach(key=>delete t[key]);Object.assign(t,saved);}
    };},set(t,k,v){calls.push(['set',k,v]);t[k]=v;return true;}});
    return {ctx,calls};
}
const image={naturalWidth:800,naturalHeight:400},appearance={image,bass:{center:20},shakeX:7,shakeY:-9,autoRotation:11,logoRotation:0,centerColor:'#fff',second:true,secondRadius:20,secondColor:'#000',color:()=> '#ddd'};
test('Linear artwork has independent X/Y/size, full rectangular artwork and shared bass/shake/opacity',()=>{
    const env=environment();env.set({coverX:62,coverY:54,coverSize:38},40);
    const c=context();env.app.VisualizerLinearCover.draw(c.ctx,env.config(),appearance,0);
    assert.deepEqual(c.calls.find(c=>c[0]==='translate'),['translate',1920*.62+7,1080*.54-9]);
    assert.equal(c.calls.find(c=>c[0]==='scale')[1],(1080*.38/2+20)/(1080*.38/2));
    assert.ok(c.calls.some(c=>c[0]==='set'&&c[1]==='globalAlpha'&&c[2]===.4));
    assert.equal(c.ctx.globalAlpha,1);assert.ok(!c.calls.some(c=>c[0]==='clip'||c[0]==='rotate'));
    const drawn=c.calls.find(c=>c[0]==='drawImage');assert.equal(drawn[1],image);assert.equal(drawn[4]/drawn[5],2);
    const blank=context();env.app.VisualizerLinearCover.draw(blank.ctx,env.config(),{...appearance,image:null},1000);assert.equal(blank.calls.length,0);
});
test('Circular artwork clips/rotates/scales around the same center, with FPS-independent signed RPM',()=>{
    const angle=(speed,fps)=>{
        const env=environment();env.set({coverShape:'circle',coverRotationSpeed:speed});let last;
        for(let i=0;i<=fps*2;i++){last=context();env.app.VisualizerLinearCover.draw(last.ctx,env.config(),appearance,i*1000/fps);}
        return last.calls.find(c=>c[0]==='rotate')[1];
    };
    for(const fps of [15,30,60,120])for(const speed of [-2,-.8,0,.8,2])assert.ok(Math.abs(angle(speed,fps)-speed*12*Math.PI/180)<1e-10);
    const env=environment();env.set({coverShape:'circle',coverSize:38});const c=context();env.app.VisualizerLinearCover.draw(c.ctx,env.config(),appearance,0);
    const arc=c.calls.find(c=>c[0]==='arc');assert.deepEqual(arc.slice(1,4),[0,0,1080*.38/2]);
    assert.ok(c.calls.findIndex(c=>c[0]==='translate')<c.calls.findIndex(c=>c[0]==='scale'));
    assert.ok(c.calls.findIndex(c=>c[0]==='clip')<c.calls.findIndex(c=>c[0]==='rotate'));
    assert.deepEqual(c.calls.find(c=>c[0]==='drawImage').slice(2,6),[200,0,400,400]);
});
test('Shape/layout transitions retain Linear geometry/speed and do not add a hidden elapsed-time jump',()=>{
    const env=environment();env.set({coverShape:'circle',coverX:62,coverY:54,coverSize:38,coverRotationSpeed:-.8});
    const draw=time=>{const c=context();env.app.VisualizerLinearCover.draw(c.ctx,env.config(),appearance,time);return c.calls.filter(c=>c[0]==='rotate');};
    draw(0);const prior=draw(1000)[0][1];env.set({coverShape:'square'});assert.equal(draw(50000).length,0);
    env.set({coverShape:'circle'});assert.equal(draw(100000)[0][1],prior);
    env.set({layout:'circle',squareSize:410});env.set({layout:'square'});env.set({layout:'linear'});
    assert.equal(env.config().coverRotationSpeed,-.8);assert.equal(env.config().coverX,62);assert.equal(env.config().squareSize,410);assert.equal(draw(200000)[0][1],prior);
});
test('Circle/Square draw traces and every Linear spectrum geometry remain identical to previous renderer',()=>{
    const current=environment(),before=environment(true),samples=Array.from({length:128},(_,i)=>i%7/7);
    const plain=value=>JSON.parse(JSON.stringify(value));
    for(const layout of ['circle','square','linear'])for(const mirror of ['none','center','dual'])for(const reverse of [false,true])for(const rotation of [-70,0,75]) {
        const patch={layout,mirror,reverse,rotation,coverShape:'circle',coverRotationSpeed:2,coverX:62,coverY:54,coverSize:38};current.set(patch);before.set(patch);
        assert.deepEqual(plain(current.app.VisualizerGeometry.build(samples,current.config(),appearance.bass)),plain(before.app.VisualizerGeometry.build(samples,before.config(),appearance.bass)));
        const a=context(),b=context(),renderAppearance=layout==='linear'?{...appearance,image:null}:appearance;
        current.app.VisualizerGeometry.draw(a.ctx,samples,renderAppearance);before.app.VisualizerGeometry.draw(b.ctx,samples,renderAppearance);
        assert.deepEqual(a.calls,b.calls);
    }
});
test('Existing schema values remain unchanged and new Linear fields safely normalize old presets',()=>{
    const env=environment(),old={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'../dev/tests/artifacts/linear-cover-schema-before.js'),'utf8'),old);
    for(const[key,field]of Object.entries(old.window.VisualizerLayoutSettings.properties))assert.equal(JSON.stringify(env.app.VisualizerLayoutSettings.properties[key]),JSON.stringify(field));
    const settings=env.app.VisualizerLayoutSettings,legacy=settings.normalize({layout:'linear'});
    assert.equal(legacy.coverShape,'square');assert.equal(legacy.coverSize,30);assert.equal(legacy.coverRotationSpeed,0);
    assert.equal(settings.normalize({coverSize:200,coverX:-10,coverRotationSpeed:200}).coverSize,100);
    assert.throws(()=>settings.normalize({coverRotationSpeed:Infinity}));assert.throws(()=>settings.normalize({coverShape:'invalid'}));
});
