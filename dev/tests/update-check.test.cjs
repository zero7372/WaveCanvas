const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { create, parse, compare, ENDPOINT, RELEASE_PAGE, DAY } = require('../../electron/update-check.cjs');
const quiet = { warn() {} };
function directory() { return fs.mkdtempSync(path.join(os.tmpdir(), 'wavecanvas-update-')); }
// 模擬 GitHub 回應：status、JSON 內容，或直接丟出網路錯誤。
function mock(responses) {
    const calls = [];
    const fetch = async (url, options) => {
        calls.push({ url, options });
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return { ok: next.status === undefined || next.status < 300, status: next.status ?? 200, json: async () => { if (next.body instanceof Error) throw next.body; return next.body; } };
    };
    return { fetch, calls };
}
const release = (tag, extra = {}) => ({ body: { tag_name: tag, html_url: RELEASE_PAGE + 'tag/' + tag, prerelease: false, draft: false, ...extra } });
test('Semantic version parsing and comparison', () => {
    assert.equal(parse('v1.10.0').text, '1.10.0'); assert.equal(parse('1.2'), null); assert.equal(parse('latest'), null);
    assert.equal(compare(parse('1.10.0'), parse('1.9.9')), 1);
    assert.equal(compare(parse('1.1.0'), parse('1.1.0')), 0);
    assert.equal(compare(parse('1.1.0'), parse('1.1.0-beta.1')), 1);
    assert.equal(compare(parse('2.0.0'), parse('10.0.0')), -1);
});
test('Newer stable release is reported with its release page', async () => {
    const { fetch, calls } = mock([release('v1.2.0')]);
    const result = await create({ userData: directory(), version: '1.1.0', fetch, log: quiet }).check();
    assert.deepEqual(result, { status: 'available', version: '1.2.0', current: '1.1.0', url: RELEASE_PAGE + 'tag/v1.2.0' });
    // 只送出一個 GET 到 GitHub 的 latest API，不帶使用者資料。
    assert.equal(calls.length, 1); assert.equal(calls[0].url, ENDPOINT);
    assert.equal(calls[0].options.method, undefined); assert.equal(calls[0].options.body, undefined);
    assert.deepEqual(Object.keys(calls[0].options.headers).sort(), ['Accept', 'User-Agent']); assert.equal(calls[0].options.headers['User-Agent'], 'WaveCanvas/1.1.0');
});
test('Same or older release reports current', async () => {
    for (const tag of ['v1.1.0', 'v1.0.0']) {
        const { fetch } = mock([release(tag)]);
        assert.equal((await create({ userData: directory(), version: '1.1.0', fetch, log: quiet }).check()).status, 'current');
    }
});
test('Network failure and rate limiting fail quietly', async () => {
    for (const response of [new TypeError('fetch failed'), { status: 403, body: { message: 'API rate limit exceeded' } }, { status: 500, body: {} }]) {
        const warnings = [], { fetch } = mock([response]);
        const result = await create({ userData: directory(), version: '1.1.0', fetch, log: { warn: (...args) => warnings.push(args) } }).check();
        assert.equal(result.status, 'error'); assert.equal(warnings.length, 1);
    }
});
test('Malformed responses, prereleases and foreign links are rejected', async () => {
    for (const response of [{ body: new SyntaxError('Unexpected token') }, { body: null }, { body: { tag_name: 'nightly' } }, release('v2.0.0-beta.1'), release('v2.0.0', { prerelease: true }), release('v2.0.0', { draft: true })]) {
        const { fetch } = mock([response]);
        assert.equal((await create({ userData: directory(), version: '1.1.0', fetch, log: quiet }).check()).status, 'error');
    }
    const { fetch } = mock([release('v2.0.0', { html_url: 'https://example.com/phish' })]);
    assert.equal((await create({ userData: directory(), version: '1.1.0', fetch, log: quiet }).check()).url, RELEASE_PAGE + 'latest');
});
test('Automatic checks run at most once a day; manual checks always run', async () => {
    let time = 1_000_000; const userData = directory();
    const { fetch, calls } = mock([release('v1.1.0'), release('v1.1.0'), release('v1.1.0')]);
    const checker = create({ userData, version: '1.1.0', fetch, now: () => time, log: quiet });
    assert.equal((await checker.check()).status, 'current');
    time += DAY - 1; assert.equal((await checker.check()).status, 'skipped-recent');
    assert.equal((await checker.check({ manual: true })).status, 'current');
    time += DAY; assert.equal((await checker.check()).status, 'current');
    assert.equal(calls.length, 3);
    // 重新啟動後仍記得上次檢查時間。
    assert.equal((await create({ userData, version: '1.1.0', fetch, now: () => time + 1000, log: quiet }).check()).status, 'skipped-recent');
});
test('Skipped version is not offered automatically, but a later version is', async () => {
    let time = 0; const userData = directory();
    const { fetch } = mock([release('v1.2.0'), release('v1.2.0'), release('v1.3.0')]);
    const checker = create({ userData, version: '1.1.0', fetch, now: () => time, log: quiet });
    await checker.skip('1.2.0');
    assert.equal((await checker.check()).status, 'skipped-version');
    assert.equal((await checker.check({ manual: true })).status, 'available');
    time += DAY; assert.equal((await checker.check()).version, '1.3.0');
});
