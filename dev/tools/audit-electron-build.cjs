const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),asar=require('@electron/asar');
const root=path.resolve(__dirname,'../..'),directory=path.join(root,'dist/win-unpacked'),archive=path.join(directory,'resources/app.asar');
const entries=asar.listPackage(archive).map(item=>item.replace(/\\/g,'/').replace(/^\//,''));
assert.deepEqual(fs.readdirSync(path.join(directory,'resources')).sort(),['app.asar','ffmpeg'],'Only WaveCanvas runtime and FFmpeg belong in resources');
assert.deepEqual(fs.readdirSync(path.join(directory,'resources/ffmpeg')).sort(),['BUILD.json','LICENSE','README.txt','ffmpeg.exe','ffprobe.exe'],'FFmpeg runtime allowlist');
const unexpected=entries.filter(item=>item&&!/^(?:app(?:\/|$)|electron(?:\/|$)|package\.json$|License\.txt$|README\.md$)/.test(item));
assert.deepEqual(unexpected,[],'Unexpected package content');
for(const file of ['app/index.html','electron/main.cjs','electron/preload.cjs','app/assets/templates/builtin_circle_default.png','app/assets/templates/builtin_square_default.png','app/assets/templates/builtin_linear_default.png','app/assets/wavecanvas.png','License.txt']) assert.ok(entries.includes(file),file);
const pkg=JSON.parse(asar.extractFile(archive,'package.json'));assert.equal(pkg.productName,'WaveCanvas');assert.equal(pkg.devDependencies,undefined);
function size(dir){return fs.readdirSync(dir,{withFileTypes:true}).reduce((total,item)=>total+(item.isDirectory()?size(path.join(dir,item.name)):fs.statSync(path.join(dir,item.name)).size),0);}
const report={productName:pkg.productName,version:pkg.version,files:entries.length,bytes:size(directory),mib:size(directory)/1048576,unexpected,entries};
fs.mkdirSync(path.join(root,'dev/tests/artifacts'),{recursive:true});
fs.writeFileSync(path.join(root,'dev/tests/artifacts/electron-build-audit.json'),JSON.stringify(report,null,2));
console.log('Package allowlist passed: '+entries.length+' entries; '+report.mib.toFixed(2)+' MiB; no dev/ or node_modules.');
