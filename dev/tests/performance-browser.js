(function () {
    'use strict';
    const frame = document.querySelector('#app'), output = document.querySelector('#results'), status = document.querySelector('#status');
    if (new URLSearchParams(location.search).get('detail') === '1') frame.src='../../app/index.html?profile=1&profileDetail=1';
    if (new URLSearchParams(location.search).get('baseline') === '1') frame.src='fixtures/baselines/index-before.html?profile=1';
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    let app, doc, audio, perf, runtime, wav, cover, background, busy = false;
    const errors = [], report = { kind: 'Synthetic / controlled browser benchmark', scenarios: [], checks: [] };
    const check = (ok, message) => { report.checks.push({ pass: !!ok, message }); show(); };
    function show() { output.textContent = JSON.stringify(report, null, 2); }
    async function ready(predicate, ms = 10000) { const start = performance.now(); while (!predicate()) { if (performance.now() - start > ms) throw Error('Timeout waiting for fixture'); await wait(40); } }
    function waveFile() {
        const rate = 8000, samples = rate * 90, bytes = new ArrayBuffer(44 + samples * 2), view = new DataView(bytes);
        const text = (offset, string) => [...string].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
        text(0,'RIFF'); view.setUint32(4,36+samples*2,true); text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples*2,true);
        for (let i=0;i<samples;i++) view.setInt16(44+i*2,Math.round(32767*(.22*Math.sin(2*Math.PI*60*i/rate)+.12*Math.sin(2*Math.PI*1000*i/rate))),true);
        return new app.File([bytes],'performance-90s.wav',{type:'audio/wav'});
    }
    async function image(size,name) {
        const canvas=doc.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');
        const gradient=ctx.createLinearGradient(0,0,size,size);gradient.addColorStop(0,'#184467');gradient.addColorStop(1,'#873768');ctx.fillStyle=gradient;ctx.fillRect(0,0,size,size);
        return new app.File([await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))],name,{type:'image/png'});
    }
    async function loadAudio() {
        const transfer=new app.DataTransfer();transfer.items.add(wav);const input=doc.querySelector('#audio-file');input.files=transfer.files;input.dispatchEvent(new app.Event('change'));
        await ready(()=>audio.readyState>=2 && Number.isFinite(audio.duration));
    }
    function loadLyrics() {
        const lines=Array.from({length:45},(_,i)=>'[00:'+String(i*2).padStart(2,'0')+'.000]');
        // Actual valid minutes/seconds for the whole 90-second fixture.
        const stamp=i=>'['+String(Math.floor(i*2/60)).padStart(2,'0')+':'+String(i*2%60).padStart(2,'0')+'.000]';
        app.VisualizerLyrics.load(lines.map((_,i)=>stamp(i)+'Open the gate '+i).join('\n'),'primary.lrc');
        app.VisualizerLyrics.loadSecondary(lines.map((_,i)=>stamp(i)+'敞開大門 '+i).join('\n'),'secondary.lrc');
    }
    async function setup(full = false) {
        audio.pause(); app.VisualizerPresets.reset(); app.WaveCanvasShell.showView('EDITOR');
        doc.querySelector('#future-timing').open=false;
        if (!audio.getAttribute('src')) await loadAudio();
        await app.VisualizerFiles.select('logoimage',[cover]);
        runtime.updateStandalone({lyrics:{enabled:full},text:{enabled:full,bassReaction:full,borderBlur:full?10:0}});
        if (full) {
            loadLyrics(); await app.VisualizerFiles.select('backgroundimage',[background]);
            runtime.updateProperties({backgroundsource:{value:2},particlestyle:{value:1},particlenum:{value:3}});
            runtime.updateStandalone({background:{blur:16}});
        }
        audio.currentTime=0;await wait(100);
    }
    frame.addEventListener('load',async()=>{
        app=frame.contentWindow;doc=app.document;audio=doc.querySelector('#local-audio');perf=app.WaveCanvasPerf;runtime=app.VisualizerRuntime;
        app.addEventListener('error',event=>errors.push(event.message));app.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
        wav=waveFile();cover=await image(512,'cover.png');background=await image(4096,'background-4096.png');
        app.WaveCanvasShell.showView('EDITOR');status.textContent='Ready';
        for (const control of document.querySelectorAll('button')) control.disabled = false;
    });
    async function action(button,fn) {
        if (!perf || !cover || !background || busy) return; busy = true;
        for (const control of document.querySelectorAll('button')) control.disabled = true;
        try { await fn(); } catch(error) { check(false,error.stack); }
        finally { busy = false; for (const control of document.querySelectorAll('button')) control.disabled = false; audio.pause();status.textContent='Done';show(); }
    }
    document.querySelector('#run').addEventListener('click',event=>action(event.target,async()=>{
        report.scenarios=[];report.environment={userAgent:app.navigator.userAgent,dpr:app.devicePixelRatio,fixtureViewport:[app.innerWidth,app.innerHeight],canvas:[app.canvas.width,app.canvas.height],gpu:'UNKNOWN'};
        for(const scenario of ['A Idle','B Basic','C Lyrics','D Full','E Full + Timing']) {
            status.textContent=scenario;await setup(scenario.startsWith('D')||scenario.startsWith('E'));
            if(scenario.startsWith('C')) {loadLyrics();runtime.updateStandalone({lyrics:{enabled:true}});}
            if(scenario.startsWith('A')) {app.VisualizerLocalAudio.clear();app.VisualizerFiles.clear('logoimage');}
            if(scenario.startsWith('E')) {doc.querySelector('#future-timing').open=true;await ready(()=>app.VisualizerTimingEditor.getState().waveformReady);app.VisualizerTimingEditor.zoom(120);}
            if(!scenario.startsWith('A')) await audio.play();
            await wait(1000);perf.reset();await wait(Math.max(3,Math.min(120,Number(document.querySelector('#seconds').value)||8))*1000);
            report.scenarios.push({scenario,...perf.snapshot()});show();audio.pause();
        }
        check(errors.length===0,'No page errors during scenarios: '+errors.join(';'));
    }));
    document.querySelector('#background').addEventListener('click',event=>action(event.target,async()=>{
        report.backgroundModes=[];
        for (const mode of ['infinity','bassPulse']) {
            await setup(true);runtime.updateStandalone({background:{mode}});await audio.play();
            status.textContent='Background '+mode;await wait(1000);perf.reset();await wait(8000);
            report.backgroundModes.push({mode,...perf.snapshot()});show();audio.pause();
        }
        check(errors.length===0,'Background modes have no page errors: '+errors.join(';'));
        if(doc.querySelector('#settings-panel').hidden)doc.querySelector('#settings-toggle').click();
        doc.querySelector('#tab-background').click();
        const group=doc.querySelector('[data-group="Background"]');if(group)group.open=true;
    }));
    document.querySelector('#micro').addEventListener('click',event=>action(event.target,async()=>{
        await setup(true);doc.querySelector('#future-timing').open=true;await ready(()=>app.VisualizerTimingEditor.getState().waveformReady);await wait(100);
        perf.reset();
        const viewport=doc.querySelector('#timing-scroll'),descriptor=Object.getOwnPropertyDescriptor(app.Element.prototype,'scrollLeft');let reads=0;
        Object.defineProperty(viewport,'scrollLeft',{configurable:true,get(){reads++;return descriptor.get.call(this);},set(value){descriptor.set.call(this,value);}});
        const waveformCanvas=doc.querySelector('#timing-waveform');let backingResets=0;
        for(const key of ['width','height']) {
            const field=Object.getOwnPropertyDescriptor(app.HTMLCanvasElement.prototype,key);
            Object.defineProperty(waveformCanvas,key,{configurable:true,get(){return field.get.call(this);},set(value){backingResets++;field.set.call(this,value);}});
        }
        // Repeated real zoom redraws: stresses layout-write -> scrollLeft reads.
        for(let i=0;i<200;i++) app.VisualizerTimingEditor.zoom(i%2?50:120);
        report.redraw={iterations:200,scrollLeftReads:reads,backingResets,...perf.snapshot()};delete viewport.scrollLeft;delete waveformCanvas.width;delete waveformCanvas.height;show();
        perf.reset();
        for(let i=0;i<100;i++)app.dispatchEvent(new app.Event('wavecanvas-view-change'));
        await wait(80);report.resizeBurst={events:100,...perf.snapshot()};show();
        report.waveformBuild=[];
        for(const minutes of [3,10,60]) {
            status.textContent='Synthetic 8 kHz PCM '+minutes+' min';
            const rate=8000,data=new Float32Array(minutes*60*rate);for(let i=0;i<data.length;i++)data[i]=Math.sin(i*.01)*.4;
            const start=performance.now(),cache=await app.VisualizerWaveform.build({length:data.length,numberOfChannels:1,sampleRate:rate,duration:minutes*60,getChannelData:()=>data});
            report.waveformBuild.push({minutes,sampleRate:rate,channels:1,elapsedMs:performance.now()-start,levels:cache.levels.length,peakBytes:cache.levels.reduce((sum,level)=>sum+level.min.byteLength+level.max.byteLength,0),pcmBytes:data.byteLength});show();
            check(app.VisualizerWaveform.level(cache,minutes*60/1920).stride>=128,minutes+' min reuses an existing density level');
        }
    }));
    document.querySelector('#cycles').addEventListener('click',event=>action(event.target,async()=>{
        await setup(true);doc.querySelector('#future-timing').open=true;await ready(()=>app.VisualizerTimingEditor.getState().waveformReady);
        loadLyrics();await audio.play();await wait(150);perf.reset();
        const node=doc.querySelector('.timing-block'),wave=doc.querySelector('#timing-waveform');await wait(600);
        const playing=perf.snapshot();
        check(doc.querySelector('.timing-block')===node && doc.querySelector('#timing-waveform')===wave,'Playback retains lyric blocks and waveform canvas');
        check(!playing.measures['timing.blocks'] && !playing.measures['waveform.build.elapsed'] && !playing.measures['VisualizerLRC.parse'],'Playback does not rebuild blocks / waveform / reparse LRC');
        check(!playing.measures['timing.draw'],'Playback without follow scroll does not redraw waveform');
        audio.pause();await wait(100);perf.reset();await wait(250);check(!perf.snapshot().pendingRAF['timing.frame'],'Paused timeline has no scheduled animation loop');
        const baselineNodes=doc.querySelectorAll('*').length,baselineHeap=perf.snapshot().heapBytes,baselineListeners=JSON.stringify(perf.listeners(audio));
        report.cycles=[];
        for(let i=0;i<30;i++) {
            await loadAudio();await app.VisualizerFiles.select('logoimage',[cover]);await app.VisualizerFiles.select('logoimage',[cover]);loadLyrics();loadLyrics();
            doc.querySelector('#future-timing').open=!!(i%2);app.WaveCanvasShell.selectTab(i%2?'visualizer':'lyrics');
            app.WaveCanvasShell.showView('HOME');app.WaveCanvasShell.showView('EDITOR');
            app.VisualizerPresets.import(JSON.stringify(app.VisualizerPresets.create('Cycle')));
            app.VisualizerLocalAudio.clear();app.VisualizerFiles.clear('logoimage');app.VisualizerFiles.clear('backgroundimage');app.VisualizerLyrics.clear();app.VisualizerLyrics.clearSecondary();
            await wait(60);
            if(i%5===4)report.cycles.push({cycle:i+1,urls:perf.snapshot().activeURLs,heapBytes:perf.snapshot().heapBytes,nodes:doc.querySelectorAll('*').length,pending:perf.snapshot().pendingRAF});
            status.textContent='Media cycle '+(i+1);show();
        }
        await wait(300);const last=perf.snapshot();report.memory={baselineHeap,finalHeap:last.heapBytes,baselineNodes,finalNodes:doc.querySelectorAll('*').length};
        check(last.activeURLs===0,'All media Object URLs revoked after replace / clear');
        check(last.audioGraphs===1,'Repeated files reuse the single live Web Audio graph');
        check(JSON.stringify(perf.listeners(audio))===baselineListeners,'Audio listener registrations stay stable across repeated media cycles');
        check(last.duplicateListenerAttempts===0,'No repeated identical event-listener registration attempts');
        check(Object.values(last.pendingRAF).every(count=>count<=1),'At most one pending RAF per render-loop label after repeated sessions');
        check(app.VisualizerTimingEditor.getState().waveformLevels===0,'Clear releases stale waveform peak cache');
        for(const dpr of [1,1.25,1.5,2]) {
            Object.defineProperty(app,'devicePixelRatio',{value:dpr,configurable:true});
            for(const [w,h] of [[1366,768],[480,640],[960,640]]) {
                frame.style.width=w+'px';frame.style.height=h+'px';app.dispatchEvent(new app.Event('resize'));await wait(80);
                const stage=doc.querySelector('#stage').getBoundingClientRect(),box=doc.querySelector('#preview-container').getBoundingClientRect();
                check(app.canvas.width===1920&&app.canvas.height===1080&&stage.width>0&&Math.abs(stage.width/stage.height-16/9)<.001&&stage.right<=box.right+1&&stage.bottom<=box.bottom+1,'Mock DPR '+dpr+' / '+w+'×'+h+' canonical 16:9 remains contained');
            }
        }
        delete app.devicePixelRatio;frame.style.width='960px';frame.style.height='640px';
        check(errors.length===0,'Lifecycle has no uncaught errors: '+errors.join(';'));
    }));
    document.querySelector('#geometry').addEventListener('click',event=>action(event.target,async()=>{
        await setup(true);await audio.play();report.geometry=[];
        for(const [layout,orientation] of [['circle','horizontal'],['square','horizontal'],['linear','horizontal'],['linear','vertical']]) {
            runtime.updateStandalone({visualizer:{layout,orientation,rotation:30,mirror:'dual'}});await wait(300);perf.reset();await wait(3000);
            report.geometry.push({layout,orientation,...perf.snapshot()});show();
        }
        audio.pause();runtime.updateStandalone({visualizer:{layout:'square'}});const config=runtime.getStandalone().visualizer;
        perf.reset();for(let i=0;i<5000;i++)app.VisualizerGeometry.build(app.audioSample,config,{center:4,bars:2});
        report.geometryBuild=perf.snapshot();show();
        check(report.geometry.every(value=>!value.measures['image.decode']&&!value.urlCreated),'All four layouts reuse cached images without decode / Object URL per frame');
    }));
    document.querySelector('#trace').addEventListener('click',event=>action(event.target,async()=>{
        await setup(true);doc.querySelector('#future-timing').open=true;await ready(()=>app.VisualizerTimingEditor.getState().waveformReady);app.VisualizerTimingEditor.zoom(120);await audio.play();
        perf.reset();report.soak=[];
        for(let i=0;i<12;i++) {
            status.textContent='Full + Timing soak '+((i+1)*10)+' / 120s';await wait(10000);
            if(audio.ended){audio.currentTime=0;await audio.play();}
            const state=perf.snapshot();report.soak.push({seconds:(i+1)*10,heapBytes:state.heapBytes,urls:state.activeURLs,nodes:doc.querySelectorAll('*').length,pending:state.pendingRAF,audioGraphs:state.audioGraphs,waveformLevels:app.VisualizerTimingEditor.getState().waveformLevels});show();
        }
        report.traceRun=perf.snapshot();show();
        check(report.soak.every(state=>state.audioGraphs===1&&state.urls===3),'120s soak keeps one audio graph and only three owned media URLs');
        check(report.soak.every(state=>Object.values(state.pending).every(count=>count<=1)),'120s soak does not accumulate duplicate RAF callbacks');
        check(new Set(report.soak.map(state=>state.nodes)).size===1,'120s soak does not accumulate DOM nodes');
    }));
}());
