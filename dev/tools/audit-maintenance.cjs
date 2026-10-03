'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
function markdown(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? markdown(path.join(directory, entry.name)) : entry.name.endsWith('.md') ? [path.join(directory, entry.name)] : []); }
const documents = [path.join(root, 'README.md'), ...markdown(path.join(root, 'dev/reports'))]; let links = 0;
for (const file of documents) for (const match of fs.readFileSync(file, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
    const reference = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!reference || /^(?:[a-z]+:|\/\/)/i.test(reference)) continue;
    assert.ok(fs.existsSync(path.resolve(path.dirname(file), reference)), path.relative(root, file) + ': ' + reference); links++;
}
const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).scripts;
for (const [name, command] of Object.entries(scripts)) { const script = /^node (dev\/tools\/[^ ]+\.cjs)/.exec(command); if (script) assert.ok(fs.existsSync(path.join(root, script[1])), 'Missing script ' + name); }
assert.ok(fs.existsSync(path.join(root, 'dev/tests/fixtures/baselines/index-before.html')));
assert.ok(fs.existsSync(path.join(root, 'dev/tests/fixtures/integration-tone.wav')));
assert.ok(!fs.existsSync(path.join(root, 'dev/downloads')), 'Disposable downloads remain');
console.log('Maintenance audit passed: ' + documents.length + ' Markdown documents, ' + links + ' local links, package script targets and static baseline entry.');
