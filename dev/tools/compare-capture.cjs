'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const [golden,candidate]=process.argv.slice(2).map(p=>path.resolve(p));if(!candidate)throw Error('Usage: compare-capture.cjs golden-directory candidate-directory');
const read=(d,n)=>JSON.parse(fs.readFileSync(path.join(d,n)));const A=read(golden,'benchmark.json'),B=read(candidate,'benchmark.json'),ca=read(golden,'config.json'),cb=read(candidate,'config.json');
const ffmpeg=path.resolve(__dirname,'../../vendor/ffmpeg/ffmpeg.exe');
const decode=file=>execFileSync(ffmpeg,['-v','error','-i',file,'-f','rawvideo','-pix_fmt','rgba','-'],{windowsHide:true,maxBuffer:10*1024*1024});
const decodeCanvas=data=>execFileSync(ffmpeg,['-v','error','-f','image2pipe','-i','pipe:0','-f','rawvideo','-pix_fmt','rgba','-'],{input:Buffer.from(data.split(',')[1],'base64'),windowsHide:true,maxBuffer:10*1024*1024});
function diff(a,b,mask=false){let max=0,changed=0,total=0,channels=0;for(let i=0;i<a.length;i++){if(mask&&Math.floor(i/4)%1920<16&&Math.floor(i/4/1920)<16)continue;const delta=Math.abs(a[i]-b[i]);max=Math.max(max,delta);if(delta)changed++;total+=delta;channels++;}return {max,changed,ratio:changed/channels,meanAbsolute:total/channels};}
const normalize=value=>JSON.parse(JSON.stringify(value).replace(/blob:file:\/\/\/[^"\\)]+/g,'blob:local-image'));
const exactState=s=>{const {canvas,heapBytes,...rest}=s;return normalize(rest);};
const selected=[];
for(const index of ca.selected){if(!A.states[index]||!B.states[index])continue;
 const semanticExact=JSON.stringify(exactState(A.states[index]))===JSON.stringify(exactState(B.states[index]));const canvas=diff(decodeCanvas(A.states[index].canvas),decodeCanvas(B.states[index].canvas));const pixels=decode(path.join(candidate,'raw-'+index+'.png')),composite=diff(decode(path.join(golden,'raw-'+index+'.png')),pixels,ca.witness!==cb.witness);const neighbors={};
 for(const n of [index-1,index+1])if(n>=0&&fs.existsSync(path.join(golden,'raw-'+n+'.png')))neighbors[n]=diff(decode(path.join(golden,'raw-'+n+'.png')),pixels,ca.witness!==cb.witness).meanAbsolute;
 selected.push({index,semanticExact,canvas,composite,neighborMeanAbsolute:neighbors,pass:semanticExact&&canvas.max<=1&&canvas.ratio<.001&&composite.max<=1&&composite.ratio<.001});
}
const result={golden,candidate,snapshotExact:JSON.stringify(read(golden,'snapshot.json'))===JSON.stringify(read(candidate,'snapshot.json')),selected,witnessErrors:B.witnessErrors,pass:false,tolerance:'Phase 1 maximum 1/255 and changed channels <0.1%; current compositor must match exact frame, no one-frame lag.'};result.pass=result.snapshotExact&&selected.length>0&&selected.every(r=>r.pass)&&!B.witnessErrors.length;
fs.writeFileSync(path.join(candidate,'comparison.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({candidate,pass:result.pass,witnessErrors:result.witnessErrors.length,frames:selected.map(r=>({index:r.index,pass:r.pass,max:r.composite.max,ratio:r.composite.ratio,semantic:r.semanticExact}))},null,2));process.exitCode=result.pass?0:1;
