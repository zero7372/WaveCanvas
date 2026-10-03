(function () {
    'use strict';
    let cache, frameIndex = -1, worker, context, captureMarker;
    const urls = [];
    window.WaveCanvasExportStage = Object.freeze({
        configureCapture() {
            // One metadata row sits outside the 1920x1080 Stage and is never encoded.
            document.documentElement.style.height = document.body.style.height = '1081px';
            captureMarker = document.createElement('div');
            captureMarker.style.cssText = 'position:fixed;left:0;top:1080px;width:2px;height:1px;z-index:2147483647;display:flex;pointer-events:none';
            for (let i = 0; i < 2; i++) {
                const pixel = document.createElement('span');
                pixel.style.cssText = 'display:block;width:1px;height:1px;flex:none';
                captureMarker.append(pixel);
            }
            document.body.append(captureMarker);
        },
        async prepare(payload) {
            const started = window.exportNativeNow();
            const runtime = window.VisualizerRuntime;
            runtime.restoreProjectSettings(payload.snapshot.state.settings);
            for (const [slot, key] of [['cover', 'logoimage'], ['background', 'backgroundimage'], ['overlay', 'backgroundimagef']]) {
                const file = payload.assets[slot]; if (!file) continue;
                const url = URL.createObjectURL(new Blob([file.bytes])); urls.push(url);
                await window.VisualizerImages.load(url);
                runtime.updateProperties({ [key]: { value: url } });
            }
            context = new AudioContext(); // Same default device sample rate as Preview's AudioContext.
            const buffer = await context.decodeAudioData(payload.assets.audio.bytes.buffer.slice(payload.assets.audio.bytes.byteOffset,
                payload.assets.audio.bytes.byteOffset + payload.assets.audio.bytes.byteLength));
            const mixing = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
            const source = mixing.createBufferSource(); source.buffer = buffer; source.connect(mixing.destination); source.start();
            // Native speaker downmix matches AnalyserNode, including multichannel input.
            const pcm = (await mixing.startRendering()).getChannelData(0).slice();
            window.WaveCanvasExportClock.configure(buffer.duration);
            window.VisualizerLyrics.restoreDocuments(payload.snapshot.state.lyrics);
            await document.fonts.ready;
            const rect = document.querySelector('#stage').getBoundingClientRect();
            if (devicePixelRatio !== 1 || rect.x !== 0 || rect.y !== 0 || rect.width !== 1920 || rect.height !== 1080) throw Error('Export Stage pixel mapping 不正確。');
            cache = await new Promise((resolve, reject) => {
                worker = new Worker('export-audio-worker.js');
                worker.onerror = event => reject(new Error(event.message));
                worker.onmessage = ({ data }) => { if (data.error) reject(new Error(data.error)); else if (data.cache) resolve(data.cache); };
                worker.postMessage({ pcm, sampleRate: buffer.sampleRate, count: Math.ceil(buffer.duration * 30) + 1 }, [pcm.buffer]);
            });
            worker.terminate(); worker = null; await context.close(); context = null;
            return { duration: buffer.duration, analysisMs: window.exportNativeNow() - started, cacheBytes: cache.byteLength };
        },
        // Production leaves diagnostic false; native time never advances the virtual clock.
        async renderAtFrame(index, diagnostic = false, rafCount = 2) {
            const marks = {}, now = window.exportNativeNow; let tick = diagnostic ? now() : 0;
            if (index !== frameIndex + 1) throw new Error('Export frames 必須依序 render。');
            frameIndex = index;
            window.showFPS = false; // Preview diagnostics are not part of the exported artwork.
            if (index % 2 === 0) window.VisualizerRuntime.deliverLocalAudio(cache.subarray(index / 2 * 128, index / 2 * 128 + 128));
            window.WaveCanvasExportClock.advance(index / 60);
            if (diagnostic) { marks.updateMs = now() - tick; tick = now(); }
            await window.WaveCanvasExportClock.settle();
            if (diagnostic) { marks.animationMs = now() - tick; tick = now(); }
            if (captureMarker) {
                const value = index + 1, rgb = [value & 255, (value >>> 8) & 255, (value >>> 16) & 255];
                captureMarker.children[0].style.backgroundColor = 'rgb(' + rgb.join(',') + ')';
                captureMarker.children[1].style.backgroundColor = 'rgb(' + rgb.map(v => 255 - v).join(',') + ')';
            }
            // Force style resolution before Main requests Chromium compositor capture.
            document.querySelector('#stage').getBoundingClientRect();
            await window.WaveCanvasExportClock.paintBarrier(rafCount);
            if (diagnostic) marks.barrierMs = now() - tick;
            return { index, timeSec: index / 60, ...(diagnostic ? { marks } : {}) };
        },
        dispose() { worker?.terminate(); context?.close(); urls.forEach(url => URL.revokeObjectURL(url)); }
    });
}());
