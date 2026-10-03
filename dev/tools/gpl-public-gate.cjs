'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function evaluate(root) {
    const reasons=[], output=path.join(root,'release');
    const requireValue=(value,reason)=>{if(!value)reasons.push(reason);};
    const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
    try {
        const m=read(path.join(output,'source-info/SOURCE_MANIFEST.json'));
        requireValue(m.status==='PASS','Source manifest status is not PASS');
        for(const field of ['staticClosureStatus','licenseClosureStatus','deliveryStatus'])requireValue(m[field]==='PASS',field+' is not PASS');
        requireValue(m.buildRecipe?.status==='PASS'&&!!m.buildRecipe.providerScripts,'Matching provider build recipe absent');
        requireValue(m.patches?.status==='PASS'&&Array.isArray(m.patches.provider),'Provider patch provenance unverified');
        requireValue(m.ffmpegSource?.mappingStatus==='PASS'&&m.libx264Source?.mappingStatus==='PASS','Exact FFmpeg/x264 upstream mapping incomplete');
        requireValue(Array.isArray(m.dependencies)&&m.dependencies.length>=53,'External dependency inventory incomplete');
        const inventory=read(path.join(root,'licenses/FFmpeg/DEPENDENCIES.json'));
        requireValue(inventory.dependencies.every(item=>m.dependencies.some(d=>d.id===item.id)),'Manifest omits enabled dependency');
        for(const d of m.dependencies||[])requireValue(d.patchStatus==='PASS'&&d.licenseStatus==='PASS'&&
            ((d.sourceStatus==='PASS'&&!!d.revision&&/^[a-f0-9]{64}$/.test(d.archiveSha256||''))||
             (d.sourceStatus==='N/A'&&!!d.exclusionReason)),d.id+' exact source / patches / license or justified exclusion incomplete');
        requireValue(/^https:\/\//.test(m.deliveryURL||'')&&!/[<>]|placeholder|unresolved/i.test(m.deliveryURL),'Source delivery URL unresolved');
        requireValue(m.sourceArchive===m.plannedCompleteArtifact&&m.sourceArchive==='WaveCanvas-1.0.0-GPL-Source.zip','Complete source artifact not declared');
        const file=m.sourceArchive&&path.resolve(output,m.sourceArchive);
        requireValue(file&&file.startsWith(output+path.sep)&&fs.existsSync(file),'Complete source ZIP missing');
        if(file&&file.startsWith(output+path.sep)&&fs.existsSync(file)) {
            requireValue(hash(file)===m.sourceArchiveSha256,'Complete source hash mismatch');
            const hashes=fs.readFileSync(path.join(output,'RELEASE-HASHES.txt'),'utf8');
            requireValue(hashes.split(/\r?\n/).includes(m.sourceArchiveSha256+'  '+m.sourceArchive),'Source ZIP missing from release hash manifest');
        }
        const checklist=fs.readFileSync(path.join(output,'RELEASE_GPL_SOURCE_CHECKLIST.md'),'utf8');
        const rows=checklist.split(/\r?\n/).filter(line=>/^\|[^|]+\|\s*(?:PASS|FAIL|BLOCKED|N\/A)\s*\|/.test(line));
        requireValue(rows.length>=12&&!rows.some(line=>/\|\s*(?:FAIL|BLOCKED)\s*\|/.test(line)),'GPL checklist has unfinished requirements');
        for(const file of ['THIRD_PARTY_NOTICES.md','win-unpacked/resources/licenses/FFmpeg/SOURCE_INFO.txt']) {
            const text=fs.readFileSync(path.join(output,file),'utf8');
            requireValue(!/<OFFICIAL_RELEASE_URL>|PENDING|UNKNOWN|NOT DELIVERED|BLOCKED|unresolved/i.test(text),file+' contains unresolved release/source metadata');
            requireValue(text.includes('WaveCanvas-1.0.0-GPL-Source.zip')&&!!m.deliveryURL&&text.includes(m.deliveryURL),file+' lacks exact artifact / delivery URL');
        }
    } catch(error){reasons.push('Missing/invalid public gate material: '+error.message);}
    if(!reasons.length)try{
        const m=read(path.join(output,'source-info/SOURCE_MANIFEST.json'));
        require('node:child_process').execFileSync(process.env.WAVECANVAS_SOURCE_PYTHON||'python',[
            path.join(root,'dev/tools/verify-gpl-source.py'),path.join(output,m.sourceArchive),
            path.join(output,'source-info/SOURCE_MANIFEST.json')],{stdio:'pipe',timeout:300000});
    }catch(error){reasons.push('Complete source ZIP content/recipe/patch verification failed: '+error.message);}
    return {gplSourceGate:reasons.length?'BLOCKED':'PASS',publicReleaseReady:!reasons.length,reasons};
}
module.exports={evaluate};
