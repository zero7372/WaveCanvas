# WaveCanvas controlled FFmpeg build

Windows x64 / MSYS2 UCRT64. This pipeline fixes source snapshots, their hashes, toolchain package archives, source patch state, configure commands and output hashes. It does not require bit-identical binaries on every machine.

Run from the WaveCanvas repository root using PowerShell and Python 3.10+:

```powershell
& dev/ffmpeg-build/scripts/bootstrap.ps1
& dev/ffmpeg-build/scripts/build.ps1 -Jobs 8
node dev/ffmpeg-build/scripts/isolated-qa.cjs
```

The default toolchain/build workspace is `.ffmpeg-build` beside the repo, keeping MSYS2 build paths separate from repository paths that may contain spaces. Use the scripts' `-WorkspaceRoot` option to select a short ASCII location if needed. Bootstrap extracts the official hash-pinned base archive, installs only locked project toolchain packages, and modifies neither the host's permanent PATH nor an existing MSYS2 installation. Initial setup recorded package locks; normal reruns use the exact archives. No global security setting is changed.

Tracked inputs are in `manifests/`; source checkouts, downloads and outputs are ignored. Required tools are MSYS2 Bash/GCC/binutils/make/NASM/pkgconf plus host Python/PowerShell. Git/perl are part of the locked tool environment; yasm, cmake and meson are unnecessary for these recipes.

Sources:

- FFmpeg n9.0.2: `946fcce07b6dcd0331c8cc609192aeff5e1924f8`.
- x264: `0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee`.
- zlib v1.3.2: `da607da739fa6047df13e66a2af6b8bec7c2a498` (native PNG support for existing export QA/image diagnostics).

Only libx264 and zlib are enabled external libraries; native FFmpeg AAC/audio decoders/demuxers remain available. Project storage formally accepts WAV, MP3, FLAC, OGG, M4A, AAC and Opus, while the browser picker also permits `audio/*`; retain built-in codecs instead of disabling everything. No ffplay, third-party codec zoo, network input or production hardware encoder selection is added. Internal FFmpeg libraries remain part of its one source tree.

`stage-sources.py` checks the archive SHA-256 keyed to the exact upstream revision before extracting it; no floating branch checkout is used. `record-build.py` compares **every original upstream file** with the compiled source tree and rejects source changes. Zero custom source patches are applied. Build-generated config files are retained as outputs. Archive snapshots lack Git history, so x264's generated display version is `0.165.x`; its exact commit/archive mapping is recorded in the build manifest rather than fabricated as a Git-derived revision count.

Build order: zlib static library, x264 static library with Win32 threading/NASM, then FFmpeg/ffprobe with explicit static pkg-config paths and `--disable-autodetect`. Compiler-provided C/POSIX/atomic runtimes and Windows imports are classified separately in the closure review; their exact package versions and licenses are retained. No additional DLLs are shipped beyond the Windows/UCRT system requirements.

Output contains ffmpeg.exe, ffprobe.exe, VERSION.txt, BUILD_CONFIG.txt, TOOLCHAIN-MANIFEST.json, BUILD-MANIFEST.json, SHA256.txt, native feature/config/log/linker evidence. `isolated-qa.cjs` uses the unchanged production args and tests every supported project audio extension before vendor promotion. Temporary `WAVECANVAS_TEST_FFMPEG` exists only in the dev export test harness; production resolver/code is unchanged.

The formal GPL source ZIP also supplies these scripts under `build-scripts/`, pinned manifests under `manifests/`, full snapshots under `sources/`, original archives under `upstream/` and licenses. Standalone scripts recognize that bundle layout; run bootstrap.ps1/build.ps1 there with an ASCII workspace. Source inputs can be staged offline from included archives; obtaining the general-purpose toolchain is a separate prerequisite.
