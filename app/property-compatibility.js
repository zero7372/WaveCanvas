(function () {
    'use strict';
    // Historical schema keys remain readable for old presets / WE property messages only.
    const retired = new Set([
        'showclock', 'bassshakeclock', 'hrmode', 'userhrposx', 'userhrposy', 'showsecs', 'showday', 'texttype',
        'userdayposx', 'userdayposy', 'removecolon', 'clockfont', 'clocksize', 'clockcolor', 'clockopacity',
        'blurclkvalue', 'clockpositionx1', 'clockpositiony1', 'clkbassmultiplier',
        'showtext', 'textfont', 'textsize', 'textcolor', 'textopacity', 'blurtxtvalue', 'textpositionx', 'textpositiony',
        'backgroundvideonumber', 'blurvalue', 'schemecolor',
        'customrandomdirectory', 'slideshowInterval', 'slideshowIntervalMultiplier', 'imageoptions'
    ]);
    const hidden = new Set([...retired, 'bassshaketext', 'txtbassmultiplier']);
    window.VisualizerPropertyCompatibility = Object.freeze({
        retired: key => retired.has(key),
        visible: key => !hidden.has(key) && key !== 'clock',
        options: (key, options) => key === 'backgroundsource' ? options.filter(option => option.value !== 4 && option.value !== 3) : options,
        value: (key, value) => key === 'backgroundsource' ? (value === 3 ? 2 : value === 4 ? 1 : value) : value
    });
}());
