'use strict';
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..', '..');
const command = process.argv[2];
const env = { ...process.env, ELECTRON_CACHE: path.join(root, '.electron-cache'),
    electron_config_cache: path.join(root, '.electron-cache'), ELECTRON_BUILDER_CACHE: path.join(root, '.electron-builder-cache') };
delete env.ELECTRON_RUN_AS_NODE;
process.env.ELECTRON_CACHE = env.ELECTRON_CACHE;
process.env.electron_config_cache = env.electron_config_cache;
const electron = require('electron'); // Electron 44 lazily installs its binary on first use.
let child;
if (command === 'build' || command === 'release') child = spawn(process.execPath, [require.resolve('electron-builder/out/cli/cli.js'), '--win', ...(command === 'release' ? ['nsis', '-c.directories.output=release'] : ['--dir']), '--x64'], { cwd: root, env: { ...env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }, stdio: 'inherit' });
else if (command === 'dev' || command === 'start') child = spawn(electron, ['.', ...(command === 'dev' ? ['--dev'] : [])], { cwd: root, env, stdio: 'inherit' });
else throw new Error('Expected dev, start or build');
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
