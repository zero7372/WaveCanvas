'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'../tests/artifacts');const dirs=fs.readdirSync(root).filter(n=>n.startsWith('home-benchmark-')&&fs.existsSync(path.join(root,n,'benchmark.json'))).sort();
if(dirs.length<2)throw Error('Need two completed benchmarks');
const a=path.join(root,dirs.at(-2)),b=path.join(root,dirs.at(-1));
const A=JSON.parse(fs.readFileSync(path.join(a,'benchmark.json'))),B=JSON.parse(fs.readFileSync(path.join(b,'benchmark.json')));
const probeA=JSON.parse(fs.readFileSync(path.join(a,'ffprobe.json'))),probeB=JSON.parse(fs.readFileSync(path.join(b,'ffprobe.json')));
const snapshotEqual=JSON.stringify(JSON.parse(fs.readFileSync(path.join(a,'snapshot.json'))))===JSON.stringify(JSON.parse(fs.readFileSync(path.join(b,'snapshot.json'))));
const normalizeBackground=value=>value.replace(/blob:file:\/\/\/[^"\)]+/g,'blob:local-image');
const selected=[];const ffmpeg=path.resolve(__dirname,'../../vendor/ffmpeg/ffmpeg.exe');
for(const frame of [0,60,120]){
 const stateA=A.states[frame],stateB=B.states[frame];
 const semanticEqual=JSON.stringify(stateA.samples)===JSON.stringify(stateB.samples)&&stateA.lyrics===stateB.lyrics&&normalizeBackground(stateA.background)===normalizeBackground(stateB.background);
 const png=name=>execFileSync(ffmpeg,['-v','error','-i',name,'-f','rawvideo','-pix_fmt','rgba','-'],{windowsHide:true,maxBuffer:10*1024*1024});
 const pixelsA=png(path.join(a,'raw-'+frame+'.png')),pixelsB=png(path.join(b,'raw-'+frame+'.png'));let max=0,changed=0;for(let i=0;i<pixelsA.length;i++){const d=Math.abs(pixelsA[i]-pixelsB[i]);max=Math.max(max,d);if(d)changed++;}
 for(const [dir,state] of [[a,stateA],[b,stateB]])fs.writeFileSync(path.join(dir,'canvas-'+frame+'.png'),Buffer.from(state.canvas.split(',')[1],'base64'));
 const canvasA=png(path.join(a,'canvas-'+frame+'.png')),canvasB=png(path.join(b,'canvas-'+frame+'.png'));let canvasMax=0,canvasChanged=0;
 for(let i=0;i<canvasA.length;i++){const d=Math.abs(canvasA[i]-canvasB[i]);canvasMax=Math.max(canvasMax,d);if(d)canvasChanged++;}
 selected.push({frame,semanticEqual,canvasPngExact:stateA.canvas===stateB.canvas,canvasMaxDelta:canvasMax,canvasChangedRatio:canvasChanged/canvasA.length,rawPixelsMaxDelta:max,rawPixelsChangedChannels:changed,changedRatio:changed/pixelsA.length});
}
const result={a,b,snapshotEqual,selected,pass:snapshotEqual&&selected.every(s=>s.semanticEqual&&s.canvasMaxDelta<=1&&s.canvasChangedRatio<.001&&s.rawPixelsMaxDelta<=1&&s.changedRatio<.001),toleranceNote:'Phase 1 Chromium rounding tolerance: maximum 1/255, less than 0.1% changed channels. Canvas PNG byte equality is reported separately.',timingNote:'Duration comparison verifies mux/clock endpoints; no manual auditory beat synchronization claim.'};
fs.writeFileSync(path.join(b,'comparison.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));process.exitCode=result.pass?0:1;
