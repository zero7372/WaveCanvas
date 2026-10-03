const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..', '..', 'app');
function environment(file = 'visualizer-geometry.js') {
    const app = {window:null};app.window=app;vm.createContext(app);
    vm.runInContext(fs.readFileSync(path.join(root,'layout-schema.js'),'utf8'),app);
    let config = {...app.VisualizerLayoutSettings.defaults(),layout:'square'}; let update;
    app.VisualizerRuntime={mode:'standalone',getStandalone:()=>({visualizer:config}),subscribe(callback){update=callback;callback({}, {visualizer:config});}};
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),app);
    return {geometry:app.VisualizerGeometry,defaults:app.VisualizerLayoutSettings.defaults(),set(patch){config={...config,...patch};update({}, {visualizer:config});}};
}
const plain = value => JSON.parse(JSON.stringify(value));
test('Every Square side and each side center are exactly mirrored for all count/mirror/reverse settings', () => {
    const app=environment(), samples=Array.from({length:128},(_,i)=>i<64?((i*17)%31)/31:1000),original=JSON.stringify(samples);
    for(let count=4;count<=128;count++)for(const mirror of ['none','center','dual'])for(const reverse of [false,true]) {
        const config={...app.defaults,layout:'square',barCount:count,mirror,reverse};
        const output=app.geometry.build(samples,config),n=output.perSide;
        assert.equal(output.bars.length,n*4);assert.ok(Math.abs(n*4-count)<=2);
        for(let i=0;i<n;i++) {
            const [top,right,bottom,left]=[0,1,2,3].map(side=>output.bars[side*n+i]);
            for(const bar of [right,bottom,left]) {
                assert.equal(bar.length,top.length);assert.equal(bar.width,top.width);
                assert.equal(bar.colorIndex,top.colorIndex);assert.equal(bar.frequencyStart,top.frequencyStart);assert.equal(bar.frequencyEnd,top.frequencyEnd);
            }
            const twin=output.bars[n-1-i];
            assert.equal(twin.length,top.length);assert.ok(Math.abs(twin.x+top.x)<1e-9);
            assert.equal(top.x,bottom.x);assert.equal(top.y,-bottom.y);
            assert.equal(right.x,-left.x);assert.equal(right.y,left.y);
            assert.equal(top.ny,-1);assert.equal(right.nx,1);assert.equal(bottom.ny,1);assert.equal(left.nx,-1);
        }
    }
    assert.equal(JSON.stringify(samples),original);
});
test('Square peak aggregation covers every processed bin and distributes low-frequency peaks to all four sides', () => {
    const app=environment(),config={...app.defaults,layout:'square'},samples=Array(128).fill(0);
    for(let bin=0;bin<64;bin++) {
        samples.fill(0);samples[bin]=.6;
        const {bars,perSide:n}=app.geometry.build(samples,config);
        for(let side=0;side<4;side++)assert.equal(Math.max(...bars.slice(side*n,(side+1)*n).map(b=>b.length)),.6*config.height);
    }
    samples.fill(0);samples[1]=.8;
    const {bars,perSide:n}=app.geometry.build(samples,config);
    for(let side=0;side<4;side++) {
        assert.equal(bars[side*n+n/2-1].length,.8*config.height);
        assert.equal(bars[side*n+n/2].length,.8*config.height);
        assert.equal(bars[side*n].length,0);
    }
    samples[1]=Infinity;samples[2]=NaN;samples[3]=-9;
    assert.ok(app.geometry.build(samples,config).bars.every(b=>b.length===0));
});
test('Square leaves corners clear and supports inward, bass spacing and identical mirrored colors', () => {
    const app=environment(),config={...app.defaults,layout:'square'},samples=Array(128).fill(.4);
    const outward=app.geometry.build(samples,config,{center:8,bars:6,distance:10});
    assert.equal(outward.half,config.squareSize/2+8);
    const edge=config.squareSize/2+16;
    for(const bar of outward.bars) {
        const along=bar.nx?bar.y:bar.x;
        assert.ok(Math.abs(along)+bar.width/2<edge);
        assert.equal(bar.length,.4*config.height);
    }
    const inward=app.geometry.build(samples,{...config,direction:'inward'},{center:8,bars:6,distance:10});
    for(let i=0;i<outward.bars.length;i++)assert.equal(inward.bars[i].length,-outward.bars[i].length);
    let colorCalls=0;const fills=[];const ctx=new Proxy({}, {get(t,k){if(k==='fillRect')return (...args)=>fills.push({args,color:t.fillStyle});return k in t?t[k]:()=>{};}});
    app.geometry.draw(ctx,samples,{bass:{},shakeX:0,shakeY:0,autoRotation:0,logoRotation:0,centerColor:'#111',color:()=>String(++colorCalls)});
    assert.equal(colorCalls,8,'Each frequency group computes color once');
    const bars=fills.slice(1);
    assert.equal(bars.length,64);for(let i=0;i<16;i++)for(let side=1;side<4;side++)assert.equal(bars[i].color,bars[side*16+i].color);
});
test('Linear geometry and drawing traces exactly match the previous renderer', () => {
    const now=environment(),before=environment('../dev/tests/fixtures/baselines/square-geometry-before.js');
    const samples=Array.from({length:128},(_,i)=>i%7/7);
    for(const layout of ['linear','circle'])for(const orientation of ['horizontal','vertical'])for(const mirror of ['none','center','dual'])for(const reverse of [false,true])for(const anchor of ['start','center','end'])for(const amplitudeDirection of ['positive','negative','both']) {
        const config={...now.defaults,layout,orientation,mirror,reverse,anchor,amplitudeDirection,barCount:17,rotation:23};
        assert.deepEqual(plain(now.geometry.build(samples,config,{center:3,distance:5,bars:8})),plain(before.geometry.build(samples,config,{center:3,distance:5,bars:8})));
        if(layout!=='linear')continue;
        const trace=app=>{
            const calls=[],ctx=new Proxy({}, {get(t,k){return k in t?t[k]:(...args)=>calls.push([k,...args]);},set(t,k,v){calls.push(['set',k,v]);t[k]=v;return true;}});
            app.set(config);app.geometry.draw(ctx,samples,{bass:{center:3,distance:5,bars:8},shakeX:1,shakeY:2,autoRotation:12,logoRotation:0,color:i=>String(i)});return calls;
        };
        assert.deepEqual(trace(now),trace(before));
    }
});
test('Circle renderer, FFT, listener, Audio, Lyrics and Timing implementation are unchanged', () => {
    const hashes=JSON.parse(fs.readFileSync(path.join(root,'../dev/tests/fixtures/baselines/square-protected-hashes.json')));
    for(const [file,expected] of Object.entries(hashes)) {
        // Factory defaults intentionally change runtime/preset handling, not the renderers or audio.
        // SRT import adds runtime source metadata without changing Lyrics renderer.
        if (['runtime-adapter.js','presets.js','lyrics-runtime.js'].includes(file)) continue;
        assert.equal(crypto.createHash('sha256').update(require('./project-baseline.cjs')(file,fs.readFileSync(path.join(root,file)))).digest('hex'),expected,file);
    }
});
test('Square spectrum layouts preserve counts, corner spacing, band coverage and their symmetry', () => {
    const app=environment(),samples=Array.from({length:128},(_,i)=>i<64?(i+1)/64:1000);
    for(const squareSpectrumLayout of ['symmetric','topBassMirror','foldedDiagonal'])for(let count=4;count<=128;count++)for(const reverse of [false,true]) {
        const config={...app.defaults,layout:'square',squareSpectrumLayout,barCount:count,reverse};
        const {bars,perSide:n}=app.geometry.build(samples,config),edge=config.squareSize/2;
        assert.equal(bars.length,4*n);
        const at=(side,i)=>bars[side*n+i];
        const same=(a,b)=>{assert.equal(a.group,b.group);assert.equal(a.length,b.length);assert.equal(a.colorIndex,b.colorIndex);};
        const bands=new Set();
        for(let side=0;side<4;side++)for(let i=0;i<n;i++) {
            const b=at(side,i),along=b.nx?b.y:b.x;
            assert.ok(Math.abs(along)+b.width/2<edge);
            if(i>0) {const prev=at(side,i-1);assert.ok(along-(prev.nx?prev.y:prev.x)>=b.width-1e-8);}
            for(let bin=b.frequencyStart;bin<=b.frequencyEnd;bin++)bands.add(bin);
            assert.equal(b.length,(b.frequencyEnd+1)/64*config.height);
        }
        assert.equal(bands.size,64);
        for(let i=0;i<n;i++) {
            if(squareSpectrumLayout==='symmetric') {same(at(0,i),at(0,n-1-i));for(let side=1;side<4;side++)same(at(0,i),at(side,i));}
            if(squareSpectrumLayout==='topBassMirror') {same(at(0,i),at(0,n-1-i));same(at(2,i),at(2,n-1-i));same(at(1,i),at(3,n-1-i));}
            if(squareSpectrumLayout==='foldedDiagonal') {same(at(0,i),at(2,n-1-i));same(at(1,i),at(3,n-1-i));same(at(0,i),at(1,n-1-i));}
        }
        // Clockwise route: top center -> top right -> right -> bottom center.
        if(squareSpectrumLayout==='topBassMirror') {
            const path=[...bars.slice(Math.floor(n/2),n),...bars.slice(n,2*n),...bars.slice(2*n+Math.floor(n/2),3*n).reverse()];
            for(let i=1;i<path.length;i++)assert.ok(reverse?path[i].group<=path[i-1].group:path[i].group>=path[i-1].group);
            if(n>1&&!reverse)assert.ok(Math.min(...bars.slice(n).map(b=>b.frequencyStart))>0);
        }
        if(squareSpectrumLayout==='foldedDiagonal') {
            for(let i=1;i<n;i++)assert.ok(reverse?at(0,i).group>at(0,i-1).group:at(0,i).group<at(0,i-1).group);
            same(at(0,n-1),at(1,0));same(at(2,0),at(3,n-1));
        }
    }
});
test('All Square layouts retain reverse, inward, bass, rotation and cached cover drawing', () => {
    const app=environment(),samples=Array.from({length:128},(_,i)=>i/128), image={cached:true};
    for(const squareSpectrumLayout of ['symmetric','topBassMirror','foldedDiagonal']) {
        const config={...app.defaults,layout:'square',squareSpectrumLayout};
        const normal=app.geometry.build(samples,config),reverse=app.geometry.build(samples,{...config,reverse:true});
        const maxGroup=Math.max(...normal.bars.map(b=>b.group));
        normal.bars.forEach((b,i)=>assert.equal(reverse.bars[i].group,maxGroup-b.group));
        const bass={center:8,bars:6,distance:10}, outward=app.geometry.build(samples,config,bass),inward=app.geometry.build(samples,{...config,direction:'inward'},bass);
        assert.equal(outward.half,config.squareSize/2+8);
        outward.bars.forEach((b,i)=>{assert.equal(inward.bars[i].length,-b.length);assert.equal(b.nx?Math.abs(b.x):Math.abs(b.y),config.squareSize/2+16);});
        assert.deepEqual(plain(app.geometry.build(samples,{...config,rotation:73},bass)),plain(outward));
        const rotations=[],images=[],colors=[];
        const ctx=new Proxy({}, {get(t,k){if(k==='rotate')return value=>rotations.push(value);if(k==='drawImage')return (...args)=>images.push(args);return k in t?t[k]:()=>{};}});
        app.set({...config,rotation:73});
        app.geometry.draw(ctx,samples,{bass,shakeX:0,shakeY:0,autoRotation:12,logoRotation:7,image,color:index=>{colors.push(index);return '#fff';}});
        assert.equal(rotations[0],85*Math.PI/180);assert.equal(rotations[1],7*Math.PI/180);assert.equal(images[0][0],image);
        assert.equal(colors.length,maxGroup+1);assert.ok(colors.every(index=>index>=0&&index<=127));
    }
});
test('Square spectrum schema defaults legacy presets to Symmetric and validates enums', () => {
    const app=environment();assert.equal(app.defaults.squareSpectrumLayout,'symmetric');
    const env={window:null};env.window=env;vm.createContext(env);vm.runInContext(fs.readFileSync(path.join(root,'layout-schema.js'),'utf8'),env);
    assert.equal(env.VisualizerLayoutSettings.normalize({layout:'square'}).squareSpectrumLayout,'symmetric');
    for(const squareSpectrumLayout of ['symmetric','topBassMirror','foldedDiagonal'])assert.equal(env.VisualizerLayoutSettings.normalize({squareSpectrumLayout}).squareSpectrumLayout,squareSpectrumLayout);
    assert.throws(()=>env.VisualizerLayoutSettings.normalize({squareSpectrumLayout:'unknown'}),/選項無效/);
});
test('Square corner and neighbour clearances remain valid at schema size/width/gap extremes', () => {
    const app=environment(),samples=Array(128).fill(.1);
    for(const squareSpectrumLayout of ['symmetric','topBassMirror','foldedDiagonal'])for(const squareSize of [8,32,256,1080])for(const barCount of [4,8,12,64,128])for(const barWidth of [1,8,80])for(const gap of [0,4,80]) {
        const {bars,perSide:n}=app.geometry.build(samples,{...app.defaults,layout:'square',squareSpectrumLayout,squareSize,barCount,barWidth,gap});
        for(let side=0;side<4;side++)for(let i=0;i<n;i++) {
            const b=bars[side*n+i], along=b.nx?b.y:b.x;
            assert.ok(b.width>0&&Math.abs(along)+b.width/2<squareSize/2);
            if(i>0) {const prev=bars[side*n+i-1];assert.ok(along-(prev.nx?prev.y:prev.x)>=b.width-1e-8);}
        }
    }
});
