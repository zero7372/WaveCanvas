'use strict';
// Integration gate checks use the generated release, not an unverified status-only mock.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {evaluate}=require('./gpl-public-gate.cjs');
const root=path.resolve(__dirname,'../..'),checks=[];
const check=(value,label)=>{assert.ok(value,label);checks.push({pass:true,label});console.log('PASS '+label);};
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'wavecanvas-controlled-gate-'));
try {
    const baseline=evaluate(root);
    check(baseline.artifactReady&&baseline.publicReleaseReady&&baseline.gplSourceGate==='PASS'&&!baseline.published,'Complete controlled co-delivery release passes while unpublished without invented URL');
    for(const relative of ['release/source-info','release/win-unpacked/resources/ffmpeg','release/win-unpacked/resources/licenses/FFmpeg','licenses/FFmpeg','vendor/ffmpeg','dev/tools'])fs.mkdirSync(path.join(fixture,relative),{recursive:true});
    for(const relative of ['licenses/FFmpeg/DEPENDENCIES.json','vendor/ffmpeg/BUILD.json','dev/tools/verify-gpl-source.py','release/RELEASE-HASHES.txt','release/RELEASE_GPL_SOURCE_CHECKLIST.md','release/THIRD_PARTY_NOTICES.md','release/win-unpacked/resources/licenses/FFmpeg/SOURCE_INFO.txt'])fs.copyFileSync(path.join(root,relative),path.join(fixture,relative));
    const m=JSON.parse(fs.readFileSync(path.join(root,'release/source-info/SOURCE_MANIFEST.json')));
    const manifest=path.join(fixture,'release/source-info/SOURCE_MANIFEST.json');
    const put=value=>fs.writeFileSync(manifest,JSON.stringify(value));
    for(const name of ['ffmpeg.exe','ffprobe.exe'])fs.copyFileSync(path.join(root,'release/win-unpacked/resources/ffmpeg',name),path.join(fixture,'release/win-unpacked/resources/ffmpeg',name));
    put(m);check(!evaluate(fixture).artifactReady,'Missing complete source ZIP fails closed');
    fs.copyFileSync(path.join(root,'release',m.sourceArchive),path.join(fixture,'release',m.sourceArchive));
    check(evaluate(fixture).artifactReady,'Independent copied release/source material passes');
    put({...m,sourceArchiveSha256:'0'.repeat(64)});check(!evaluate(fixture).artifactReady,'Source ZIP hash mismatch fails closed');
    put({...m,deliveryMode:'none'});check(!evaluate(fixture).artifactReady,'Missing co-delivery strategy fails closed');
    put({...m,published:true,deliveryURL:null});check(!evaluate(fixture).artifactReady,'Published metadata requires a real delivery URL');
    put({...m,output:{...m.output,'ffmpeg.exe':{...m.output['ffmpeg.exe'],sha256:'0'.repeat(64)}}});check(!evaluate(fixture).artifactReady,'Runtime/source hash mismatch fails closed');
    put({...m,buildRecipe:{status:'BLOCKED'}});check(!evaluate(fixture).artifactReady,'Missing controlled build recipe fails closed');
} finally {
    fs.rmSync(fixture,{recursive:true,force:true});
    fs.writeFileSync(path.join(root,'dev/reports/archive/controlled-ffmpeg-2026-10-04/public-gate-qa.json'),JSON.stringify({checks},null,2)+'\n');
}
