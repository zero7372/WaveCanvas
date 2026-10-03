async function runPerformanceTests(app, we, check) {
    const doc=app.document,audio=doc.querySelector('#local-audio'),panel=doc.querySelector('#future-timing'),viewport=doc.querySelector('#timing-scroll'),timing=app.VisualizerTimingEditor;
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    check(!app.WaveCanvasPerf && !doc.querySelector('#performance-overlay'),'Normal Standalone has no profiler hooks or overlay');
    check(!we.WaveCanvasPerf && !we.document.querySelector('#performance-overlay'),'WE mode has no profiler hooks or overlay by default');
    selectFile(app,wavFile('perf-regression.wav',60,.2,6));await loadedAudio(audio);
    const start=performance.now();while(!timing.getState().waveformReady){if(performance.now()-start>5000)throw Error('Waveform timeout');await wait(30);}
    app.VisualizerLyrics.load('[00:00]Primary\n[00:00]次要\n[00:02]Next\n[00:04]Final','perf.lrc');panel.open=true;await wait(100);
    const client=Object.getOwnPropertyDescriptor(app.Element.prototype,'clientWidth');let reads=0;
    Object.defineProperty(viewport,'clientWidth',{configurable:true,get(){reads++;return client.get.call(this);}});
    for(let i=0;i<100;i++)app.dispatchEvent(new app.Event('wavecanvas-view-change'));
    check(reads===0,'Resize burst defers layout reads until the next animation frame');
    await wait(80);delete viewport.clientWidth;
    check(reads===1,'One frame coalesces 100 resize requests into one timeline layout');
    const scroll=Object.getOwnPropertyDescriptor(app.Element.prototype,'scrollLeft');let scrollReads=0;
    Object.defineProperty(viewport,'scrollLeft',{configurable:true,get(){scrollReads++;return scroll.get.call(this);},set(value){scroll.set.call(this,value);}});
    const waveformCanvas=doc.querySelector('#timing-waveform');let backingResets=0;
    for(const key of ['width','height']) {
        const field=Object.getOwnPropertyDescriptor(app.HTMLCanvasElement.prototype,key);
        Object.defineProperty(waveformCanvas,key,{configurable:true,get(){return field.get.call(this);},set(value){backingResets++;field.set.call(this,value);}});
    }
    timing.zoom(80);const immediateReads=scrollReads;delete viewport.scrollLeft;delete waveformCanvas.width;delete waveformCanvas.height;
    check(immediateReads===2,'Zoom reads scrollLeft once for anchoring and once for the final waveform redraw');
    check(backingResets===0,'Fractional DPR redraw reuses the existing waveform backing store');
    const nodes=[...doc.querySelectorAll('.timing-block')],canvas=doc.querySelector('#timing-waveform'),levels=timing.getState().waveformLevels;
    let added=0;const observer=new app.MutationObserver(records=>{for(const record of records)added+=record.addedNodes.length+record.removedNodes.length;});
    observer.observe(doc.querySelector('#timing-primary'),{childList:true,subtree:true});
    doc.querySelector('#timing-follow').checked=false;await audio.play();await wait(500);
    const paused=new Promise(resolve=>audio.addEventListener('pause',resolve,{once:true}));audio.pause();await paused;observer.disconnect();
    check(added===0 && nodes.every((node,index)=>doc.querySelectorAll('.timing-block')[index]===node),'Playback does not rebuild timing lyric DOM');
    check(timing.getState().waveformLevels===levels && doc.querySelector('#timing-waveform')===canvas,'Zoom / playback retains cached waveform levels and canvas');
    const head=doc.querySelector('#timing-playhead').style.left;await wait(100);
    check(doc.querySelector('#timing-playhead').style.left===head,'Paused timeline does not move playhead');
    panel.open=false;await wait(60);panel.open=true;await wait(60);
    check(timing.getState().waveformLevels===levels,'Timing open / close preserves existing waveform cache');
    app.VisualizerLyrics.load('[00:00]Start\n[00:01]Next','cleanup.lrc');audio.currentTime=.1;await audio.play();await wait(60);
    app.dispatchEvent(new app.PageTransitionEvent('pagehide',{persisted:false}));await wait(80);
    check(doc.querySelector('#lyrics-stack').getAnimations({subtree:true}).every(animation=>animation.playState!=='running'),'Non-persisted pagehide cancels lyric animations');
    check(audio.paused,'Non-persisted pagehide pauses local audio');
}
