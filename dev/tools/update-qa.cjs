'use strict';
// 更新檢查 QA：在 Main 內以模擬回應取代 GitHub，檢查提示、略過版本、手動檢查與離線啟動。
const fs = require('node:fs/promises'), path = require('node:path');
const { launch, artifacts } = require('./preferences-smoke.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
// 在 Main 裡換掉 fetch；每次請求都記錄下來，確認只查詢 GitHub 的 latest API。
const respond = body => `globalThis.updateRequests=[];globalThis.fetch=async(url,options)=>{updateRequests.push({url:String(url),method:options?.method||'GET',body:options?.body??null,headers:options?.headers});${body}};true`;
const release = tag => respond(`return {ok:true,status:200,json:async()=>({tag_name:'${tag}',html_url:'https://github.com/zero7372/WaveCanvas/releases/tag/${tag}',prerelease:false,draft:false})};`);
async function run() {
    await fs.mkdir(artifacts, { recursive: true });
    const checks = [], check = (pass, label) => { checks.push({ pass: !!pass, label }); console.log((pass ? 'PASS ' : 'FAIL ') + label); };
    const sessions = [];
    const until = async (session, expression, timeout = 15000) => { for (let i = 0; i < timeout / 100; i++) { if (await session.renderer(expression)) return true; await wait(100); } throw Error('Timeout ' + expression); };
    try {
        // 1. 離線啟動：自動檢查失敗時不延遲、不顯示任何訊息。
        const offline = path.join(artifacts, 'profile-offline'); await fs.mkdir(offline);
        await fs.writeFile(path.join(offline, 'update-check.json'), JSON.stringify({ lastCheckedAt: 0 }));
        const started = Date.now();
        let session = await launch(offline); sessions.push(session);
        const ready = Date.now() - started;
        await session.evaluate(respond("throw new TypeError('fetch failed');"));
        await session.evaluate(`globalThis.updateErrors=[];projectQA.window.webContents.on('console-message',e=>{if(e.level==='error'||e.level===3)updateErrors.push(e.message)});true`);
        await wait(4500);
        const offlineState = JSON.parse(await session.evaluate('JSON.stringify({requests:updateRequests.length,errors:updateErrors})'));
        check(offlineState.requests === 1, 'Startup runs one automatic check after a short delay');
        check(!(await session.renderer('!!document.querySelector("#update-notice")')) && !offlineState.errors.length && !(await session.renderer('document.querySelector("#shell-status").textContent')), 'Offline automatic check fails silently');
        check(ready < 20000, 'Launch is not blocked by the update check (' + ready + ' ms to ready window)');
        const state = JSON.parse(await fs.readFile(path.join(offline, 'update-check.json'), 'utf8'));
        check(state.lastCheckedAt > 0, 'Automatic check time is recorded for the once-a-day limit');
        // 2. 手動檢查：有新版、無新版、網路失敗、格式異常。
        await session.renderer('document.querySelector("#preferences-menu").click();true');
        await until(session, '!!document.querySelector("#preference-check-now")');
        const manual = async setup => { await session.evaluate(setup); await session.renderer('document.querySelector("#preference-check-now").click();true'); await until(session, '!document.querySelector("#preference-check-now").disabled'); return session.renderer('document.querySelector("#preference-update-status").textContent'); };
        check((await manual(release('v99.0.0'))) === '有新版本 99.0.0。' && await session.renderer('!!document.querySelector("#update-notice")'), 'Manual check: newer release shows status and notice');
        const request = JSON.parse(await session.evaluate('JSON.stringify(updateRequests[0])'));
        check(request.url === 'https://api.github.com/repos/zero7372/WaveCanvas/releases/latest' && request.method === 'GET' && request.body === null && Object.keys(request.headers).sort().join() === 'Accept,User-Agent', 'Only a GET to the GitHub latest-release API, without user data');
        await session.renderer('document.querySelector("#update-notice").remove();true');
        check((await manual(release('v1.0.0'))).startsWith('已是最新版本'), 'Manual check: no newer release reports up to date');
        check((await manual(respond("throw new TypeError('fetch failed');"))) === '無法檢查更新，請稍後再試。', 'Manual check: network failure is reported without crashing');
        check((await manual(respond("return {ok:true,status:200,json:async()=>{throw new SyntaxError('bad json')}};"))) === '無法檢查更新，請稍後再試。', 'Manual check: malformed response is reported without crashing');
        check((await manual(respond("return {ok:false,status:403,json:async()=>({message:'rate limited'})};"))) === '無法檢查更新，請稍後再試。', 'Manual check: rate limiting is reported without crashing');
        check(!(await session.renderer('!!document.querySelector("#update-notice")')), 'Failed checks never show the update notice');
        await session.renderer('document.querySelector("#preferences-dialog").close();true');
        // 3. 提示的「略過此版本」與「查看新版本」。
        await session.evaluate(release('v99.0.0') + `;projectQA.opened=[];projectQA.electron.shell.openExternal=async url=>{projectQA.opened.push(url)};true`);
        await session.renderer('WaveCanvasUpdates.check(true).then(()=>true)');
        await until(session, '!!document.querySelector("#update-notice")');
        await session.renderer('[...document.querySelectorAll("#update-notice button")].find(b=>b.textContent==="查看新版本").click();true'); await wait(300);
        check(JSON.parse(await session.evaluate('JSON.stringify(projectQA.opened)'))[0] === 'https://github.com/zero7372/WaveCanvas/releases/tag/v99.0.0', 'View release opens the GitHub release page');
        await session.renderer('WaveCanvasUpdates.check(true).then(()=>true)'); await until(session, '!!document.querySelector("#update-notice")');
        await session.renderer('[...document.querySelectorAll("#update-notice button")].find(b=>b.textContent==="略過此版本").click();true'); await wait(300);
        check(JSON.parse(await fs.readFile(path.join(offline, 'update-check.json'), 'utf8')).skippedVersion === '99.0.0', 'Skip this version is remembered');
        await session.finish(); sessions.pop();
        // 4. 略過的版本不再自動提示；偏好設定關閉時不檢查。
        await fs.writeFile(path.join(offline, 'update-check.json'), JSON.stringify({ lastCheckedAt: 0, skippedVersion: '99.0.0' }));
        session = await launch(offline); sessions.push(session); await session.evaluate(release('v99.0.0')); await wait(4500);
        check(!(await session.renderer('!!document.querySelector("#update-notice")')), 'Skipped version is not offered automatically');
        await session.renderer('WaveCanvasPreferences.update({general:{checkForUpdates:false}}).then(()=>true)');
        await session.finish(); sessions.pop();
        await fs.writeFile(path.join(offline, 'update-check.json'), JSON.stringify({ lastCheckedAt: 0 }));
        session = await launch(offline); sessions.push(session); await session.evaluate(release('v99.0.0')); await wait(4500);
        check(await session.evaluate('updateRequests.length') === 0 && !(await session.renderer('!!document.querySelector("#update-notice")')), 'Automatic check is off when disabled in Preferences');
        await session.finish(); sessions.pop();
    } catch (error) { check(false, 'Error: ' + error.message); }
    finally { for (const session of sessions) await session.finish().catch(() => {}); }
    const failed = checks.filter(item => !item.pass).length;
    await fs.writeFile(path.join(artifacts, 'update-qa.json'), JSON.stringify(checks, null, 2));
    console.log('Update: ' + (checks.length - failed) + ' passed / ' + failed + ' failed'); console.log(artifacts);
    process.exitCode = failed ? 1 : 0;
}
run();
