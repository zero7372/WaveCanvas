'use strict';
// Test-only Main inspector harness. Dialog responses are controlled; no test hooks ship in app/.
const fs = require('node:fs/promises'), path = require('node:path'), net = require('node:net'), { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), packaged = process.argv.includes('--packaged');
const artifacts = path.join(root, 'dev/tests/artifacts/browser-regression-' + Date.now());
process.env.ELECTRON_CACHE = path.join(root, '.electron-cache'); process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function launch(profile) {
    const port = await freePort(), exe = packaged ? path.join(root, 'dist/win-unpacked/WaveCanvas.exe') : require('electron');
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

async function run(){await fs.mkdir(artifacts,{recursive:true});let session,server;const results=[];
try{const port=await freePort();let serverArgs=[path.join(root,'dev/tools/serve.cjs')];
if(process.argv.includes('--baseline')){
 const {execFileSync}=require('node:child_process'), baseline='a09cc58179a4af2d153cdda8783492e1fcd2bf0c',baselineRoot=path.join(artifacts,'baseline');
 const files=execFileSync('git',['ls-tree','-r','--name-only',baseline,'app'],{cwd:root,encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/);
 for(const file of files){const target=path.resolve(baselineRoot,file);if(!target.startsWith(baselineRoot+path.sep))throw Error('Invalid baseline path');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,execFileSync('git',['show',baseline+':'+file],{cwd:root,windowsHide:true,maxBuffer:10*1024*1024}));}
 const source=(await fs.readFile(path.join(root,'dev/tools/serve.cjs'),'utf8')).replace("const root = path.resolve(__dirname, '..', '..');",'const root = '+JSON.stringify(root)+';').replace("const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));","const target = path.resolve(url.pathname.startsWith('/app/') ? "+JSON.stringify(baselineRoot)+" : root, '.' + decodeURIComponent(url.pathname));").replace('const relative = path.relative(root, target);','const relative = path.relative(url.pathname.startsWith("/app/") ? '+JSON.stringify(baselineRoot)+' : root, target);');
 serverArgs=['-e',source];await fs.writeFile(path.join(artifacts,'baseline.json'),JSON.stringify({commit:baseline,appFiles:files.length,testFiles:'current regression tests including corrected selectors'},null,2));
}
server=spawn(process.execPath,serverArgs,{cwd:root,env:{...process.env,PORT:String(port)},windowsHide:true});server.stderr.on('data',()=>{});
for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:'+port+'/app/index.html')).ok)break;}catch{}await wait(100);}
const profile=path.join(artifacts,'profile');await fs.mkdir(profile);session=await launch(profile);
await session.evaluate('projectQA.browser=new projectQA.electron.BrowserWindow({width:1400,height:1000,show:true,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false,partition:"browser-regression"}});true');
const browser = code => session.evaluate('projectQA.browser.webContents.executeJavaScript('+JSON.stringify(code)+',true)');
for(const page of ['browser.html','repository-smoke.html','factory-defaults-browser.html','srt-browser.html','linear-cover-browser.html','templates-browser.html']){
 await session.evaluate('projectQA.browser.loadURL('+JSON.stringify('http://127.0.0.1:'+port+'/dev/tests/'+page)+').then(()=>true)');
 await browser('document.querySelector("#run").click();true');let output='';
 for(let i=0;i<600;i++){output=await browser('document.querySelector("#results").textContent');if(output.includes('DONE'))break;await wait(500);}
 const passes=(output.match(/^PASS /gm)||[]).length,failures=(output.match(/^FAIL /gm)||[]).length,pass=output.includes('DONE')&&!failures;results.push({page,passes,failures,pass});await fs.writeFile(path.join(artifacts,page+'.txt'),output);console.log((pass?'PASS ':'FAIL ')+page+' '+passes+' passed / '+failures+' failed');
}
await session.evaluate('projectQA.browser.destroy();true');
}catch(e){results.push({pass:false,error:e.stack});console.error(e);}finally{if(session)await session.finish();server?.kill();await fs.writeFile(path.join(artifacts,'results.json'),JSON.stringify(results,null,2));}
console.log(artifacts);process.exitCode=results.some(r=>!r.pass)?1:0;}
run().catch(e=>{console.error(e);process.exitCode=1});
