'use strict';
// 更新檢查：只提示，不下載、不安裝。
// 只向 GitHub 送出一個查詢最新正式版的 GET 請求；不附帶任何使用者資料，User-Agent 只有程式名稱與版本。
const fs = require('node:fs/promises'), path = require('node:path');
const REPOSITORY = 'zero7372/WaveCanvas';
const ENDPOINT = 'https://api.github.com/repos/' + REPOSITORY + '/releases/latest';
const RELEASE_PAGE = 'https://github.com/' + REPOSITORY + '/releases/';
const DAY = 24 * 60 * 60 * 1000;
// 語意化版本：只接受 MAJOR.MINOR.PATCH（可帶 v 前綴）；帶預發布標記的版本不算正式版。
function parse(value) {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(value || '').trim());
    return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] || null, text: match[1] + '.' + match[2] + '.' + match[3] } : null;
}
function compare(a, b) {
    for (const key of ['major', 'minor', 'patch']) if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
    if (a.prerelease === b.prerelease) return 0;
    if (!a.prerelease) return 1; if (!b.prerelease) return -1;
    return a.prerelease > b.prerelease ? 1 : -1;
}
function create({ userData, version, fetch = (...args) => globalThis.fetch(...args), now = () => Date.now(), timeoutMs = 8000, log = console }) {
    const file = path.join(userData, 'update-check.json');
    let state = null, last = null;
    async function read() {
        if (state) return state;
        try {
            const value = JSON.parse(await fs.readFile(file, 'utf8'));
            state = { lastCheckedAt: Number.isFinite(value?.lastCheckedAt) ? value.lastCheckedAt : null, skippedVersion: parse(value?.skippedVersion) ? parse(value.skippedVersion).text : null };
        } catch { state = { lastCheckedAt: null, skippedVersion: null }; }
        return state;
    }
    async function write() { await fs.mkdir(userData, { recursive: true }); await fs.writeFile(file, JSON.stringify(state), 'utf8'); }
    async function query() {
        const response = await fetch(ENDPOINT, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'WaveCanvas/' + version }, signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) throw Error('HTTP ' + response.status);
        const release = await response.json();
        const latest = parse(release?.tag_name);
        // 只採用正式版，連結也只接受本專案的 Release 頁面。
        if (!latest || latest.prerelease || release.prerelease === true || release.draft === true) throw Error('Unexpected release data');
        const url = typeof release.html_url === 'string' && release.html_url.startsWith(RELEASE_PAGE) ? release.html_url : RELEASE_PAGE + 'latest';
        return { version: latest.text, url };
    }
    // manual：使用者按「檢查更新」，不受一天一次與略過版本限制，失敗時回報原因。
    // 自動檢查：一天最多一次，失敗一律安靜略過。
    async function check({ manual = false } = {}) {
        const current = parse(version);
        const saved = await read();
        // 系統時間被往回調時視為可以檢查，避免永遠不再檢查。
        const elapsed = saved.lastCheckedAt === null ? Infinity : now() - saved.lastCheckedAt;
        if (!manual && elapsed >= 0 && elapsed < DAY) return { status: 'skipped-recent' };
        saved.lastCheckedAt = now(); await write().catch(error => log.warn('Update check state:', error.message));
        try {
            const latest = await query();
            const newer = current && compare(parse(latest.version), current) > 0;
            last = newer ? latest : null;
            if (!newer) return { status: 'current', version: current?.text || version };
            if (!manual && saved.skippedVersion === latest.version) return { status: 'skipped-version', version: latest.version };
            return { status: 'available', version: latest.version, current: current.text, url: latest.url };
        } catch (error) {
            if (!manual) log.warn('Update check:', error.message);
            return { status: 'error', message: error.message };
        }
    }
    async function skip(value) {
        const target = parse(value); if (!target) throw Error('Invalid version');
        const saved = await read(); saved.skippedVersion = target.text; await write(); return true;
    }
    return { check, skip, latest: () => last, file };
}
module.exports = { create, parse, compare, ENDPOINT, RELEASE_PAGE, DAY };
