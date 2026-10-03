async function runBackgroundTests(app, we, check) {
    const runtime = app.VisualizerRuntime, doc = app.document, image = doc.querySelector('#bgimg');
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const canvas = doc.createElement('canvas'); canvas.width = 640; canvas.height = 320;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#345678'; ctx.fillRect(0, 0, 640, 320);
    const make = async (type, extension) => new app.File([await new Promise(resolve => canvas.toBlob(resolve, type))], 'background.' + extension, {type});
    const decoded = new Map(), revoked = [], decode = app.Image.prototype.decode, revoke = app.URL.revokeObjectURL.bind(app.URL);
    app.Image.prototype.decode = function () { decoded.set(this.src, (decoded.get(this.src) || 0) + 1); return decode.call(this); };
    app.URL.revokeObjectURL = url => { revoked.push(url); revoke(url); };
    try {
        app.WaveCanvasShell.showView('EDITOR'); app.VisualizerPresets.reset();
        for (const [type, extension] of [['image/png','png'],['image/jpeg','jpg'],['image/webp','webp']]) {
            await app.VisualizerFiles.select('backgroundimage', [await make(type, extension)]);
            const url = runtime.getSettings().backgroundimage.value;
            check(image.style.backgroundImage.includes(url) && !image.hidden && runtime.getSettings().backgroundsource.value === 2, 'Background ' + extension + ' loads one centered cover image');
            await wait(80); check(decoded.get(url) === 1, 'Background ' + extension + ' decodes once during animation');
        }
        const original = runtime.getSettings().backgroundimage.value;
        check(await app.VisualizerFiles.select('backgroundimage', []) === false && runtime.getSettings().backgroundimage.value === original, 'Cancel retains background');
        let rejected = false;
        try { await app.VisualizerFiles.select('backgroundimage', [new app.File(['bad'], 'bad.png')]); } catch { rejected = true; }
        check(rejected && runtime.getSettings().backgroundimage.value === original, 'Bad background is rejected without replacing the working image');
        const png = await make('image/png','png');
        const pending = app.VisualizerFiles.select('backgroundimage',[png]); const latest = app.VisualizerFiles.select('backgroundimage',[png]);
        check(!(await pending) && await latest, 'Rapid background replacements keep the last selection');
        check(revoked.includes(original) && new Set(revoked).size === revoked.length, 'Replaced and failed image URLs are revoked once');
        runtime.updateStandalone({background:{mode:'infinity',offsetX:0,offsetY:0,driftAmount:18,driftSpeed:1}});
        const start = image.style.transform; await wait(180);
        check(image.style.transform !== start && image.style.transform.includes('translate3d') && !image.style.transform.includes('rotate'), 'Infinity animates translation without rotation');
        check(!doc.querySelector('[data-background-property=driftAmount]').hidden && doc.querySelector('[data-background-property=bassAttack]').hidden, 'Infinity shows only drift controls');
        runtime.updateStandalone({background:{mode:'bassPulse',offsetX:400,offsetY:-200,bassAttack:20,bassRelease:100}});
        check(new app.DOMMatrix(image.style.transform).m41 === 0 && new app.DOMMatrix(image.style.transform).m42 === 0, 'Bass is fixed at center even with stored drift offsets');
        check(doc.querySelector('[data-background-property=driftAmount]').hidden && !doc.querySelector('[data-background-property=bassAttack]').hidden && doc.querySelector('[data-background-property=offsetX]').hidden, 'Bass shows only pulse controls and hides positional offsets');
        const audio = doc.querySelector('#local-audio');
        // Synthetic processed input, not a second analyser or any change to the accepted mapping.
        const bytes = new ArrayBuffer(44 + 16000), view = new DataView(bytes);
        const text = (i,s) => [...s].forEach((c,n) => view.setUint8(i+n,c.charCodeAt(0)));
        text(0,'RIFF');view.setUint32(4,16036,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,16000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,16000,true);
        const transfer = new app.DataTransfer(); transfer.items.add(new app.File([bytes],'background-silence.wav',{type:'audio/wav'}));
        const input = doc.querySelector('#audio-file'); input.files = transfer.files; input.dispatchEvent(new app.Event('change'));
        for (let i=0;i<100 && audio.readyState<2;i++) await wait(20);
        await audio.play();
        const timer = setInterval(() => { app.audioSample.fill(0); app.audioSample[1]=.7; }, 5);
        await wait(120); clearInterval(timer);
        const peak = Number(image.style.transform.match(/scale\(([^)]+)\)/)[1]); audio.pause(); await wait(500);
        const released = Number(image.style.transform.match(/scale\(([^)]+)\)/)[1]);
        check(peak > 1.085 && peak <= 1.08 * 1.035 && released < peak, 'Bass attacks subtly and releases smoothly on pause');
        const preset = app.VisualizerPresets.create('New Background');
        app.VisualizerPresets.reset(); app.VisualizerPresets.import(JSON.stringify(preset));
        check(runtime.getStandalone().background.mode === 'bassPulse' && doc.querySelector('#background-mode').value === 'bassPulse', 'New modes and appearance roundtrip through preset and UI');
        const old = {format:'audio-visualizer-preset',version:1,properties:{backgroundsource:3,customrandomdirectory:'old',slideshowInterval:2,imageoptions:3},standalone:{background:{mode:'slideshow',opacity:.5}}};
        const migrated = app.VisualizerPresets.import(JSON.stringify(old));
        check(runtime.getSettings().backgroundsource.value === 2 && runtime.getStandalone().background.mode === 'infinity' && migrated.warnings.length >= 4, 'Old slideshow preset safely migrates and ignores removed settings');
        check(!doc.querySelector('#bgimg1,#bgimg2,#setting-customrandomdirectory,#setting-slideshowInterval,#setting-imageoptions') && ![...doc.querySelector('#setting-backgroundsource').options].some(option=>option.value==='3'), 'No slideshow layers, settings or source option remain');
        await app.VisualizerFiles.select('backgroundimage',[png]);
        runtime.updateStandalone({background:{opacity:.4,blur:12,backingColor:'#123456'}});
        check(image.style.opacity === '0.4' && image.style.filter === 'blur(12px)' && doc.querySelector('#stage').style.backgroundColor === 'rgb(18, 52, 86)', 'Blur opacity and backing color remain independent');
        runtime.updateStandalone({background:{enabled:false}}); check(image.hidden, 'Disable hides image without discarding source');
        runtime.updateStandalone({background:{enabled:true}}); check(!image.hidden, 'Enable restores the same cached image');
        app.WaveCanvasShell.showView('HOME'); const frozen = image.style.transform; await wait(100);
        check(image.style.transform === frozen && image.style.willChange === '', 'Home stops the background animation');
        app.WaveCanvasShell.showView('EDITOR'); await wait(100); check(image.style.transform !== frozen, 'Editor resumes drift smoothly');
        app.VisualizerPresets.reset();
    } finally { app.Image.prototype.decode = decode; app.URL.revokeObjectURL = revoke; }
}
