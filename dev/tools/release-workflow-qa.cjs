'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), {execFileSync} = require('node:child_process');
const {launch,artifacts} = require('./preferences-smoke.cjs');
const root = path.resolve(__dirname,'../..'), wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run() {
    await fs.mkdir(artifacts,{recursive:true}); const profile=path.join(artifacts,'workflow-profile'); await fs.mkdir(profile);
    const checks=[],check=(value,label)=>{checks.push({pass:!!value,label});console.log((value?'PASS ':'FAIL ')+label);};let session;
    try {
        session=await launch(profile);let r=code=>session.renderer(code),m=code=>session.evaluate(code);
        await r('window.work=WaveCanvasProject.newProject();true'); await wait(100);
        await r('document.querySelector("#project-name-input").value="Release 中文 Workflow";document.querySelector("#project-name-input").dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("#project-name-submit").click();true');
        check(await r('work')&&await r('WaveCanvasProject.getState().name==="Release 中文 Workflow"'),'Installed New -> named project');
        const primary=path.join(artifacts,'primary.lrc'),secondary=path.join(artifacts,'secondary.srt');
        await fs.writeFile(primary,'[00:00.00]測試第一行\n[00:02.00]測試第二行\n');await fs.writeFile(secondary,'1\n00:00:00,000 --> 00:00:02,000\nFirst translated line\n\n2\n00:00:02,000 --> 00:00:04,000\nSecond translated line\n');
        for(const [selector,file] of [['#audio-file',path.join(root,'dev/tests/fixtures/integration-tone.wav')],['#setting-logoimage',path.join(root,'app/assets/wavecanvas.png')],['#setting-backgroundimage',path.join(root,'app/assets/wavecanvas.png')],['#lyrics-file',primary],['#lyrics-secondary-file',secondary]])await session.select(selector,file);
        await r('VisualizerSystemFonts.load()');
        await r('document.querySelector("#text-fontFamily").value="Bahnschrift";document.querySelector("#text-fontFamily").dispatchEvent(new Event("change",{bubbles:true}));VisualizerRuntime.updateStandalone({visualizer:{layout:"square",squareSize:405},lyrics:{globalOffsetMs:125}});VisualizerLyrics.retime("primary",VisualizerLyrics.getDocument("primary").events[0].id,250);true');
        const file=path.join(artifacts,'workflow 中文.waveproj');await m('projectQA.savePaths.push('+JSON.stringify(file)+');true');check(await r('WaveCanvasProject.save()'),'Import five media slots -> installed font / timing / layout -> Save');
        check(JSON.parse(await fs.readFile(file,'utf8')).appVersion===require('../../package.json').version,'Saved writer version uses canonical package metadata');
        const model=require('../../app/project-model.js'),saved=model.comparison(await r('WaveCanvasProject.snapshot()'));await session.finish(false);session=await launch(profile,[file]);r=code=>session.renderer(code);m=code=>session.evaluate(code);
        for(let i=0;i<200&&!(await r('WaveCanvasProject.getState().projectPath==='+JSON.stringify(file)));i++)await wait(30);
        const restored=model.comparison(await r('WaveCanvasProject.snapshot()'));await fs.writeFile(path.join(artifacts,'state-roundtrip.json'),JSON.stringify({before:JSON.parse(saved),after:JSON.parse(restored)},null,2));
        check(restored===saved,'Close -> shell-argv reopen preserves complete canonical project state');
        const parent=path.join(artifacts,'collect');await fs.mkdir(parent);await m('projectQA.openPaths.push('+JSON.stringify(parent)+');projectQA.answers.push(1);true');check(await r('WaveCanvasProject.collect()'),'Collect named project with installed font');
        const original=path.join(parent,'Release 中文 Workflow'),moved=path.join(artifacts,'搬移 Workflow');await fs.rename(original,moved);
        const collected=path.join(moved,'Release 中文 Workflow.waveproj');await m('projectQA.openPaths.push('+JSON.stringify(collected)+');true');check(await r('WaveCanvasProject.open()'),'Moved collected folder resolves all relative media');
        const cp=JSON.parse(await fs.readFile(collected,'utf8'));
        async function files(dir){let result=[];for(const item of await fs.readdir(dir,{withFileTypes:true}))result.push(...(item.isDirectory()?await files(path.join(dir,item.name)):[path.join(dir,item.name)]));return result;}
        check(Object.values(cp.state.media).every(ref=>ref?.startsWith('media/'))&&cp.state.settings.standalone.text.fontFamily==='Bahnschrift'&&!(await files(moved)).some(f=>/\.(ttf|otf|ttc|woff2?)$/i.test(f)),'Collect stores family string only and copies no font files');
        for(let i=0;i<12;i++){await r('VisualizerRuntime.updateStandalone({inputGain:'+(1+i/20)+'});true');if(!(await r('WaveCanvasProject.autosave()')))throw Error('Autosave failed '+i);}
        const backups=await fs.readdir(path.join(profile,'Backups',cp.projectId));check(backups.length===10,'Installed autosave preserves rolling ten backups');
        const output=path.join(artifacts,'workflow-300.mp4');
        await m('(async()=>{const payload=await projectQA.window.webContents.executeJavaScript("WaveCanvasExport.payload()",true);projectQA.done=false;projectQA.window.waveCanvasExportController.startTest(payload,'+JSON.stringify(output)+',{startTime:0,endTime:5}).then(result=>{projectQA.result=result;projectQA.done=true;},error=>{projectQA.error=error.message;projectQA.done=true;});return true;})()');
        for(let i=0;i<1200&&!(await m('projectQA.done'));i++)await wait(100);
        check(await m('!projectQA.error&&projectQA.result.frames===300'),'Same reopened / collected workflow exports 300 frames');
        const probe=JSON.parse(execFileSync(path.join(path.dirname(process.env.WAVECANVAS_QA_EXE),'resources/ffmpeg/ffprobe.exe'),['-v','error','-count_frames','-show_streams','-of','json',output],{encoding:'utf8',windowsHide:true}));
        const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');
        check(video.codec_name==='h264'&&video.width===1920&&video.height===1080&&video.r_frame_rate==='60/1'&&Number(video.nb_read_frames)===300&&audio.codec_name==='aac'&&Math.abs(Number(video.duration)-Number(audio.duration))<.025,'Installed ffprobe validates H.264 1080p60 / AAC / frame count / AV sync <25ms');
        await fs.writeFile(path.join(artifacts,'ffprobe.json'),JSON.stringify(probe,null,2));
        console.log('PRESERVATION_PROFILE='+profile);
    }catch(error){check(false,error.stack||String(error));}
    finally{if(session)await session.finish();await fs.writeFile(path.join(artifacts,'results.json'),JSON.stringify({checks},null,2));}
    console.log(artifacts);process.exitCode=checks.some(c=>!c.pass)?1:0;
}
run().catch(error=>{console.error(error);process.exitCode=1});
