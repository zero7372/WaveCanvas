'use strict';
// Test-only Main inspector harness. Dialog responses are controlled; no test hooks ship in app/.
const fs = require('node:fs/promises'), path = require('node:path'), net = require('node:net'), { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), packaged = process.argv.includes('--packaged');
const artifacts = path.join(root, 'dev/tests/artifacts/project-' + (packaged ? 'packaged' : 'development') + '-' + Date.now());
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
async function run() {
    await fs.mkdir(artifacts, { recursive: true }); const profile = path.join(artifacts, 'profile'); await fs.mkdir(profile);
    const checks = [], check = (pass, label) => { checks.push({ pass: Boolean(pass), label }); console.log((pass ? 'PASS ' : 'FAIL ') + label); };
    let session;
    try {
        session = await launch(profile); const { renderer: r, evaluate: main } = session;
        const projectFile = path.join(artifacts, '中文 空白 專案.waveproj'), secondFile = path.join(artifacts, '另存 副本.waveproj');
        const wav = path.join(artifacts, '音訊 檔案.wav'), cover = path.join(artifacts, '封面 圖片.png'), primary = path.join(artifacts, '主要 歌詞.srt'), secondary = path.join(artifacts, '次要 歌詞.lrc');
        await fs.copyFile(path.join(root, 'dev/tests/artifacts/timing-review.wav'), wav); await fs.copyFile(path.join(root, 'app/assets/wavecanvas.png'), cover);
        const originalPrimary = '1\n00:00:01,000 --> 00:00:03,000\n敞開大門\n\n2\n00:00:05,000 --> 00:00:07,000\n...\n\n3\n00:00:10,000 --> 00:00:11,000\n夜晚記得\n';
        await fs.writeFile(primary, originalPrimary); await fs.writeFile(secondary, '[offset:30]\n[00:01.00]Open the gate\n[00:10.00]The night remembers\n');
        check(await r(`typeof require==='undefined'&&typeof process==='undefined'&&typeof waveCanvas.project.save==='function'&&!waveCanvas.project.fs&&!waveCanvas.project.ipcRenderer`), 'Narrow project preload; no Node / raw IPC / fs');
        check(await r(`WaveCanvasProject.autosave().then(result=>!result&&!WaveCanvasProject.getState().projectPath)`), 'Untitled never autosaves');
        await r('WaveCanvasPreferences.update({project:{askNameOnCreate:false}})');
        await r('WaveCanvasProject.newProject()'); await r(`document.querySelector('[data-template="circle"]').click();true`);
        check(await r('WaveCanvasProject.getState().dirty'), 'Template mutation marks dirty');
        for (const [selector, file] of [['#audio-file', wav], ['#setting-logoimage', cover], ['#setting-backgroundimage', cover], ['#lyrics-file', primary], ['#lyrics-secondary-file', secondary]]) { await session.select(selector, file); if(selector.includes('setting-'))check(await r(`VisualizerFiles.getName(${JSON.stringify(selector.includes('logoimage')?'logoimage':'backgroundimage')})==='封面 圖片.png'`),selector+' image committed'); }
        await fs.writeFile(path.join(artifacts,'before-layout.json'),JSON.stringify(await r(`({cover:VisualizerFiles.getName('logoimage'),background:VisualizerFiles.getName('backgroundimage'),state:WaveCanvasProject.snapshot()})`),null,2));
        await r(`VisualizerRuntime.updateProperties({circleradius:{value:181}});VisualizerRuntime.updateStandalone({visualizer:{layout:'square',squareSize:411,squareSpectrumLayout:'topBassMirror'}});VisualizerRuntime.updateStandalone({visualizer:{layout:'linear',coverX:73},background:{mode:'bassPulse',opacity:.35,blur:15},text:{title:'中文歌名',artist:'測試作者'},lyrics:{globalOffsetMs:120,secondaryOffsetMs:-50}});let cue=VisualizerLyrics.getDocument('primary').events[0];VisualizerLyrics.retime('primary',cue.id,2250);true`);
        await main(`projectQA.savePaths.push(${JSON.stringify(projectFile)});true`);
        check(await r(`new Promise(resolve=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true}));setTimeout(()=>resolve(!WaveCanvasProject.getState().dirty&&!!WaveCanvasProject.getState().projectPath),600);})`), 'Untitled Ctrl+S uses Save As; Unicode path, clean state');
        const saved = JSON.parse(await fs.readFile(projectFile, 'utf8')), savedId = saved.state.lyrics.primary.events[0].id;
        check(saved.state.media.audio === wav && saved.state.lyrics.primary.events[0].timeMs === 2250 && saved.state.lyrics.primary.events[0].sourceCue.startTimeMs === 1000, 'Real source refs and edited SRT/sourceCue stored');
        check(!JSON.stringify(saved).includes('blob:'), 'Project contains no Object URLs');
        check(await r(`(async()=>{await document.querySelector('#local-audio').play();await new Promise(r=>setTimeout(r,100));document.querySelector('#local-audio').pause();document.querySelector('#local-audio').currentTime=4;await new Promise(r=>setTimeout(r,200));return !WaveCanvasProject.getState().dirty;})()`), 'Playback / pause / seek do not dirty project');
        check(await session.finish(false), 'Clean project closes normally'); session = await launch(profile);
        await session.evaluate(`projectQA.openPaths.push(${JSON.stringify(projectFile)});true`);
        check(await session.renderer('WaveCanvasProject.open()'), 'Project reopens after process restart');
        const restored = await session.renderer(`({audio:document.querySelector('#local-audio').readyState,cover:VisualizerFiles.getName('logoimage'),primary:VisualizerLyrics.getDocument('primary'),secondary:VisualizerLyrics.getDocument('secondary'),state:WaveCanvasProject.getState(),standalone:VisualizerRuntime.getStandalone()})`);
        await fs.writeFile(path.join(artifacts,'restored.json'),JSON.stringify(restored,null,2));
        check(restored.audio>=2&&restored.cover==='封面 圖片.png'&&restored.primary?.events[0].id===savedId&&restored.primary?.events[0].timeMs===2250&&restored.secondary?.fileOffsetMs===30&&restored.standalone.text.title==='中文歌名'&&restored.standalone.background.opacity===.35&&!restored.state.dirty, 'Full media / edited lyrics / IDs / offsets / background / Song Info restored');
        for (const [layout, expression] of [['circle', 'VisualizerRuntime.getSettings().circleradius.value===181'], ['square', 'VisualizerRuntime.getStandalone().visualizer.squareSize===411'], ['linear', 'VisualizerRuntime.getStandalone().visualizer.coverX===73']]) {
            check(await session.renderer(`VisualizerRuntime.updateStandalone({visualizer:{layout:${JSON.stringify(layout)}}});${expression}`), layout + ' inactive bank restored');
        }
        await session.renderer(`VisualizerRuntime.updateStandalone({inputGain:1.25});true`);
        const beforeAutosave = await fs.readFile(projectFile, 'utf8'); check(await session.renderer('WaveCanvasProject.autosave()'), 'Saved + dirty autosave writes and cleans');
        const backups = path.join(profile, 'Backups', saved.projectId), backupFiles = await fs.readdir(backups);
        check(backupFiles.length === 1 && JSON.parse(await fs.readFile(path.join(backups, backupFiles[0]), 'utf8')).state.settings.standalone.inputGain === saved.state.settings.standalone.inputGain, 'Backup retains previous version before overwrite');
        check(await fs.readFile(projectFile, 'utf8') !== beforeAutosave, 'Autosave updates formal project');
        const untouched = await fs.stat(projectFile); check(!await session.renderer('WaveCanvasProject.autosave()'), 'Clean autosave skips write');
        check(await session.renderer(`WaveCanvasProject.markProjectDirty();WaveCanvasProject.autosave().then(result=>!result&&!WaveCanvasProject.getState().dirty)`), 'False dirty + identical canonical content skips write');
        check((await fs.stat(projectFile)).mtimeMs === untouched.mtimeMs, 'Skipped autosave leaves mtime unchanged');
        await session.renderer(`VisualizerRuntime.updateStandalone({inputGain:1.3});true`);
        const beforeFailure=await fs.readFile(projectFile,'utf8');
        await session.evaluate(`projectQA.originalRename=process.getBuiltinModule('fs/promises').rename;process.getBuiltinModule('fs/promises').rename=async(from,to)=>{if(to===${JSON.stringify(projectFile)})throw Error('Injected replacement failure');return projectQA.originalRename(from,to);};true`);
        check(!await session.renderer('WaveCanvasProject.autosave()')&&await session.renderer('WaveCanvasProject.getState().dirty&&WaveCanvasProject.getState().failure.includes("自動儲存失敗")'),'Autosave failure retains dirty state / low-noise failure status');
        check(await fs.readFile(projectFile,'utf8')===beforeFailure,'Failed autosave leaves formal project intact');
        await session.evaluate('process.getBuiltinModule("fs/promises").rename=projectQA.originalRename;true');
        await session.evaluate(`projectQA.savePaths.push(${JSON.stringify(secondFile)});true`); check(await session.renderer(`WaveCanvasProject.save('saveAs')`), 'Explicit Save As succeeds');
        check(JSON.parse(await fs.readFile(secondFile, 'utf8')).projectId === saved.projectId, 'Save As preserves project identity');
        await session.renderer(`VisualizerRuntime.updateStandalone({inputGain:1.5});true`); check(await session.renderer(`WaveCanvasProject.save()`), 'Existing Save writes without Save dialog');
        await session.renderer(`VisualizerRuntime.updateStandalone({inputGain:1.6});true`); await session.evaluate('projectQA.answers.push(2);true');
        check(!await session.renderer('WaveCanvasProject.open()') && await session.renderer('WaveCanvasProject.getState().dirty'), 'Open guard Cancel preserves current project');
        await session.evaluate('projectQA.answers.push(2);projectQA.window.close();true'); await wait(250); check(!session.exited(), 'Close guard Cancel retains window');
        await session.evaluate(`projectQA.answers.push(0);projectQA.openPaths.push(${JSON.stringify(projectFile)});true`); check(await session.renderer('WaveCanvasProject.open()'), 'Open guard Save persists before switching');
        check(JSON.parse(await fs.readFile(secondFile, 'utf8')).state.settings.standalone.inputGain === 1.6, 'Guard Save writes edited state');
        const invalid = path.join(artifacts, 'invalid.waveproj');
        for (const [text, label] of [['{bad', 'invalid JSON'], [JSON.stringify({ ...saved, format: 'preset' }), 'wrong format'], [JSON.stringify({ ...saved, version: 2 }), 'newer version']]) {
            await fs.writeFile(invalid, text); await session.evaluate(`projectQA.openPaths.push(${JSON.stringify(invalid)});true`);
            check(!await session.renderer('WaveCanvasProject.open()') && await session.renderer(`WaveCanvasProject.getState().projectPath===${JSON.stringify(projectFile)}`), label + ' reports error and keeps active project');
        }
        const collectParent = path.join(artifacts, 'collected'); await fs.mkdir(collectParent);
        await session.evaluate(`projectQA.openPaths.push(${JSON.stringify(collectParent)});projectQA.answers.push(1);true`); check(await session.renderer('WaveCanvasProject.collect()'), 'Collect continue succeeds');
        check(await session.renderer(`WaveCanvasProject.getState().projectPath===${JSON.stringify(projectFile)}`), 'Collect continue preserves current path');
        const collectedDirectory = path.join(collectParent, saved.name), collectedPath = path.join(collectedDirectory, saved.name + '.waveproj');
        const collected = JSON.parse(await fs.readFile(collectedPath, 'utf8')); check(Object.values(collected.state.media).every(ref => ref === null || ref.startsWith('media/')), 'Collected refs are relative');
        check(await fs.readFile(primary, 'utf8') === originalPrimary, 'Original subtitle never overwritten by Save/autosave/Collect');
        const moved = path.join(artifacts, '搬移 可攜資料夾'); await fs.rename(collectedDirectory, moved); const movedPath = path.join(moved, path.basename(collectedPath));
        await session.evaluate(`projectQA.openPaths.push(${JSON.stringify(movedPath)});true`); check(await session.renderer('WaveCanvasProject.open()'), 'Moved collected folder reopens');
        check(await session.renderer(`document.querySelector('#local-audio').readyState>=2&&VisualizerLyrics.getDocument('primary').events[0].timeMs===2250&&!WaveCanvasProject.getState().dirty`), 'Moved project resolves media and edited timing');
        await session.evaluate(`projectQA.openPaths.push(${JSON.stringify(collectParent)});projectQA.answers.push(0);true`); check(await session.renderer('WaveCanvasProject.collect()'), 'Collect switch succeeds');
        check(await session.renderer(`WaveCanvasProject.getState().projectPath!==${JSON.stringify(movedPath)}&&!WaveCanvasProject.getState().dirty`), 'Collect switch activates copied project and clean baseline');
        await session.renderer(`document.querySelector('#local-audio').currentTime=2.5;document.querySelector('#future-timing').open=true;VisualizerLyrics.update('seek');VisualizerTimingEditor.select('primary',VisualizerLyrics.getDocument('primary').events[0].id);true`);
        await wait(250);
        await session.evaluate(`projectQA.window.webContents.capturePage().then(image=>process.getBuiltinModule('fs').writeFileSync(${JSON.stringify(path.join(artifacts,'restored-editor.png'))},image.toPNG()))`);
        await session.renderer(`WaveCanvasShell.showView('HOME');true`); await wait(250); check(await session.renderer('document.querySelectorAll(".recent-project-card").length>=3'), 'Recent Home cards render project name/path/time/layout thumbnail');
        await session.evaluate(`projectQA.window.webContents.capturePage().then(image=>process.getBuiltinModule('fs').writeFileSync(${JSON.stringify(path.join(artifacts,'recent-home.png'))},image.toPNG()))`);
        const recent = JSON.parse(await fs.readFile(path.join(profile, 'recent-projects.json'), 'utf8')); check(new Set(recent.map(item => item.path.toLowerCase())).size === recent.length, 'Recent list persists and deduplicates');
        const missingProject=JSON.parse(await fs.readFile(projectFile,'utf8'));missingProject.state.media.cover=path.join(artifacts,'missing-cover.png');missingProject.state.media.audio=path.join(artifacts,'missing-audio.wav');
        const missingPath=path.join(artifacts,'missing-media.waveproj');await fs.writeFile(missingPath,JSON.stringify(missingProject));
        await session.evaluate(`projectQA.openPaths.push(${JSON.stringify(missingPath)});true`);check(await session.renderer('WaveCanvasProject.open()'),'Missing Media project opens gracefully');
        check(await session.renderer('WaveCanvasProject.getState().failure.includes("Missing Media")&&document.querySelector("#cover-name").textContent.includes("Missing")'),'Missing Media list and media slot indicators');
        await session.renderer('VisualizerRuntime.updateStandalone({inputGain:1.7});true');
        check(await session.renderer('WaveCanvasProject.snapshot().state.media.cover.endsWith("missing-cover.png")'),'Changing settings preserves missing media references');
        await session.evaluate(`projectQA.openPaths.push(${JSON.stringify(collectParent)});true`);check(!await session.renderer('WaveCanvasProject.collect()'),'Collect missing media aborts visibly');
        await session.renderer('WaveCanvasShell.showView("EDITOR");true');
        await session.evaluate(`projectQA.window.webContents.capturePage().then(image=>process.getBuiltinModule('fs').writeFileSync(${JSON.stringify(path.join(artifacts,'missing-media.png'))},image.toPNG()))`);
        await session.renderer(`VisualizerRuntime.updateStandalone({inputGain:2});true`); await session.evaluate('projectQA.answers.push(1);true');
        const newResult=await session.renderer('WaveCanvasProject.newProject()');
        await fs.writeFile(path.join(artifacts,'new-state.json'),JSON.stringify(await session.renderer('WaveCanvasProject.getState()'),null,2));
        check(newResult && await session.renderer('!WaveCanvasProject.getState().projectPath&&!WaveCanvasProject.getState().dirty&&!document.querySelector("#local-audio").getAttribute("src")'), 'New guard Discard clears media and restores clean factory state');
        await session.renderer(`VisualizerRuntime.updateStandalone({inputGain:2});true`);
        check(!await session.renderer(`WaveCanvasProject.save('saveAs')`), 'Save As cancel retains dirty state');
        await session.evaluate('projectQA.answers.push(0);true'); await session.evaluate('projectQA.window.close();true'); await wait(300); check(!session.exited(), 'Close Save then Save As cancel aborts close');
        check(await session.finish(true), 'Close guard Discard exits'); session = null;
    } catch (error) { check(false, error.stack || String(error)); }
    finally { if (session) await session.finish(); await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ packaged, checks }, null, 2)); }
    const failed = checks.filter(item => !item.pass).length; console.log('Project smoke: ' + (checks.length - failed) + ' passed / ' + failed + ' failed\n' + artifacts); process.exitCode = failed ? 1 : 0;
}
run().catch(error => { console.error(error); process.exitCode = 1; });
