'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const schema = require('../../app/app-settings.js'), settings = require('../../electron/settings-store.cjs'), state = require('../../electron/application-state.cjs'), projects = require('../../electron/project-store.cjs');
async function folder(t) { const value = await fs.mkdtemp(path.join(os.tmpdir(), 'wavecanvas-options-')); t.after(() => fs.rm(value,{recursive:true,force:true})); return value; }
test('Old v1 preferences retain project values and supplement all new defaults without rewriting input', async t => {
    const dir = await folder(t), file = path.join(dir,'settings.json'); const old = {format:schema.defaults.format,version:1,project:{askNameOnCreate:false,autosaveEnabled:false,autosaveIntervalMinutes:15}};
    await fs.writeFile(file,JSON.stringify(old)); const value = await settings.create(dir).get();
    assert.deepEqual(value.project,{...old.project,recentProjectsLimit:10}); assert.deepEqual(value.general,schema.defaults.general); assert.deepEqual(value.playback,schema.defaults.playback); assert.equal(await fs.readFile(file,'utf8'),JSON.stringify(old));
});
test('Options whitelists and numeric boundaries reject invalid saves and normalize corrupt loads', () => {
    for (const [group,key,values] of [['project','recentProjectsLimit',[5,10,15,20]],['interface','uiScale',[.8,.9,1,1.1,1.25]],['playback','defaultVolume',[0,.5,1]],['export','defaultDirectoryMode',['last-used','project-folder','custom']]]) {
        for (const value of values) assert.equal(schema.patch(null,{[group]:{[key]:value}})[group][key],value);
        for (const value of [null,'bad',-1,Infinity,{},NaN]) {assert.throws(()=>schema.patch(null,{[group]:{[key]:value}}));assert.equal(schema.normalize({...schema.defaults,[group]:{[key]:value}})[group][key],schema.defaults[group][key]);}
    }
    assert.throws(()=>schema.patch(null,{state:{window:{}}})); assert.throws(()=>schema.patch(null,{export:{customDirectory:'../relative'}}));
    assert.equal(schema.patch(null,{export:{customDirectory:'C:\\中文 folder'}}).export.customDirectory,'C:\\中文 folder');
});
test('Window restore honors remember off, maximized, display removal and reduced work areas', () => {
    const displays=[{workArea:{x:0,y:0,width:1920,height:1040}},{workArea:{x:-1280,y:0,width:1280,height:720}}];
    const bounds={x:100,y:100,width:1200,height:800,maximized:true}; assert.deepEqual(state.windowBounds(bounds,displays),bounds); assert.equal(state.windowBounds(bounds,displays,false),null);
    assert.equal(state.windowBounds({...bounds,x:2400},displays),null); assert.equal(state.windowBounds({...bounds,width:NaN},displays),null);
    const second={...bounds,x:-1280,width:1200,height:700,y:0}; assert.ok(state.windowBounds(second,displays)); assert.equal(state.windowBounds(second,[displays[0]]),null);
    assert.deepEqual(state.windowBounds({...bounds,width:3000,height:2000},displays),{x:0,y:0,width:1920,height:1040,maximized:true});
});
test('Recent limits keep descending order, trim immediately and never delete project files', async t => {
    const dir=await folder(t);let limit=20;const store=projects.create(dir,{getRecentLimit:()=>limit});
    const records=Array.from({length:20},(_,i)=>({path:path.join(dir,i+'.waveproj'),name:String(i),lastOpenedAt:new Date(200000-i).toISOString(),layout:'circle'}));
    for(const record of records)await fs.writeFile(record.path,'retain'); await fs.writeFile(path.join(dir,'recent-projects.json'),JSON.stringify(records));
    for(limit of [20,15,10,5]){assert.equal((await store.getRecent()).length,limit);await store.trimRecent(limit);assert.deepEqual((await store.getRecent()).map(x=>x.name),records.slice(0,limit).map(x=>x.name));}
    for(const record of records)assert.equal(await fs.readFile(record.path,'utf8'),'retain');
});
test('Export directory priorities handle missing folders, unsaved project, Unicode and spaces', async t => {
    const dir=await folder(t), last=path.join(dir,'last used'),custom=path.join(dir,'中文 folder'),project=path.join(dir,'project');for(const p of [last,custom,project])await fs.mkdir(p);
    const value={lastExportDirectory:last};assert.equal(await state.exportDirectory({defaultDirectoryMode:'last-used'},value),last);
    assert.equal(await state.exportDirectory({defaultDirectoryMode:'custom',customDirectory:custom},value),custom);
    assert.equal(await state.exportDirectory({defaultDirectoryMode:'project-folder'},value,path.join(project,'x.waveproj')),project);
    assert.equal(await state.exportDirectory({defaultDirectoryMode:'project-folder'},value,null),last);
    await fs.rmdir(custom);assert.equal(await state.exportDirectory({defaultDirectoryMode:'custom',customDirectory:custom},value),last);
    await fs.rmdir(last);assert.equal(await state.exportDirectory({defaultDirectoryMode:'last-used'},value),null);
});
test('Preference reset preserves remembered state, recent history and backup data across restart', async t => {
    const dir=await folder(t), store=settings.create(dir);await state.create(dir).update({window:{x:10,y:10,width:1200,height:800,maximized:false},lastExportDirectory:dir});
    await fs.writeFile(path.join(dir,'recent-projects.json'),'history');await fs.mkdir(path.join(dir,'Backups'));await fs.writeFile(path.join(dir,'Backups','retain'),'backup');
    const options={general:{startupMode:'reopen-last',confirmUnsavedClose:false},playback:{defaultVolume:.5,autoPlayOnLoad:true},interface:{uiScale:1.25},export:{defaultDirectoryMode:'custom',customDirectory:'C:\\中文 folder'},project:{recentProjectsLimit:20}};
    const saved=await store.update(options);assert.deepEqual(await settings.create(dir).get(),saved);const remembered=await state.create(dir).get();await store.reset();assert.deepEqual(await state.create(dir).get(),remembered);assert.equal(await fs.readFile(path.join(dir,'recent-projects.json'),'utf8'),'history');assert.equal(await fs.readFile(path.join(dir,'Backups','retain'),'utf8'),'backup');
});
