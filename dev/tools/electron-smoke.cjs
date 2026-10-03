'use strict';
// Test-only Main Process inspector driver. No test hooks or bridge ship in the app.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),packaged=process.argv.includes('--packaged'),devToolsMode=process.argv.includes('--devtools'),tag=packaged?'packaged':devToolsMode?'devtools':'development';
process.env.ELECTRON_CACHE=path.join(root,'.electron-cache');process.env.electron_config_cache=process.env.ELECTRON_CACHE;
const artifacts=path.join(root,'dev/tests/artifacts/electron-'+tag);fs.mkdirSync(artifacts,{recursive:true});
const downloads=path.join(artifacts,'downloads-'+Date.now());fs.mkdirSync(downloads);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
async function run(){
 const profile=path.join(artifacts,'profile-'+Date.now());fs.mkdirSync(profile);
 const port=await freePort(),exe=packaged?(process.env.WAVECANVAS_QA_EXE || path.join(root, 'dist/win-unpacked/WaveCanvas.exe')):require('electron');
 const args=packaged?[]:['.',...(devToolsMode?['--dev']:[])],env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(exe,['--inspect=127.0.0.1:'+port,'--user-data-dir='+profile,...args],{cwd:root,env,windowsHide:false});let output='',exited=false;
 child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);child.on('exit',()=>exited=true);
 const pending=new Map();let socket,serial=0;const report={tag,checks:[]};
 try{
  const deadline=Date.now()+15000;let target;
  while(Date.now()<deadline&&!target&&!exited){try{target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json())[0];}catch{}await wait(80);}
  if(!target)throw Error('Main inspector unavailable: '+output);
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(pending.has(message.id)){const item=pending.get(message.id);pending.delete(message.id);message.error?item.reject(Error(message.error.message)):item.resolve(message.result);}});
  async function evaluate(expression){const id=++serial;const response=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Inspector evaluation timeout'));},30000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description||JSON.stringify(response.exceptionDetails));return response.result?.value;}
  const mainFile=packaged?path.join(path.dirname(process.env.WAVECANVAS_QA_EXE || path.join(root, 'dist/win-unpacked/WaveCanvas.exe')), 'resources/app.asar/electron/main.cjs'):path.join(root,'electron/main.cjs');
  await evaluate(`globalThis.wcQA={electron:process.getBuiltinModule('module').createRequire(${JSON.stringify(mainFile)})('electron'),downloads:[]};wcQA.electron.app.setPath('userData',${JSON.stringify(profile)}); 'ready'`);
  await evaluate(`(async()=>{for(let i=0;i<150;i++){const w=wcQA.electron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('index.html'));if(w&&!w.webContents.isLoading()){wcQA.window=w;return true;}await new Promise(r=>setTimeout(r,50));}throw Error('Window did not load');})()`);
  await evaluate(`(async()=>{for(let i=0;i<150;i++){if(wcQA.window.isVisible() && (!${devToolsMode} || wcQA.window.webContents.isDevToolsOpened()))return true;await new Promise(r=>setTimeout(r,50));}throw Error('Window / DevTools visibility: '+JSON.stringify({visible:wcQA.window.isVisible(),devTools:wcQA.window.webContents.isDevToolsOpened(),argv:process.argv,title:wcQA.window.getTitle()}));})()`);
  const security=await evaluate(`({preferences:wcQA.window.webContents.getLastWebPreferences(),versions:process.versions,title:wcQA.window.getTitle(),devTools:wcQA.window.webContents.isDevToolsOpened()})`);report.versions=security.versions;
  const check=(pass,label)=>report.checks.push({pass:Boolean(pass),label});
  check(security.preferences.contextIsolation&&!security.preferences.nodeIntegration&&security.preferences.sandbox,'contextIsolation / no Node / sandbox');check(security.title==='Untitled — WaveCanvas'&&security.devTools===devToolsMode,devToolsMode?'Dev mode automatically opens DevTools':'Project title / no auto DevTools in start or build');
  await evaluate(`wcQA.electron.session.defaultSession.on('will-download',(_event,item)=>{item.setSavePath(${JSON.stringify(downloads)}+'/'+item.getFilename());item.once('done',(_event,state)=>wcQA.downloads.push({name:item.getFilename(),state}));});true`);
  const source=fs.readFileSync(path.join(root,'dev/tests/electron-renderer-smoke.js'),'utf8');
  const result=await evaluate(`wcQA.window.webContents.executeJavaScript(${JSON.stringify(source+'\nelectronRendererSmoke()')},true)`);report.checks.push(...result.checks);
  await wait(500);report.downloads=await evaluate('wcQA.downloads');
  check(report.downloads.length===2&&report.downloads.every(item=>item.state==='completed'),'Preset and LRC downloads complete');
  for(const item of report.downloads){const text=fs.readFileSync(path.join(downloads,item.name),'utf8');check(item.name.endsWith('.json')?JSON.parse(text).format==='audio-visualizer-preset':text.includes('主要中文'),'Downloaded '+item.name+' contains valid Unicode data');}
  const imports=[['#audio-file','dev/tests/fixtures/integration-tone.wav'],['#setting-logoimage','app/assets/wavecanvas.png'],['#lyrics-file','dev/tests/fixtures/electron-primary.lrc'],['#lyrics-secondary-file','dev/tests/fixtures/electron-secondary.srt']];
  for(const [selector,file] of imports) await evaluate(`(async()=>{const d=wcQA.window.webContents.debugger;d.attach('1.3');try{const tree=await d.sendCommand('DOM.getDocument');const node=await d.sendCommand('DOM.querySelector',{nodeId:tree.root.nodeId,selector:${JSON.stringify(selector)}});await d.sendCommand('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[${JSON.stringify(path.join(root,file))}]});}finally{d.detach();}})()`);
  await wait(250);
  check(await evaluate(`wcQA.window.webContents.executeJavaScript("document.querySelector('#local-audio').readyState>=2 && VisualizerFiles.getName('logoimage')==='wavecanvas.png' && VisualizerLyrics.getEvent(0).secondary==='Open the gate'")`),'On-disk WAV / PNG / LRC / SRT import via unchanged HTML file inputs');
  await evaluate(`wcQA.window.webContents.executeJavaScript("document.querySelector('#local-audio').currentTime=1.5;VisualizerLyrics.update('seek');VisualizerTimingEditor.select('primary',VisualizerLyrics.getDocument('primary').events[0].id);true")`);
  await evaluate('wcQA.window.minimize();true');await wait(200);check(await evaluate('wcQA.window.isMinimized()'),'Minimize');
  const second=spawn(exe,['--user-data-dir='+profile,...args],{cwd:root,env,windowsHide:false});const secondCode=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{second.kill();reject(Error('Second instance timeout'));},5000);second.on('exit',code=>{clearTimeout(timer);resolve(code);});});await wait(200);
  check(secondCode===0&&await evaluate("!wcQA.window.isMinimized() && wcQA.window.isFocused() && wcQA.electron.BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('index.html')).length===1"),'Single instance restores and focuses first window');
  await evaluate('wcQA.window.maximize();true');await wait(250);check(await evaluate('wcQA.window.isMaximized()'),'Maximize');
  await evaluate('wcQA.window.unmaximize();wcQA.window.setSize(1100,740);true');await wait(250);
  check(await evaluate('!wcQA.window.isMaximized()'),'Restore');
  const stage=await evaluate(`wcQA.window.webContents.executeJavaScript("(()=>{const r=document.querySelector('#stage').getBoundingClientRect(),t=document.querySelector('#transport').getBoundingClientRect();return {ratio:r.width/r.height,within:t.bottom<=innerHeight};})()")`);check(Math.abs(stage.ratio-16/9)<.01&&stage.within,'Resize keeps stage 16:9 and Transport within viewport');
  await evaluate(`wcQA.window.webContents.capturePage().then(image=>process.getBuiltinModule('fs').writeFileSync(${JSON.stringify(path.join(artifacts,'editor.png'))},image.toPNG()))`);
  await evaluate('wcQA.electron.dialog.showMessageBox=async()=>({response:1});setTimeout(()=>wcQA.window.close(),100);true');socket.close();socket=null;const closeDeadline=Date.now()+5000;while(!exited&&Date.now()<closeDeadline)await wait(50);check(exited,'Closing dirty primary window with discard exits process');
 }catch(error){report.checks.push({pass:false,label:error.stack||String(error)});}finally{if(socket)socket.close();if(!exited)child.kill();fs.writeFileSync(path.join(artifacts,'console.txt'),output);fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify(report,null,2));}
 for(const item of report.checks)console.log((item.pass?'PASS ':'FAIL ')+item.label);const failures=report.checks.filter(item=>!item.pass).length;console.log('Electron '+tag+': '+(report.checks.length-failures)+' passed / '+failures+' failed');process.exitCode=failures?1:0;
}
run().catch(error=>{console.error(error);process.exitCode=1;});
