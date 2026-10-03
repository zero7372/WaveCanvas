(function () {
    'use strict';
    if (window.VisualizerRuntime.mode !== 'standalone') return;
    const audio = document.querySelector('#local-audio'), preferences = window.WaveCanvasPreferences;
    let selection = 0, listener;
    window.addEventListener('local-audio-change', () => {
        const token = ++selection, file = window.VisualizerLocalAudio.getFile();
        if (listener) audio.removeEventListener('canplay', listener);
        listener = null;
        if (!file) return;
        const userInitiated = !window.WaveCanvasProject?.getState().busy;
        preferences.ready.then(() => {
            if (token !== selection) return;
            audio.volume = preferences.get().playback.defaultVolume;
            if (!userInitiated || !preferences.get().playback.autoPlayOnLoad) return;
            const play = () => { if (token === selection && !audio.error && preferences.get().playback.autoPlayOnLoad) audio.play().catch(error => console.warn('Auto-play:', error.message)); };
            if (audio.readyState >= 3 && !audio.error) play(); else { listener = play; audio.addEventListener('canplay', play, { once:true }); }
        });
    });
}());
