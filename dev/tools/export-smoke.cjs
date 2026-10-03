'use strict';
// Test-only Main inspector harness. Dialog responses are controlled; no test hooks ship in app/.
const fs = require('node:fs/promises'), path = require('node:path'), net = require('node:net'), { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), packaged = process.argv.includes('--packaged');
const testFFmpeg = process.env.WAVECANVAS_TEST_FFMPEG || path.join(root,'vendor/ffmpeg/ffmpeg.exe');
const testFFprobe = path.join(path.dirname(testFFmpeg),'ffprobe.exe');
const artifacts = path.join(root, 'dev/tests/artifacts/export-' + (packaged ? 'packaged' : 'development') + '-' + Date.now());
process.env.ELECTRON_CACHE = path.join(root, '.electron-cache'); process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function launch(profile) {
    const port = await freePort(), exe = packaged ? (process.env.WAVECANVAS_QA_EXE || path.join(root, 'dist/win-unpacked/WaveCanvas.exe')) : require('electron');
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(exe, ['--inspect=127.0.0.1:' + port, '--user-data-dir=' + profile, ...(packaged ? [] : ['.'])], { cwd: root, env, windowsHide: false });
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
    const main = packaged ? path.join(path.dirname(process.env.WAVECANVAS_QA_EXE || path.join(root, 'dist/win-unpacked/WaveCanvas.exe')), 'resources/app.asar/electron/main.cjs') : path.join(root, 'electron/main.cjs');
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
async function run(){
 await fs.mkdir(artifacts,{recursive:true});let session;
 const real=path.resolve(root,'../Untitled'),before=await manifest(real),file=path.join(real,'Untitled.waveproj');
 const checks=[],check=(pass,label)=>{checks.push({pass:!!pass,label});console.log((pass?'PASS ':'FAIL ')+label);};
 try{
 const profile=path.join(artifacts,'profile');await fs.mkdir(profile);session=await launch(profile);
 if(process.env.WAVECANVAS_TEST_FFMPEG){
 const runtime=packaged?path.join(path.dirname(process.env.WAVECANVAS_QA_EXE||path.join(root,'dist/win-unpacked/WaveCanvas.exe')),'resources/app.asar/electron/ffmpeg-runner.cjs'):path.join(root,'electron/ffmpeg-runner.cjs');
 await session.evaluate('process.getBuiltinModule("module").createRequire('+JSON.stringify(runtime)+')('+JSON.stringify(runtime)+').resolver=()=>'+JSON.stringify(testFFmpeg)+';true');
 }
 await session.evaluate('projectQA.openPaths.push('+JSON.stringify(file)+');true');
 check(await session.renderer('WaveCanvasProject.open()'),'Real project opens through ordinary loader');
 const original=JSON.parse(await fs.readFile(file,'utf8'));
 const restored=await session.renderer('({snapshot:WaveCanvasProject.snapshot(),audio:{duration:document.querySelector("#local-audio").duration,ready:document.querySelector("#local-audio").readyState},cover:VisualizerFiles.getName("logoimage"),background:VisualizerFiles.getName("backgroundimage"),primary:VisualizerLyrics.getDocument("primary"),secondary:VisualizerLyrics.getDocument("secondary")})');
 await fs.writeFile(path.join(artifacts,'restored.json'),JSON.stringify(restored,null,2));
 check(Object.keys(original.state.media).every(key=>restored.snapshot.state.media[key]===original.state.media[key]),'Current saved media/lyrics references preserved verbatim');
 check(JSON.stringify(restored.primary)===JSON.stringify(original.state.lyrics.primary)&&JSON.stringify(restored.secondary)===JSON.stringify(original.state.lyrics.secondary),'Both serialized edited lyric documents restored exactly');
 check(restored.audio.ready>=2&&restored.cover&&restored.background,'Audio and images decode');
 await session.renderer('WaveCanvasShell.showView("EDITOR");document.querySelector("#local-audio").currentTime=30;VisualizerLyrics.update("seek");true');
 await session.evaluate('projectQA.window.webContents.capturePage().then(image=>process.getBuiltinModule("fs").writeFileSync('+JSON.stringify(path.join(artifacts,'preview.png'))+',image.toPNG()))');
 const full=process.argv.includes('--full');const output=path.join(artifacts,full?'real-full.mp4':'real-short.mp4');
 await session.evaluate('(async()=>{const payload=await projectQA.window.webContents.executeJavaScript("WaveCanvasExport.payload()",true);projectQA.exportFinished=false;projectQA.window.waveCanvasExportController.startTest(payload,'+JSON.stringify(output)+',{startTime:0,endTime:'+ (full?restored.audio.duration:5)+'}).then(r=>{projectQA.exportResult=r;projectQA.exportFinished=true;},e=>{projectQA.exportError=e.stack;projectQA.exportFinished=true;});return true;})()');
 for(let i=0;i<1800;i++){if(await session.evaluate('projectQA.exportFinished'))break;await wait(500);if(i%60===0)console.log('Export working...');}
 const result=await session.evaluate('({result:projectQA.exportResult,error:projectQA.exportError})');await fs.writeFile(path.join(artifacts,'export-result.json'),JSON.stringify(result,null,2));check(!result.error&&result.result?.frames===(full?Math.ceil(restored.audio.duration*60):300),'Real project '+(full?'full':'short')+' export succeeds');if(result.error)throw Error(result.error);
 const ffprobe=testFFprobe;const {execFileSync}=require('child_process');
 const probe=JSON.parse(execFileSync(ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',output],{encoding:'utf8',windowsHide:true}));await fs.writeFile(path.join(artifacts,'ffprobe.json'),JSON.stringify(probe,null,2));
 const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');check(video.codec_name==='h264'&&video.width===1920&&video.height===1080&&video.r_frame_rate==='60/1'&&Number(video.nb_read_frames)===(full?Math.ceil(restored.audio.duration*60):300)&&audio.codec_name==='aac','ffprobe H.264 / 1080p / 60 FPS / '+(full?Math.ceil(restored.audio.duration*60):300)+' frames / AAC');
 execFileSync(testFFmpeg,['-v','error','-i',output,'-vf','select=eq(n\\,120)','-frames:v','1',path.join(artifacts,'frame-120.png')],{windowsHide:true});
 }catch(e){check(false,e.stack||String(e));}finally{if(session)await session.finish();check(JSON.stringify(before)===JSON.stringify(await manifest(real)),'Real project files hashes/size/mtime unchanged');await fs.writeFile(path.join(artifacts,'results.json'),JSON.stringify({checks},null,2));}
 console.log(artifacts);process.exitCode=checks.some(c=>!c.pass)?1:0;
}
run().catch(e=>{console.error(e);process.exitCode=1});
