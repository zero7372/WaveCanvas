const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'performance-profile.js'), 'utf8');
function fixture(enabled) {
    let now = 0, serial = 0;
    class Target { addEventListener() {} removeEventListener() {} }
    const pending = new Map(), cancelled = [], revoked = [];
    const document = new Target();document.hidden = false;document.visibilityState = 'visible';
    document.querySelector = selector => selector === '#stage' ? { getBoundingClientRect: () => ({ width: 960, height: 540 }) } : null;
    const window = new Target();
    Object.assign(window, { requestAnimationFrame: fn => { pending.set(++serial, fn);return serial; }, cancelAnimationFrame: id => { cancelled.push(id);pending.delete(id); } });
    const URL = { createObjectURL: () => 'blob:' + ++serial, revokeObjectURL: url => revoked.push(url) };
    const box = { window, document, URL, URLSearchParams, EventTarget: Target, location: { search: enabled ? '?profile=1' : '' }, performance: { now: () => ++now }, devicePixelRatio: 2, navigator: { userAgent: 'test' }, setInterval, clearInterval };
    const originalRAF = window.requestAnimationFrame, originalURL = URL.createObjectURL;
    vm.runInNewContext(source, box);
    return { window, document, URL, pending, cancelled, revoked, originalRAF, originalURL, Target };
}
test('profiling disabled leaves native APIs and normal UI untouched', () => {
    const f = fixture(false);
    assert.equal(f.window.WaveCanvasPerf, undefined);
    assert.equal(f.window.requestAnimationFrame, f.originalRAF);
    assert.equal(f.URL.createObjectURL, f.originalURL);
    assert.equal(f.pending.size, 0);
});
test('profiling preserves RAF cancellation and reports bounded frame/cost aggregates', () => {
    const f = fixture(true), perf = f.window.WaveCanvasPerf;
    let calls = 0;
    function run() { calls++; f.window.requestAnimationFrame(run); }
    const id = f.window.requestAnimationFrame(run); f.window.cancelAnimationFrame(id);
    assert.equal(f.pending.size, 0); assert.equal(perf.snapshot().pendingRAF.visualizer, undefined);
    f.window.requestAnimationFrame(run);
    for (const timestamp of [0, 16.667, 33.334, 66.668]) {
        const [key, fn] = [...f.pending][0]; f.pending.delete(key); fn(timestamp);
    }
    const state = perf.snapshot();
    assert.equal(calls, 4); assert.equal(state.frames, 3);assert.equal(state.longFrames, 1);assert.equal(state.droppedEstimate, 1);
    let receiver;
    const receiverId=f.window.requestAnimationFrame(function () { receiver=this; });
    f.pending.get(receiverId).call(f.window,80);f.pending.delete(receiverId);assert.equal(receiver,f.window);
    assert.equal(state.pendingRAF.visualizer, 1);assert.equal(state.measures.visualizer.calls, 4);
    state.canvas.callerMutation=1;assert.equal(perf.snapshot().canvas.callerMutation,undefined);
    assert.equal(Array.isArray(state.measures.visualizer), false);
    perf.reset();assert.equal(perf.snapshot().frames, 0);assert.equal(perf.snapshot().pendingRAF.visualizer, 1);
});
test('profiler tracks owned URLs and target listener registration without changing results', () => {
    const f = fixture(true), perf = f.window.WaveCanvasPerf, target = new f.Target(), listener = () => {};
    target.addEventListener('play',listener);target.addEventListener('play',listener);
    assert.equal(perf.snapshot().duplicateListenerAttempts, 1);assert.equal(perf.listeners(target)['play:false'],1);
    target.removeEventListener('play',listener);assert.equal(perf.listeners(target)['play:false'],0);
    const first=f.URL.createObjectURL({}),second=f.URL.createObjectURL({});assert.equal(perf.snapshot().activeURLs,2);
    f.URL.revokeObjectURL(first);f.URL.revokeObjectURL(second);assert.equal(perf.snapshot().activeURLs,0);assert.equal(f.revoked.length,2);
    const wrapped=perf.wrap('result',(a,b)=>a+b);assert.equal(wrapped(2,3),5);
    assert.throws(()=>perf.wrap('error',()=>{throw Error('preserved');})(),/preserved/);
    assert.equal(perf.snapshot().measures.error.calls,1);
});
