const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const i18n = require('../../app/i18n.js'), en = require('../../app/locales/en.js'), ja = require('../../app/locales/ja.js');
const CJK = /[一-鿿]/;
// 不是介面文字的繁中字面值（主控台訊息、字型名稱等）。新增時請說明原因。
const allowed = new Set([
    '[i18n] 缺少 ', ' 翻譯：' // i18n.js 自己的開發用警告
]);
function unescape(text) { return text.replace(/\\(.)/g, (match, character) => ({ n: '\n', t: '\t' })[character] ?? character); }
// 掃描程式碼中的繁中字串字面值（略過註解），回傳 { file, line, text, concat }。
function scan() {
    const results = [], literal = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
    const files = [...fs.readdirSync(path.join(root, 'app')).filter(name => name.endsWith('.js')).map(name => 'app/' + name),
        ...fs.readdirSync(path.join(root, 'electron')).filter(name => name.endsWith('.cjs')).map(name => 'electron/' + name)];
    for (const file of files) {
        if (file === 'app/ui-zh-tw.js') continue;
        fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).forEach((line, index) => {
            const code = line.replace(/(^|\s)\/\/.*$/, '');
            for (const match of code.matchAll(literal)) {
                const text = match[1] ?? match[2] ?? match[3];
                if (!CJK.test(text)) continue;
                const before = code.slice(0, match.index).trimEnd(), after = code.slice(match.index + match[0].length).trimStart();
                results.push({ file, line: index + 1, text: unescape(text), concat: before.endsWith('+') || after.startsWith('+') || (match[3] !== undefined && text.includes('${')) });
            }
        });
    }
    for (const file of ['app/index.html', 'app/export.html']) {
        const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
        for (const match of source.matchAll(/>([^<>]*)<|\s(?:title|placeholder|aria-label|alt)="([^"]*)"/g)) {
            const text = (match[1] ?? match[2] ?? '').trim();
            if (CJK.test(text)) results.push({ file, line: source.slice(0, match.index).split('\n').length, text, concat: false });
        }
    }
    const zhTw = fs.readFileSync(path.join(root, 'app/ui-zh-tw.js'), 'utf8');
    for (const match of zhTw.matchAll(/'([^'\n]*[一-鿿][^'\n]*)'/g)) results.push({ file: 'app/ui-zh-tw.js', line: 0, text: match[1], concat: false });
    return results;
}
test('Every Chinese UI string has English and Japanese translations', () => {
    const strings = scan().filter(item => !allowed.has(item.text));
    const report = language => strings.filter(item => !Object.hasOwn(language.messages, item.text.trim())).map(item => item.file + ':' + item.line + ' ' + item.text);
    assert.deepEqual(report(en), [], '缺少 English 翻譯');
    assert.deepEqual(report(ja), [], '缺少日本語翻譯');
});
test('No UI string is built by concatenating Chinese fragments', () => {
    const concatenated = scan().filter(item => item.concat && !allowed.has(item.text)).map(item => item.file + ':' + item.line + ' ' + item.text);
    assert.deepEqual(concatenated, [], '請改用含 {變數} 的範本字串');
});
test('Catalogs agree on keys and placeholders and are marked as drafts', () => {
    assert.deepEqual(Object.keys(ja.messages).sort(), Object.keys(en.messages).sort());
    const names = text => (text.match(/\{\w+\}/g) || []).sort().join();
    for (const [key, value] of Object.entries(en.messages)) {
        assert.equal(names(value), names(key), 'en ' + key);
        assert.equal(names(ja.messages[key]), names(key), 'ja ' + key);
        assert.ok(value.trim() && ja.messages[key].trim(), 'empty translation: ' + key);
    }
    assert.ok(en.draft && ja.draft);
    // 物件字面值的重複鍵會悄悄覆蓋前一個譯文（例如「復原」同時是 Undo 與 Recover）。
    for (const [file, catalog] of [['en.js', en], ['ja.js', ja]]) {
        const lines = fs.readFileSync(path.join(root, 'app/locales', file), 'utf8').split(/\r?\n/).filter(line => /^ {8}"/.test(line)).length;
        assert.equal(lines, Object.keys(catalog.messages).length, file + ' has duplicate keys');
    }
});
test('Language resolution follows the system and falls back to English', () => {
    assert.equal(i18n.resolve('system', ['zh-TW', 'en-US']), 'zh-TW');
    assert.equal(i18n.resolve('system', ['zh-Hant-HK']), 'zh-TW');
    assert.equal(i18n.resolve('system', ['ja-JP']), 'ja');
    assert.equal(i18n.resolve('system', ['fr-FR', 'de-DE']), 'en');
    assert.equal(i18n.resolve('system', ['zh-CN']), 'en');
    assert.equal(i18n.resolve('ja', ['zh-TW']), 'ja');
    assert.equal(i18n.resolve('bogus', []), 'en');
});
test('Missing translations fall back to English, then to the source, and are recorded', () => {
    i18n.setLanguage('ja');
    try {
        assert.equal(i18n.t('輸出影片'), '動画を書き出し');
        assert.equal(i18n.t('{field}必須是有限數值。', { field: i18n.msg('字型') }), 'フォントは有限の数値である必要があります。');
        assert.equal(i18n.t('這句不存在的測試字串'), '這句不存在的測試字串');
        assert.ok(i18n.missing().some(item => item.source === '這句不存在的測試字串'));
    } finally { i18n.setLanguage('zh-TW'); }
    assert.equal(i18n.t('輸出影片'), '輸出影片');
});
test('Project and export stage stay independent of the interface language', () => {
    const index = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8'), exportPage = fs.readFileSync(path.join(root, 'app/export.html'), 'utf8');
    assert.match(index, /<main id="stage" lang="zh-Hant"/); assert.match(exportPage, /<main id="stage" lang="zh-Hant"/);
    // 專案模型與輸出設定不讀取介面語言。
    for (const file of ['app/project-model.js', 'app/export-stage.js', 'app/export-settings.js']) assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /WaveCanvasI18n\.language|interface\.language/, file);
});
