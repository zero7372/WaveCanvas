'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),directory=path.resolve(process.argv[2]||path.join(root,'dev/ffmpeg-build/output'));
const output=path.join(root,'dev/ffmpeg-build/workspace/qa');fs.mkdirSync(output,{recursive:true});
const ffmpeg=path.join(directory,'ffmpeg.exe'),ffprobe=path.join(directory,'ffprobe.exe');
const fixtureRoot=path.join(root,'dev/tests/fixtures/controlled-ffmpeg-audio');
const fixtureManifest=JSON.parse(fs.readFileSync(path.join(fixtureRoot,'MANIFEST.json'),'utf8'));
const run=(exe,args)=>cp.execFileSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:16000000});
const checks=[];const check=(value,label)=>{checks.push({pass:!!value,label});assert.ok(value,label);console.log('PASS '+label);};
async function main(){
    try{
        for(const option of ['version','buildconf','encoders','decoders','demuxers','muxers','protocols']){
            const result=cp.spawnSync(ffmpeg,['-'+option],{encoding:'utf8',windowsHide:true,maxBuffer:16000000});
            check(result.status===0,'Feature command -'+option);fs.writeFileSync(path.join(output,option+'.txt'),result.stdout+result.stderr);
        }
        const encoders=fs.readFileSync(path.join(output,'encoders.txt'),'utf8'),muxers=fs.readFileSync(path.join(output,'muxers.txt'),'utf8');
        check(/\blibx264\b/.test(encoders)&&/\baac\b/.test(encoders),'libx264 and native AAC encoders');
        check(/\bmp4\b/.test(muxers),'MP4 muxer');
        check(run(ffprobe,['-version']).includes('9.0.2-wavecanvas-controlled'),'Controlled ffprobe version');
        const fixtures=[['wav','pcm_s16le'],['mp3','libmp3lame'],['flac','flac'],['ogg','libvorbis'],['opus','libopus'],['m4a','aac'],['aac','aac']];
        for(const [extension,codec] of fixtures){
            const file=path.join(output,'input.'+extension);
            if(['mp3','ogg','opus'].includes(extension)){
                const content=fs.readFileSync(path.join(fixtureRoot,'input.'+extension));
                assert.equal(crypto.createHash('sha256').update(content).digest('hex'),fixtureManifest.files['input.'+extension]);
                fs.writeFileSync(file,content);
            }else run(ffmpeg,['-v','error','-y','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','6','-c:a',codec,file]);
            const target=path.join(output,'decoded-'+extension+'.m4a');
            run(ffmpeg,['-v','error','-y','-i',file,'-t','1','-c:a','aac',target]);
            const probe=JSON.parse(run(ffprobe,['-v','error','-show_streams','-of','json',target]));
            check(probe.streams.some(s=>s.codec_name==='aac'&&Number(s.duration)>.9),'Decode/probe/transcode '+extension.toUpperCase());
        }
        const target=path.join(output,'cli-300.mp4'),args=require('../../../electron/ffmpeg-runner.cjs').args(path.join(output,'input.wav'),target,300);
        const proc=cp.spawn(ffmpeg,args,{windowsHide:true,stdio:['pipe','ignore','pipe']});let stderr='';proc.stderr.on('data',b=>stderr+=b);proc.stdin.on('error',()=>{});
        const completed=new Promise((resolve,reject)=>{proc.on('error',reject);proc.on('close',code=>code===0?resolve():reject(Error(stderr)));});
        const frame=Buffer.alloc(1920*1080*4);for(let y=0;y<1080;y++)for(let x=0;x<1920;x++){const p=(y*1920+x)*4;frame[p]=x%256;frame[p+1]=y%256;frame[p+2]=(x+y)%256;frame[p+3]=255;}
        for(let i=0;i<300;i++)await new Promise((resolve,reject)=>proc.stdin.write(frame,e=>e?reject(e):resolve()));proc.stdin.end();await completed;
        const probe=JSON.parse(run(ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',target]));fs.writeFileSync(path.join(output,'cli-probe.json'),JSON.stringify(probe,null,2));
        const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');
        check(video.codec_name==='h264'&&video.width===1920&&video.height===1080&&video.r_frame_rate==='60/1'&&video.pix_fmt==='yuv420p'&&Number(video.nb_read_frames)===300,'Unchanged production BGRA pipe / libx264 medium CRF18 / 1080p60 / 300 frames / yuv420p');
        check(audio.codec_name==='aac'&&Math.abs(Number(video.duration)-Number(audio.duration))<1/60,'Native AAC and A/V duration difference < one frame');
        const atoms=[],bytes=fs.readFileSync(target);for(let at=0;at+8<=bytes.length;){const size=bytes.readUInt32BE(at);atoms.push(bytes.toString('ascii',at+4,at+8));if(size<8)break;at+=size;}
        check(atoms.indexOf('moov')>=0&&atoms.indexOf('moov')<atoms.indexOf('mdat'),'MP4 faststart moov precedes mdat');
        for(const name of ['ffmpeg','ffprobe']){
            const imports=[...fs.readFileSync(path.join(directory,name+'-PE.txt'),'utf8').matchAll(/DLL Name: (.+)/g)].map(m=>m[1].trim());
            check(imports.length>0&&imports.every(d=>/^(api-ms-win-.*|bcrypt|gdi32|kernel32|ole32|oleaut32|shell32|shlwapi|user32|avicap32|advapi32|ws2_32)\.dll$/i.test(d)),name+' imports Windows system DLLs only');
        }
    }catch(error){checks.push({pass:false,label:error.stack});console.error(error.stack);process.exitCode=1;}
    finally{fs.writeFileSync(path.join(output,'isolated-results.json'),JSON.stringify({checks,directory,binaries:['ffmpeg.exe','ffprobe.exe'].map(file=>({file,bytes:fs.statSync(path.join(directory,file)).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')}))},null,2)+'\n');}
}
main();
