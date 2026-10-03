const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname, '..', '..', 'app'),plain=value=>JSON.parse(JSON.stringify(value));
function modules(){const app={window:{}};for(const file of ['lrc-parser.js','srt-parser.js','lyrics-import.js','timing-model.js','lyrics-runtime.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),app,{filename:file});return app.window;}
const cue=(start,end,text,sequence='1')=>(sequence===null?'':sequence+'\n')+start+' --> '+end+'\n'+text;
function runtime(app){const handlers=new Map(),audio={currentTime:0,duration:30,ended:false,addEventListener:(event,handler)=>handlers.set(event,handler),removeEventListener:event=>handlers.delete(event)};return {audio,api:app.VisualizerLyricsRuntime.create(audio,()=>0,()=>({mergeToleranceMs:100,secondaryOffsetMs:0}))};}
test('SRT standard milliseconds, hours, UTF8 BOM, LF/CRLF and noncontiguous/missing sequence',()=>{
    const app=modules();
    const input=cue('00:00:12,500','00:00:15,200','Hello world','9')+'\n\n\n'+cue('01:02:03,004','01:02:05,600','剪映中文字幕',null);
    for(const text of [input,'\ufeff'+input.replace(/\n/g,'\r\n')]){
        const parsed=app.VisualizerSRT.parse(text);assert.equal(parsed.cues.length,2);
        assert.equal(parsed.cues[0].startTimeMs,12500);assert.equal(parsed.cues[0].endTimeMs,15200);assert.equal(parsed.cues[0].sequence,9);
        assert.equal(parsed.cues[1].startTimeMs,3723004);assert.equal(parsed.cues[1].sequence,null);assert.equal(parsed.cues[1].text,'剪映中文字幕');
    }
});
test('SRT joins every nonempty line, strips markup, decodes entities and preserves raw cue data',()=>{
    const app=modules(),raw=" <i>I don't know</i> \n\n  <b>where</b> <u>to go</u> &amp; 回家<br>now &#x4E2D; ";
    const parsed=app.VisualizerSRT.parse(cue('00:00:10,000','00:00:14,000',raw));
    assert.equal(parsed.cues[0].text,"I don't know where to go & 回家 now 中");
    assert.ok(parsed.cues[0].rawLines.some(line=>line.includes('<i>')));
    assert.equal(app.VisualizerSRT.plainText('&#999999999; &lt;gate&gt;'),'� <gate>');
});
test('SRT skips empty/invalid cues with warnings, accepts final block and adjacent headers without blank separator',()=>{
    const app=modules(),text=cue('00:00:01,000','00:00:02,000','<i> </i>')+'\n\n'+cue('00:61:01,000','00:62:02,000','bad','99')+'\n\n'+cue('00:00:04,000','00:00:03,000','negative','100')+'\n\n'+cue('00:00:06,010','00:00:07,020','valid','101')+'\n'+cue('00:00:08,001','00:00:09,001','final',null);
    const parsed=app.VisualizerSRT.parse(text);assert.equal(parsed.cues.length,2);assert.equal(parsed.warnings.length,3);
    assert.equal(parsed.cues[0].text,'valid');assert.equal(parsed.cues[1].text,'final');
    const spaced=app.VisualizerSRT.parse('1\n\n00:00:01,000 --> 00:00:02,000\nFirst\n\n2\n\n00:00:03,000 --> 00:00:04,000\nSecond');
    assert.equal(spaced.cues[0].text,'First');assert.equal(spaced.cues[1].sequence,2);
    assert.throws(()=>app.VisualizerLyricsImport.parse('broken','bad.srt'),/沒有有效/);
    assert.throws(()=>app.VisualizerSRT.parse('x'.repeat(1024*1024+1)),/1 MB/);
    assert.throws(()=>app.VisualizerLyricsImport.validateFile({name:'song.vtt',size:10}),/lrc 或 .srt/);
});
test('SRT source documents sort deterministically, keep stable cue ids, preserve end times and isolate snapshots',()=>{
    const app=modules(),m=app.VisualizerTimingModel,text=cue('00:00:05,000','00:00:06,000','Later','10')+'\n\n'+cue('00:00:02,000','00:00:03,000','First','7')+'\n\n'+cue('00:00:02,000','00:00:04,000','第二句','7');
    const a=m.fromText(text,'primary','song.srt'),b=m.fromText(text,'primary','song.srt');
    assert.deepEqual(plain(a.events.map(event=>event.id)),plain(b.events.map(event=>event.id)));assert.notEqual(a.id,b.id,'Each load still owns a distinct Timing history document');
    assert.deepEqual(plain(a.events.map(event=>event.rawText)),['First','第二句','Later']);
    const merged=m.toParsed(a);assert.equal(merged.events[0].primary,'First');assert.equal(merged.events[0].secondary,'第二句');
    const snapshot=m.snapshot(a);snapshot.events[0].sourceCue.rawLines[0]='corrupt';snapshot.events[0].sourceCue.endTimeMs=999;
    assert.equal(a.events[0].sourceCue.endTimeMs,3000);assert.notEqual(a.events[0].sourceCue.rawLines[0],'corrupt');
    const source=plain(a.events[0].sourceCue),id=a.events[0].id;m.retime(a,id,1500);
    assert.equal(a.events.find(event=>event.id===id).timeMs,1500);assert.deepEqual(plain(a.events.find(event=>event.id===id).sourceCue),source);
});
test('All LRC/SRT Primary/Secondary combinations use the same merge and exact interlude semantics',()=>{
    const app=modules(),formats=['lrc','srt'];
    for(const primaryFormat of formats)for(const secondaryFormat of formats){
        const {api,audio}=runtime(app);
        const primary=primaryFormat==='srt'?cue('00:00:01,000','00:00:01,500','Gate')+'\n\n'+cue('00:00:04,000','00:00:05,000','...','2'):'[00:01.000]Gate\n[00:04.000]...';
        const secondary=secondaryFormat==='srt'?cue('00:00:01,050','00:00:02,000','門')+'\n\n'+cue('00:00:04,000','00:00:05,000','翻譯','2'):'[00:01.050]門\n[00:04.000]翻譯';
        api.load(primary,'primary.'+primaryFormat);api.loadSecondary(secondary,'secondary.'+secondaryFormat);
        assert.equal(api.getEvent(0).secondary,'門');assert.equal(api.getState().sourceFormat,primaryFormat);assert.equal(api.getState().secondarySourceFormat,secondaryFormat);
        audio.currentTime=2;api.update('seek');assert.equal(api.getState().activeIndex,0,'SRT end time does not end the active lyric');
        audio.currentTime=4.2;api.update('seek');assert.ok(api.getState().interlude);
        api.loadSecondary(cue('00:00:01,000','00:00:02,000','...'),'secondary.srt');audio.currentTime=1.2;api.update('seek');
        assert.equal(api.getEvent(0).secondary,'...');assert.equal(api.getState().interlude,null,'Secondary ... never sets event type');
        audio.currentTime=0;api.update('seek');assert.equal(api.getState().activeIndex,-1);api.destroy();
    }
});
test('SRT edits, numeric/manual timing, undo/redo and LRC export retain metadata; failed imports preserve active documents',()=>{
    const app=modules(),m=app.VisualizerTimingModel,{api}=runtime(app);api.load(cue('00:00:01,500','00:00:03,000','中 English'),'song.srt');
    const document=api.getDocument('primary'),id=document.events[0].id;
    const history=m.history((edit,time)=>api.retime(edit.source,edit.id,time));
    const edit={source:'primary',id,from:1500,to:m.parseTime('00:02.250')};api.retime('primary',id,edit.to);history.record(edit);
    assert.equal(api.getDocument('primary').events[0].timeMs,2250);history.undo();assert.equal(api.getDocument('primary').events[0].timeMs,1500);history.redo();
    assert.equal(api.getDocument('primary').events[0].sourceCue.endTimeMs,3000);
    const exported=m.serialize(api.getDocument('primary'));assert.equal(exported,'[00:02.250]中 English\r\n');assert.equal(app.VisualizerLRC.parse(exported).events[0].timeMs,2250);
    const before=JSON.stringify(api.getDocument('primary'));assert.throws(()=>api.load('broken','bad.srt'));assert.equal(JSON.stringify(api.getDocument('primary')),before);
    assert.equal(m.fromText('[00:01.00]Legacy','primary','Untitled').sourceFormat,'lrc');
});
test('SRT phase protects LRC parser, Lyrics renderer, Timing editor and all audio/visual/factory/preset code byte-for-byte',()=>{
    const hashes=JSON.parse(fs.readFileSync(path.join(root,'../dev/tests/fixtures/baselines/srt-protected-hashes.json'),'utf8').replace(/^\uFEFF/,''));
    for(const [file,hash] of Object.entries(hashes))assert.equal(crypto.createHash('sha256').update(require('./project-baseline.cjs')(file,fs.readFileSync(path.join(root,file)))).digest('hex'),hash,file);
});
