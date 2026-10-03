async function electronRendererSmoke() {
    const checks = [], check = (ok, label) => checks.push({ pass: Boolean(ok), label });
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const until = async predicate => { const deadline = performance.now() + 8000; while (!predicate()) { if (performance.now() > deadline) throw Error('Timed out waiting for media'); await wait(40); } };
    const doc = document, runtime = window.VisualizerRuntime, audio = doc.querySelector('#local-audio');
    const errors = []; window.addEventListener('error', event => errors.push(event.message)); window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
    const owned = new Set(), revoked = new Set(), nativeCreate = URL.createObjectURL, nativeRevoke = URL.revokeObjectURL;
    URL.createObjectURL = function (...args) { const url = nativeCreate.apply(this, args); owned.add(url); return url; };
    URL.revokeObjectURL = function (url) { revoked.add(url); return nativeRevoke.call(this, url); };
    try {
        check(location.protocol === 'file:', 'Direct local file loading without server');
        check(typeof require === 'undefined' && typeof process === 'undefined' && typeof window.electron === 'undefined', 'Renderer has no Node / native execution bridge');
        check(window.WaveCanvasShell.getView() === 'HOME', 'Home visible');
        const images = [...doc.querySelectorAll('#home-view img')]; await Promise.all(images.map(image => image.decode()));
        check(images.length >= 3 && images.every(image => image.naturalWidth > 0), 'All template / Recent thumbnails decode locally');
        check(getComputedStyle(doc.querySelector('#workspace')).display === 'flex', 'Local stylesheets apply');
        for (const layout of ['circle', 'square', 'linear']) {
            doc.querySelector('[data-template="' + layout + '"]').click();
            check(runtime.getStandalone().visualizer.layout === layout && window.WaveCanvasShell.getView() === 'EDITOR', layout + ' template opens Editor');
            doc.querySelector('#home-button').click();
        }
        doc.querySelector('[data-template="circle"]').click();
        async function select(selector, file) { const transfer = new DataTransfer(); transfer.items.add(file); const input = doc.querySelector(selector); input.files = transfer.files; input.dispatchEvent(new Event('change')); await wait(80); }
        const rate = 8000, count = rate * 30, bytes = new ArrayBuffer(44 + count * 2), view = new DataView(bytes);
        const text = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
        text(0,'RIFF');view.setUint32(4,36+count*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,count*2,true);
        for (let index=0;index<count;index++) view.setInt16(44+index*2,32767*(.25*Math.sin(2*Math.PI*60*index/rate)+.12*Math.sin(2*Math.PI*1000*index/rate)),true);
        const wav = new File([bytes], 'desktop-smoke.wav', {type:'audio/wav'});
        await select('#audio-file',wav); await until(()=>audio.readyState>=2);
        check(Math.abs(audio.duration-30)<.01, 'HTML File input imports local WAV');
        await audio.play(); await wait(500);
        check(!audio.paused && audio.currentTime>0, 'Web Audio playback starts');
        check(window.audioSample.some(value=>value>.001) && window.sum>0, 'Existing analyser / FFT / bass reaction produces signal');
        for (const layout of ['circle','square','linear']) {
            runtime.updateStandalone({visualizer:{layout}});await wait(120);
            check(runtime.getStandalone().visualizer.layout===layout && window.audioSample.some(value=>value>.001),layout+' renders with live audio signal');
        }
        audio.pause(); check(audio.paused,'Pause'); audio.currentTime=3.25; await until(()=>!audio.seeking);
        check(Math.abs(audio.currentTime-3.25)<.01,'Seek preserves decimal time');
        const canvas=doc.createElement('canvas');canvas.width=400;canvas.height=250;const context=canvas.getContext('2d');context.fillStyle='#32618f';context.fillRect(0,0,400,250);
        const cover = new File([await new Promise(resolve=>canvas.toBlob(resolve))], 'desktop-cover.png', {type:'image/png'});
        await select('#setting-logoimage',cover); await until(()=>window.VisualizerFiles.getName('logoimage')===cover.name); const firstCover=runtime.getSettings().logoimage.value;
        check(firstCover.startsWith('blob:') && window.VisualizerFiles.getName('logoimage')==='desktop-cover.png','Cover import uses existing image cache');
        await select('#setting-logoimage',cover); check(revoked.has(firstCover),'Replacing Cover revokes previous URL');
        const srt='1\n00:00:01,000 --> 00:00:02,000\n<i>Open the gate</i>\n\n2\n00:00:05,000 --> 00:00:06,000\n...\n\n3\n00:00:10,000 --> 00:00:12,000\nThe night remembers';
        await select('#lyrics-file',new File([srt],'primary.srt',{type:'application/x-subrip'}));
        await select('#lyrics-secondary-file',new File(['[00:01.000]敞開大門\n[00:10.000]夜晚記得'],'secondary.lrc',{type:'text/plain'}));
        check(window.VisualizerLyrics.getEvent(0).secondary==='敞開大門' && window.VisualizerLyrics.getState().sourceFormat==='srt','Primary SRT + Secondary LRC bilingual import');
        audio.currentTime=1.5;window.VisualizerLyrics.update('seek'); await wait(80);
        check(doc.querySelector('#lyrics-stack').textContent.includes('Open the gate'),'Existing Lyrics renderer shows SRT text');
        audio.currentTime=5.5;window.VisualizerLyrics.update('seek');check(Boolean(window.VisualizerLyrics.getState().interlude),'Primary ... interlude');
        await select('#lyrics-file',new File(['[00:01.000]主要中文\n[00:05.000]...\n[00:10.000]下一句'],'primary.lrc',{type:'text/plain'}));
        await select('#lyrics-secondary-file',new File([srt],'secondary.srt',{type:'application/x-subrip'}));
        check(window.VisualizerLyrics.getEvent(0).secondary==='Open the gate','Primary LRC + Secondary SRT import');
        const editor=window.VisualizerTimingEditor; doc.querySelector('#future-timing').open=true;
        await until(()=>editor.getState().waveformReady);
        check(editor.getState().waveformReady,'Waveform decodes and caches local audio');
        const event=window.VisualizerLyrics.getDocument('primary').events[0];editor.select('primary',event.id);editor.adjust(10);
        check(window.VisualizerLyrics.getDocument('primary').events[0].timeMs===1010,'Fine adjust');editor.undo();editor.redo();
        check(window.VisualizerLyrics.getDocument('primary').events[0].timeMs===1010,'Undo / Redo');
        doc.querySelector('#timing-time').value='00:02.250';doc.querySelector('#timing-time').dispatchEvent(new Event('change'));
        check(window.VisualizerLyrics.getDocument('primary').events.find(item=>item.id===event.id).timeMs===2250,'Manual timestamp edit');
        const block=doc.querySelector('#timing-primary [data-id="'+event.id+'"]'),box=block.getBoundingClientRect();
        block.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:42,button:0,clientX:box.left+8,clientY:box.top+8}));
        doc.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:42,clientX:box.left+30,clientY:box.top+8}));doc.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:42,clientX:box.left+30,clientY:box.top+8}));
        check(window.VisualizerLyrics.getDocument('primary').events.find(item=>item.id===event.id).timeMs!==2250,'Drag retime uses existing handler');editor.undo();
        editor.zoom(1.2);editor.fitSong();check(editor.getState().scale>0,'Timing zoom / fit');
        const preset=window.VisualizerPresets.create('桌面測試');runtime.updateStandalone({inputGain:1.25});
        await select('#import-preset',new File([JSON.stringify(preset)],'desktop.json',{type:'application/json'}));
        check(runtime.getStandalone().inputGain===preset.standalone.inputGain,'Preset file import');
        doc.querySelector('#preset-name').value='桌面測試';doc.querySelector('#export-preset').click();editor.exportLRC('primary');
        check(doc.querySelector('#preset-download').href.startsWith('blob:') && doc.querySelector('#timing-download-primary').download.endsWith('.lrc'),'Preset / Unicode LRC request native Chromium downloads');
        await wait(500); // Let downloads consume their Blob before media replacement revokes timing URLs.
        window.VisualizerPresets.reset();check(runtime.getStandalone().inputGain===runtime.getStandaloneDefaults().inputGain,'Factory defaults / Reset');
        const originalAudio=audio.src;await select('#audio-file',wav);await until(()=>audio.readyState>=2);check(revoked.has(originalAudio),'Replacing Audio revokes previous URL');
        const finalAudio=audio.src;window.VisualizerLocalAudio.clear();window.VisualizerFiles.clear('logoimage');
        check(revoked.has(finalAudio),'Clearing Audio revokes URL');
        check(!runtime.getSettings().logoimage.value.startsWith('blob:'),'Clearing Cover removes image source');
        check([...owned].filter(url=>!revoked.has(url)).length<=3,'Owned URLs remain bounded after media replacement/clear');
        check(errors.length===0,'No Renderer errors: '+JSON.stringify(errors));
        return {checks,errors,activeURLs:[...owned].filter(url=>!revoked.has(url)).length};
    } finally { URL.createObjectURL=nativeCreate;URL.revokeObjectURL=nativeRevoke; }
}
