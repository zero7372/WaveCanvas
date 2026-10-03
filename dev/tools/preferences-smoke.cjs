'use strict';
// Test-only Main inspector harness. Dialog responses are controlled; no test hooks ship in app/.
const fs = require('node:fs/promises'), path = require('node:path'), net = require('node:net'), { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), packaged = process.argv.includes('--packaged');
const artifacts = path.join(root, 'dev/tests/artifacts/preferences-' + (packaged ? 'packaged' : 'development') + '-' + Date.now());
process.env.ELECTRON_CACHE = path.join(root, '.electron-cache'); process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function launch(profile, extraArguments = [], shellProject = null) {
    const port = await freePort(), exe = packaged ? (process.env.WAVECANVAS_QA_EXE || path.join(root, 'dist/win-unpacked/WaveCanvas.exe')) : require('electron');
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const args = ['--inspect=127.0.0.1:' + port, '--user-data-dir=' + profile, ...(packaged ? [] : ['.']), ...extraArguments];
    const quotePS = value => "'" + value.replace(/'/g, "''") + "'";
    let restoreAssociation = () => {};
    if (shellProject) {
        const { execFileSync } = require('node:child_process');
        if (/\.lnk$/i.test(shellProject)) {
            const shortcut = `$s=(New-Object -ComObject WScript.Shell).CreateShortcut(${quotePS(shellProject)});`;
            const original = execFileSync('powershell.exe',['-NoProfile','-Command',shortcut+'$s.Arguments'],{encoding:'utf8',windowsHide:true}).trim();
            const argument = '"--inspect=127.0.0.1:' + port + '" "--user-data-dir=' + profile + '"';
            execFileSync('powershell.exe',['-NoProfile','-Command',shortcut+`$s.Arguments=${quotePS(argument)};$s.Save()`],{windowsHide:true});
            restoreAssociation = () => execFileSync('powershell.exe',['-NoProfile','-Command',shortcut+`$s.Arguments=${quotePS(original)};$s.Save()`],{windowsHide:true});
        } else {
        const key = 'HKCU:\\Software\\Classes\\WaveCanvas.Project\\shell\\open\\command';
        const original = execFileSync('powershell.exe', ['-NoProfile','-Command',`(Get-Item ${quotePS(key)}).GetValue('')`], {encoding:'utf8',windowsHide:true}).trim();
        const command = '"' + exe + '" "--inspect=127.0.0.1:' + port + '" "--user-data-dir=' + profile + '" "%1"';
        execFileSync('powershell.exe',['-NoProfile','-Command',`Set-Item -LiteralPath ${quotePS(key)} -Value ${quotePS(command)}`],{windowsHide:true});
        restoreAssociation = () => execFileSync('powershell.exe',['-NoProfile','-Command',`Set-Item -LiteralPath ${quotePS(key)} -Value ${quotePS(original)}`],{windowsHide:true});
        }
    }
    // Shell UI QA must display the application: SW_HIDE suppresses Electron's first window.
    const child = shellProject ? spawn('powershell.exe',['-NoProfile','-Command',`Start-Process -FilePath ${quotePS(shellProject)} -WindowStyle Normal -Wait`],{cwd:root,env,windowsHide:true}) : spawn(exe, args, { cwd: root, env, windowsHide: false });
    let output = '', exited = false; child.stdout.on('data', data => output += data); child.stderr.on('data', data => output += data); child.on('exit', () => exited = true);
    let target; for (let i = 0; i < 200 && !target && !exited; i++) { try { target = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json())[0]; } catch {} await wait(50); }
    restoreAssociation();
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
    const main = packaged ? path.join(path.dirname(exe), 'resources/app.asar/electron/main.cjs') : path.join(root, 'electron/main.cjs');
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

async function run() {
    await fs.mkdir(artifacts,{recursive:true}); const profile=path.join(artifacts,'profile'); await fs.mkdir(profile); const checks=[];
    const check=(pass,label)=>{checks.push({pass:!!pass,label});console.log((pass?'PASS ':'FAIL ')+label);};let session;
    try {
        session=await launch(profile);const r=code=>session.renderer(code),m=code=>session.evaluate(code);
        async function until(code){for(let i=0;i<100;i++){if(await r(code))return;await wait(30);}throw Error('Condition timeout: '+code);}
        async function begin(kind){await r('window.polishWork=WaveCanvasProject.'+kind+'();true');await until('!!document.querySelector("#project-name-dialog[open]")');}
        async function input(value){await r('document.querySelector("#project-name-input").value='+JSON.stringify(value)+';document.querySelector("#project-name-input").dispatchEvent(new Event("input",{bubbles:true}));true');}
        async function key(value){const event={type:'keyDown',key:value,code:value,windowsVirtualKeyCode:value==='Enter'?13:27,nativeVirtualKeyCode:value==='Enter'?13:27,...(value==='Enter'?{text:'\r'}:{})};await m('(async()=>{const d=projectQA.window.webContents.debugger;d.attach("1.3");try{await d.sendCommand("Input.dispatchKeyEvent",'+JSON.stringify(event)+');await d.sendCommand("Input.dispatchKeyEvent",'+JSON.stringify({...event,type:'keyUp',text:''})+');}finally{d.detach();}return true;})()');}
        async function prefs(){await until('!document.querySelector("#preferences-dialog")');await r('document.querySelector("#preferences-menu").click();true');await until('!!document.querySelector("#preferences-dialog[open]")');}
        async function apply(){await r('document.querySelector("#preferences-save").click();true');await until('!document.querySelector("#preferences-dialog")');}
        async function settlePaint(){await r('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await wait(120);}
        check(JSON.stringify(await r('WaveCanvasPreferences.get()'))===JSON.stringify(require('../../app/app-settings.js').normalize(null)),'Default preferences / isolated userData');
        const original=await r('JSON.stringify(WaveCanvasProject.snapshot())');await begin('newProject');
        check(await r('document.activeElement.id==="project-name-input"'),'New name initial input focus');
        await input('  ');check(await r('document.querySelector("#project-name-submit").disabled'),'Blank / spaces rejected');await key('Escape');
        check(!await r('polishWork')&&original===await r('JSON.stringify(WaveCanvasProject.snapshot())'),'Esc cancels New without replacing project');
        await begin('newProject');await r('document.querySelector("#project-name-later").click();true');check(await r('polishWork')&&await r('WaveCanvasProject.getState().name==="Untitled"&&!WaveCanvasProject.getState().projectPath'),'Later creates Untitled / path null');
        await begin('newProject');await input('  My Song: Final?  ');await key('Enter');check(await r('polishWork')&&await r('WaveCanvasProject.getState().name==="My Song: Final?"&&!WaveCanvasProject.getState().projectPath'),'Enter creates trimmed named unsaved project');
        await prefs();await r('document.querySelector("#preference-autosave").checked=false;document.querySelector("#preference-autosave").dispatchEvent(new Event("change"));true');
        check(await r('document.querySelector("#preference-interval").disabled'),'Autosave Off disables interval control');
        await r('document.querySelector("#preferences-dialog").close();true');check(await r('WaveCanvasPreferences.get().project.autosaveEnabled'),'Preferences close discards draft');
        await prefs();await r('document.querySelector("#preference-ask-name").checked=false;document.querySelector("#preference-autosave").checked=false;document.querySelector("#preference-interval").value="1";true');await apply();
        check(await r('!WaveCanvasProject.getState().dirty&&WaveCanvasPreferences.get().project.autosaveIntervalMinutes===1'),'Preferences Save persists/applies without project dirty');
        await prefs();await r('document.querySelector("#preferences-reset").click();true');await until('document.querySelectorAll("dialog[open]").length===2');
        await r('Array.from(document.querySelectorAll("dialog[open]")).at(-1).querySelector("footer button:last-child").click();true');await until('document.querySelectorAll("dialog[open]").length===1');
        await until('document.querySelector("#preference-ask-name").checked&&!WaveCanvasPreferences.get().project.askNameOnCreate');
        check(await r('document.querySelector("#preference-ask-name").checked&&!WaveCanvasPreferences.get().project.askNameOnCreate'),'Restore Defaults requires confirmation and remains draft');
        await r('document.querySelector("#preferences-dialog").close();true');check(await r('!WaveCanvasPreferences.get().project.askNameOnCreate'),'Cancel reset draft retains saved settings');
        await settlePaint();await session.evaluate('projectQA.window.webContents.capturePage().then(image=>process.getBuiltinModule("fs").writeFileSync('+JSON.stringify(path.join(artifacts,'named-editor.png'))+',image.toPNG()))');
        const file=path.join(artifacts,'different-file-name.waveproj');await m('projectQA.savePaths.push('+JSON.stringify(file)+');true');check(await r('WaveCanvasProject.save()'),'First Save opens native Save As');
        const calls=await m('projectQA.dialogCalls');check(calls.find(x=>x.type==='save').options.defaultPath==='My Song Final.waveproj','First Save filename sanitized from display name');
        check(JSON.parse(await fs.readFile(file,'utf8')).name==='My Song: Final?'&&await r('WaveCanvasProject.getState().name==="My Song: Final?"'),'Save chosen filename never changes display name');
        const saved=await r('JSON.stringify(WaveCanvasProject.snapshot())');await begin('rename');await input('My Song');await key('Escape');check(!await r('polishWork')&&saved===await r('JSON.stringify(WaveCanvasProject.snapshot())'),'Rename Esc preserves metadata');
        await begin('rename');await input('Renamed: Song?');await settlePaint();await session.evaluate('projectQA.window.webContents.capturePage().then(image=>process.getBuiltinModule("fs").writeFileSync('+JSON.stringify(path.join(artifacts,'rename-dialog.png'))+',image.toPNG()))');await key('Enter');await r('polishWork');
        check(await r('WaveCanvasProject.getState().dirty&&WaveCanvasProject.getState().projectPath==='+JSON.stringify(file)),'Rename dirties metadata, retains path, does not rename file');
        await until('document.title!==""');await wait(80);check(await m('projectQA.window.getTitle()')==='Renamed: Song? * — WaveCanvas','Dirty window title uses display name then asterisk');
        const file2=path.join(artifacts,'final-v3.waveproj');await m('projectQA.savePaths.push('+JSON.stringify(file2)+');true');check(await r('WaveCanvasProject.save("saveAs")'),'Save As succeeds');
        check((await m('projectQA.dialogCalls.filter(x=>x.type==="save").at(-1).options.defaultPath')).endsWith('Renamed Song.waveproj')&&JSON.parse(await fs.readFile(file2,'utf8')).name==='Renamed: Song?','Save As defaults to sanitized name and preserves metadata');
        const parent=path.join(artifacts,'collect');await fs.mkdir(parent);await m('projectQA.openPaths.push('+JSON.stringify(parent)+');projectQA.answers.push(1);true');check(await r('WaveCanvasProject.collect()'),'Collect succeeds');
        const collected=path.join(parent,'Renamed Song','Renamed Song.waveproj');check(JSON.parse(await fs.readFile(collected,'utf8')).name==='Renamed: Song?','Collect folder/file sanitized; embedded display name unchanged');
        const recent=JSON.parse(await fs.readFile(path.join(profile,'recent-projects.json'),'utf8'));check(recent.find(x=>x.path===file2)?.name==='Renamed: Song?','Recent cache prefers saved display metadata');
        const legacy=JSON.parse(await fs.readFile(file2,'utf8'));delete legacy.name;const legacyFile=path.join(artifacts,'Legacy Name.waveproj');await fs.writeFile(legacyFile,JSON.stringify(legacy));await m('projectQA.openPaths.push('+JSON.stringify(legacyFile)+');true');check(await r('WaveCanvasProject.open()')&&await r('WaveCanvasProject.getState().name==="Legacy Name"'),'Legacy v1 without name falls back to file basename');
        await r('WaveCanvasProject.save()');check(JSON.parse(await fs.readFile(legacyFile,'utf8')).name==='Legacy Name','Legacy Save adds optional name without version bump');
        check(await r('WaveCanvasProject.newProject()')&&await r('!document.querySelector("#project-name-dialog")&&WaveCanvasProject.getState().name==="Untitled"'),'askName Off creates Untitled directly');
        await prefs();await settlePaint();await session.evaluate('projectQA.window.webContents.capturePage().then(image=>process.getBuiltinModule("fs").writeFileSync('+JSON.stringify(path.join(artifacts,'preferences-dialog.png'))+',image.toPNG()))');await r('document.querySelector("#preferences-dialog").close();true');
        await session.finish(false);session=await launch(profile);check(await session.renderer('WaveCanvasPreferences.ready.then(()=>!WaveCanvasPreferences.get().project.askNameOnCreate&&!WaveCanvasPreferences.get().project.autosaveEnabled&&WaveCanvasPreferences.get().project.autosaveIntervalMinutes===1)'),'Preferences persist process restart');
        await session.evaluate('projectQA.openPaths.push('+JSON.stringify(file2)+');true');check(await session.renderer('WaveCanvasProject.open()')&&await session.renderer('WaveCanvasProject.getState().name==="Renamed: Song?"'),'Saved project name persists restart / Open');
        await session.renderer('WaveCanvasPreferences.reset()');check(await session.renderer('WaveCanvasPreferences.get().project.askNameOnCreate&&WaveCanvasPreferences.get().project.autosaveEnabled&&!WaveCanvasProject.getState().dirty'),'Restore defaults only settings, leaves project clean');
        await session.finish(false);session=null;
    } catch(error){check(false,error.stack||String(error));}
    finally{if(session)await session.finish();await fs.writeFile(path.join(artifacts,'results.json'),JSON.stringify({packaged,checks},null,2));}
    const failed=checks.filter(x=>!x.pass).length;console.log('Preferences: '+(checks.length-failed)+' passed / '+failed+' failed\n'+artifacts);process.exitCode=failed?1:0;
}
module.exports = { launch, artifacts };
if (require.main === module) run().catch(error=>{console.error(error);process.exitCode=1});
