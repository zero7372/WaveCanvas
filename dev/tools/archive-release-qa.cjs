'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),artifacts=path.join(root,'dev/tests/artifacts'),archive=path.join(root,'dev/reports/archive/release-engineering-2026-10-03');
fs.mkdirSync(archive,{recursive:true});
function copy(file,name){const from=path.join(artifacts,file);if(!fs.existsSync(from)||fs.statSync(from).size>300000)return;fs.copyFileSync(from,path.join(archive,name||path.basename(file)));}
const logs=['release-node','release-build','release-check','release-installer','release-shell-final','release-workflow-final','release-project-final','release-preferences-smoke','release-options-smoke','release-fonts-final','release-electron-smoke','release-export-qa','release-export-smoke','release-full-export','release-browser','release-reinstall-final','release-installed-audit'];
for(const name of logs)copy(name+'.log',name+'.txt');
for(const name of ['installer-qa.json','release-sizes.json','release-browser-comparison.json','release-suite-status.json','electron-build-audit.json'])copy(name);
for(const name of logs){const log=path.join(artifacts,name+'.log');if(!fs.existsSync(log))continue;const folder=fs.readFileSync(log,'utf8').split(/\r?\n/).filter(line=>line.startsWith(artifacts+path.sep)).at(-1);if(!folder||!fs.existsSync(folder)||!fs.statSync(folder).isDirectory())continue;
    for(const file of ['results.json','font-results.json','font-enumeration.json','font-persistence.json','reinstall-results.json','ffprobe.json','export-result.json','determinism.json','probe-0.json'])copy(path.relative(artifacts,path.join(folder,file)),name.replace(/^release-/,'')+'-'+file);
}
const browsers=fs.readFileSync(path.join(artifacts,'release-browser.log'),'utf8').trim().split(/\r?\n/).at(-1);
if(browsers?.startsWith(artifacts+path.sep))for(const file of fs.readdirSync(browsers).filter(name=>name.endsWith('.html.txt')))copy(path.relative(artifacts,path.join(browsers,file)),file);
console.log('Archived small release QA evidence: '+fs.readdirSync(archive).length+' files. Profiles, videos and large progress/diagnostic dumps excluded.');
