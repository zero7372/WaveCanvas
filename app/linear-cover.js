(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    let opacity = 1, angle = 0, previousTime = null, previousImage = null;
    let previousLayout, previousShape;
    runtime.subscribe((properties, standalone) => {
        opacity = properties.circleopacity.value / 100;
        const { layout, coverShape } = standalone.visualizer;
        if (layout !== previousLayout || coverShape !== previousShape) previousTime = null;
        previousLayout = layout; previousShape = coverShape;
    });
    function draw(ctx, config, appearance, now = performance.now()) {
        const image = appearance.image;
        if (!image) { previousTime = null; previousImage = null; return; }
        if (image !== previousImage) previousTime = null;
        previousImage = image;
        const circle = config.coverShape === 'circle';
        if (circle && previousTime !== null) {
            // RPM -> degrees/second; elapsed time keeps rotation independent of FPS.
            angle = (angle + config.coverRotationSpeed * 6 * Math.max(0, now - previousTime) / 1000) % 360;
        }
        previousTime = circle ? now : null;
        const baseHalf = 1080 * config.coverSize / 200;
        const half = Math.max(0, baseHalf + (appearance.bass.center || 0));
        ctx.save();
        ctx.translate(1920 * config.coverX / 100 + appearance.shakeX, 1080 * config.coverY / 100 + appearance.shakeY);
        ctx.scale(half / baseHalf, half / baseHalf);
        ctx.globalAlpha *= opacity;
        if (circle) {
            ctx.beginPath(); ctx.arc(0, 0, baseHalf, 0, Math.PI * 2); ctx.clip();
            ctx.rotate(angle * Math.PI / 180);
        }
        if (circle) {
            const side = Math.min(image.naturalWidth, image.naturalHeight);
            ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side,
                -baseHalf, -baseHalf, baseHalf * 2, baseHalf * 2);
        } else {
            // Unclipped artwork retains its full rectangular aspect ratio.
            const longest = Math.max(image.naturalWidth, image.naturalHeight);
            const width = baseHalf * 2 * image.naturalWidth / longest;
            const height = baseHalf * 2 * image.naturalHeight / longest;
            ctx.drawImage(image, -width / 2, -height / 2, width, height);
        }
        ctx.restore();
    }
    window.VisualizerLinearCover = Object.freeze({ draw });
}());
