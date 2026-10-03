async function runSongInfoTests(app, we, check) {
    const runtime = app.VisualizerRuntime, doc = app.document;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const edit = (key, value) => {
        const input = doc.querySelector('#text-' + key);
        if (input.type === 'checkbox') input.checked = value; else input.value = value;
        input.dispatchEvent(new app.Event(input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input'));
    };
    const layer = doc.querySelector('#song-info-layer'), group = doc.querySelector('#song-info-content');
    const title = doc.querySelector('#song-info-title'), artist = doc.querySelector('#song-info-artist');
    app.VisualizerPresets.reset();
    check(title.textContent === 'Song Title' && artist.textContent === 'Artist' && !layer.hidden, 'Song Info default group renders Title + Artist');
    check(we.document.querySelector('#song-info-layer').hidden && !we.document.querySelector('[data-group="Song Info"]'), 'WE hides Standalone Song Info');
    check(!doc.querySelector('[data-group="Clock / Text"]') && typeof app.clock === 'undefined', 'Clock function and controls removed');
    check(!doc.querySelector('#bgvid') && !doc.querySelector('link[href*="font/"]') && !doc.querySelector('#setting-backgroundsource option[value="4"]'), 'Removed assets have no live DOM dependencies or built-in video option');
    const info = doc.querySelector('[data-group="Song Info"]'); info.open = true;
    edit('title', '測試曲名 <b>literal</b>'); edit('artist', '測試作者');
    check(title.textContent === '測試曲名 <b>literal</b>' && !title.querySelector('b') && artist.textContent === '測試作者', 'Title/Artist inputs update group safely using textContent');
    edit('title', ''); check(title.hidden && !artist.hidden && !layer.hidden, 'Empty title hides only Title');
    edit('artist', ''); check(layer.hidden, 'Both empty strings hide Song Info group');
    edit('title', 'Song Title'); check(!layer.hidden && artist.hidden, 'Primary-only text restores group');
    edit('artist', 'Artist');
    for (const alignment of ['left', 'center', 'right']) {
        edit('alignment', alignment);
        check(app.getComputedStyle(group).textAlign === alignment, 'Song Info alignment: ' + alignment);
    }
    edit('positionX', 25); edit('positionY', 40); edit('scale', 1.5); edit('lineGap', 22);
    check(group.style.left === '480px' && group.style.top === '432px' && group.style.gap === '22px' && group.style.transform.includes('scale(1.5)'), 'Song Info position/scale/gap use canonical Stage coordinates');
    edit('fontFamily', 'Georgia');
    check(doc.querySelectorAll('#text-fontFamily option').length === 11 && app.getComputedStyle(group).fontFamily.includes('Georgia'), 'System font dropdown and live family preview');
    check(doc.querySelector('#text-fontFamily option[value="Georgia"]').style.fontFamily.includes('Georgia'), 'Native option has font preview style');
    edit('color', '#ffffff'); edit('borderEnabled', true); edit('borderColor', '#336699'); edit('borderWidth', 2); edit('borderBlur', 12);
    check(app.getComputedStyle(group).color === 'rgb(255, 255, 255)' && app.getComputedStyle(title).webkitTextStrokeWidth === '2px' && app.getComputedStyle(title).textShadow !== 'none', 'White text, outline width and soft glow render');
    edit('borderBlur', 0); check(app.getComputedStyle(title).textShadow === 'none', 'Zero blur produces hard outline');
    edit('borderWidth', 0); check(app.getComputedStyle(title).webkitTextStrokeWidth === '0px' && app.getComputedStyle(title).textShadow === 'none', 'Zero border width disables both stroke and glow');
    edit('borderWidth', 2); edit('borderEnabled', false);
    check(app.getComputedStyle(title).webkitTextStrokeWidth === '0px' && doc.querySelector('[data-text-property=borderWidth]').hidden, 'Border off clears effect and hides dependent controls');
    edit('scale', 1); edit('bassReaction', true); edit('bassStrength', 160);
    const audio = doc.querySelector('#local-audio');
    selectFile(app, wavFile('song-info-bass.wav', 60, 0.5));
    await loadedAudio(audio); await audio.play(); await wait(350);
    check(Number(group.style.transform.match(/scale\(([^)]+)\)/)[1]) > 1, 'Song Info bass reaction uses existing processed audioSample');
    edit('bassStrength', 0); check(group.style.transform.includes('scale(1)'), 'Zero bass strength keeps base scale');
    edit('bassReaction', false); check(group.style.transform.includes('scale(1)'), 'Bass off keeps base scale');
    audio.pause();
    check(runtime.getSettings().bassshaketext.value === false && runtime.getSettings().txtbassmultiplier.value === 0, 'Bass compatibility keys share Song Info state');
    const preset = app.VisualizerPresets.create('Song Info');
    app.VisualizerPresets.reset(); app.VisualizerPresets.import(JSON.stringify(preset));
    check(runtime.getStandalone().text.fontFamily === 'Georgia' && doc.querySelector('#text-lineGap').value === '22' && artist.textContent === 'Artist', 'Song Info preset roundtrip synchronizes UI and DOM');
    app.VisualizerPresets.import(JSON.stringify({format:'audio-visualizer-preset',version:1,properties:{showclock:true,clockfont:'invalid',showtext:true,textfont:99,backgroundsource:4}}));
    check(runtime.getStandalone().text.title === 'Song Title' && runtime.getSettings().backgroundsource.value === 1, 'Old Clock/Text/video preset safely defaults');
    app.VisualizerPresets.reset();
    check(doc.querySelector('#text-color').value === '#ffffff' && doc.querySelector('#text-title').value === 'Song Title', 'Reset Song Info defaults synchronizes controls');
    check(Array.from(doc.querySelectorAll('#settings-panel input:disabled, #settings-panel select:disabled')).length === 0, 'Settings have no disabled dead controls');
    info.open = false;
}
