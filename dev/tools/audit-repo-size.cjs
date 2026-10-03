'use strict';
// Logical bytes, including ignored files; never follows directory links or changes files.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
function scan(directory) {
    const result = { bytes: 0, files: 0, links: 0 };
    if (!fs.existsSync(directory)) return { ...result, mib: 0, missing: true };
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name), info = fs.lstatSync(target);
        if (info.isSymbolicLink()) result.links++;
        else if (entry.isDirectory()) { const child = scan(target); for (const key of ['bytes', 'files', 'links']) result[key] += child[key]; }
        else { result.bytes += info.size; result.files++; }
    }
    return { ...result, mib: result.bytes / 1048576 };
}
const directories = ['app','electron','vendor','dev','dev/tests','dev/tests/fixtures','dev/tests/artifacts','dev/reports','dev/downloads','node_modules','dist','.git','.electron-cache','.npm-cache','.electron-builder-cache'];
console.log(JSON.stringify({ at: new Date().toISOString(), root, method: 'logical file bytes; no symlink traversal; nested directories overlap', total: scan(root), directories: Object.fromEntries(directories.map(directory => [directory, scan(path.join(root, directory))])) }, null, 2));
