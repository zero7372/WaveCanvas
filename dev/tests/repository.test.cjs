const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'dev/notes/repository-file-manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
const fontPatchHashes = JSON.parse(fs.readFileSync(path.join(repo, 'dev/notes/system-font-enumeration-source-hashes.json'), 'utf8'));
test('Classification protects retained source/fixtures and records disposed generated outputs', () => {
    assert.equal(new Set(manifest.map(item => item.destination)).size, manifest.length);
    for (const item of manifest) {
        if (item.disposition === 'removed-generated-during-cleanup') {
            assert.ok(item.destination.startsWith('dev/tests/artifacts/')); continue;
        }
        const destination = path.join(repo, item.destination);
        assert.ok(fs.statSync(destination).isFile(), item.original);
        const editable = item.destination === 'README.md' || item.destination === 'app/index.html'
            || /^dev\/tools\//.test(item.destination) || /^dev\/tests\/[^/]+\.(?:js|html|cjs)$/.test(item.destination)
            || /^dev\/reports\//.test(item.destination) || item.destination === 'dev/tests/fixtures/baselines/index-before.html';
        if (!editable) assert.equal(crypto.createHash('sha256').update(require('./project-baseline.cjs')(path.basename(destination),fs.readFileSync(destination))).digest('hex'), fontPatchHashes[item.destination] || item.sha256, item.destination);
    }
});
test('Every static HTML script, stylesheet, base and local link resolves after classification', () => {
    for (const item of manifest.filter(item => item.destination.endsWith('.html') && item.disposition !== 'removed-generated-during-cleanup')) {
        const file = path.join(repo, item.destination);
        const html = fs.readFileSync(file, 'utf8').replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>');
        const base = /<base\b[^>]*href="([^"]+)"/i.exec(html);
        const directory = base ? path.resolve(path.dirname(file), base[1]) : path.dirname(file);
        for (const match of html.matchAll(/<(?:script|link|a|iframe|img)\b[^>]*\b(?:src|href)\s*=\s*"([^"]+)"/gi)) {
            const reference = match[1].split(/[?#]/)[0];
            if (!reference || /^(?:\w+:|\/\/|\/)/.test(reference)) continue;
            assert.ok(fs.existsSync(path.resolve(directory, reference)), item.destination + ': ' + reference);
        }
    }
});
test('README local Markdown links target the classified reports', () => {
    const readme = fs.readFileSync(path.join(repo, 'README.md'), 'utf8');
    for (const match of readme.matchAll(/\]\(([^)]+)\)/g)) {
        const target = match[1].split('#')[0];
        if (target && !/^\w+:/.test(target)) assert.ok(fs.existsSync(path.join(repo, target)), target);
    }
});
