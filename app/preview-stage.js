(function () {
    'use strict';
    const standalone = window.VisualizerRuntime.mode === 'standalone';
    document.body.classList.add(standalone ? 'runtime-standalone' : 'runtime-we');
    const container = document.querySelector('#preview-container');
    const stage = document.querySelector('#stage');
    const width = 1920, height = 1080;
    function fit() {
        if (!standalone) return;
        const scale = Math.max(0, Math.min(container.clientWidth / width, container.clientHeight / height));
        stage.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
    }
    function resizeCanvas(canvas) {
        if (standalone) {
            if (canvas.width !== width) canvas.width = width;
            if (canvas.height !== height) canvas.height = height;
            fit();
        } else {
            canvas.width = canvas.scrollWidth;
            canvas.height = canvas.scrollHeight;
        }
    }
    if (standalone) {
        new ResizeObserver(fit).observe(container);
        fit();
    }
    window.addEventListener('resize', fit);
    window.VisualizerStage = Object.freeze({ width, height, fit, resizeCanvas,
        toStage(clientX, clientY) {
            const rect = stage.getBoundingClientRect();
            if (!rect.width || !rect.height) return null;
            return { x: (clientX - rect.left) * width / rect.width, y: (clientY - rect.top) * height / rect.height };
        }
    });
}());
