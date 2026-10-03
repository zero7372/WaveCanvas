async function runShellTests(app, check) {
    const doc = app.document, shell = app.WaveCanvasShell, runtime = app.VisualizerRuntime;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    check(shell.getView() === 'EDITOR' && doc.title === 'WaveCanvas', 'WaveCanvas Editor and brand title');
    check(doc.querySelectorAll('#settings-tabs [role=tab]').length === 5 && doc.querySelectorAll('[data-media]').length === 4, 'Five Inspector tabs and four Media items');
    check(doc.querySelector('#recent-projects') === null && doc.querySelector('.recent-projects').textContent.includes('沒有近期專案'), 'Home has truthful empty Recent Projects');
    for (const id of ['visualizer','lyrics','song','background','audio']) {
        doc.querySelector('#tab-' + id).click();
        check(doc.querySelector('#tab-' + id).getAttribute('aria-selected') === 'true' && !doc.querySelector('#inspector-' + id).hidden, 'Inspector tab: ' + id);
    }
    check(doc.querySelector('#cover-controls #setting-logoimage') && doc.querySelector('#primary-controls #lyrics-file') && doc.querySelector('#secondary-controls #lyrics-secondary-file'), 'Existing media inputs moved out of Inspector');
    check(doc.querySelector('#inspector-song [data-text-property=title]') && doc.querySelector('#inspector-lyrics [data-lyrics-property=fontFamily]'), 'Collapsible sections preserve existing setting controls');
    runtime.updateStandalone({text:{title:'Retained session'},visualizer:{layout:'square',rotation:23}});
    const before = JSON.stringify(runtime.getStandalone()), resource = doc.querySelector('#local-audio').getAttribute('src');
    doc.querySelector('#home-button').click();
    check(shell.getView() === 'HOME' && doc.querySelector('#editor-view').hidden, 'Home hides Editor without destroying it');
    doc.querySelector('#new-project').click();
    check(JSON.stringify(runtime.getStandalone()) === before && doc.querySelector('#local-audio').getAttribute('src') === resource, 'Home -> resume retains state and audio resource');
    for (const target of ['media','settings']) {
        const toggle = doc.querySelector('#' + target + '-toggle'), panel = doc.querySelector('#' + target + '-panel');
        const initial = panel.hidden; toggle.click(); await wait(40); check(panel.hidden !== initial, target + ' panel collapse'); toggle.click();
    }
    const frame = document.querySelector('#standalone'), previousStyle = frame.getAttribute('style');
    for (const [width,height] of [[1920,1080],[1366,768],[480,640]]) {
        frame.style.width = width + 'px'; frame.style.height = height + 'px';
        for (const showPanels of [false,true]) {
            for (const kind of ['media','settings']) {
                if (doc.querySelector('#' + kind + '-panel').hidden === showPanels) doc.querySelector('#' + kind + '-toggle').click();
            }
            doc.querySelector('#future-timing').open = showPanels; await wait(100);
            const stage = doc.querySelector('#stage').getBoundingClientRect(), box = doc.querySelector('#preview-container').getBoundingClientRect();
            check(stage.width > 0 && Math.abs(stage.width/stage.height - 16/9)<0.001 && stage.left >= box.left-1 && stage.right<=box.right+1 && stage.top>=box.top-1 && stage.bottom<=box.bottom+1,
                'Shell ' + width + 'x' + height + ' panels ' + showPanels + ': contained 16:9');
            check(app.canvas.width===1920 && app.canvas.height===1080 && runtime.getStandalone().visualizer.rotation===23, 'Shell resize preserves canonical coordinates and geometry');
            check(doc.documentElement.scrollWidth<=width && doc.documentElement.scrollHeight<=height, 'Shell fits viewport without overflow');
        }
    }
    if (previousStyle === null) frame.removeAttribute('style'); else frame.setAttribute('style', previousStyle);
    doc.querySelector('#future-timing').open = false;
    doc.querySelector('#audio-clear').click();
    check(!doc.querySelector('#local-audio').getAttribute('src') && doc.querySelector('#audio-name').textContent==='尚未載入音訊' && doc.querySelector('#play-pause').disabled, 'Audio clear releases resource and resets Transport');
    selectFile(app, wavFile('shell-audio.wav',60,.4,8)); const audio=doc.querySelector('#local-audio'); await loadedAudio(audio);
    check(doc.querySelector('#audio-name').textContent==='shell-audio.wav' && doc.querySelector('#duration').textContent==='00:08', 'Audio filename and duration shown in Media/Transport');
    doc.querySelector('#play-pause').click(); await wait(250); check(!audio.paused && audio.currentTime>0, 'Custom Transport plays existing audio');
    doc.querySelector('#play-pause').click(); check(audio.paused, 'Custom Transport pauses existing audio');
    const seek=doc.querySelector('#transport-seek');seek.value=3;seek.dispatchEvent(new app.Event('input')); check(Math.abs(audio.currentTime-3)<.05,'Custom Transport seeks audio');
    const volume=doc.querySelector('#transport-volume');volume.value=.3;volume.dispatchEvent(new app.Event('input'));check(Math.abs(audio.volume-.3)<.001,'Custom Transport adjusts playback volume only');
    doc.querySelector('#rewind').click();check(audio.currentTime===0,'Rewind returns to start');
    const imageCanvas=document.createElement('canvas'); imageCanvas.width=160; imageCanvas.height=90;
    const imageBlob=await new Promise(resolve=>imageCanvas.toBlob(resolve,'image/png'));
    await app.VisualizerFiles.select('logoimage',[new app.File([imageBlob],'shell-cover.png',{type:'image/png'})]);
    check(doc.querySelector('#cover-name').textContent==='shell-cover.png' && doc.querySelector('#cover-meta').textContent==='160 × 90','Media displays cached Cover filename and dimensions');
    doc.querySelector('[data-media="cover"] footer .quiet-button').click();
    check(doc.querySelector('#cover-name').textContent==='尚未載入封面','Media Cover clear updates filename');
    for(const [id,name] of [['lyrics-file','primary.lrc'],['lyrics-secondary-file','secondary.lrc']]) {
        const transfer=new app.DataTransfer();transfer.items.add(new app.File(['[00:01]A lyric'],name,{type:'text/plain'}));
        const input=doc.querySelector('#'+id);input.files=transfer.files;input.dispatchEvent(new app.Event('change'));await wait(60);
    }
    check(doc.querySelector('#primary-name').textContent==='primary.lrc' && doc.querySelector('#secondary-name').textContent==='secondary.lrc','Media displays Primary and Secondary LRC filenames');
    doc.querySelector('#lyrics-secondary-clear').click();check(doc.querySelector('#secondary-name').textContent==='尚未載入次要歌詞','Media Secondary clear updates filename');
    doc.querySelector('#lyrics-clear').click();check(doc.querySelector('#primary-name').textContent==='尚未載入主要歌詞','Media Primary clear updates filename');
    runtime.updateStandalone({text:{title:'Song Title'}}); shell.selectTab('visualizer');
}
