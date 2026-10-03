'use strict';
// Test-only Main inspector harness. Dialog responses are controlled; no test hooks ship in app/.
const fs = require('node:fs/promises'), path = require('node:path'), net = require('node:net'), { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), packaged = process.argv.includes('--packaged');
const artifacts = path.join(root, 'dev/tests/artifacts/home-benchmark-' + Date.now());
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

async function manifest(directory){const result={};for(const e of await fs.readdir(directory,{withFileTypes:true})){const f=path.join(directory,e.name);if(e.isDirectory())Object.assign(result,await manifest(f));else{const stat=await fs.stat(f);result[f]={size:stat.size,mtime:stat.mtimeMs,hash:require('crypto').createHash('sha256').update(await fs.readFile(f)).digest('hex')};}}return result;}
const {execFileSync}=require('node:child_process');
function aggregate(values) { const a=[...values].sort((a,b)=>a-b);return {count:a.length,mean:a.reduce((s,v)=>s+v,0)/a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.ceil(a.length*.95)-1],p99:a[Math.ceil(a.length*.99)-1],max:a.at(-1)}; }
async function run(){
 await fs.mkdir(artifacts,{recursive:true});let session;const checks=[],check=(pass,label)=>{checks.push({pass:!!pass,label});console.log((pass?'PASS ':'FAIL ')+label);};
 const real=path.resolve(root,'../Untitled'),before=await manifest(real),file=path.join(real,'Untitled.waveproj');
 const mode=process.argv.includes('--nvenc')?'nvenc':'libx264';
 const ffmpeg=path.join(root,'vendor/ffmpeg/ffmpeg.exe'),ffprobe=path.join(root,'vendor/ffmpeg/ffprobe.exe');
 let gpuSampler,processSampler;
 try{
 const profile=path.join(artifacts,'profile');await fs.mkdir(profile);session=await launch(profile);
 await session.evaluate('projectQA.openPaths.push('+JSON.stringify(file)+');true');check(await session.renderer('WaveCanvasProject.open()'),'Normal project loader');
 const payload=await session.renderer('WaveCanvasExport.payload()');await fs.writeFile(path.join(artifacts,'snapshot.json'),JSON.stringify(payload.snapshot,null,2));
 const original=JSON.parse(await fs.readFile(file,'utf8'));check(JSON.stringify(payload.snapshot.state.lyrics)===JSON.stringify(original.state.lyrics),'Edited lyrics preserved');
 const gpu=await session.evaluate('(async()=>({featureStatus:projectQA.electron.app.getGPUFeatureStatus(),info:await projectQA.electron.app.getGPUInfo("complete"),versions:process.versions}))()');await fs.writeFile(path.join(artifacts,'gpu.json'),JSON.stringify(gpu,null,2));
 if(mode==='nvenc'){
 const help=execFileSync(ffmpeg,['-hide_banner','-h','encoder=h264_nvenc'],{encoding:'utf8',windowsHide:true});await fs.writeFile(path.join(artifacts,'nvenc-help.txt'),help);
 execFileSync(ffmpeg,['-hide_banner','-v','error','-f','lavfi','-i','color=c=black:s=1920x1080:r=60','-frames:v','60','-c:v','h264_nvenc','-preset','p6','-rc','vbr','-cq','18','-b:v','0','-pix_fmt','yuv420p','-f','null','-'],{windowsHide:true});check(true,'NVENC actual 1080p60 encoding probe');
 }
 const setup=`(()=>{const req=process.getBuiltinModule('module').createRequire(${JSON.stringify(path.join(root,'electron/main.cjs'))});const render=req('./export-render-window.cjs'),ff=req('./ffmpeg-runner.cjs');projectQA.samples=[];projectQA.states={};projectQA.originalCreate=render.create;projectQA.originalRun=ff.run;projectQA.originalArgs=ff.args;
 render.create=async()=>{const r=await projectQA.originalCreate();const capture=r.capture.bind(r);r.capture=async index=>{const marks={},t=performance.now();const frame=await capture(index,marks);marks.captureMs=performance.now()-t;projectQA.samples.push(marks);if([0,60,120].includes(index)){projectQA.states[index]=await r.execute('({samples:audioSample.slice(),background:document.querySelector("#bgimg").style.cssText,lyrics:document.querySelector("#lyrics-stack").innerHTML,canvas:document.querySelector("#canvas").toDataURL(),settings:VisualizerRuntime.getSettings()})');process.getBuiltinModule('fs').writeFileSync(${JSON.stringify(artifacts)}+'/raw-'+index+'.png',projectQA.electron.nativeImage.createFromBitmap(frame,{width:1920,height:1080}).toPNG());}return frame;};return r;};
 ff.run=(...args)=>{const r=projectQA.originalRun(...args),write=r.write.bind(r);r.write=async frame=>{const t=performance.now();await write(frame);projectQA.samples.at(-1).stdinMs=performance.now()-t;};return r;};
 ${mode==='nvenc'?`ff.args=(...args)=>{const a=projectQA.originalArgs(...args),i=a.indexOf('-c:v');a.splice(i,6,'-c:v','h264_nvenc','-preset','p6','-rc','vbr','-cq','18','-b:v','0');return a;};`:''}return true;})()`;
 await session.evaluate(setup);
 const gpuLog=require('fs').createWriteStream(path.join(artifacts,'gpu-samples.csv'));gpuSampler=spawn('nvidia-smi',['--query-gpu=timestamp,utilization.gpu,utilization.encoder,memory.used','--format=csv,noheader,nounits','-l','1'],{windowsHide:true});gpuSampler.stdout.pipe(gpuLog);gpuSampler.stderr.on('data',()=>{});
 const processScript=path.join(artifacts,'sample-processes.ps1');await fs.writeFile(processScript,`while ($true) { $items = Get-Process -Name electron,ffmpeg -ErrorAction SilentlyContinue; $record = [pscustomobject]@{timestamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();processes=@($items | Select-Object Id,ProcessName,CPU,WorkingSet64)}; $record | ConvertTo-Json -Compress -Depth 4; Start-Sleep -Seconds 1 }`);
 const procLog=require('fs').createWriteStream(path.join(artifacts,'process-samples.jsonl'));processSampler=spawn('powershell.exe',['-NoProfile','-File',processScript],{windowsHide:true});processSampler.stdout.pipe(procLog);processSampler.stderr.on('data',()=>{});
 const output=path.join(artifacts,mode+'.mp4');await session.evaluate('(async()=>{const payload=await projectQA.window.webContents.executeJavaScript("WaveCanvasExport.payload()",true);projectQA.exportFinished=false;projectQA.window.waveCanvasExportController.startTest(payload,'+JSON.stringify(output)+').then(r=>{projectQA.exportResult=r;projectQA.exportFinished=true;},e=>{projectQA.exportError=e.stack;projectQA.exportFinished=true;});return true;})()');
 for(let i=0;i<2400;i++){if(await session.evaluate('projectQA.exportFinished'))break;await wait(500);if(i%60===0)console.log(mode+' export working...');}
 gpuSampler.kill();processSampler.kill();
 const result=await session.evaluate('({result:projectQA.exportResult,error:projectQA.exportError,samples:projectQA.samples,states:projectQA.states})');await fs.writeFile(path.join(artifacts,'benchmark.json'),JSON.stringify(result,null,2));check(!result.error&&result.result?.frames===3612,'Full 3612 frame export');if(result.error)throw Error(result.error);
 const breakdown={};for(const key of Object.keys(result.samples[0]))breakdown[key]=aggregate(result.samples.map(s=>s[key]));await fs.writeFile(path.join(artifacts,'aggregate.json'),JSON.stringify({mode,breakdown,result:result.result},null,2));
 const probe=JSON.parse(execFileSync(ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',output],{encoding:'utf8',windowsHide:true}));await fs.writeFile(path.join(artifacts,'ffprobe.json'),JSON.stringify(probe,null,2));const v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.find(s=>s.codec_type==='audio');check(v.codec_name==='h264'&&v.width===1920&&v.height===1080&&v.r_frame_rate==='60/1'&&Number(v.nb_read_frames)===3612&&a.codec_name==='aac','H264 / 1080p60 / 3612 frames / AAC');check(Math.abs(Number(v.duration)-Number(a.duration))<=1/60,'A/V duration difference within one frame');
 for(const frame of [0,60,120])execFileSync(ffmpeg,['-v','error','-i',output,'-vf','select=eq(n\\,'+frame+')','-frames:v','1',path.join(artifacts,'decoded-'+frame+'.png')],{windowsHide:true});
 }catch(e){check(false,e.stack||String(e));}finally{gpuSampler?.kill();processSampler?.kill();if(session)await session.finish();check(JSON.stringify(before)===JSON.stringify(await manifest(real)),'Source hashes / sizes / mtimes unchanged');await fs.writeFile(path.join(artifacts,'results.json'),JSON.stringify({checks},null,2));}
 console.log(artifacts);process.exitCode=checks.some(c=>!c.pass)?1:0;
}
run().catch(e=>{console.error(e);process.exitCode=1});
