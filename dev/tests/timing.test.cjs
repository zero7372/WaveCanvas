const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function modules() {
    const box = { window: {}, setTimeout, Float32Array };
    for (const file of ['lrc-parser.js','srt-parser.js','lyrics-import.js','timing-model.js','lyrics-runtime.js','waveform-cache.js']) vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', '..', 'app', file),'utf8'),box);
    return box.window;
}
function media() { return { currentTime:0,duration:10,ended:false,addEventListener(){},removeEventListener(){} }; }
test('timeline mapping and cursor anchored zoom retain the pointed time', () => {
    const model=modules().VisualizerTimingModel;
    for (const scale of [.02,20,1200]) for (const seconds of [0,12.43,36000]) assert.equal(model.mapping(scale).xToTime(model.mapping(scale).timeToX(seconds)),seconds);
    const scroll=model.zoomScroll(20,80,1250,83);
    assert.equal((scroll+83)/80,(1250+83)/20);
    assert.throws(()=>model.mapping(0));
});
test('millisecond timestamps parse/serialize, reject invalid values and snap/clamp safely', () => {
    const m=modules().VisualizerTimingModel;
    for(const time of [0,1,59999,60000,84530,599999999]) assert.equal(m.parseTime(m.format(time)),time);
    for(const text of ['00:60.000','-00:01.000','00:00.NaN','00:01','Infinity','10000:00.000']) assert.throws(()=>m.parseTime(text));
    assert.equal(m.bounded(1234,10,10),1230);assert.equal(m.bounded(1260,10,50),1250);assert.equal(m.bounded(1251,10,100),1300);
    assert.equal(m.bounded(-50,10,10),0);assert.equal(m.bounded(999999,10.005,10),10005);
    assert.throws(()=>m.bounded(NaN));assert.throws(()=>m.bounded(Infinity));
    assert.throws(()=>m.bounded(1000,10,NaN));assert.throws(()=>m.bounded(1000,10,-10));
});
test('editable source preserves bilingual duplicates, extra lines, blanks, metadata and raw offsets', () => {
    const m=modules().VisualizerTimingModel;
    const doc=m.fromText('[ar:歌手]\n[ti:Title]\n[offset:+250]\n[00:02]...\n[00:01]English\n[00:01]中文\n[00:01]extra\n[00:00]\n[00:03]A long line','primary','test.lrc');
    assert.deepEqual(Array.from(doc.events,event=>event.timeMs),[0,1000,2000,3000]);
    assert.equal(doc.events[2].type,'interlude');assert.equal(doc.events[1].lines.length,3);
    const exported=m.serialize(doc);assert.match(exported,/\[offset:250\]/);assert.match(exported,/\[ar:歌手\]/);assert.match(exported,/\[00:01.000\]extra/);
    const parsed=m.toParsed(doc);assert.equal(parsed.events[1].secondary,'中文');assert.equal(parsed.warnings.length,1);
    const clone=m.snapshot(doc);clone.events[1].timeMs=999;clone.events[1].lines[0]='Changed';assert.equal(doc.events[1].timeMs,1000);assert.equal(doc.events[1].lines[0],'English');
    const spaces=m.fromText('[00:01]  keep spacing  ','primary');assert.match(m.serialize(spaces),/\[00:01.000\]  keep spacing  /);assert.equal(m.toParsed(spaces).events[0].primary,'keep spacing');
});
test('retiming across neighbours sorts data while preserving identity and text; tracks stay independent', () => {
    const m=modules().VisualizerTimingModel, primary=m.fromText('[00:01]A\n[00:02]B','primary'),secondary=m.fromText('[00:01]譯文','secondary');
    const id=primary.events[0].id;m.retime(primary,id,3000,10);
    assert.equal(primary.events[1].id,id);assert.equal(primary.events[1].rawText,'A');assert.equal(secondary.events[0].timeMs,1000);
    m.retime(primary,id,-100,10);assert.equal(primary.events[0].id,id);assert.equal(primary.events[0].timeMs,0);
    assert.notEqual(m.fromText('[00:01]A','primary').events[0].id,id);
});
test('runtime retime uses existing bilingual/interlude merge, syncs active cue and never bakes offsets', () => {
    const api=modules(), audio=media(), runtime=api.VisualizerLyricsRuntime.create(audio,()=>200,()=>({secondaryOffsetMs:-50,mergeToleranceMs:100}));
    runtime.load('[offset:100]\n[00:01]A\n[00:02]...','p.lrc');runtime.loadSecondary('[offset:150]\n[00:01]...\n[00:02]...','s.lrc');
    audio.currentTime=.7;runtime.update('seek',true);assert.equal(runtime.getEvent(runtime.getState().activeIndex).primary,'A');
    assert.equal(api.VisualizerLyricsRuntime.isInterlude(runtime.getEvent(0)),false);
    const doc=runtime.getDocument('primary'),id=doc.events[0].id;runtime.retime('primary',id,1500);
    assert.equal(runtime.getDocument('primary').events[0].timeMs,1500);assert.equal(runtime.getDocument('secondary').events[0].timeMs,1000);assert.equal(runtime.getState().activeIndex,-1);
    audio.currentTime=1.3;runtime.update('seek',true);assert.equal(runtime.getState().activeIndex,0);
    audio.currentTime=1.7;runtime.update('seek',true);assert.equal(api.VisualizerLyricsRuntime.isInterlude(runtime.getEvent(1)),true);
    audio.currentTime=0;runtime.update('seek',true);assert.equal(runtime.getState().activeIndex,-1);
    assert.match(api.VisualizerTimingModel.serialize(runtime.getDocument('primary')),/\[00:01.500\]A/);
    assert.throws(()=>runtime.retime('bad',id,0));assert.throws(()=>runtime.retime('primary',id,NaN));
});
test('empty/secondary-only sources and timestamp collisions remain valid', () => {
    const api=modules(),r=api.VisualizerLyricsRuntime.create(media());
    r.loadSecondary('[00:00]次要');assert.equal(r.getState().count,0);assert.equal(r.getDocument('secondary').events.length,1);
    r.load('');assert.equal(r.getDocument('primary').events.length,0);
    r.load('[00:01]A\n[00:02]B');const id=r.getDocument('primary').events[1].id;r.retime('primary',id,1000);
    assert.equal(r.getState().count,1);assert.equal(r.getEvent(0).secondary,'');assert.equal(r.getDocument('primary').events.length,2);
    r.clear();assert.equal(r.getDocument('primary'),null);assert.equal(r.getDocument('secondary'),null);
});
test('local timing history supports drag/fine/manual undo redo and truncates the redo branch', () => {
    const m=modules().VisualizerTimingModel,doc=m.fromText('[00:01]A','primary'),id=doc.events[0].id;
    const h=m.history((edit,value)=>m.retime(doc,edit.id,value));
    for(const value of [1500,1510,8453]) { const from=doc.events[0].timeMs;m.retime(doc,id,value);h.record({id,from,to:value}); }
    h.undo();assert.equal(doc.events[0].timeMs,1510);h.undo();assert.equal(doc.events[0].timeMs,1500);
    h.redo();assert.equal(doc.events[0].timeMs,1510);h.record({id,from:1510,to:1600});assert.equal(h.state().redo,0);
    h.clear();assert.equal(h.undo(),false);
});
test('waveform caches stereo extrema and multiple densities, handles silence and cancels stale work', async () => {
    const w=modules().VisualizerWaveform, channels=[new Float32Array(1024),new Float32Array(1024)];channels[0][45]=.8;channels[1][90]=-.6;channels[1][100]=NaN;
    const buffer={length:1024,numberOfChannels:2,sampleRate:48000,duration:1024/48000,getChannelData:i=>channels[i]};
    const cache=await w.build(buffer);assert.ok(cache.levels.length>1);assert.ok(Math.abs(cache.levels[0].max[0]-.8)<.0001);assert.ok(Math.abs(cache.levels[0].min[0]+.6)<.0001);
    assert.ok(w.level(cache,1).stride>w.level(cache,.001).stride);assert.ok(cache.levels.every(level=>Array.from(level.min).every(Number.isFinite)));
    assert.equal(await w.build(buffer,()=>true),null);
    channels.forEach(channel=>channel.fill(0));const silent=await w.build(buffer);assert.ok(silent.levels.every(level=>Array.from(level.max).every(value=>value===0)));
});
