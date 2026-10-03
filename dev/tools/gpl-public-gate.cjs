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
        requireValue(m.provider==='WaveCanvas controlled FFmpeg build'&&m.schemaVersion===2,'Controlled source manifest required');
        requireValue(Array.isArray(m.dependencies)&&m.dependencies.some(d=>d.id==='x264')&&m.dependencies.some(d=>d.id==='zlib'),'External dependency inventory incomplete');
        const inventory=read(path.join(root,'licenses/FFmpeg/DEPENDENCIES.json'));
        requireValue(inventory.status==='PASS'&&inventory.dependencies.length===m.dependencies.length&&inventory.dependencies.every(item=>m.dependencies.some(d=>JSON.stringify(d)===JSON.stringify(item))),'Manifest omits or changes enabled dependency');
        for(const d of m.dependencies||[])requireValue(d.licenseStatus==='PASS'&&
            ((d.sourceStatus==='PASS'&&!!d.revision&&/^[a-f0-9]{64}$/.test(d.archiveSha256||''))||
             (d.sourceStatus==='N/A'&&d.patchStatus==='N/A'&&!!d.exclusionReason&&d.archives?.length)),d.id+' exact source / patches / license or justified exclusion incomplete');
        requireValue((m.dependencies||[]).filter(d=>d.sourceStatus==='PASS').every(d=>d.patchStatus==='PASS'),'Included source patch evidence incomplete');
        requireValue(m.artifactReady===true&&m.deliveryMode==='alongside-installer'&&m.deliveryStatement?.includes(m.sourceArchive),'Source co-delivery declaration missing');
        requireValue(m.published===false||(/^https:\/\//.test(m.deliveryURL||'')&&!/[<>]|placeholder|unresolved/i.test(m.deliveryURL)),'Published source delivery URL unresolved');
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
            requireValue(!/<OFFICIAL_RELEASE_URL>|PENDING|NOT DELIVERED|BLOCKED/i.test(text),file+' contains unfinished source metadata');
            requireValue(text.includes('WaveCanvas-1.0.0-GPL-Source.zip')&&/distributed alongside/i.test(text),file+' lacks exact artifact / co-delivery statement');
        }
        const vendor=read(path.join(root,'vendor/ffmpeg/BUILD.json'));
        for(const [name,item] of Object.entries(m.output||{}))requireValue(vendor.sha256[name]===item.sha256&&hash(path.join(output,'win-unpacked/resources/ffmpeg',name))===item.sha256,'Controlled source binary binding mismatch: '+name);
    } catch(error){reasons.push('Missing/invalid public gate material: '+error.message);}
    if(!reasons.length)try{
        const m=read(path.join(output,'source-info/SOURCE_MANIFEST.json'));
        require('node:child_process').execFileSync(process.env.WAVECANVAS_SOURCE_PYTHON||'python',[
            path.join(root,'dev/tools/verify-gpl-source.py'),path.join(output,m.sourceArchive),
            path.join(output,'source-info/SOURCE_MANIFEST.json')],{stdio:'pipe',timeout:300000});
    }catch(error){reasons.push('Complete source ZIP content/recipe/patch verification failed: '+error.message);}
    return {gplSourceGate:reasons.length?'BLOCKED':'PASS',artifactReady:!reasons.length,publicReleaseReady:!reasons.length,published:false,reasons};
}
module.exports={evaluate};
