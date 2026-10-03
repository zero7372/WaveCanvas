document.querySelector('#run').addEventListener('click', async function () {
    this.disabled=true;const frame=document.querySelector('#app'),output=document.querySelector('#results');let passes=0,failures=0;
    const check=(ok,label)=>{output.textContent+='\n'+(ok?'PASS ':'FAIL ')+label;ok?passes++:failures++;};
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    output.textContent='Running';
    try {
        await new Promise(resolve=>{frame.onload=resolve;frame.src='../../app/index.html?template-media-tests';});
        const app=frame.contentWindow,doc=app.document,r=app.VisualizerRuntime,shell=app.WaveCanvasShell;
        const errors=[];app.addEventListener('error',event=>errors.push(event.message));app.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
        let confirmations=0;app.confirm=()=>{confirmations++;return false;};
        check(shell.getView()==='HOME'&&!doc.querySelector('#template-gallery').hidden,'Home displays built-in selection immediately');
        const cards=[...doc.querySelectorAll('.template-card')],definitions=app.VisualizerTemplates.definitions;
        check(cards.length===3,'Three cards are generated from definitions');
        for(const [i,definition] of definitions.entries()) {
            const card=cards[i],image=card.querySelector('img');
            if(!image.complete)await new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});});
            check(image.complete&&image.naturalWidth>0&&image.src.endsWith(definition.thumbnail),definition.name+' thumbnail resolves');
            check(card.querySelector('h3').textContent===definition.name&&card.querySelector('.template-subtitle').textContent===definition.subtitle&&card.querySelector('.template-description').textContent===definition.description,definition.name+' exact supplied copy');
            check(card.querySelector('button').textContent==='使用此模板',definition.name+' launcher label');
        }
        check(definitions.every(item=>item.previewVideo===null)&&!doc.querySelector('#template-gallery video'),'Null previewVideo renders no video element');
        const buttonYs=cards.map(card=>card.querySelector('button').getBoundingClientRect().top);
        check(Math.max(...buttonYs)-Math.min(...buttonYs)<1,'Desktop card buttons align in one row');
        for(const width of [1280,980,720,420]){
            frame.style.width=width+'px';await wait(100);
            const home=doc.querySelector('#home-view'),rect=home.getBoundingClientRect();
            check(home.scrollWidth<=home.clientWidth+1&&doc.documentElement.scrollWidth<=width,'Home '+width+'px: no horizontal overflow');
            check(cards.every(card=>{const b=card.getBoundingClientRect();return b.width>0&&b.left>=rect.left&&b.right<=rect.right+1;}),'Home '+width+'px: all cards contained');
            check(cards.every(card=>{const b=card.querySelector('img').getBoundingClientRect();return Math.abs(b.width/b.height-16/9)<.01;}),'Home '+width+'px: consistent thumbnail ratio');
        }
        frame.style.width='1280px';await wait(60);
        for(const definition of definitions){
            shell.showView('HOME');r.updateStandalone({visualizer:{layout:definition.layout,rotation:45,coverX:81}});
            doc.querySelector('[data-template-id="'+definition.id+'"] button').click();await wait(60);
            check(shell.getView()==='EDITOR'&&!doc.querySelector('#editor-view').hidden,definition.name+' button enters Editor');
            check(same(r.getStandalone().visualizer,app.VisualizerFactoryDefaults.get(definition.layout).standalone.visualizer),definition.name+' button applies exact target factory geometry');
            check(!r.getSettings().logoimage.value&&!doc.querySelector('#local-audio').getAttribute('src'),definition.name+' works without importing media');
        }
        for(const [media,clearId] of [['cover',null],['primary','lyrics-clear'],['secondary','lyrics-secondary-clear']]){
            const footer=doc.querySelector('[data-media="'+media+'"] footer'),buttons=[...footer.children];
            check(buttons.length===2&&buttons[0].textContent==='選取／替換'&&buttons[1].classList.contains('danger-button')&&(!clearId||buttons[1].id===clearId),media+' action order: select then clear');
            check(buttons[0].getBoundingClientRect().bottom<=buttons[1].getBoundingClientRect().top,media+' actions stack vertically');
            const style=app.getComputedStyle(buttons[1]);check(style.color==='rgb(220, 155, 158)'&&style.backgroundColor==='rgb(48, 38, 41)',media+' uses subdued red danger style');
        }
        const fixture=doc.createElement('canvas');fixture.width=180;fixture.height=100;fixture.getContext('2d').fillRect(0,0,180,100);
        const blob=await new Promise(resolve=>fixture.toBlob(resolve,'image/png'));
        await app.VisualizerFiles.select('logoimage',[new app.File([blob],'cover-ui.png',{type:'image/png'})]);
        await app.VisualizerFiles.select('backgroundimage',[new app.File([blob],'background-ui.png',{type:'image/png'})]);
        // Silent WAV proves source retention; no audio/FFT pipeline is changed or recalibrated here.
        const samples=8000,buffer=new ArrayBuffer(44+samples*2),view=new DataView(buffer);
        const ascii=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
        ascii(0,'RIFF');view.setUint32(4,36+samples*2,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,16000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,samples*2,true);
        const audioInput=doc.querySelector('#audio-file'),transfer=new app.DataTransfer();transfer.items.add(new app.File([buffer],'silent-ui.wav',{type:'audio/wav'}));audioInput.files=transfer.files;audioInput.dispatchEvent(new app.Event('change'));
        const audio=doc.querySelector('#local-audio');for(let i=0;i<100&&!Number.isFinite(audio.duration);i++)await wait(20);
        app.VisualizerLyrics.load('[00:00.10]Primary\n[00:00.60]Next','primary-ui.lrc');
        app.VisualizerLyrics.loadSecondary('[00:00.10]次要\n[00:00.60]下一句','secondary-ui.lrc');
        r.updateStandalone({inputGain:1.25,lyrics:{globalOffsetMs:91},text:{title:'Keep title',artist:'Keep artist'}});
        const urls={cover:r.getSettings().logoimage.value,background:r.getSettings().backgroundimage.value,audio:audio.getAttribute('src')};
        for(const definition of definitions){
            shell.showView('HOME');doc.querySelector('[data-template-id="'+definition.id+'"] button').click();
            check(r.getSettings().logoimage.value===urls.cover&&r.getSettings().backgroundimage.value===urls.background&&audio.getAttribute('src')===urls.audio,definition.name+' retains loaded audio, Cover and background URLs');
            check(doc.querySelector('#primary-name').textContent==='primary-ui.lrc'&&doc.querySelector('#secondary-name').textContent==='secondary-ui.lrc',definition.name+' retains both loaded LRCs');
            check(r.getStandalone().inputGain===1.25&&r.getStandalone().lyrics.globalOffsetMs===91&&r.getStandalone().text.title==='Keep title',definition.name+' preserves audio/Lyrics settings and song content');
        }
        const preset=app.VisualizerPresets.create('Regression');r.updateStandalone({visualizer:{coverX:77}});app.VisualizerPresets.import(JSON.stringify(preset));
        check(same(r.getStandalone().visualizer,preset.standalone.visualizer),'Preset roundtrip remains intact after template launch');
        // Preset intentionally clears image URLs by its existing contract; reload to exercise actual clear handlers.
        await app.VisualizerFiles.select('logoimage',[new app.File([blob],'cover-ui.png',{type:'image/png'})]);
        const coverClear=doc.querySelector('[data-media="cover"] footer .danger-button');coverClear.click();
        check(r.getSettings().logoimage.value===''&&doc.querySelector('#cover-name').textContent==='尚未載入封面','Cover clear works through original handler');
        doc.querySelector('#lyrics-secondary-clear').click();
        check(doc.querySelector('#secondary-name').textContent==='尚未載入次要歌詞'&&doc.querySelector('#primary-name').textContent==='primary-ui.lrc','Secondary clear keeps Primary LRC');
        doc.querySelector('#lyrics-clear').click();
        check(doc.querySelector('#primary-name').textContent==='尚未載入主要歌詞','Primary clear works through original handler');
        check(confirmations===0,'All clear actions execute without confirmation dialogs');
        for(const width of [1280,720,420]){
            frame.style.width=width+'px';await wait(100);const stage=doc.querySelector('#stage').getBoundingClientRect();
            check(stage.width>0&&Math.abs(stage.width/stage.height-16/9)<.001&&app.canvas.width===1920&&app.canvas.height===1080,'Editor '+width+'px retains canonical 16:9 Stage');
        }
        check(errors.length===0,'No browser errors or unhandled promises: '+JSON.stringify(errors));
        frame.style.width='1280px';shell.showView('HOME');
    }catch(error){check(false,error.stack||error.message);}
    output.textContent+='\nDONE '+passes+' passed / '+failures+' failed';this.disabled=false;
});
