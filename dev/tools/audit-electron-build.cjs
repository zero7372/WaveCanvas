const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),asar=require('@electron/asar');
const root=path.resolve(__dirname,'../..'),directory=path.resolve(process.argv.includes('--release') ? path.join(root,'release/win-unpacked') : process.env.WAVECANVAS_QA_EXE ? path.dirname(process.env.WAVECANVAS_QA_EXE) : path.join(root,'dist/win-unpacked')),archive=path.join(directory,'resources/app.asar');
const entries=asar.listPackage(archive).map(item=>item.replace(/\\/g,'/').replace(/^\//,''));
assert.deepEqual(fs.readdirSync(path.join(directory,'resources')).sort(),['app.asar','ffmpeg','licenses'],'Only WaveCanvas runtime, FFmpeg and licenses belong in resources');
assert.deepEqual(fs.readdirSync(path.join(directory,'resources/ffmpeg')).sort(),['BUILD.json','LICENSE','README.txt','ffmpeg.exe','ffprobe.exe'],'FFmpeg runtime allowlist');
const unexpected=entries.filter(item=>item&&!/^(?:app(?:\/|$)|electron(?:\/|$)|package\.json$|License\.txt$|README\.md$)/.test(item));
assert.deepEqual(unexpected,[],'Unexpected package content');
for(const file of ['app/index.html','electron/main.cjs','electron/preload.cjs','app/assets/templates/builtin_circle_default.png','app/assets/templates/builtin_square_default.png','app/assets/templates/builtin_linear_default.png','app/assets/wavecanvas.png','License.txt']) assert.ok(entries.includes(file),file);
const pkg=JSON.parse(asar.extractFile(archive,'package.json'));assert.equal(pkg.productName,'WaveCanvas');assert.equal(pkg.devDependencies,undefined);
assert.equal(pkg.version,require('../../package.json').version,'Packaged canonical version');
const licenseFiles=['FFmpeg/BUILD_INFO.json','FFmpeg/LICENSE','FFmpeg/PROVIDER-README.txt','FFmpeg/SHA256.txt','FFmpeg/SOURCE_INFO.txt','FFmpeg/SOURCE_MANIFEST.json','THIRD_PARTY_NOTICES.md','WaveCanvas-LICENSE.txt'];
function relativeFiles(dir,prefix=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?relativeFiles(path.join(dir,item.name),prefix+item.name+'/'):[prefix+item.name]);}
assert.deepEqual(relativeFiles(path.join(directory,'resources/licenses')).sort(),licenseFiles.sort(),'License resource allowlist');
for(const file of ['LICENSE.electron.txt','LICENSES.chromium.html'])assert.ok(fs.statSync(path.join(directory,file)).size>0,'Electron/Chromium notice '+file);
function size(dir){return fs.readdirSync(dir,{withFileTypes:true}).reduce((total,item)=>total+(item.isDirectory()?size(path.join(dir,item.name)):fs.statSync(path.join(dir,item.name)).size),0);}
const report={productName:pkg.productName,version:pkg.version,files:entries.length,bytes:size(directory),mib:size(directory)/1048576,unexpected,entries};
fs.mkdirSync(path.join(root,'dev/tests/artifacts'),{recursive:true});
fs.writeFileSync(path.join(root,'dev/tests/artifacts/electron-build-audit.json'),JSON.stringify(report,null,2));
console.log('Package allowlist passed: '+entries.length+' entries; '+report.mib.toFixed(2)+' MiB; no dev/ or node_modules.');
