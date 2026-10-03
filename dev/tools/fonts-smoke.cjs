'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {launch,artifacts}=require('./preferences-smoke.cjs');
const root=path.resolve(__dirname,'../..'),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(){
    await fs.mkdir(artifacts,{recursive:true});const profile=path.join(artifacts,'font-profile');await fs.mkdir(profile);
    const checks=[],check=(pass,label)=>{checks.push({pass:!!pass,label});console.log((pass?'PASS ':'FAIL ')+label);};let session;
    try{
        session=await launch(profile);const r=code=>session.renderer(code),m=code=>session.evaluate(code);
        await r('VisualizerSystemFonts.load()');const enumeration=await r('(async()=>({...VisualizerSystemFonts.getState(),families:VisualizerSystemFonts.families,permission:(await navigator.permissions.query({name:"local-fonts"})).state}))()');await fs.writeFile(path.join(artifacts,'font-enumeration.json'),JSON.stringify(enumeration,null,2));
        check(enumeration.status==='available'&&enumeration.installedFamilyCount>11,'Actual Local Font Access enumerates more than the old safe list');
        if(enumeration.status!=='available')throw Error(JSON.stringify(enumeration));
        for(const family of ['Calibri','Cambria','Consolas','Bahnschrift','Malgun Gothic','Yu Gothic'])check(enumeration.families.includes(family),'Installed family '+family);
        check(await r('(()=>{const ids=["text-fontFamily","lyrics-fontFamily","lyrics-secondaryFontFamily"];const lists=ids.map(id=>Array.from(document.getElementById(id).options,x=>x.value));return lists.every(list=>JSON.stringify(list)===JSON.stringify(VisualizerSystemFonts.families));})()'),'All three dropdowns share canonical choices');
        check(await r('!WaveCanvasProject.getState().dirty'),'Enumeration leaves startup project clean');
        await session.select('#audio-file',path.join(root,'dev/tests/fixtures/integration-tone.wav'));
        const project=path.join(artifacts,'font identity.waveproj');await r('VisualizerRuntime.updateStandalone({text:{fontFamily:"Bahnschrift"},lyrics:{fontFamily:"Some Weird Font",secondaryFontFamily:"思源黑體 TC"}});true');await m('projectQA.savePaths.push('+JSON.stringify(project)+');true');check(await r('WaveCanvasProject.save()'),'Save installed / missing / CJK families');
        check(await r('WaveCanvasProject.open('+JSON.stringify(project)+')'),'Open project ordinary loader');
        const snapshot=await r('WaveCanvasProject.snapshot()'),standalone=snapshot.state.settings.standalone;
        check(standalone.text.fontFamily==='Bahnschrift'&&standalone.lyrics.fontFamily==='Some Weird Font'&&standalone.lyrics.secondaryFontFamily==='思源黑體 TC','Project Save/Open preserves exact family strings');
        check(await r('document.getElementById("lyrics-fontFamily").value==="Some Weird Font"&&document.getElementById("lyrics-secondaryFontFamily").value==="思源黑體 TC"&&!WaveCanvasProject.getState().dirty'),'Unknown project fonts displayed without dirty mutation');
        check(await r('document.querySelector("#lyrics-stack").style.fontFamily.startsWith("\\\"Some Weird Font\\\"")'),'Preview renders saved family first with legal fallback');
        const payload=await r('WaveCanvasExport.payload()');check(payload.snapshot.state.settings.standalone.lyrics.fontFamily==='Some Weird Font','Export snapshot keeps missing family metadata');
        // Real dedicated export renderer, without changing encoder/capture or adding product hooks.
        const runtimeRoot=process.argv.includes('--packaged')?path.join(root,'dist/win-unpacked/resources/app.asar'):root;
        await m('projectQA.fontExport=new projectQA.electron.BrowserWindow({show:false,width:1920,height:1080,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});projectQA.fontPayload='+JSON.stringify(payload)+';projectQA.fontExport.loadFile('+JSON.stringify(path.join(runtimeRoot,'app/export.html'))+')');
        const exportScript='(async()=>{const payload='+JSON.stringify(payload)+';for(const file of Object.values(payload.assets))if(file?.bytes)file.bytes=new Uint8Array(Object.values(file.bytes));await WaveCanvasExportStage.prepare(payload);const s=VisualizerRuntime.exportProjectSettings();const result={text:s.standalone.text.fontFamily,primary:s.standalone.lyrics.fontFamily,secondary:s.standalone.lyrics.secondaryFontFamily,css:document.querySelector("#lyrics-stack").style.fontFamily};WaveCanvasExportStage.dispose();return result;})()';
        const exported=await m('projectQA.fontExport.webContents.executeJavaScript('+JSON.stringify(exportScript)+',true)');
        check(exported.text==='Bahnschrift'&&exported.primary==='Some Weird Font'&&exported.secondary==='思源黑體 TC'&&exported.css.startsWith('"Some Weird Font"'),'Dedicated export renderer retains strings and renders saved family first');await m('projectQA.fontExport.destroy();true');
        await r('document.getElementById("lyrics-fontFamily").value="Calibri";document.getElementById("lyrics-fontFamily").dispatchEvent(new Event("change",{bubbles:true}));true');await wait(150);
        check(await r('VisualizerRuntime.getStandalone().lyrics.fontFamily==="Calibri"&&WaveCanvasProject.getState().dirty'),'Only explicit user selection changes value and marks dirty');check(await r('WaveCanvasProject.save()'),'Save changed font');
        const saved=JSON.parse(await fs.readFile(project,'utf8'));check(saved.state.settings.standalone.lyrics.fontFamily==='Calibri'&&typeof saved.state.settings.standalone.text.fontFamily==='string','Disk saves family strings, no index or font-file metadata');
        const names=['Arial','Bahnschrift','Calibri','Cambria','Consolas','Microsoft JhengHei UI','Yu Gothic UI','思源黑體 TC','family with spaces','Unicode 😀','A "quoted" \\ family','punctuation, ; } family'];
        const css=await r('('+JSON.stringify(names)+').map(name=>({name,valid:CSS.supports("font-family",VisualizerSystemFonts.fontStack(name))}))');check(css.every(x=>x.valid),'Chromium accepts CSS stacks including quotes / punctuation / CJK / Unicode');
        check(enumeration.permission==='granted'&&await r('(async()=> (await navigator.permissions.query({name:"geolocation"})).state==="denied")()'),'Bundled editor grants only local-fonts; unrelated permission stays denied');
        await m('projectQA.fontBrowser=new projectQA.electron.BrowserWindow({show:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});projectQA.fontBrowser.loadFile('+JSON.stringify(path.join(runtimeRoot,'app/index.html'))+')');
        await m('projectQA.fontBrowser.show();projectQA.fontBrowser.focus();new Promise(resolve=>setTimeout(resolve,300))');
        const browserScript='(async()=>{await VisualizerSystemFonts.load();VisualizerRuntime.updateStandalone({text:{fontFamily:"Some Weird Font"}});return {permission:(await navigator.permissions.query({name:"local-fonts"})).state,state:VisualizerSystemFonts.getState(),selection:document.getElementById("text-fontFamily").value,options:document.getElementById("text-fontFamily").options.length,desktop:Boolean(window.waveCanvas)};})()';
        const browser=await m('projectQA.fontBrowser.webContents.executeJavaScript('+JSON.stringify(browserScript)+',true)');check(!browser.desktop&&browser.permission==='denied'&&browser.state.status==='empty'&&browser.selection==='Some Weird Font'&&browser.options===12,'Browser real denied permission returns empty fonts and preserves unknown selection via safe fallback');await m('projectQA.fontBrowser.destroy();true');
        await fs.writeFile(path.join(artifacts,'font-persistence.json'),JSON.stringify({standalone,exported,css,browser},null,2));
    }catch(error){check(false,error.stack||String(error));}finally{if(session)await session.finish();await fs.writeFile(path.join(artifacts,'font-results.json'),JSON.stringify({checks},null,2));}
    const failed=checks.filter(x=>!x.pass).length;console.log('Fonts: '+(checks.length-failed)+' passed / '+failed+' failed\n'+artifacts);process.exitCode=failed?1:0;
}
run().catch(error=>{console.error(error);process.exitCode=1;});
