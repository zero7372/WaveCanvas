'use strict';
// Test-only Main inspector harness. Dialog responses are controlled; no test hooks ship in app/.
const fs = require('node:fs/promises'), path = require('node:path'), net = require('node:net'), { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), packaged = process.argv.includes('--packaged');
const artifacts = path.join(root, 'dev/tests/artifacts/phase2a-' + (process.argv.find(a=>a.startsWith('--mode='))?.slice(7)||'baseline') + '-' + Date.now());
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
function aggregate(values) { const a=[...values].sort((a,b)=>a-b);return {count:a.length,total:a.reduce((s,v)=>s+v,0),mean:a.reduce((s,v)=>s+v,0)/a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.ceil(a.length*.95)-1],p99:a[Math.ceil(a.length*.99)-1],max:a.at(-1)}; }
const modes={
 'sentinel-stream':{rafCount:0,nativeFrameRate:240,sentinel:true,streamPaint:true},
 'sentinel':{rafCount:0,nativeFrameRate:240,sentinel:true},
 'sentinel-60':{rafCount:0,nativeFrameRate:60,sentinel:true},
 'snapshot-zero':{rafCount:0,nativeFrameRate:60,snapshot:true},
 'snapshot-one':{rafCount:1,nativeFrameRate:60,snapshot:true},
 'snapshot-two':{rafCount:2,nativeFrameRate:60,snapshot:true},
 'snapshot-max':{rafCount:0,nativeFrameRate:240,snapshot:true},
 baseline:{rafCount:2,nativeFrameRate:60,singlePaint:false,discardReadback:true,copyBitmap:true},
 'no-discard-readback':{rafCount:2,nativeFrameRate:60,singlePaint:false,discardReadback:false,copyBitmap:true},
 'owned-buffer':{rafCount:2,nativeFrameRate:60,singlePaint:false,discardReadback:false,copyBitmap:false},
 'single-paint':{rafCount:2,nativeFrameRate:60,singlePaint:true,discardReadback:false,copyBitmap:false},
 'single-explicit':{rafCount:1,nativeFrameRate:60,singlePaint:true,discardReadback:false,copyBitmap:false},
 'zero-raf':{rafCount:0,nativeFrameRate:60,singlePaint:false,discardReadback:false,copyBitmap:false},
 'one-raf':{rafCount:1,nativeFrameRate:60,singlePaint:false,discardReadback:false,copyBitmap:false},
 'max-rate':{rafCount:2,nativeFrameRate:240,singlePaint:false,discardReadback:false,copyBitmap:false},
 'max-rate-single':{rafCount:2,nativeFrameRate:240,singlePaint:true,discardReadback:false,copyBitmap:false},
 production:null
};
function installWitness(){
 const marker=document.createElement('div');marker.id='capture-frame-witness';marker.style.cssText='position:absolute;left:0;top:0;width:16px;height:16px;z-index:2147483647;pointer-events:none;';document.querySelector('#stage').append(marker);
 const clock=window.WaveCanvasExportClock;window.WaveCanvasExportClock=Object.freeze({...clock,advance(seconds){clock.advance(seconds);const index=Math.round(seconds*60),r=index&255,g=(index>>8)&255;marker.style.backgroundColor='rgb('+r+','+g+','+(r^g^165)+')';}});
}
function semanticState(){
 const style=selector=>{const e=document.querySelector(selector),s=getComputedStyle(e);return {transform:s.transform,opacity:s.opacity,filter:s.filter,visibility:s.visibility,display:s.display};};
 return {samples:audioSample.slice(),canvas:document.querySelector('#canvas').toDataURL(),lyrics:document.querySelector('#lyrics-stack').innerHTML,lyricsStyle:style('#lyrics-layer'),songInfo:document.querySelector('#song-info-layer').innerHTML,songInfoStyle:style('#song-info-layer'),background:document.querySelector('#bgimg').style.cssText,particles:JSON.parse(JSON.stringify(window.particles)),particleStyle:JSON.parse(JSON.stringify(window.particleStyle)),bass:{bassShake:window.bassShake,bassEffectMult1:window.bassEffectMult1,bassEffectMult2:window.bassEffectMult2,bassEffectMult5:window.bassEffectMult5},heapBytes:performance.memory?.usedJSHeapSize};
}
async function run(){
 const mode=process.argv.find(a=>a.startsWith('--mode='))?.slice(7)||'baseline';if(!(mode in modes))throw Error('Unknown mode');
 const witness=process.argv.includes('--witness'),full=process.argv.includes('--full');const frameLimit=Number(process.argv.find(a=>a.startsWith('--frames='))?.slice(9)||300);
 await fs.mkdir(artifacts,{recursive:true});let session,sampler;const checks=[],check=(pass,label)=>{checks.push({pass:!!pass,label});console.log((pass?'PASS ':'FAIL ')+label);};
 const real=path.resolve(root,'../Untitled'),before=await manifest(real);const selected=[0,1,2,30,60,120,600],captureFrames=[...new Set(selected.flatMap(n=>[Math.max(0,n-1),n,n+1]))];
 try{
 const profile=path.join(artifacts,'profile');await fs.mkdir(profile);session=await launch(profile);
 await session.evaluate('projectQA.openPaths.push('+JSON.stringify(path.join(real,'Untitled.waveproj'))+');true');check(await session.renderer('WaveCanvasProject.open()'),'Ordinary project loader');
 const snapshot=await session.renderer('WaveCanvasProject.snapshot()');await fs.writeFile(path.join(artifacts,'snapshot.json'),JSON.stringify(snapshot,null,2));
 const duration=await session.renderer('document.querySelector("#local-audio").duration');const count=full?Math.ceil(duration*60):frameLimit;
 await fs.writeFile(path.join(artifacts,'config.json'),JSON.stringify({mode,options:modes[mode],witness,count,selected},null,2));
 const setup=`(()=>{const req=process.getBuiltinModule('module').createRequire(${JSON.stringify(path.join(root,'electron/main.cjs'))}),render=req('./export-render-window.cjs'),ff=req('./ffmpeg-runner.cjs');const create=render.create,experimentCreate=req(${JSON.stringify(path.join(root,'dev/tools/capture-experiments.cjs'))}).create,run=ff.run;projectQA.samples=[];projectQA.states={};projectQA.witnessErrors=[];projectQA.capturePids=[];projectQA.encoderPid=null;
 render.create=async()=>{const r=await ${mode==="production"?"create()":"experimentCreate("+JSON.stringify(modes[mode])+")"};projectQA.capturePids=projectQA.electron.app.getAppMetrics().map(p=>p.pid);const prepare=r.prepare.bind(r),capture=r.capture.bind(r);r.prepare=async()=>{const info=await prepare();${witness?'await r.execute('+JSON.stringify('('+installWitness.toString()+')()')+');':''}return info;};r.capture=async index=>{const marks={},t=performance.now(),frame=await capture(index,marks);marks.captureMs=performance.now()-t;projectQA.samples.push(marks);
 ${witness?`const offset=(8*1920+8)*4,rgb=[index&255,(index>>8)&255,(index&255)^((index>>8)&255)^165];if(frame[offset+2]!==rgb[0]||frame[offset+1]!==rgb[1]||frame[offset]!==rgb[2])projectQA.witnessErrors.push({index,actual:[frame[offset+2],frame[offset+1],frame[offset]],expected:rgb});`:''}
 if(${JSON.stringify(captureFrames)}.includes(index))process.getBuiltinModule('fs').writeFileSync(${JSON.stringify(artifacts)}+'/raw-'+index+'.png',projectQA.electron.nativeImage.createFromBitmap(frame,{width:1920,height:1080}).toPNG());
 if(${JSON.stringify(selected)}.includes(index))projectQA.states[index]=await r.execute(${JSON.stringify('('+semanticState.toString()+')()')});return frame;};return r;};
 ff.run=(...args)=>{const r=run(...args),write=r.write.bind(r);projectQA.encoderPid=r.child.pid;r.write=async frame=>{const t=performance.now();await write(frame);projectQA.samples.at(-1).stdinMs=performance.now()-t;};return r;};return true;})()`;
 await session.evaluate(setup);
 const processScript=path.join(artifacts,'sample-processes.ps1');await fs.writeFile(processScript,'while ($true) { $items = Get-Process -Name electron,WaveCanvas,ffmpeg -ErrorAction SilentlyContinue; [pscustomobject]@{timestamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();processes=@($items | Select-Object Id,ProcessName,CPU,WorkingSet64)} | ConvertTo-Json -Compress -Depth 4; Start-Sleep -Seconds 1 }');
 sampler=spawn('powershell.exe',['-NoProfile','-File',processScript],{windowsHide:true});sampler.stdout.pipe(require('fs').createWriteStream(path.join(artifacts,'process-samples.jsonl')));sampler.stderr.on('data',()=>{});
 const output=path.join(artifacts,'export.mp4');await session.evaluate('(async()=>{const payload=await projectQA.window.webContents.executeJavaScript("WaveCanvasExport.payload()",true);projectQA.exportFinished=false;projectQA.window.waveCanvasExportController.startTest(payload,'+JSON.stringify(output)+','+(full?'undefined':JSON.stringify({startTime:0,endTime:count/60}))+').then(r=>{projectQA.exportResult=r;projectQA.exportFinished=true;},e=>{projectQA.exportError=e.stack;projectQA.exportFinished=true;});return true;})()');
 for(let i=0;i<2400;i++){if(await session.evaluate('projectQA.exportFinished'))break;await wait(500);if(i%60===0)console.log(mode+' capture working...');}
 sampler.kill();
 const result=await session.evaluate('({result:projectQA.exportResult,error:projectQA.exportError,samples:projectQA.samples,states:projectQA.states,witnessErrors:projectQA.witnessErrors,capturePids:projectQA.capturePids,encoderPid:projectQA.encoderPid})');await fs.writeFile(path.join(artifacts,'benchmark.json'),JSON.stringify(result,null,2));
 check(!result.error&&result.result?.frames===count,'Exact '+count+' frame export');if(result.error)throw Error(result.error);
 if(witness)check(!result.witnessErrors.length,'Every-frame compositor identity witness matches current frame ('+result.witnessErrors.length+' errors)');
 const breakdown={};for(const key of Object.keys(result.samples[0]))if(key.endsWith('Ms'))breakdown[key]=aggregate(result.samples.map(s=>s[key]||0));
 const rows=(await fs.readFile(path.join(artifacts,'process-samples.jsonl'),'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);const ffmpegMemory=Math.max(0,...rows.flatMap(r=>r.processes.filter(p=>p.Id===result.encoderPid).map(p=>p.WorkingSet64)));const heap=Math.max(0,...Object.values(result.states).map(s=>s.heapBytes||0));
 await fs.writeFile(path.join(artifacts,'aggregate.json'),JSON.stringify({mode,witness,count,breakdown,result:result.result,peakFFmpegWorkingSetBytes:ffmpegMemory,selectedPeakJSHeapBytes:heap},null,2));
 const ffprobe=path.join(root,'vendor/ffmpeg/ffprobe.exe'),probe=JSON.parse(execFileSync(ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',output],{encoding:'utf8',windowsHide:true}));await fs.writeFile(path.join(artifacts,'ffprobe.json'),JSON.stringify(probe,null,2));const v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.find(s=>s.codec_type==='audio');check(v.codec_name==='h264'&&v.width===1920&&v.height===1080&&v.r_frame_rate==='60/1'&&Number(v.nb_read_frames)===count&&a.codec_name==='aac','H264 / 1080p60 / exact decoded frames / AAC');check(Math.abs(Number(v.duration)-Number(a.duration))<=1/60,'A/V endpoint difference within one frame');
 }catch(e){check(false,e.stack||String(e));}finally{sampler?.kill();if(session)await session.finish();check(JSON.stringify(before)===JSON.stringify(await manifest(real)),'Source hash / size / mtime unchanged');await fs.writeFile(path.join(artifacts,'results.json'),JSON.stringify({checks},null,2));}
 console.log(artifacts);process.exitCode=checks.some(c=>!c.pass)?1:0;
}
run().catch(e=>{console.error(e);process.exitCode=1});
