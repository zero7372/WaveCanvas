'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { launch, artifacts } = require('./preferences-smoke.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
const q = value => "'" + value.replace(/'/g,"''") + "'";
async function run() {
    await fs.mkdir(artifacts,{recursive:true}); const profile = path.join(artifacts,'shell-profile'); await fs.mkdir(profile);
    const checks = [], check = (value,label) => { checks.push({pass:!!value,label}); console.log((value?'PASS ':'FAIL ') + label); };
    let session;
    try {
        session = await launch(profile);
        const r = code=>session.renderer(code), m=code=>session.evaluate(code);
        await r('WaveCanvasPreferences.update({project:{askNameOnCreate:false},general:{confirmUnsavedClose:false}})'); await r('WaveCanvasProject.newProject()');
        const source = path.join(artifacts,'第一個 中文 project.waveproj'), target=path.join(artifacts,'另一個 project 中文.waveproj');
        await m('projectQA.savePaths.push('+JSON.stringify(source)+');true'); check(await r('WaveCanvasProject.save()'),'Installed app saves Unicode project');
        const project = JSON.parse(await fs.readFile(source,'utf8')); project.name='外部開啟 中文'; project.state.settings.standalone.text.fontFamily='Bahnschrift'; await fs.writeFile(target,JSON.stringify(project));
        const commandKey='HKCU:\\Software\\Classes\\WaveCanvas.Project\\shell\\open\\command';
        const original=execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-Item ${q(commandKey)}).GetValue('')`],{encoding:'utf8',windowsHide:true}).trim();
        check(original === '"'+process.env.WAVECANVAS_QA_EXE+'" "%1"','Actual installed association quotes executable and project');
        async function shell(file) {
            // Temporarily append the isolated profile to the real registered command; restore immediately after shell dispatch.
            const command='"'+process.env.WAVECANVAS_QA_EXE+'" "--user-data-dir='+profile+'" "%1"';
            try { execFileSync('powershell.exe',['-NoProfile','-Command',`Set-Item -LiteralPath ${q(commandKey)} -Value ${q(command)}; Start-Process -FilePath ${q(file)} -WindowStyle Hidden -Wait`],{windowsHide:true,timeout:20000}); }
            finally { execFileSync('powershell.exe',['-NoProfile','-Command',`Set-Item -LiteralPath ${q(commandKey)} -Value ${q(original)}`],{windowsHide:true}); }
            await wait(500);
        }
        await r('VisualizerRuntime.updateStandalone({inputGain:1.6});true'); await m('projectQA.answers.push(2);true'); await shell(target);
        check(await r('WaveCanvasProject.getState().projectPath==='+JSON.stringify(source)+'&&WaveCanvasProject.getState().dirty'),'Shell running Cancel preserves edits with confirmUnsavedClose Off');
        await m('projectQA.answers.push(0);true'); await shell(target);
        for(let i=0;i<200&&!(await r('WaveCanvasProject.getState().projectPath==='+JSON.stringify(target)));i++)await wait(30);
        check(JSON.parse(await fs.readFile(source,'utf8')).state.settings.standalone.inputGain===1.6 && await r('WaveCanvasProject.getState().projectPath==='+JSON.stringify(target)),'Shell running Save writes edits before normal loader opens target');
        await r('VisualizerRuntime.updateStandalone({inputGain:1.8});true'); await m('projectQA.answers.push(1);true'); await shell(source);
        for(let i=0;i<200&&!(await r('WaveCanvasProject.getState().projectPath==='+JSON.stringify(source)));i++)await wait(30);
        check(await r('WaveCanvasProject.getState().projectPath==='+JSON.stringify(source)+'&&!WaveCanvasProject.getState().dirty'),'Shell running Discard opens target');
        await session.finish(false); session=await launch(profile,[],target);
        for(let i=0;i<200&&!(await session.renderer('WaveCanvasProject.getState().projectPath==='+JSON.stringify(target)));i++)await wait(30);
        check(await session.renderer('WaveCanvasProject.getState().projectPath==='+JSON.stringify(target)+'&&WaveCanvasProject.getState().name==="外部開啟 中文"&&!WaveCanvasProject.getState().dirty'),'Actual Windows shell cold open loads Unicode / spaces via formal pipeline');
        check(await session.renderer('VisualizerRuntime.getStandalone().text.fontFamily==="Bahnschrift"'),'Shell loader restores installed font family');
        check((await session.renderer('waveCanvas.project.getRecent()')).some(item=>item.path===target),'Shell open updates Recent Projects');
        const metadata=await session.renderer('waveCanvas.release.read()');check(metadata.version===require('../../package.json').version && metadata.documents.length===4 && metadata.documents.some(d=>d.name==='FFmpeg/SOURCE_INFO.txt'&&d.text.includes('readiness: PASS')&&d.text.includes('Published: false')),'Packaged canonical About version and narrow license resources');
        await session.renderer('Array.from(document.querySelectorAll(".app-menu button")).find(b=>b.textContent==="Open Source Licenses").click();true'); await wait(250);
        check(await session.renderer('!!document.querySelector("#release-dialog[open]")&&document.querySelector("#release-dialog").textContent.includes("libx264")'),'Help Open Source Licenses UI opens with GPL/source status');
        await session.renderer('document.querySelector("#release-dialog").close();true');
        const longDirectory=path.join(artifacts,...Array.from({length:6},(_,i)=>'Unicode 長路徑 Ω '+i+' '+ 'x'.repeat(35)));await fs.mkdir(longDirectory,{recursive:true});
        const longFile=path.join(longDirectory,'🎵 中文 project.waveproj');await fs.writeFile(longFile,JSON.stringify(project));
        await shell(longFile);
        for(let i=0;i<200&&!(await session.renderer('WaveCanvasProject.getState().projectPath==='+JSON.stringify(longFile)));i++)await wait(30);
        check(longFile.length>260&&await session.renderer('WaveCanvasProject.getState().projectPath==='+JSON.stringify(longFile)),'Windows shell long path >260 / Unicode / emoji opens where host supports it');
        await fs.writeFile(path.join(artifacts,'preserved-profile.json'),JSON.stringify({profile,source,target}));
        console.log('PRESERVATION_PROFILE='+profile); await session.finish(false);session=null;
    } catch(error) { check(false,error.stack||String(error)); }
    finally { if(session)await session.finish(); await fs.writeFile(path.join(artifacts,'results.json'),JSON.stringify({checks},null,2)); }
    console.log(artifacts); process.exitCode=checks.some(c=>!c.pass)?1:0;
}
run().catch(error=>{console.error(error);process.exitCode=1});
