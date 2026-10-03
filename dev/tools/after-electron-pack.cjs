const fs=require('node:fs'),path=require('node:path');
module.exports=async context=>{
    const directory=path.resolve(context.appOutDir),dist=path.resolve(__dirname,'../../dist');
    if (!directory.startsWith(dist+path.sep)) throw Error('Refusing cleanup outside generated dist');
    const demo=path.resolve(directory,'resources/default_app.asar');
    if (!demo.startsWith(directory+path.sep)) throw Error('Invalid generated resource path');
    // electronDist preserves the upstream Getting Started demo; it is not a WaveCanvas runtime dependency.
    if (fs.existsSync(demo)) fs.unlinkSync(demo);
};
