'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), output = path.join(root, 'release'), pkg = require('../../package.json');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const check = (condition, message) => { assert.ok(condition, message); console.log('PASS ' + message); };
check(pkg.version === '1.0.0' && pkg.productName === 'WaveCanvas' && pkg.build.win.executableName === 'WaveCanvas', 'Canonical version and product identity');
const icon = fs.readFileSync(path.join(root, pkg.build.win.icon));
check(icon.readUInt16LE(2) === 1 && icon.readUInt16LE(4) === 7, 'Seven-size Windows ICO');
check([16,24,32,48,64,128,256].every(size => Array.from({length:7},(_,i)=>icon[6+i*16] || 256).includes(size)), 'ICO dimensions');
const metadata = require('../../vendor/ffmpeg/BUILD.json');
for (const [name, digest] of Object.entries(metadata.sha256)) for (const directory of ['vendor/ffmpeg','release/win-unpacked/resources/ffmpeg']) check(hash(path.join(root,directory,name)) === digest, directory + '/' + name + ' pinned hash');
const files = ['WaveCanvas-LICENSE.txt','THIRD_PARTY_NOTICES.md','FFmpeg/LICENSE','FFmpeg/SOURCE_INFO.txt','FFmpeg/BUILD_INFO.json','FFmpeg/SHA256.txt','FFmpeg/SOURCE_MANIFEST.json'];
for (const file of files) check(hash(path.join(root,'licenses',file)) === hash(path.join(output,'win-unpacked/resources/licenses',file)), 'Packaged license ' + file);
check(fs.existsSync(path.join(output, 'WaveCanvas-Setup-' + pkg.version + '.exe')), 'NSIS installer present');
const asar=require('@electron/asar'),archive=path.join(output,'win-unpacked/resources/app.asar');
for(const entry of asar.listPackage(archive).map(file=>file.replace(/\\/g,'/').replace(/^\//,''))) if (/^(app|electron)\//.test(entry) && fs.statSync(path.join(root,entry)).isFile()) assert.deepEqual(asar.extractFile(archive,path.normalize(entry)),fs.readFileSync(path.join(root,entry)),'Packaged source mismatch: '+entry);
check(true,'Packaged app / electron sources match current frozen core and release implementation');
if (process.argv.includes('--generate')) {
    for(const generated of ['builder-debug.yml','WaveCanvas-Setup-'+pkg.version+'.exe.blockmap']) { const file=path.join(output,generated); if(fs.existsSync(file))fs.unlinkSync(file); }
    for (const name of ['THIRD_PARTY_NOTICES.md','RELEASE-CHECKLIST.md','RELEASE_GPL_SOURCE_CHECKLIST.md','RELEASE-NOTES-1.0.0.md']) fs.copyFileSync(path.join(root,name),path.join(output,name));
    fs.cpSync(path.join(root,'licenses'),path.join(output,'licenses'),{recursive:true});
    fs.mkdirSync(path.join(output,'source-info'),{recursive:true}); fs.copyFileSync(path.join(root,'licenses/FFmpeg/SOURCE_MANIFEST.json'),path.join(output,'source-info/SOURCE_MANIFEST.json'));
    const artifacts = ['WaveCanvas-Setup-'+pkg.version+'.exe','win-unpacked/WaveCanvas.exe','win-unpacked/resources/ffmpeg/ffmpeg.exe','win-unpacked/resources/ffmpeg/ffprobe.exe', ...files.map(file=>'licenses/'+file), 'source-info/SOURCE_MANIFEST.json','THIRD_PARTY_NOTICES.md','RELEASE-CHECKLIST.md','RELEASE_GPL_SOURCE_CHECKLIST.md','RELEASE-NOTES-1.0.0.md'];
    fs.writeFileSync(path.join(output,'RELEASE-HASHES.txt'),artifacts.map(file=>hash(path.join(output,file))+'  '+file).join('\n')+'\n');
}
const manifest = fs.readFileSync(path.join(output,'RELEASE-HASHES.txt'),'utf8').trim().split('\n');
assert.deepEqual(fs.readdirSync(output).sort(),['WaveCanvas-Setup-'+pkg.version+'.exe','RELEASE-HASHES.txt','THIRD_PARTY_NOTICES.md','RELEASE-CHECKLIST.md','RELEASE_GPL_SOURCE_CHECKLIST.md','RELEASE-NOTES-1.0.0.md','licenses','source-info','win-unpacked'].sort(),'Release output allowlist: no build debug, tests, caches or downloads');
for (const line of manifest) { const [digest,file] = line.split('  '); const full = path.resolve(output,file); check(full.startsWith(output+path.sep) && hash(full) === digest,'Release hash ' + file); }
require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'audit-electron-build.cjs'),'--release'],{stdio:'inherit'});
console.log('Release health passed. Unsigned RC; GPL source delivery BLOCKED; publicReleaseReady=false.');
