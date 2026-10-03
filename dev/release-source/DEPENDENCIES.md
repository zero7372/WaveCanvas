# External dependency audit

All 53 explicit external/hardware enable flags are inventoried. Classifications are preliminary upstream families, not an exact-source license certificate. Every provider patch/source/notice closure remains BLOCKED. MPL and dual-license components are called out rather than mislabeled permissive.

| Component | Provider version | Preliminary license family | Upstream revision mapping |
|---|---|---|---|
| cairo | 1.18.5 | LGPL/MPL | BLOCKED |
| fontconfig | Not supplied | permissive | BLOCKED |
| iconv | Not supplied | LGPL | BLOCKED |
| gnutls | Not supplied | LGPL (library); mixed bundled parts | BLOCKED |
| libxml2 | Not supplied | permissive | BLOCKED |
| gmp | Not supplied | LGPL/GPL dual | BLOCKED |
| bzlib | Not supplied | permissive | BLOCKED |
| lzma | Not supplied | mixed permissive/GPL tools | BLOCKED |
| zlib | Not supplied | permissive | BLOCKED |
| libsrt | v1.5.7-7-gcae8f62 | MPL | BLOCKED |
| libssh | 0.12.2 | LGPL | BLOCKED |
| libzmq | 4.3.5 | MPL | BLOCKED |
| avisynth | v3.7.5-383-g5c82777b | GPL with interface exception | PASS |
| sdl2 | release-2.32.0-234-gb90ac9502 | permissive | BLOCKED |
| libwebp | v1.6.0-249-g1f34635 | permissive | BLOCKED |
| libx264 | v0.165.3223 | GPL | PASS |
| libx265 | 4.3-45-g116b875 | GPL | BLOCKED |
| libxvid | v1.3.7 | GPL | BLOCKED |
| libaom | v3.15.0-25-g023743a7d7 | permissive | BLOCKED |
| libopenjpeg | 2.5.4 | permissive | BLOCKED |
| libvpx | v1.17.0-57-gd2413e2ca | permissive | BLOCKED |
| mediafoundation | Not supplied | system/runtime interface | BLOCKED |
| libass | 0.17.5-8-gb2fe9d8 | permissive | BLOCKED |
| libfreetype | VER-2-14-3 | FTL/GPL dual | BLOCKED |
| libfribidi | v1.0.16-19-gc928e4c | LGPL | BLOCKED |
| libharfbuzz | 14.4.0-108-g64e2b532 | permissive | BLOCKED |
| libvidstab | v1.1.2-214-ge2445c4 | LGPL at reported upstream commit; FFmpeg treats as GPL | PASS |
| libvmaf | v3.2.0-13-gf85a8536 | permissive | BLOCKED |
| libzimg | release-3.0.6-253-g67e0603 | permissive | BLOCKED |
| amf | v1.5.2-2-gc35f613 | permissive headers / external runtime | BLOCKED |
| cuda-llvm | Not supplied | toolchain / hardware interface | BLOCKED |
| cuvid | n13.1.15.0-1-geddcea9 | hardware interface | BLOCKED |
| dxva2 | Not supplied | system/runtime interface | BLOCKED |
| d3d11va | Not supplied | system/runtime interface | BLOCKED |
| d3d12va | Not supplied | system/runtime interface | BLOCKED |
| ffnvcodec | n13.1.15.0-1-geddcea9 | permissive headers | BLOCKED |
| libvpl | 2.17 | permissive / external runtime | BLOCKED |
| nvdec | n13.1.15.0-1-geddcea9 | hardware interface | BLOCKED |
| nvenc | n13.1.15.0-1-geddcea9 | hardware interface | BLOCKED |
| vaapi | 2.25.0. | permissive / external runtime | BLOCKED |
| openal | 1.25.2-48-g7532541 | LGPL | BLOCKED |
| libgme | 0.6.6 | LGPL | BLOCKED |
| libopenmpt | libopenmpt-0.6.30-3-g6c0a06bc | permissive with bundled dependency licenses | BLOCKED |
| libopencore-amrwb | 0.1.6 | permissive Apache-2.0 | BLOCKED |
| libmp3lame | 3.100 | LGPL | BLOCKED |
| libtheora | v1.2.0 | permissive | BLOCKED |
| libvo-amrwbenc | 0.1.3 | permissive Apache-2.0 | BLOCKED |
| libgsm | 1.0.24 | permissive | BLOCKED |
| libopencore-amrnb | 0.1.6 | permissive Apache-2.0 | BLOCKED |
| libopus | v1.6.1-68-g503d81b1 | permissive | BLOCKED |
| libspeex | Speex-1.2.1-51-g0589522 | permissive | BLOCKED |
| libvorbis | v1.3.7-37-g1b75110b | permissive | BLOCKED |
| librubberband | v4.0.0 | GPL | BLOCKED |

AviSynthPlus is an additional GPL/interface-exception component; Windows FFmpeg uses runtime loading, so no installed avisynth.dll is claimed. Acquired source/headers are retained conservatively. vid.stab reported commit contains LGPL-2.1-or-later LICENSE and RELICENSE.md, although FFmpeg's exact LICENSE.md/configure still places it in the GPL group. Preserve its exact upstream texts and keep Gyan patch state unresolved.

Static linking means permissive/LGPL/MPL components cannot simply be omitted from combined-source scope. DEPENDENCIES.json includes potential transitive components (not confirmed linked) and no assumed exclusions. A static link map, package lock and per-component exclusion review are still required. Hardware flags describe headers/interfaces, not driver redistribution. GCC/MinGW runtimes need exact package/licensing/system-library analysis; compiler identification alone does not close this.
