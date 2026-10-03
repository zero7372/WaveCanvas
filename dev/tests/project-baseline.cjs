'use strict';
// Compare historical snapshots after removing only the Project v1 additive interfaces.
// Original FFT, listener, rendering, parsing and audio sampling code still use their original hashes.
module.exports = function projectBaseline(file, source) {
    if (!/\.(?:js|css)$/.test(file)) return source;
    source = source.toString('utf8');
    if (file === 'local-audio.js') source = source.replace('load: loadFile, ', '');
    if (file === 'runtime-adapter.js') source = source.replace(/        exportProjectSettings\(\) \{[\s\S]*?(?=        getStandaloneDefaults:)/, '');
    if (file === 'lyrics-runtime.js') source = source.replace(/            restoreDocuments\(documents\) \{[\s\S]*?            \},\r?\n/, '');
    if (file === 'lyrics-ui.js') source = source.replace(/^            window\.dispatchEvent\(new CustomEvent\('wavecanvas-lyrics-file'.*\r?\n/gm, '');
    if (file === 'timing-model.js') source = source.replace(/    function reserveId\(doc\) \{[\s\S]*?    \}\r?\n/, '').replace('fromText, reserveId, snapshot', 'fromText, snapshot');
    if (file === 'local-files.js') source = source.replace(/^.*(?:const sourceFiles =|sourceFiles\.set\(|sourceFiles\.delete\(|getFile: key => sourceFiles\.get).*\r?\n/gm, '');
    if (file === 'standalone.css') source = source.replace(/\/\* Desktop project status and persistent recent projects\. \*\/[\s\S]*$/, '');
    return source;
};
