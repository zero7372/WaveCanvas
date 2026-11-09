'use strict';
// GitHub Release 上傳：安裝檔與 GPL 原始碼 ZIP 一律附在同一個 Release（GPLv3 第 6(d) 條的同處提供）。
// 預設只檢查並印出指令；加上 --publish 才會呼叫 gh，而且只建立草稿 Release，正式公開仍需在 GitHub 手動按下發布。
// 舊版本的 Release 與其原始碼 ZIP 不要刪除。
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..', '..');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// 回傳要附上的檔案；缺少原始碼 ZIP 或雜湊不符時拒絕，避免只發安裝檔。
function assets(output, version) {
    const names = ['WaveCanvas-Setup-' + version + '.exe', 'WaveCanvas-' + version + '-GPL-Source.zip', 'RELEASE-HASHES.txt', 'THIRD_PARTY_NOTICES.md'];
    for (const name of names) if (!fs.existsSync(path.join(output, name))) throw Error('缺少發布檔案：' + name + '。請先執行 npm run release:build 並準備完整 GPL 原始碼 ZIP。');
    const manifest = new Map(fs.readFileSync(path.join(output, 'RELEASE-HASHES.txt'), 'utf8').trim().split(/\r?\n/).map(line => line.split('  ').reverse()));
    for (const name of names.slice(0, 2)) {
        if (!manifest.has(name)) throw Error('RELEASE-HASHES.txt 沒有列出 ' + name);
        if (manifest.get(name) !== hash(path.join(output, name))) throw Error(name + ' 與 RELEASE-HASHES.txt 不符，請重新執行 release:check。');
    }
    return names.map(name => path.join(output, name));
}
function main() {
    const version = require(path.join(root, 'package.json')).version, output = path.join(root, 'release'), tag = 'v' + version;
    const files = assets(output, version), notes = path.join(root, 'RELEASE-NOTES-' + version + '.md');
    // 標籤要指向打包用的這個 commit；沒有 --target 時 GitHub 會把新標籤打在預設分支上，可能是舊程式碼。
    const git = (...parts) => require('node:child_process').execFileSync('git', parts, { cwd: root, encoding: 'utf8' }).trim();
    const commit = git('rev-parse', 'HEAD');
    if (git('status', '--porcelain', '--untracked-files=no')) throw Error('工作目錄有未提交的變更，請先提交再發布。');
    if (!git('branch', '-r', '--contains', commit)) throw Error('目前的 commit ' + commit.slice(0, 7) + ' 還沒推送到 GitHub，請先推送。');
    const args = ['release', 'create', tag, ...files, '--draft', '--target', commit, '--title', 'WaveCanvas ' + version, '--notes-file', notes];
    console.log('標籤 ' + tag + ' 會指向 ' + commit.slice(0, 7) + '。');
    console.log('將附在 ' + tag + ' 的檔案：'); for (const file of files) console.log('  ' + path.relative(root, file));
    if (!process.argv.includes('--publish')) { console.log('\n確認後執行：npm run release:upload -- --publish（建立草稿 Release）'); return; }
    require('node:child_process').execFileSync('gh', args, { cwd: root, stdio: 'inherit' });
    console.log('已建立草稿 Release ' + tag + '，請在 GitHub 確認後再發布。');
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { assets };
