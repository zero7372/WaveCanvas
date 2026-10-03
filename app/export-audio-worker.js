self.window = self;
importScripts('audio-adapter.js');
self.onmessage = ({ data }) => {
    try {
        const { pcm, sampleRate, count } = data, n = self.VisualizerAudioAdapter.FFT_SIZE;
        const real = new Float64Array(n), imaginary = new Float64Array(n), db = new Float32Array(n / 2);
        const windowing = new Float64Array(n), reversed = new Uint16Array(n);
        for (let i = 0; i < n; i++) {
            windowing[i] = .42 - .5 * Math.cos(2 * Math.PI * i / n) + .08 * Math.cos(4 * Math.PI * i / n);
            let x = i, r = 0; for (let bit = 0; bit < 13; bit++) { r = (r << 1) | (x & 1); x >>>= 1; } reversed[i] = r;
        }
        const mapper = self.VisualizerAudioAdapter.createSpectrumMapper(sampleRate, n);
        const cache = new Float32Array(count * 128);
        for (let frame = 0; frame < count; frame++) {
            const end = Math.floor(frame * sampleRate / 30);
            imaginary.fill(0);
            for (let i = 0; i < n; i++) real[reversed[i]] = (pcm[end - n + i] || 0) * windowing[i];
            for (let size = 2; size <= n; size *= 2) {
                const angle = -2 * Math.PI / size, wr = Math.cos(angle), wi = Math.sin(angle);
                for (let base = 0; base < n; base += size) {
                    let tr = 1, ti = 0;
                    for (let j = 0; j < size / 2; j++) {
                        const a = base + j, b = a + size / 2;
                        const br = real[b] * tr - imaginary[b] * ti, bi = real[b] * ti + imaginary[b] * tr;
                        real[b] = real[a] - br; imaginary[b] = imaginary[a] - bi; real[a] += br; imaginary[a] += bi;
                        const next = tr * wr - ti * wi; ti = tr * wi + ti * wr; tr = next;
                    }
                }
            }
            for (let bin = 0; bin < db.length; bin++) db[bin] = 20 * Math.log10(Math.hypot(real[bin], imaginary[bin]) / n);
            cache.set(mapper.map(db), frame * 128);
            if (frame % 120 === 0) self.postMessage({ progress: frame / count });
        }
        self.postMessage({ cache }, [cache.buffer]);
    } catch (error) { self.postMessage({ error: error.message }); }
};
