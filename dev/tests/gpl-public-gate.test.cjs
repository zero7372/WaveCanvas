'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {evaluate}=require('../tools/gpl-public-gate.cjs');
const root=path.resolve(__dirname,'../..');
test('current RC cannot be publicly ready with the preparation archive',()=>{
    const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'wavecanvas-gpl-current-'));
    try{
        fs.mkdirSync(path.join(fixture,'release/source-info'),{recursive:true});
        fs.mkdirSync(path.join(fixture,'licenses/FFmpeg'),{recursive:true});
        fs.copyFileSync(path.join(root,'licenses/FFmpeg/SOURCE_MANIFEST.json'),path.join(fixture,'release/source-info/SOURCE_MANIFEST.json'));
        fs.copyFileSync(path.join(root,'licenses/FFmpeg/DEPENDENCIES.json'),path.join(fixture,'licenses/FFmpeg/DEPENDENCIES.json'));
        const result=evaluate(fixture);assert.equal(result.publicReleaseReady,false);
        assert.ok(result.reasons.some(r=>r.includes('Complete source ZIP missing')));
        assert.ok(result.reasons.some(r=>r.includes('delivery URL unresolved')));
        assert.ok(result.reasons.some(r=>r.includes('Provider patch')));
    }finally{fs.rmSync(fixture,{recursive:true,force:true});}
});
test('flipping manifest status alone never clears source, recipe, notices or URL gates',()=>{
    const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'wavecanvas-gpl-gate-'));
    try{
        for(const relative of ['release/source-info','release/win-unpacked/resources/licenses/FFmpeg','licenses/FFmpeg'])fs.mkdirSync(path.join(fixture,relative),{recursive:true});
        const m=JSON.parse(fs.readFileSync(path.join(root,'licenses/FFmpeg/SOURCE_MANIFEST.json')));m.status='PASS';
        fs.writeFileSync(path.join(fixture,'release/source-info/SOURCE_MANIFEST.json'),JSON.stringify(m));
        fs.copyFileSync(path.join(root,'licenses/FFmpeg/DEPENDENCIES.json'),path.join(fixture,'licenses/FFmpeg/DEPENDENCIES.json'));
        fs.copyFileSync(path.join(root,'RELEASE_GPL_SOURCE_CHECKLIST.md'),path.join(fixture,'release/RELEASE_GPL_SOURCE_CHECKLIST.md'));
        fs.copyFileSync(path.join(root,'THIRD_PARTY_NOTICES.md'),path.join(fixture,'release/THIRD_PARTY_NOTICES.md'));
        fs.copyFileSync(path.join(root,'licenses/FFmpeg/SOURCE_INFO.txt'),path.join(fixture,'release/win-unpacked/resources/licenses/FFmpeg/SOURCE_INFO.txt'));
        const result=evaluate(fixture);assert.equal(result.publicReleaseReady,false);
        for(const term of ['staticClosureStatus','licenseClosureStatus','Matching provider build recipe','libx265','checklist','unresolved'])assert.ok(result.reasons.some(r=>r.includes(term)),term);
    }finally{fs.rmSync(fixture,{recursive:true,force:true});}
});
test('missing materials fail closed',()=>{
    const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'wavecanvas-gpl-missing-'));
    try{assert.equal(evaluate(fixture).publicReleaseReady,false);}finally{fs.rmSync(fixture,{recursive:true,force:true});}
});
