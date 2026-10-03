'use strict';
const path = require('node:path');
// argv is already tokenized by Windows/Electron. Never split or execute it.
function projectArgument(argv) {
    return argv.find(value => typeof value === 'string' && !value.startsWith('-') && !value.includes('\0') && path.isAbsolute(value) && /\.waveproj$/i.test(value)) || null;
}
module.exports = { projectArgument };
