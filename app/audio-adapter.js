(function () {
    'use strict';

    // Web Audio's Blackman window: mean(w^2) = 0.42^2 + (0.5^2 + 0.08^2) / 2.
    const BLACKMAN_POWER = 0.3046;
    const INPUT_GAIN = 1.5;
    const NOISE_FLOOR_DB = -100;
    const FFT_SIZE = 8192;

    function createSpectrumMapper(sampleRate, fftSize) {
        if (!Number.isFinite(sampleRate) || sampleRate < 8000 || fftSize < 512 || (fftSize & (fftSize - 1))) {
            throw new RangeError('Invalid sample rate or FFT size');
        }
        const binWidth = sampleRate / fftSize;
        const maxFrequency = Math.min(20000, sampleRate / 2);
        const edges = Array.from({ length: 9 }, (_, i) => i * 32);
        for (let i = 1; i <= 56; i++) edges.push(256 * Math.pow(maxFrequency / 256, i / 56));

        // Fractional bin-cell overlaps conserve power at band boundaries without duplicating bins.
        const bands = Array.from({ length: 64 }, (_, band) => {
            const cells = [];
            const low = Math.max(1, Math.floor(edges[band] / binWidth - 0.5));
            const high = Math.min(fftSize / 2 - 1, Math.ceil(edges[band + 1] / binWidth + 0.5));
            for (let bin = low; bin <= high; bin++) {
                const overlap = Math.min(edges[band + 1], (bin + 0.5) * binWidth)
                    - Math.max(edges[band], (bin - 0.5) * binWidth);
                if (overlap > 0) cells.push([bin, overlap / binWidth]);
            }
            return cells;
        });
        const output = new Array(128).fill(0);
        return Object.freeze({
            edges: Object.freeze(edges),
            map(decibels) {
                for (let band = 0; band < 64; band++) {
                    let power = 0;
                    for (const [bin, weight] of bands[band]) {
                        const db = decibels[bin];
                        if (Number.isFinite(db) && db > NOISE_FLOOR_DB) power += Math.pow(10, db / 10) * weight;
                    }
                    // Positive-frequency FFT power -> equivalent sine peak amplitude, then visual gain.
                    output[band] = Math.min(1, INPUT_GAIN * 2 * Math.sqrt(power / BLACKMAN_POWER));
                    output[64 + band] = output[band];
                }
                return output;
            }
        });
    }

    window.VisualizerAudioAdapter = Object.freeze({
        FFT_SIZE, INPUT_GAIN, BLACKMAN_POWER, NOISE_FLOOR_DB, createSpectrumMapper
    });
}());
