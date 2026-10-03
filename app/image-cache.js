(function () {
    'use strict';
    const cache = new Map();
    let logo = null;
    let logoVersion = 0;
    let logoSource = null;

    function load(url) {
        if (cache.has(url)) return cache.get(url);
        const image = new Image();
        const promise = new Promise((resolve, reject) => {
            if (typeof image.decode === 'function') {
                image.src = url;
                image.decode().then(() => resolve(image), reject);
            } else {
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error('Image could not be loaded'));
                image.src = url;
            }
        });
        cache.set(url, promise);
        promise.catch(() => { if (cache.get(url) === promise) cache.delete(url); });
        return promise;
    }

    function setLogo(url) {
        if (logoSource && logoSource !== url) cache.delete(logoSource);
        logoSource = url;
        const version = ++logoVersion;
        logo = null;
        if (!url) return;
        load(url).then(image => {
            if (version === logoVersion) logo = image;
        }).catch(() => {}); // WE may send missing paths; leave the image undrawn safely.
    }

    window.VisualizerImages = Object.freeze({ load, setLogo, getLogo: () => logo, forget: url => cache.delete(url) });
}());
