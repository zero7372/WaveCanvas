'use strict';
// Assemble metadata from preserved evidence; no invented dependency locks or recipe.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'); process.chdir(root);
const evidence='dev/reports/archive/gpl-source-2026-10-03', metadata='dev/release-source';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');};
const rows=`cairo|LGPL/MPL|https://www.cairographics.org/|1.18.5
fontconfig|permissive|https://www.freedesktop.org/wiki/Software/fontconfig/|
iconv|LGPL|https://www.gnu.org/software/libiconv/|
gnutls|LGPL (library); mixed bundled parts|https://www.gnutls.org/|
libxml2|permissive|https://gitlab.gnome.org/GNOME/libxml2|
gmp|LGPL/GPL dual|https://gmplib.org/|
bzlib|permissive|https://sourceware.org/bzip2/|
lzma|mixed permissive/GPL tools|https://tukaani.org/xz/|
zlib|permissive|https://zlib.net/|
libsrt|MPL|https://github.com/Haivision/srt|v1.5.7-7-gcae8f62
libssh|LGPL|https://www.libssh.org/|0.12.2
libzmq|MPL|https://github.com/zeromq/libzmq|4.3.5
avisynth|GPL with interface exception|https://github.com/AviSynth/AviSynthPlus|v3.7.5-383-g5c82777b
sdl2|permissive|https://github.com/libsdl-org/SDL|release-2.32.0-234-gb90ac9502
libwebp|permissive|https://chromium.googlesource.com/webm/libwebp/|v1.6.0-249-g1f34635
libx264|GPL|https://code.videolan.org/videolan/x264|v0.165.3223
libx265|GPL|https://bitbucket.org/multicoreware/x265_git/|4.3-45-g116b875
libxvid|GPL|https://www.xvid.com/|v1.3.7
libaom|permissive|https://aomedia.googlesource.com/aom/|v3.15.0-25-g023743a7d7
libopenjpeg|permissive|https://github.com/uclouvain/openjpeg|2.5.4
libvpx|permissive|https://chromium.googlesource.com/webm/libvpx/|v1.17.0-57-gd2413e2ca
mediafoundation|system/runtime interface|https://learn.microsoft.com/en-us/windows/win32/medfound/microsoft-media-foundation-sdk|
libass|permissive|https://github.com/libass/libass|0.17.5-8-gb2fe9d8
libfreetype|FTL/GPL dual|https://freetype.org/|VER-2-14-3
libfribidi|LGPL|https://github.com/fribidi/fribidi|v1.0.16-19-gc928e4c
libharfbuzz|permissive|https://github.com/harfbuzz/harfbuzz|14.4.0-108-g64e2b532
libvidstab|LGPL at reported upstream commit; FFmpeg treats as GPL|https://github.com/georgmartius/vid.stab|v1.1.2-214-ge2445c4
libvmaf|permissive|https://github.com/Netflix/vmaf|v3.2.0-13-gf85a8536
libzimg|permissive|https://github.com/sekrit-twc/zimg|release-3.0.6-253-g67e0603
amf|permissive headers / external runtime|https://github.com/GPUOpen-LibrariesAndSDKs/AMF|v1.5.2-2-gc35f613
cuda-llvm|toolchain / hardware interface|https://llvm.org/|
cuvid|hardware interface|https://github.com/FFmpeg/nv-codec-headers|n13.1.15.0-1-geddcea9
dxva2|system/runtime interface|https://learn.microsoft.com/en-us/windows/win32/medfound/about-dxva-2-0|
d3d11va|system/runtime interface|https://learn.microsoft.com/en-us/windows/win32/direct3d11/|
d3d12va|system/runtime interface|https://learn.microsoft.com/en-us/windows/win32/direct3d12/|
ffnvcodec|permissive headers|https://github.com/FFmpeg/nv-codec-headers|n13.1.15.0-1-geddcea9
libvpl|permissive / external runtime|https://github.com/intel/libvpl|2.17
nvdec|hardware interface|https://github.com/FFmpeg/nv-codec-headers|n13.1.15.0-1-geddcea9
nvenc|hardware interface|https://github.com/FFmpeg/nv-codec-headers|n13.1.15.0-1-geddcea9
vaapi|permissive / external runtime|https://github.com/intel/libva|2.25.0.
openal|LGPL|https://github.com/kcat/openal-soft|1.25.2-48-g7532541
libgme|LGPL|https://github.com/libgme/game-music-emu|0.6.6
libopenmpt|permissive with bundled dependency licenses|https://lib.openmpt.org/|libopenmpt-0.6.30-3-g6c0a06bc
libopencore-amrwb|permissive Apache-2.0|https://sourceforge.net/projects/opencore-amr/|0.1.6
libmp3lame|LGPL|https://lame.sourceforge.io/|3.100
libtheora|permissive|https://github.com/xiph/theora|v1.2.0
libvo-amrwbenc|permissive Apache-2.0|https://sourceforge.net/projects/opencore-amr/|0.1.3
libgsm|permissive|https://www.quut.com/gsm/|1.0.24
libopencore-amrnb|permissive Apache-2.0|https://sourceforge.net/projects/opencore-amr/|0.1.6
libopus|permissive|https://github.com/xiph/opus|v1.6.1-68-g503d81b1
libspeex|permissive|https://github.com/xiph/speex|Speex-1.2.1-51-g0589522
libvorbis|permissive|https://github.com/xiph/vorbis|v1.3.7-37-g1b75110b
librubberband|GPL|https://github.com/breakfastquay/rubberband|v4.0.0`;
const config=fs.readFileSync(evidence+'/ffmpeg-buildconf.txt','utf8');
const flags=[...new Set(config.match(/--(?:enable|disable)-[\w-]+/g))];
const deps=rows.split('\n').map(row=>{const[id,classification,url,version]=row.split('|');return {id,flag:'--enable-'+id,classification,classificationStatus:'PRELIMINARY — exact source license review still BLOCKED',upstreamURL:url,reportedVersion:version||null,versionEvidence:'vendor/ffmpeg/README.txt',revision:null,sourceArchive:null,archiveSha256:null,sourceStatus:'BLOCKED',patchStatus:'BLOCKED',licenseStatus:'BLOCKED',exclusionReason:null,sourceRequirement:'Retain in scope pending verified source closure or documented System Library/general-tool exclusion'};});
for(const flag of flags.filter(f=>f.startsWith('--enable-')&&!['--enable-gpl','--enable-version3','--enable-static'].includes(f))) if(!deps.some(d=>d.flag===flag))throw Error('Uninventoried flag '+flag);
const acquired=[];
function add(id,revision,file,url,mappingStatus,basis){const full='release/gpl-source/upstream/'+file;const entry={id,revision,file,url,bytes:fs.statSync(full).size,sha256:hash(full),mappingStatus,basis,providerPatchState:'UNKNOWN',correspondingSourceStatus:'BLOCKED'};acquired.push(entry);return entry;}
const ff=add('ffmpeg','946fcce07b6dcd0331c8cc609192aeff5e1924f8','FFmpeg-946fcce07b6dcd0331c8cc609192aeff5e1924f8.zip','https://codeload.github.com/FFmpeg/FFmpeg/zip/946fcce07b6dcd0331c8cc609192aeff5e1924f8','PASS','Provider release + bundled README + official FFmpeg commit API');
const x264=add('x264','0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee','x264-0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee.zip','https://code.videolan.org/api/v4/projects/videolan%2Fx264/repository/archive.zip?sha=0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee','PASS','Binary string + real H.264 SEI r3223 0480cb0 + VideoLAN commit API');
for(const result of read(evidence+'/additional-source-downloads.json')){if(result.status!=='fulfilled')throw Error('Source download failed');const a=result.value;add(a.id,a.revision,a.file,a.url,a.id==='rubberband'?'BLOCKED':'PASS',a.id==='rubberband'?'Provider release version matches tag; pristine provider state unproven':'Provider reported short hash resolved by official upstream commit API');}
add('xvid',null,'xvidcore-1.3.7.tar.gz','https://downloads.xvid.com/downloads/xvidcore-1.3.7.tar.gz','BLOCKED','Provider release version matches official archive; no provider source-state attestation');
const ids={x264:'libx264',vidstab:'libvidstab',rubberband:'librubberband',avisynth:'avisynth',xvid:'libxvid'};
for(const a of acquired){const d=deps.find(d=>d.id===ids[a.id]);if(d)Object.assign(d,{revision:a.revision,sourceArchive:a.file,archiveSha256:a.sha256,upstreamMappingStatus:a.mappingStatus});}
const inventory={status:'BLOCKED',directFlagCoverage:'PASS',flags,dependencies:deps,transitiveClosure:{status:'BLOCKED',reason:'No provider static link map / full package lock. Explicit flags do not enumerate transitive source closure.',candidatesNotConfirmed:['libogg','pixman','expat','brotli','libpng','nettle','hogweed','libtasn1','p11-kit','libidn2','libunistring','libintl/gettext','pcre2','graphite2','FFT backend (FFTW/KissFFT)','winpthreads','libgcc','libstdc++'],providerREADMEExtras:['cuda','libmfx'],exclusions:[]}};
write(metadata+'/DEPENDENCIES.json',inventory);
const binaries=read(evidence+'/binary-verification.json');
const m={schemaVersion:1,wavecanvasVersion:'1.0.0',status:'BLOCKED',publicReleaseReady:false,binaryVersion:'9.0.2-essentials_build-www.gyan.dev',ffmpegBinary:{name:'ffmpeg.exe',...binaries['ffmpeg.exe']['vendor/ffmpeg']},ffprobeBinary:{name:'ffprobe.exe',...binaries['ffprobe.exe']['vendor/ffmpeg']},ffmpegSource:{...ff,archiveSha256:ff.sha256},libx264Source:{...x264,archiveSha256:x264.sha256},acquiredSources:acquired,dependencies:deps,staticClosureStatus:'BLOCKED',patches:{wavecanvas:'None applied to acquired snapshots',provider:null,status:'BLOCKED'},buildRecipe:{path:'BUILD-RECIPE.md',status:'BLOCKED',providerScripts:null,compiler:'gcc 16.2.0 (Rev3, MSYS2)',environment:'UCRT64 (provider site); full package locks unknown'},licenseClosureStatus:'BLOCKED',sourceArchive:null,sourceArchiveSha256:null,preparationArchive:'WaveCanvas-1.0.0-GPL-Source-PREPARATION.zip',plannedCompleteArtifact:'WaveCanvas-1.0.0-GPL-Source.zip',deliveryURL:null,deliveryURLPlaceholder:'<OFFICIAL_RELEASE_URL>',deliveryStatus:'BLOCKED',deliveryStrategy:'Separate complete source asset free alongside installer; no written offer',configurationSha256:hash(evidence+'/ffmpeg-buildconf.txt'),transitiveClosure:inventory.transitiveClosure};
write(metadata+'/SOURCE-MANIFEST.json',m);
write('licenses/FFmpeg/SOURCE_MANIFEST.json',m);
fs.copyFileSync(evidence+'/ffmpeg-buildconf.txt','licenses/FFmpeg/BUILD_CONFIG.txt');
fs.copyFileSync(metadata+'/DEPENDENCIES.json','licenses/FFmpeg/DEPENDENCIES.json');
const extracted='release/gpl-source/extracted';const dirs=fs.readdirSync(extracted);
const licenseCopies=[['x264','COPYING','x264-COPYING'],['rubberband','COPYING','rubberband-COPYING'],['vid.stab','COPYING.LESSER','vidstab-COPYING.LESSER'],['vid.stab','LICENSE','vidstab-LICENSE'],['vid.stab','RELICENSE.md','vidstab-RELICENSE.md'],['AviSynthPlus','distrib/docs/english/source/avisynthdoc/license.rst','avisynth-LICENSE.rst'],['xvidcore','LICENSE','xvid-LICENSE']];
for(const [prefix,from,to] of licenseCopies){const dir=dirs.find(d=>d.startsWith(prefix));fs.mkdirSync('licenses/FFmpeg/dependencies',{recursive:true});fs.copyFileSync(path.join(extracted,dir,from),'licenses/FFmpeg/dependencies/'+to);}
write('licenses/FFmpeg/SOURCE_INFO.txt',`WaveCanvas 1.0.0 bundled FFmpeg source status: BLOCKED\nBinary: ${m.binaryVersion}\nBinary identities: SHA256.txt and SOURCE_MANIFEST.json\nFFmpeg upstream commit: ${ff.revision}\nx264 upstream commit: ${x264.revision} (binary/SEI r3223 0480cb0)\nComplete source asset planned: ${m.plannedCompleteArtifact}\nPreparation-only asset: ${m.preparationArchive} — NOT complete Corresponding Source.\nRelease location: <OFFICIAL_RELEASE_URL> — unresolved metadata; must be replaced before public release.\nDirect free source delivery beside installer is planned; no written offer is made.\nFull configuration: BUILD_CONFIG.txt. External inventory: DEPENDENCIES.json.\nSelected dependency licenses in dependencies/; complete exact-source notice closure remains BLOCKED.\nProvider patches, transitive dependencies and matching build recipe remain UNKNOWN / NOT DELIVERED.\nUpstream snapshots and version mappings do not establish pristine provider source state.\nNo WaveCanvas patches applied to acquired snapshots; provider patches are not assumed absent.\nDo not distribute this RC publicly until complete source delivery and release metadata pass all gates.\npublicReleaseReady=false; signed=false (separate signing status).\n`);
const table=deps.map(d=>`| ${d.id} | ${d.reportedVersion||'Not supplied'} | ${d.classification} | ${d.upstreamMappingStatus||'BLOCKED'} |`).join('\n');
write(metadata+'/DEPENDENCIES.md',`# External dependency audit\n\nAll ${deps.length} explicit external/hardware enable flags are inventoried. Classifications are preliminary upstream families, not an exact-source license certificate. Every provider patch/source/notice closure remains BLOCKED. MPL and dual-license components are called out rather than mislabeled permissive.\n\n| Component | Provider version | Preliminary license family | Upstream revision mapping |\n|---|---|---|---|\n${table}\n\nAviSynthPlus is an additional GPL/interface-exception component; Windows FFmpeg uses runtime loading, so no installed avisynth.dll is claimed. Acquired source/headers are retained conservatively. vid.stab reported commit contains LGPL-2.1-or-later LICENSE and RELICENSE.md, although FFmpeg's exact LICENSE.md/configure still places it in the GPL group. Preserve its exact upstream texts and keep Gyan patch state unresolved.\n\nStatic linking means permissive/LGPL/MPL components cannot simply be omitted from combined-source scope. DEPENDENCIES.json includes potential transitive components (not confirmed linked) and no assumed exclusions. A static link map, package lock and per-component exclusion review are still required. Hardware flags describe headers/interfaces, not driver redistribution. GCC/MinGW runtimes need exact package/licensing/system-library analysis; compiler identification alone does not close this.\n`);
console.log('Prepared BLOCKED manifest; '+deps.length+' external flags; '+acquired.length+' acquired upstream archives.');
