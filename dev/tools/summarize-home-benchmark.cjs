// Summarize one-second host samples. CPU is normalized across 16 logical CPUs.
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../tests/artifacts');
const names=fs.readdirSync(root).filter(n=>n.startsWith('home-benchmark-')).sort();
for(const name of names){const dir=path.join(root,name);if(!fs.existsSync(path.join(dir,'aggregate.json')))continue;
 const result=JSON.parse(fs.readFileSync(path.join(dir,'aggregate.json')));
 const rows=fs.readFileSync(path.join(dir,'process-samples.jsonl'),'utf8').trim().split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));
 const gpu=fs.readFileSync(path.join(dir,'gpu-samples.csv'),'utf8').trim().split(/\r?\n/).filter(Boolean).map(s=>s.split(',').slice(1).map(Number));
 const stats=a=>({mean:a.reduce((s,v)=>s+v,0)/a.length,max:Math.max(...a),count:a.length});
 const cpu={electron:[],ffmpeg:[]},memory={electron:[],ffmpeg:[]};
 rows.forEach((r,i)=>{const processes=Array.isArray(r.processes)?r.processes:[r.processes];for(const group of Object.keys(cpu)){const current=processes.filter(p=>p.ProcessName===group);memory[group].push(current.reduce((s,p)=>s+p.WorkingSet64,0));if(!i)continue;const previous=Array.isArray(rows[i-1].processes)?rows[i-1].processes:[rows[i-1].processes];const elapsed=(r.timestamp-rows[i-1].timestamp)/1000;let ticks=0;for(const p of current){const old=previous.find(v=>v.Id===p.Id);if(old)ticks+=Math.max(0,p.CPU-old.CPU);}if(current.length)cpu[group].push(100*ticks/elapsed/16);}});
 const utilization={cpu:Object.fromEntries(Object.entries(cpu).map(([k,v])=>[k,stats(v)])),memory:Object.fromEntries(Object.entries(memory).map(([k,v])=>[k,stats(v)])),gpu:stats(gpu.map(r=>r[0])),encoder:stats(gpu.map(r=>r[1])),gpuMemoryMiB:stats(gpu.map(r=>r[2]))};
 fs.writeFileSync(path.join(dir,'utilization.json'),JSON.stringify(utilization,null,2));console.log(JSON.stringify({directory:name,...result,utilization}));
}
