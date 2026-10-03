'use strict';
// Internal installer QA only. Production version remains canonical package.json.
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
process.env.ELECTRON_BUILDER_CACHE=path.join(root,'.electron-builder-cache');
process.env.ELECTRON_CACHE=path.join(root,'.electron-cache');
process.env.CSC_IDENTITY_AUTO_DISCOVERY='false';
const {build,Platform,Arch}=require('electron-builder');
build({targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),config:{directories:{output:'dist/upgrade-rc'},extraMetadata:{version:'1.0.0-rc.1'}}}).catch(error=>{console.error(error);process.exitCode=1;});
