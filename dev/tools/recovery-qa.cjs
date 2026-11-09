'use strict';
// 未存檔新專案的崩潰復原 QA：強制結束後重開、素材遺失、捨棄、正常關閉與定期寫入。
const fs = require('node:fs/promises'), path = require('node:path');
const { launch, artifacts } = require('./preferences-smoke.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const exists = file => fs.stat(file).then(() => true, () => false);
function wav(seconds) {
    const rate = 8000, n = rate * seconds, b = Buffer.alloc(44 + n * 2);
    b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin(2 * Math.PI * 220 * i / rate)), 44 + i * 2);
    return b;
}
async function run() {
    await fs.mkdir(artifacts, { recursive: true });
    const checks = [], check = (pass, label) => { checks.push({ pass: !!pass, label }); console.log((pass ? 'PASS ' : 'FAIL ') + label); };
    const sessions = [];
    const start = async profile => { const session = await launch(profile); sessions.push(session); return session; };
    const until = async (session, expression, timeout = 15000) => { for (let i = 0; i < timeout / 100; i++) { if (await session.renderer(expression)) return true; await wait(100); } throw Error('Timeout ' + expression); };
    const kill = async session => { session.child.kill(); for (let i = 0; i < 100 && !session.exited(); i++) await wait(50); };
    const dialogTitle = 'document.querySelector("dialog.app-dialog[open] h2")?.textContent || ""';
    const ready = session => until(session, '!!window.WaveCanvasProject && !WaveCanvasProject.getState().busy');
    async function prepare(profile, audioFile) {
        const session = await start(profile); await ready(session);
        if (audioFile) { await session.select('#audio-file', audioFile); await until(session, 'document.querySelector("#local-audio").readyState >= 1'); }
        await session.renderer('VisualizerRuntime.updateStandalone({inputGain:2.5});true');
        await until(session, 'WaveCanvasProject.getState().dirty');
        return session;
    }
    try {
        const audioFile = path.join(artifacts, 'recovery tone.wav'); await fs.writeFile(audioFile, wav(3));
        // A：強制結束後復原
        const profileA = path.join(artifacts, 'profile-a'), recoveryA = path.join(profileA, 'Recovery', 'recovery.waveproj'); await fs.mkdir(profileA);
        let session = await prepare(profileA, audioFile);
        await session.renderer('WaveCanvasProject.syncRecovery().then(()=>true)');
        check(await exists(recoveryA), 'Unsaved new project writes recovery data into the app data folder');
        const written = JSON.parse(await fs.readFile(recoveryA, 'utf8'));
        check(written.format === 'wavecanvas-project' && written.version === 1 && path.isAbsolute(written.state.media.audio), 'Recovery data is a v1 .waveproj with absolute media paths');
        await kill(session);
        check(await exists(recoveryA), 'Recovery data survives a killed process');
        session = await start(profileA);
        await until(session, dialogTitle + ' === "復原未存檔的專案？"');
        check(true, 'Next launch offers recovery after an abnormal exit');
        await session.renderer('document.querySelector("dialog.app-dialog[open] .primary-button").click();true');
        await until(session, '!document.querySelector("dialog.app-dialog[open]") && !WaveCanvasProject.getState().busy && VisualizerRuntime.getStandalone().inputGain === 2.5');
        const restored = JSON.parse(await session.renderer('JSON.stringify({state:WaveCanvasProject.getState(),audio:VisualizerLocalAudio.getFile()?.name,media:WaveCanvasProject.snapshot().state.media.audio})'));
        check(restored.audio === 'recovery tone.wav' && restored.state.projectPath === null && restored.state.dirty && !restored.state.failure, 'Recovered project restores settings and audio, stays unsaved and dirty');
        const recent = await session.renderer('waveCanvas.project.getRecent().then(list=>list.length)');
        check(recent === 0, 'Recovery file is never added to recent projects');
        const saved = path.join(artifacts, 'recovered.waveproj');
        await session.evaluate('projectQA.savePaths.push(' + JSON.stringify(saved) + ');true');
        check(await session.renderer('WaveCanvasProject.save("save")'), 'Recovered project can be saved, including its media reference');
        await until(session, '!WaveCanvasProject.getState().busy'); await wait(300);
        check(await exists(saved) && !(await exists(recoveryA)), 'Saving removes the recovery data');
        await session.finish(); sessions.pop();
        session = await start(profileA); await ready(session); await wait(1500);
        check(!(await session.renderer(dialogTitle)), 'No recovery prompt after a normal session');
        await session.finish(); sessions.pop();

        // B：外部素材遺失時明確提示
        const profileB = path.join(artifacts, 'profile-b'), moved = path.join(artifacts, 'moved tone.wav'); await fs.mkdir(profileB);
        await fs.copyFile(audioFile, moved);
        session = await prepare(profileB, moved);
        await session.renderer('WaveCanvasProject.syncRecovery().then(()=>true)'); await kill(session);
        await fs.unlink(moved);
        session = await start(profileB);
        await until(session, dialogTitle + ' === "復原未存檔的專案？"');
        await session.renderer('document.querySelector("dialog.app-dialog[open] .primary-button").click();true');
        await until(session, '!document.querySelector("dialog.app-dialog[open]") && !WaveCanvasProject.getState().busy && VisualizerRuntime.getStandalone().inputGain === 2.5');
        const missing = JSON.parse(await session.renderer('JSON.stringify({failure:WaveCanvasProject.getState().failure,label:document.querySelector("#audio-name").textContent,status:document.querySelector("#shell-status").textContent})'));
        check(missing.failure.includes('找不到素材') && missing.failure.includes('moved tone.wav'), 'Missing external media is reported after recovery: ' + missing.failure.replace(/\n/g, ' | '));
        await session.finish(); sessions.pop();

        // C：選擇捨棄
        const profileC = path.join(artifacts, 'profile-c'), recoveryC = path.join(profileC, 'Recovery', 'recovery.waveproj'); await fs.mkdir(profileC);
        session = await prepare(profileC, null);
        await session.renderer('WaveCanvasProject.syncRecovery().then(()=>true)'); await kill(session);
        session = await start(profileC);
        await until(session, dialogTitle + ' === "復原未存檔的專案？"');
        await session.renderer('[...document.querySelectorAll("dialog.app-dialog[open] footer button")].find(b=>b.textContent==="捨棄").click();true');
        await until(session, '!document.querySelector("dialog.app-dialog[open]")'); await wait(300);
        check(!(await exists(recoveryC)) && await session.renderer('VisualizerRuntime.getStandalone().inputGain !== 2.5 && !WaveCanvasProject.getState().dirty'), 'Discard deletes recovery data and keeps a clean session');
        await session.finish(); sessions.pop();

        // D：正常關閉並選擇不儲存；定期寫入不需手動觸發
        const profileD = path.join(artifacts, 'profile-d'), recoveryD = path.join(profileD, 'Recovery', 'recovery.waveproj'); await fs.mkdir(profileD);
        session = await prepare(profileD, null);
        check(!(await exists(recoveryD)), 'No recovery data before the first interval');
        await wait(32000);
        check(await exists(recoveryD), 'Recovery data is written periodically (30 s) without user action');
        check(await session.finish(true), 'Normal close with Don\'t Save exits');
        sessions.pop();
        check(!(await exists(recoveryD)), 'Normal close with Don\'t Save removes recovery data');
        session = await start(profileD); await ready(session); await wait(1500);
        check(!(await session.renderer(dialogTitle)), 'No false recovery prompt on the next launch');
        await session.finish(); sessions.pop();
    } catch (error) { check(false, 'Error: ' + error.message); }
    finally { for (const session of sessions) await session.finish().catch(() => {}); }
    const failed = checks.filter(item => !item.pass).length;
    await fs.writeFile(path.join(artifacts, 'recovery-qa.json'), JSON.stringify(checks, null, 2));
    console.log('Recovery: ' + (checks.length - failed) + ' passed / ' + failed + ' failed'); console.log(artifacts);
    process.exitCode = failed ? 1 : 0;
}
run();
