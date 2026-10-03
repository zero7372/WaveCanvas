document.querySelector('#run').addEventListener('click',async function () {
    this.disabled=true;const output=document.querySelector('#results'),frame=document.querySelector('#app');let passes=0,failures=0;
    const check=(ok,label)=>{output.textContent+='\n'+(ok?'PASS ':'FAIL ')+label;ok?passes++:failures++;};
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    output.textContent='Running';
    try {
        await new Promise(resolve=>{frame.onload=resolve;frame.src='../../app/index.html?linear-cover-tests';});
        const app=frame.contentWindow,doc=app.document,runtime=app.VisualizerRuntime;doc.querySelector('#new-project').click();
        const errors=[];app.addEventListener('error',e=>errors.push(e.message));app.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
        const fixture=document.createElement('canvas');fixture.width=512;fixture.height=256;
        const paint=fixture.getContext('2d'),gradient=paint.createLinearGradient(0,0,512,256);gradient.addColorStop(0,'#745add');gradient.addColorStop(1,'#3de0c7');paint.fillStyle=gradient;paint.fillRect(0,0,512,256);
        paint.fillStyle='#ffffff';paint.font='bold 50px system-ui';paint.textAlign='center';paint.fillText('WaveCanvas',256,142);
        const blob=await new Promise(resolve=>fixture.toBlob(resolve,'image/png'));
        let decodes=0;const nativeDecode=app.Image.prototype.decode;app.Image.prototype.decode=function(){decodes++;return nativeDecode.call(this);};
        async function load() {
            const data=new app.DataTransfer();data.items.add(new app.File([blob],'linear-artwork.png',{type:'image/png'}));const input=doc.querySelector('#setting-logoimage');input.files=data.files;input.dispatchEvent(new app.Event('change'));
            for(let i=0;i<100&&!app.VisualizerImages.getLogo();i++)await wait(20);
            if(!app.VisualizerImages.getLogo())throw new Error('Cover cache timeout');
        }
        const input=(key,value)=>{const node=doc.querySelector('#layout-'+key);node.value=String(value);node.dispatchEvent(new app.Event(node.type==='range'?'input':'change'));};
        await load();input('layout','linear');input('coverShape','square');
        check(Boolean(app.VisualizerImages.getLogo()),'Linear uses the decoded local Cover');
        check(['coverX','coverY','coverSize','coverShape','coverRotationSpeed'].every(key=>doc.querySelector('#layout-'+key).closest('[data-linear-cover]')),'Cover controls belong to the Linear Cover group');
        input('coverX',62);input('coverY',54);input('coverSize',38);
        const image=app.VisualizerImages.getLogo(),scratch=doc.createElement('canvas');scratch.width=1920;scratch.height=1080;const ctx=scratch.getContext('2d');
        function draw(bass=0,shakeX=0,shakeY=0) {
            const calls=[],originals={};
            for(const name of ['translate','scale','rotate','arc','clip','drawImage']) {originals[name]=ctx[name];ctx[name]=function(...args){calls.push([name,...args]);return originals[name].apply(this,args);};}
            ctx.clearRect(0,0,1920,1080);
            try {app.VisualizerLinearCover.draw(ctx,runtime.getStandalone().visualizer,{image,bass:{center:bass},shakeX,shakeY});}
            finally {for(const[name,fn]of Object.entries(originals))ctx[name]=fn;}
            return calls;
        }
        let calls=draw();const translation=calls.find(c=>c[0]==='translate');
        check(Math.abs(translation[1]-1920*.62)<1e-8&&Math.abs(translation[2]-1080*.54)<1e-8,'X/Y use independent canonical stage coordinates');
        check(calls.find(c=>c[0]==='drawImage')[4]===1080*.38,'Size changes the longest artwork edge');
        check(!calls.some(c=>c[0]==='clip')&&calls.find(c=>c[0]==='drawImage')[4]/calls.find(c=>c[0]==='drawImage')[5]===2,'Square retains full non-square image without circular clipping');
        check(doc.querySelector('[data-layout-property=coverRotationSpeed]').hidden,'Square hides rotation speed');
        input('coverShape','circle');input('coverRotationSpeed',-.8);calls=draw(24,7,-9);
        check(calls.some(c=>c[0]==='clip')&&calls.find(c=>c[0]==='arc')[1]===0,'Circle mask is centered on artwork');
        check(calls.find(c=>c[0]==='scale')[1]>1&&calls.find(c=>c[0]==='translate')[1]===1920*.62+7&&calls.some(c=>c[0]==='rotate'),'Rotation combines with existing bass enlargement and shake');
        check(!doc.querySelector('[data-layout-property=coverRotationSpeed]').hidden,'Circle exposes rotation speed');
        check(!doc.querySelector('[data-property=circleopacity]').hidden&&!doc.querySelector('[data-property=cbassmultiplier]').hidden,'Loaded Linear artwork exposes shared opacity/bass controls');
        runtime.updateProperties({circleopacity:{value:40}});draw();
        check(ctx.globalAlpha===1&&ctx.getImageData(Math.round(1920*.62),Math.round(1080*.54),1,1).data[3]===102,'Shared opacity affects artwork and restores Canvas alpha');
        input('coverShape','square');input('coverShape','circle');
        check(runtime.getStandalone().visualizer.coverRotationSpeed===-.8,'Shape switch retains rotation speed');
        const circleState=runtime.getSettings().circleradius.value,squareState=runtime.getStandalone().visualizer.squareSize;
        input('layout','circle');input('layout','square');input('layout','linear');
        const config=runtime.getStandalone().visualizer;
        check(config.coverX===62&&config.coverY===54&&config.coverSize===38&&config.coverShape==='circle'&&config.coverRotationSpeed===-.8,'Layout switches retain all Linear Cover fields');
        check(runtime.getSettings().circleradius.value===circleState&&config.squareSize===squareState,'Linear Cover geometry does not overwrite Circle/Square state');
        const preset=app.VisualizerPresets.create('Linear artwork');check(preset.version===1&&preset.standalone.visualizer.coverRotationSpeed===-.8,'Preset exports new fields with version 1');
        app.VisualizerPresets.import(JSON.stringify(preset));
        check(doc.querySelector('#layout-coverSize').value==='38'&&doc.querySelector('#layout-coverShape').value==='circle','Preset import synchronizes Cover controls');
        for(const key of ['coverX','coverY','coverSize','coverShape','coverRotationSpeed'])delete preset.standalone.visualizer[key];
        app.VisualizerPresets.import(JSON.stringify(preset));check(runtime.getStandalone().visualizer.coverShape==='circle'&&runtime.getStandalone().visualizer.coverRotationSpeed===0,'Old preset uses official Linear factory fallbacks');
        await load();input('coverShape','circle');input('coverRotationSpeed',-.8);input('coverX',50);input('coverY',40);input('coverSize',38);
        runtime.updateProperties({circleopacity:{value:100}});runtime.updateStandalone({visualizer:{positionY:80}});
        const baselineDecodes=decodes;
        for(let i=0;i<60;i++)app.VisualizerLinearCover.draw(ctx,runtime.getStandalone().visualizer,{image:app.VisualizerImages.getLogo(),bass:{center:0},shakeX:0,shakeY:0});
        check(decodes===baselineDecodes,'Frames reuse image cache without decode');
        const actual=[],nativeDraw=app.ctx.drawImage;app.ctx.drawImage=function(...args){actual.push(args);return nativeDraw.apply(this,args);};
        await wait(100);app.ctx.drawImage=nativeDraw;
        check(actual.some(args=>args[0]===app.VisualizerImages.getLogo()),'Actual Linear renderer draws the loaded Cover');
        app.Image.prototype.decode=nativeDecode;await wait(100);
        check(errors.length===0,'No page errors or unhandled promises: '+JSON.stringify(errors));
    } catch(error) {check(false,error.stack||error.message);}
    output.textContent+='\nDONE passes='+passes+' failures='+failures;this.disabled=false;
});
