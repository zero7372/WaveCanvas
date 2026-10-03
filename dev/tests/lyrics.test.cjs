const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..', 'app');
function modules() {
    const sandbox = { window: {} };
    for (const file of ['system-fonts.js', 'lyrics-schema.js', 'lrc-parser.js', 'srt-parser.js', 'lyrics-import.js', 'timing-model.js', 'lyrics-runtime.js']) vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
    return sandbox.window;
}
function media() {
    const callbacks = new Map();
    return { currentTime: 0, paused: true, ended: false,
        addEventListener(event, callback) { callbacks.set(event, callback); },
        removeEventListener(event) { callbacks.delete(event); },
        fire(event) { callbacks.get(event)?.(); }, listenerCount: () => callbacks.size
    };
}
test('LRC parses seconds, hundredths, thousandths, multi-tags, metadata, offsets, CRLF and bilingual duplicate grouping', () => {
    const { VisualizerLRC: parser } = modules();
    const result = parser.parse('\uFEFF[ar:Artist]\r\n[ti:Title]\r\n[al:Album]\n[by:Writer]\n[re:App]\n[ve:1]\n[offset:+250]\n\n[00:12]First\n[00:12.50]Second\n[00:12.500]Third\n[00:10.00][01:20.00]Chorus\n[00:13]\ninvalid\n[00:99]Bad\n[00:15.1234]Bad\n[00:16]<00:16.20>Enhanced');
    assert.equal(result.fileOffsetMs, 250);
    assert.equal(result.events.length, 5);
    assert.deepEqual(Array.from(result.events, event => event.timeMs), [10000,12000,12500,13000,80000]);
    assert.equal(parser.activeIndex(result.events, 12500), 2);
    assert.equal(parser.activeIndex(result.events, 9999), -1);
    assert.equal(result.events[3].primary, '');
    assert.equal(parser.parse('[offset:-300]\n[00:01]中文').fileOffsetMs, -300);
    assert.equal(parser.parse('garbage\n\n[ar:Artist]').events.length, 0);
    assert.equal(parser.parse('[offset:Infinity]').fileOffsetMs, 0);
    assert.throws(() => parser.parse('x'.repeat(1024 * 1024 + 1)));
});
test('Lyrics runtime reads currentTime directly across pause, seek, end, replacement, clear and audio changes', () => {
    const api = modules(), audio = media(); let offset = 0;
    const runtime = api.VisualizerLyricsRuntime.create(audio, () => offset);
    const updates = []; runtime.subscribe((state, reason) => updates.push([state.activeIndex, reason]));
    runtime.load('[offset:+250]\n[00:01]One\n[00:02]Two\n[00:03]Three', 'song.lrc');
    assert.equal(runtime.getState().activeIndex, -1);
    audio.currentTime = 1; audio.paused = false; audio.fire('play');
    assert.equal(runtime.getState().activeIndex, 0);
    const previousUpdates = updates.length;
    audio.paused = true; audio.fire('pause'); runtime.update();
    assert.equal(updates.length, previousUpdates);
    audio.currentTime = 3.4; audio.fire('seeking'); assert.equal(runtime.getState().activeIndex, 2);
    audio.currentTime = 1.4; audio.fire('seeked'); assert.equal(runtime.getState().activeIndex, 0);
    for (const time of [3.8,0.1,2.8,1.2]) { audio.currentTime = time; audio.fire('seeking'); }
    assert.equal(runtime.getState().activeIndex, 0);
    audio.currentTime = 0.4; offset = 500; runtime.update('settings'); assert.equal(runtime.getState().activeIndex, 0);
    offset = -300; runtime.update('settings'); assert.equal(runtime.getState().activeIndex, -1);
    audio.currentTime = 1; offset = 0;
    runtime.load('[offset:-300]\n[00:01]延後'); assert.equal(runtime.getState().activeIndex, -1);
    audio.currentTime = 8; audio.ended = true; audio.fire('ended'); assert.equal(runtime.getState().activeIndex, 0);
    runtime.load('[00:00]New'); assert.equal(runtime.getEvent(0).primary, 'New');
    runtime.clear(); assert.equal(runtime.getState().count, 0);
    runtime.load('[00:00]Old'); audio.fire('emptied'); assert.equal(runtime.getState().count, 0);
    runtime.destroy(); assert.equal(audio.listenerCount(), 0);
});
test('Lyrics envelope uses bounded attack/release, consistent time steps and no position signal', () => {
    const { VisualizerLyricsRuntime: { envelope } } = modules();
    const rising = envelope(0,1,90,90,450);
    assert.ok(rising > 0.63 && rising < 0.64);
    const falling = envelope(1,0,90,90,450);
    assert.ok(falling > 0.81 && falling < 0.83);
    let split = 0;
    for (let i = 0; i < 9; i++) split = envelope(split,1,10,90,450);
    assert.ok(Math.abs(split - rising) < 1e-12);
    assert.ok(envelope(0,10,1000,90,450) <= 1);
    assert.equal(envelope(0,-10,1000,90,450), 0);
});

test('Lyrics phases hide intro, use audio end, and restore after backward seek', () => {
    const api=modules(), audio=media(); audio.duration=20;
    let offset=0;
    const runtime=api.VisualizerLyricsRuntime.create(audio,()=>offset);
    runtime.load('[offset:+200]\n[00:05]First\n[00:10]Last');
    assert.equal(runtime.getState().phase,'PRE_LYRICS');
    audio.currentTime=4.8; runtime.update(); assert.equal(runtime.getState().phase,'ACTIVE');
    audio.currentTime=19.9; runtime.update(); assert.equal(runtime.getState().phase,'ACTIVE');
    audio.currentTime=20; audio.fire('seeking'); assert.equal(runtime.getState().phase,'POST_LYRICS');
    offset=2000; runtime.update('settings'); assert.equal(runtime.getState().phase,'POST_LYRICS');
    audio.currentTime=10; audio.fire('seeking'); assert.equal(runtime.getState().phase,'ACTIVE');
    audio.currentTime=0; audio.fire('seeking'); assert.equal(runtime.getState().phase,'PRE_LYRICS');
    audio.currentTime=11; audio.fire('ended'); assert.equal(runtime.getState().phase,'POST_LYRICS');
    runtime.clear(); assert.equal(runtime.getState().phase,'PRE_LYRICS');
    audio.currentTime=2; runtime.load('[00:01]Only'); assert.equal(runtime.getState().phase,'ACTIVE');
});

test('Interlude is exact Primary text and timing phase follows audio plus offset', () => {
    const api=modules(), audio=media(); audio.duration=40;
    const {isInterlude,interludeTiming}=api.VisualizerLyricsRuntime;
    assert.equal(isInterlude({primary:' ... ',secondary:'ignored'}),true);
    for (const primary of ['hello...','...but','……','']) assert.equal(isInterlude({primary}),false);
    for (const duration of [100,1200,5000,180000]) {
        const timing=interludeTiming({timeMs:1000},{timeMs:1000+duration},1100);
        assert.ok(timing.intervalMs>=250 && timing.intervalMs<=900);
        assert.ok(timing.phase>=0 && timing.phase<1);
    }
    assert.notEqual(interludeTiming({timeMs:0},{timeMs:1200},0).intervalMs,interludeTiming({timeMs:0},{timeMs:5000},0).intervalMs);
    let offset=250;
    const runtime=api.VisualizerLyricsRuntime.create(audio,()=>offset);
    runtime.load('[offset:+250]\n[00:01]A\n[00:03] ... \n[00:03]翻譯不顯示\n[00:09]B');
    audio.currentTime=5; audio.fire('seeking');
    const timing=runtime.getState().interlude;
    assert.equal(timing.durationMs,6000);
    assert.ok(Math.abs(timing.phase-((5500-3000)%timing.cycleMs)/timing.cycleMs)<1e-12);
    const firstPhase=timing.phase;
    audio.currentTime=4; audio.fire('seeking'); assert.notEqual(runtime.getState().interlude.phase,firstPhase);
    audio.currentTime=9; audio.fire('seeking'); assert.equal(runtime.getState().interlude,null);
});
test('Lyrics schema covers all requested fields, clamps numbers and rejects unsafe types/colors/fonts', () => {
    const { VisualizerLyricsSettings: schema } = modules();
    const fields = 'enabled fontFamily fontSize fontWeight currentColor inactiveColor inactiveOpacity positionX positionY maxWidth lineSpacing textAlign showPrevious showNext transitionDuration transitionOvershoot inactiveBlur glowEnabled glowColorMode glowColor glowBaseOpacity glowMaxOpacity glowBlur glowSpread glowBassSensitivity glowAttack glowRelease globalOffsetMs secondaryEnabled secondaryFontFamily secondaryFontSizeRatio secondaryFontWeight secondaryColor secondaryOpacity secondaryGap secondaryPosition mergeToleranceMs secondaryOffsetMs'.split(' ');
    assert.deepEqual(Object.keys(schema.properties), fields);
    const result = schema.normalize({ globalOffsetMs: 99999, fontSize: -5, glowBaseOpacity: .6, glowMaxOpacity: .1, unknown: 1 });
    assert.equal(result.globalOffsetMs, 5000); assert.equal(result.fontSize, 18); assert.equal(result.glowMaxOpacity, .6);
    assert.equal(schema.normalize({globalOffsetMs: -99999}).globalOffsetMs, -5000);
    for (const patch of [{fontSize: NaN},{glowAttack: Infinity},{enabled:1},{glowColor:'url(x)'},[]]) assert.throws(() => schema.normalize(patch));
    for (const font of ['Microsoft JhengHei','PingFang TC','Noto Sans CJK TC','Noto Sans JP','Noto Sans','system-ui','sans-serif']) assert.ok(schema.fontStack('special_eliteregular').includes(font));
    assert.equal(schema.normalize({fontFamily:'unsupported', secondaryFontFamily:'waltographregular'}).fontFamily, 'unsupported');
    assert.equal(schema.normalize({secondaryFontFamily:'waltographregular'}).secondaryFontFamily, 'waltographregular');
    assert.equal(schema.properties.fontFamily.options.length, 11);
});

test('Bilingual LRC groups first two nonempty lines without guessing language', () => {
    const parser = modules().VisualizerLRC;
    const parsed = parser.parse('[00:12.50]Open the gate\n[00:12.50]敞開大門\n[00:12.50]Extra\n[00:16.20]日本語の歌詞\n[00:16.20]中文歌詞\n[00:20]Only primary\n[00:21]\n[00:21]Nonempty');
    assert.equal(parsed.events.length,4);
    assert.equal(parsed.events[0].primary,'Open the gate');
    assert.equal(parsed.events[0].secondary,'敞開大門');
    assert.equal(parsed.events[1].primary,'日本語の歌詞');
    assert.equal(parsed.events[1].secondary,'中文歌詞');
    assert.equal(parsed.events[2].secondary,'');
    assert.equal(parsed.events[3].primary,'Nonempty');
    assert.equal(parsed.warnings.length,1);
});
test('Two-file merge reserves exact matches, respects tolerance, missing/extra cues and signed offsets', () => {
    const parser = modules().VisualizerLRC;
    const primary = parser.parse('[00:01]A\n[00:02]B\n[00:03]C\n[00:04]D');
    const secondary = parser.parse('[00:01]甲\n[00:02.080]乙\n[00:03.200]丙\n[00:08]Extra');
    const merged = parser.merge(primary,secondary,{mergeToleranceMs:100});
    assert.deepEqual(Array.from(merged,event=>event.secondary),['甲','乙','','']);
    assert.equal(merged.length,4);
    assert.equal(parser.merge(primary,secondary,{mergeToleranceMs:0})[1].secondary,'');
    assert.equal(parser.merge(primary,secondary,{secondaryOffsetMs:200,mergeToleranceMs:0})[2].secondary,'丙');
    const earlier = parser.parse('[00:00.700]Early');
    assert.equal(parser.merge(primary,earlier,{secondaryOffsetMs:-300,mergeToleranceMs:0})[0].secondary,'Early');
    const shiftedPrimary = parser.parse('[offset:+200]\n[00:01]P');
    const shiftedSecondary = parser.parse('[offset:-100]\n[00:00.700]S');
    assert.equal(parser.merge(shiftedPrimary,shiftedSecondary,{mergeToleranceMs:0})[0].secondary,'S');
    const nearbyPrimary=parser.parse('[00:01]Near\n[00:01.050]Exact');
    const oneSecondary=parser.parse('[00:01.050]Reserved');
    const reserved=parser.merge(nearbyPrimary,oneSecondary,{mergeToleranceMs:100});
    assert.equal(reserved[0].secondary,''); assert.equal(reserved[1].secondary,'Reserved');
});
test('Bilingual runtime merges on settings changes and keeps a single seek timeline', () => {
    const api=modules(), audio=media(); let options={mergeToleranceMs:100,secondaryOffsetMs:0}, global=0;
    const runtime=api.VisualizerLyricsRuntime.create(audio,()=>global,()=>options);
    runtime.load('[00:01]Primary\n[00:02]Next','primary.lrc');
    runtime.loadSecondary('[00:01.050]次要\n[00:02.300]下一句','secondary.lrc');
    assert.equal(runtime.getEvent(0).secondary,'次要'); assert.equal(runtime.getEvent(1).secondary,'');
    options={mergeToleranceMs:100,secondaryOffsetMs:300}; runtime.refreshMerge();
    assert.equal(runtime.getEvent(1).secondary,'下一句');
    audio.currentTime=2.1; audio.fire('seeking'); assert.equal(runtime.getState().activeIndex,1);
    audio.currentTime=1.1; audio.fire('seeking'); assert.equal(runtime.getState().activeIndex,0);
    global=1000; runtime.update('settings'); assert.equal(runtime.getState().activeIndex,1);
    runtime.clearSecondary(); assert.equal(runtime.getEvent(1).secondary,'');
    assert.equal(runtime.getState().secondaryName,'');
});
