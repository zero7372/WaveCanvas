'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {launch,artifacts}=require('./preferences-smoke.cjs');
const root=path.resolve(__dirname,'../..'),stateFile=path.join(root,'dev/tests/artifacts/release-preservation.json');
async function run(){
    await fs.mkdir(artifacts,{recursive:true});let session;const checks=[];
    const check=(value,label)=>{checks.push({pass:!!value,label});console.log((value?'PASS ':'FAIL ')+label);};
    try {
        if(process.argv.includes('--prepare')){
            const profile=process.env.WAVECANVAS_QA_PROFILE;if(!profile)throw Error('Workflow preservation profile required');
            session=await launch(profile);
            await session.renderer('WaveCanvasPreferences.update({general:{startupMode:"home",rememberWindowBounds:true,confirmUnsavedClose:false},project:{askNameOnCreate:false,autosaveEnabled:true,autosaveIntervalMinutes:1,recentProjectsLimit:15},playback:{defaultVolume:.5,autoPlayOnLoad:false},interface:{uiScale:1.1},export:{defaultDirectoryMode:"project-folder"}})');
            const value={profile,preferences:await session.renderer('WaveCanvasPreferences.get()'),recent:await session.renderer('waveCanvas.project.getRecent()')};
            await fs.writeFile(stateFile,JSON.stringify(value,null,2));check(value.recent.length>0,'Prepared persisted preference groups / Recent / workflow backups');
        }else{
            const value=JSON.parse(await fs.readFile(stateFile,'utf8'));session=await launch(value.profile,[],process.env.WAVECANVAS_QA_START_LINK || null);
            if(process.env.WAVECANVAS_QA_START_LINK)check(await session.evaluate('projectQA.window.isVisible()'),'Actual Start Menu shortcut launches installed app');
            check(JSON.stringify(await session.renderer('WaveCanvasPreferences.get()'))===JSON.stringify(value.preferences),'Reinstall loads all preserved preference groups');
            check(JSON.stringify(await session.renderer('waveCanvas.project.getRecent()'))===JSON.stringify(value.recent),'Reinstall preserves Recent Projects');
            await session.renderer('VisualizerSystemFonts.load()');check(await session.renderer('VisualizerSystemFonts.getState().installedFamilyCount>11'),'Reinstalled font enumeration available');
        }
    }catch(error){check(false,error.stack||String(error));}
    finally{if(session)await session.finish(false);await fs.writeFile(path.join(artifacts,'reinstall-results.json'),JSON.stringify({checks},null,2));}
    console.log(artifacts);process.exitCode=checks.some(c=>!c.pass)?1:0;
}
run().catch(error=>{console.error(error);process.exitCode=1;});
