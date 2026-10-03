(function () {
    'use strict';
    // PCM is scanned once. Higher levels combine peaks without revisiting PCM.
    async function build(buffer, cancelled = () => false) {
        const stride = 128, length = Math.ceil(buffer.length / stride);
        const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
        let min = new Float32Array(length), max = new Float32Array(length);
        for (let chunk = 0; chunk < length; chunk += 4096) {
            if (cancelled()) return null;
            const end = Math.min(length, chunk + 4096);
            for (let bucket = chunk; bucket < end; bucket++) {
                let low = 0, high = 0;
                for (let sample = bucket * stride; sample < Math.min(buffer.length, (bucket + 1) * stride); sample++) {
                    for (const channel of channels) { const value = Number.isFinite(channel[sample]) ? channel[sample] : 0; low = Math.min(low, value); high = Math.max(high, value); }
                }
                min[bucket] = low; max[bucket] = high;
            }
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        const levels = [{ min, max, stride }];
        while (min.length > 1) {
            const nextMin = new Float32Array(Math.ceil(min.length / 2)), nextMax = new Float32Array(nextMin.length);
            for (let i = 0; i < nextMin.length; i++) { nextMin[i] = Math.min(min[i * 2], min[i * 2 + 1] ?? 0); nextMax[i] = Math.max(max[i * 2], max[i * 2 + 1] ?? 0); }
            min = nextMin; max = nextMax; levels.push({ min, max, stride: levels.at(-1).stride * 2 });
        }
        return { sampleRate: buffer.sampleRate, duration: buffer.duration, levels };
    }
    function level(cache, secondsPerPixel) {
        const samples = cache.sampleRate * secondsPerPixel;
        let chosen = cache.levels[0];
        for (const candidate of cache.levels) { if (candidate.stride > samples) break; chosen = candidate; }
        return chosen;
    }
    window.VisualizerWaveform = Object.freeze({ build, level });
}());
