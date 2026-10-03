(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    const layer = document.querySelector('#song-info-layer');
    const group = document.querySelector('#song-info-content');
    const title = document.querySelector('#song-info-title');
    const artist = document.querySelector('#song-info-artist');
    let settings = runtime.getStandalone().text;
    let frame = null, signature = '';
    function configure(next) {
        settings = next;
        layer.hidden = runtime.mode !== 'standalone' || !settings.enabled || (!settings.title && !settings.artist);
        title.textContent = settings.title; artist.textContent = settings.artist;
        title.hidden = !settings.title; artist.hidden = !settings.artist;
        group.style.left = settings.positionX * 19.2 + 'px'; group.style.top = settings.positionY * 10.8 + 'px';
        group.style.textAlign = settings.alignment;
        group.style.setProperty('--song-anchor', settings.alignment === 'left' ? '0%' : settings.alignment === 'right' ? '-100%' : '-50%');
        group.style.transformOrigin = settings.alignment + ' center';
        group.style.fontFamily = window.VisualizerSystemFonts.fontStack(settings.fontFamily);
        group.style.color = settings.color; group.style.gap = settings.lineGap + 'px';
        title.style.fontSize = 48 * settings.titleSizeRatio + 'px';
        artist.style.fontSize = 48 * settings.artistSizeRatio + 'px';
        const outline = settings.borderEnabled && settings.borderWidth > 0;
        group.style.webkitTextStroke = outline ? settings.borderWidth + 'px ' + settings.borderColor : '0px transparent';
        group.style.textShadow = outline && settings.borderBlur > 0 ? '0 0 ' + settings.borderBlur + 'px ' + settings.borderColor : 'none';
        draw();
    }
    function draw() {
        const scale = settings.scale * window.VisualizerSongInfoSettings.bassScale(window.audioSample, settings);
        group.style.transform = 'translate(var(--song-anchor), -50%) scale(' + scale + ')';
    }
    runtime.subscribe((_, standalone) => {
        const next = JSON.stringify(standalone.text);
        if (next !== signature) { signature = next; configure(standalone.text); }
    });
    if (runtime.mode === 'standalone') {
        function tick() { draw(); frame = requestAnimationFrame(tick); }
        frame = requestAnimationFrame(tick);
        window.addEventListener('pagehide', event => { if (!event.persisted) cancelAnimationFrame(frame); });
    }
}());
