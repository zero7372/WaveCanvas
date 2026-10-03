'use strict';
// Test-only Main inspector harness. Dialog responses are controlled; no test hooks ship in app/.
const fs = require('node:fs/promises'), path = require('node:path'), net = require('node:net'), { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), packaged = process.argv.includes('--packaged');
const artifacts = path.join(root, 'dev/tests/artifacts/export-' + (packaged ? 'packaged' : 'development') + '-' + Date.now());
process.env.ELECTRON_CACHE = path.join(root, '.electron-cache'); process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function launch(profile) {
    const port = await freePort(), exe = packaged ? path.join(root, 'dist/win-unpacked/WaveCanvas.exe') : require('electron');
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(exe, ['--inspect=127.0.0.1:' + port, ...(packaged ? [] : ['.'])], { cwd: root, env, windowsHide: false });
    let output = '', exited = false; child.stdout.on('data', data => output += data); child.stderr.on('data', data => output += data); child.on('exit', () => exited = true);
    let target; for (let i = 0; i < 200 && !target && !exited; i++) { try { target = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json())[0]; } catch {} await wait(50); }
    if (!target) { child.kill(); throw Error('Inspector unavailable: ' + output); }
    const socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let serial = 0; const pending = new Map();
    socket.addEventListener('message', event => { const data = JSON.parse(event.data); if (pending.has(data.id)) { const callback = pending.get(data.id); pending.delete(data.id); data.error ? callback.reject(Error(data.error.message)) : callback.resolve(data.result); } });
    async function send(method, params = {}) {
        const id = ++serial; return new Promise((resolve, reject) => { const timer = setTimeout(() => { pending.delete(id); child.kill(); socket.close(); reject(Error('Inspector timeout: ' + method + '\n' + output)); }, 40000);
            pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id, method, params })); });
    }
    async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || JSON.stringify(result.exceptionDetails)); return result.result?.value; }
    try {
    const main = packaged ? path.join(root, 'dist/win-unpacked/resources/app.asar/electron/main.cjs') : path.join(root, 'electron/main.cjs');
    await evaluate(`globalThis.projectQA={electron:process.getBuiltinModule('module').createRequire(${JSON.stringify(main)})('electron'),dialogCalls:[],savePaths:[],openPaths:[],answers:[]};projectQA.electron.app.setPath('userData',${JSON.stringify(profile)});true`);
    await evaluate(`(async()=>{for(let i=0;i<200;i++){const w=projectQA.electron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('index.html'));if(w&&!w.webContents.isLoading()&&w.isVisible()){projectQA.window=w;return true;}await new Promise(r=>setTimeout(r,50));}throw Error('Window unavailable');})()`);
    await evaluate(`projectQA.electron.dialog.showSaveDialog=async(_w,options)=>{projectQA.dialogCalls.push({type:'save',options});const file=projectQA.savePaths.shift();return file?{canceled:false,filePath:file}:{canceled:true};};projectQA.electron.dialog.showOpenDialog=async(_w,options)=>{projectQA.dialogCalls.push({type:'open',options});const file=projectQA.openPaths.shift();return file?{canceled:false,filePaths:[file]}:{canceled:true};};projectQA.electron.dialog.showMessageBox=async(_w,options)=>{projectQA.dialogCalls.push({type:'message',options});return {response:projectQA.answers.length?projectQA.answers.shift():2};};true`);
    const renderer = code => evaluate(`projectQA.window.webContents.executeJavaScript(${JSON.stringify(code)},true)`);
    async function select(selector, file) {
        await evaluate(`(async()=>{const d=projectQA.window.webContents.debugger;d.attach('1.3');try{const tree=await d.sendCommand('DOM.getDocument');const node=await d.sendCommand('DOM.querySelector',{nodeId:tree.root.nodeId,selector:${JSON.stringify(selector)}});await d.sendCommand('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[${JSON.stringify(file)}]});}finally{d.detach();}})()`); await wait(250);
    }
    return { child, renderer, evaluate, select, exited: () => exited, async finish(discard = true) {
        if (discard) await evaluate('projectQA.answers.push(1);setTimeout(()=>projectQA.window.close(),50);true').catch(() => {});
        else await evaluate('setTimeout(()=>{if(!projectQA.window.isDestroyed())projectQA.window.close();},50);true').catch(() => {});
        socket.close(); for (let i = 0; i < 100 && !exited; i++) await wait(50);
        if (!exited) child.kill(); await fs.appendFile(path.join(artifacts, 'console.txt'), output); return exited;
    } };
    } catch(error) { socket.close(); child.kill(); throw error; }
}


const {execFileSync}=require('child_process'),crypto=require('crypto');
function wav(seconds){const rate=48000,n=Math.round(rate*seconds),b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(11000*Math.sin(2*Math.PI*96*i/rate)*(1+Math.sin(2*Math.PI*2*i/rate))/2),44+i*2);return b;}
async function run(){await fs.mkdir(artifacts,{recursive:true});const checks=[],check=(p,label)=>{checks.push({pass:!!p,label});console.log((p?'PASS ':'FAIL ')+label);};let session;
try{const profile=path.join(artifacts,'profile');await fs.mkdir(profile);session=await launch(profile);
await session.evaluate('projectQA.window.exportTestDiagnostics=true;true');
const real=path.resolve(root,'../Untitled/Untitled.waveproj');await session.evaluate('projectQA.openPaths.push('+JSON.stringify(real)+');true');await session.renderer('WaveCanvasProject.open()');
const source=path.join(artifacts,'synthetic-five.wav');await fs.writeFile(source,wav(5));await session.select('#audio-file',source);
const lrc = '[00:00.00]Deterministic Primary\n[00:00.00]雙語測試\n[00:02.00]...\n[00:04.00]Final line';
await session.renderer('VisualizerLyrics.load('+JSON.stringify(lrc)+',"synthetic.lrc");VisualizerRuntime.updateStandalone({background:{mode:"infinity"},lyrics:{enabled:true}});true');
if (!process.argv.includes('--layouts')) {
const outputs=[];
for(let repeat=0;repeat<2;repeat++){
 await session.evaluate(repeat===0?'projectQA.window.minimize();true':'projectQA.window.restore();projectQA.window.setSize(1100,700);projectQA.window.webContents.setZoomFactor(1.25);true');
 await fs.writeFile(path.join(artifacts,"snapshot-"+repeat+".json"),JSON.stringify(await session.renderer("WaveCanvasProject.snapshot()"),null,2));
 const output=path.join(artifacts,'repeat-'+repeat+'.mp4');outputs.push(output);
 await session.evaluate('projectQA.savePaths.push('+JSON.stringify(output)+');true');
 await session.renderer('window.exportQAProgress=[];waveCanvas.export.onProgress(s=>exportQAProgress.push(s));true');
 await session.evaluate('projectQA.window.webContents.executeJavaScript("WaveCanvasExport.start()",true);true');
 for(let i=0;i<600;i++){const done=await session.renderer('exportQAProgress.some(s=>["complete","error","canceled"].includes(s.phase))');if(done)break;await wait(250);}
 const states=await session.renderer('exportQAProgress');await fs.writeFile(path.join(artifacts,'progress-'+repeat+'.json'),JSON.stringify(states,null,2));check(states.some(s=>s.phase==='complete'),'Native output dialog + full UI export '+repeat);
 check(await session.renderer('!WaveCanvasExport.getState().busy&&!document.querySelector("#editor-view").inert'),'Editor lock/playback restored '+repeat);
 const probe=JSON.parse(execFileSync(path.join(root,'vendor/ffmpeg/ffprobe.exe'),['-v','error','-count_frames','-show_streams','-show_format','-of','json',output],{encoding:'utf8',windowsHide:true}));await fs.writeFile(path.join(artifacts,'probe-'+repeat+'.json'),JSON.stringify(probe,null,2));check(probe.streams.some(s=>s.codec_name==='h264'&&s.nb_read_frames==='300'),'Synthetic frame count '+repeat);
}

const results=[0,1].map(i=>JSON.parse(require('fs').readFileSync(path.join(artifacts,'progress-'+i+'.json'))).find(s=>s.result).result);
const tolerances=[];
for(const frame of ['0','60','120']){
 const states=results.map(r=>r.diagnosticStates[frame]);
 check(JSON.stringify(states[0].samples)===JSON.stringify(states[1].samples)&&states[0].canvas===states[1].canvas&&states[0].lyrics===states[1].lyrics,'Identical audio / Canvas / lyric state at frame '+frame);
 const pixels=states.map((s,i)=>{const file=path.join(artifacts,'composite-'+i+'-'+frame+'.png');require('fs').writeFileSync(file,Buffer.from(s.composite,'base64'));return execFileSync(path.join(root,'vendor/ffmpeg/ffmpeg.exe'),['-v','error','-i',file,'-f','rawvideo','-pix_fmt','rgba','-'],{windowsHide:true,maxBuffer:10*1024*1024});});
 let maximum=0,changed=0;for(let i=0;i<pixels[0].length;i++){const delta=Math.abs(pixels[0][i]-pixels[1][i]);maximum=Math.max(maximum,delta);if(delta)changed++;}tolerances.push({frame,maximum,changed,ratio:changed/pixels[0].length});check(maximum<=1&&changed/pixels[0].length<.001,'Full compositor tolerance at frame '+frame+' (max 1/255, <0.1% channels)');
}
const ssim=require('child_process').spawnSync(path.join(root,'vendor/ffmpeg/ffmpeg.exe'),['-i',outputs[0],'-i',outputs[1],'-lavfi','ssim','-f','null','-'],{encoding:'utf8',windowsHide:true});const score=Number(/All:([0-9.]+)/.exec(ssim.stderr)?.[1]);check(score>=.99,'Repeated decoded video SSIM >=0.99');await fs.writeFile(path.join(artifacts,'determinism.json'),JSON.stringify({tolerances,ssim:score,bitIdentical:false,note:'Chromium antialias/compositor rounding within tolerance; semantic states exact'},null,2));
const cancelPath=path.join(artifacts,'canceled.mp4');await fs.writeFile(cancelPath,'existing-target');await session.evaluate('projectQA.savePaths.push('+JSON.stringify(cancelPath)+');true');await session.renderer('exportQAProgress=[];WaveCanvasExport.start();true');await wait(300);await session.renderer('document.querySelector("#export-progress button").click();true');for(let i=0;i<100;i++){if(await session.renderer('!WaveCanvasExport.getState().busy'))break;await wait(100);}
check(await fs.readFile(cancelPath,'utf8')==='existing-target','Cancel preserves an existing output target');check(!(await fs.readdir(artifacts)).some(n=>n.includes('.partial.mp4')),'Cancel cleans partial output after process exit');check(await session.renderer('!document.querySelector("#editor-view").inert'),'Cancel restores Editor');
const missingPath=path.join(artifacts,'missing-ffmpeg.mp4');
await session.evaluate('projectQA.runner=process.getBuiltinModule("module").createRequire('+JSON.stringify(path.join(root,'electron/main.cjs'))+')('+JSON.stringify(path.join(root,'electron/ffmpeg-runner.cjs'))+');projectQA.resolver=projectQA.runner.resolver;projectQA.runner.resolver=()=>'+JSON.stringify(path.join(artifacts,'no-ffmpeg.exe'))+';projectQA.savePaths.push('+JSON.stringify(missingPath)+');true');
await session.renderer('exportQAProgress=[];WaveCanvasExport.start();true');for(let i=0;i<100;i++){if(await session.renderer('!WaveCanvasExport.getState().busy'))break;await wait(100);}
check(await session.renderer('exportQAProgress.some(s=>s.phase==="error"&&s.error.includes("FFmpeg"))&&!document.querySelector("#editor-view").inert'),'Missing FFmpeg error restores Editor');
await session.evaluate('projectQA.runner.resolver=projectQA.resolver;true');
for(const duration of [.01,10]){
const source=path.join(artifacts,'edge-'+duration+'.wav');await fs.writeFile(source,wav(duration));await session.select('#audio-file',source);
const output=path.join(artifacts,'edge-'+duration+'.mp4');await session.evaluate('projectQA.savePaths.push('+JSON.stringify(output)+');true');await session.renderer('exportQAProgress=[];WaveCanvasExport.start();true');for(let i=0;i<1000;i++){if(await session.renderer('!WaveCanvasExport.getState().busy'))break;await wait(100);}
const probe=JSON.parse(execFileSync(path.join(root,'vendor/ffmpeg/ffprobe.exe'),['-v','error','-count_frames','-show_streams','-of','json',output],{encoding:'utf8',windowsHide:true}));await fs.writeFile(path.join(artifacts,'edge-'+duration+'-probe.json'),JSON.stringify(probe,null,2));check(probe.streams.some(s=>s.codec_name==='h264'&&Number(s.nb_read_frames)===Math.ceil(duration*60)),'Full export edge duration '+duration+' frame count');
}
const decodeFile=path.join(artifacts,'bad-audio.wav');await fs.writeFile(decodeFile,'not audio');await session.select('#audio-file',decodeFile);
await session.evaluate('projectQA.savePaths.push('+JSON.stringify(path.join(artifacts,'bad-audio.mp4'))+');true');await session.renderer('exportQAProgress=[];WaveCanvasExport.start();true');for(let i=0;i<100;i++){if(await session.renderer('!WaveCanvasExport.getState().busy'))break;await wait(100);}
check(await session.renderer('exportQAProgress.some(s=>s.phase==="error")&&!document.querySelector("#editor-view").inert'),'Audio decode failure restores Editor');
await session.select('#audio-file',path.join(artifacts,'synthetic-five.wav'));
const failedOutput=path.join(artifacts,'encode-fail.mp4');await fs.writeFile(failedOutput,'keep existing');
await session.evaluate('projectQA.originalArgs=projectQA.runner.args;projectQA.runner.args=()=>["-wavecanvas-invalid-option"];projectQA.savePaths.push('+JSON.stringify(failedOutput)+');true');await session.renderer('exportQAProgress=[];WaveCanvasExport.start();true');for(let i=0;i<200;i++){if(await session.renderer('!WaveCanvasExport.getState().busy'))break;await wait(100);}
check(await fs.readFile(failedOutput,'utf8')==='keep existing'&&await session.renderer('exportQAProgress.some(s=>s.phase==="error")&&!document.querySelector("#editor-view").inert'),'FFmpeg non-zero failure preserves target and restores Editor');await session.evaluate('projectQA.runner.args=projectQA.originalArgs;true');
await session.evaluate('projectQA.savePaths.push('+JSON.stringify(path.join(artifacts,'renderer-crash.mp4'))+');true');await session.renderer('exportQAProgress=[];WaveCanvasExport.start();true');
await session.evaluate('(async()=>{for(let i=0;i<100;i++){const w=projectQA.electron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes("export.html"));if(w){w.webContents.forcefullyCrashRenderer();return true;}await new Promise(r=>setTimeout(r,20));}throw Error("No export renderer");})()');for(let i=0;i<200;i++){if(await session.renderer('!WaveCanvasExport.getState().busy'))break;await wait(100);}
check(await session.renderer('exportQAProgress.some(s=>s.phase==="error")&&!document.querySelector("#editor-view").inert'),'Export renderer crash leaves WaveCanvas alive and restores Editor');
}
for(const [layout,particle] of [['circle',1],['square',2],['linear',1]]){
await session.renderer('VisualizerRuntime.updateStandalone({visualizer:{layout:'+JSON.stringify(layout)+',coverShape:"circle",coverRotationSpeed:-8},background:{mode:"bassPulse"}});VisualizerRuntime.updateProperties({particlestyle:{value:'+particle+'}});true');
const output=path.join(artifacts,'layout-'+layout+'.mp4');
await session.evaluate('(async()=>{const payload=await projectQA.window.webContents.executeJavaScript("WaveCanvasExport.payload()",true);projectQA.layoutDone=false;projectQA.window.waveCanvasExportController.startTest(payload,'+JSON.stringify(output)+',{startTime:0,endTime:2.1}).then(r=>{projectQA.layoutResult=r;projectQA.layoutDone=true},e=>{projectQA.layoutError=e.stack;projectQA.layoutDone=true});return true;})()');for(let i=0;i<400;i++){if(await session.evaluate('projectQA.layoutDone'))break;await wait(100);}
const result=await session.evaluate('({result:projectQA.layoutResult,error:projectQA.layoutError})');await fs.writeFile(path.join(artifacts,'layout-'+layout+'.json'),JSON.stringify(result,null,2));check(!result.error&&result.result?.frames===126,'Export '+layout+' / Particle Style '+particle+' / Bass Pulse');if(result.error)throw Error(result.error);
check(result.result.rawFrameHashes['0']!==result.result.rawFrameHashes['60'],'Animated '+layout+' frame evolves');
}
}catch(e){check(false,e.stack||String(e));}finally{if(session)await session.finish();await fs.writeFile(path.join(artifacts,'results.json'),JSON.stringify({checks},null,2));}console.log(artifacts);process.exitCode=checks.some(c=>!c.pass)?1:0;
}run().catch(e=>{console.error(e);process.exitCode=1});
