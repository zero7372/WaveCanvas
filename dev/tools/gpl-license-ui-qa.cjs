'use strict';
const fs=require('node:fs'),path=require('node:path');
const {launch,artifacts}=require('./preferences-smoke.cjs');
const root=path.resolve(__dirname,'../..'),checks=[];
const check=(value,label)=>{checks.push({pass:!!value,label});console.log((value?'PASS ':'FAIL ')+label);};
(async()=>{
    let session;
    try{
        fs.mkdirSync(artifacts,{recursive:true});
        session=await launch(path.join(root,'dev/tests/artifacts/gpl-license-profile'));
        const info=await session.renderer('waveCanvas.release.read()');
        const source=info.documents.find(d=>d.name==='FFmpeg/SOURCE_INFO.txt');
        check(info.version==='1.0.0'&&!!source,'Installed release API exposes canonical version / source info');
        check(source.text.includes('WaveCanvas-1.0.0-GPL-Source.zip')&&source.text.includes('distributed alongside')&&source.text.includes('Published: false')&&source.text.includes('readiness: PASS')&&!source.text.includes('<OFFICIAL_RELEASE_URL>'),'Installed source info states controlled co-delivery readiness and unpublished status');
        await session.renderer('Array.from(document.querySelectorAll(".app-menu button")).find(b=>b.textContent==="Open Source Licenses").click();true');
        let visible=false;
        for(let attempt=0;attempt<50&&!visible;attempt++){
            visible=await session.renderer('!!document.querySelector("#release-dialog[open]")&&document.querySelector("#release-dialog").textContent.includes("WaveCanvas-1.0.0-GPL-Source.zip")');
            if(!visible)await new Promise(resolve=>setTimeout(resolve,100));
        }
        check(visible,'Installed Open Source Licenses UI displays updated notices');
    }catch(error){check(false,error.stack);}finally{
        if(session)await session.finish(false);
        fs.writeFileSync(path.join(root,'dev/reports/archive/controlled-ffmpeg-2026-10-04/license-ui-qa.json'),JSON.stringify({checks},null,2)+'\n');
        process.exitCode=checks.some(c=>!c.pass)?1:0;
    }
})();
