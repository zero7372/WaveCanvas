# Controlled FFmpeg rebuild report

2026-10-04, Windows x64. Controlled runtime and corresponding-source artifacts are ready. GPL source gate PASS; artifactReady=true; publicReleaseReady=true; published=false; signed=false. No GitHub publication, signing, updater, new production codec, hardware export or product feature changes were performed.

Git: pipeline commit `09cd8e5`; runtime replacement is the commit containing this report, titled `Replace release FFmpeg with controlled build`. Previous `6232b63` and `490deec` were not amended. No app/ or electron/ production source changes. Downloaded archives, compiler/cache/workspace and generated release installers/source ZIP stay ignored. Vendor binaries follow the existing tracked-binary policy.

# Build environment

Initially available: PowerShell, Git for Windows, Python 3.10, Node 24.14.0 and existing Electron/builder dependencies. Initially missing: usable MSYS2/MinGW GCC, make, NASM and pkg-config. The Windows WSL bash front end alone was not a build environment. Optional/not needed: clang, yasm, cmake, meson. Perl/Git are in the locked tool environment. No manual setup requirement remains.

Established a project-local MSYS2 UCRT64 at `H:/WaveCanvas/.ffmpeg-build`, isolated from the host PATH and existing installations. No permanent PATH, registry installation or security setting changes. Original GitHub bootstrap transfer was too slow; the official repo.msys2.org mirror produced the same locked SHA256. Locked package bootstrap replay passed, including the extracted source-bundle script layout.

# Toolchain

GCC 16.2.0 Rev4; GNU ld 2.47.20260726; NASM 3.02; GNU make 4.4.1; pkgconf 3.0.7. MSYS2 base 2026-09-27 SHA256 `ad336cccfda47758b5e15cda993fbba421115cb0b126697daef1ee4dfe37209f`. Sixty-six additional package archives are fixed by exact filenames, sizes, URLs and hashes; all installed base/additional versions are recorded. Evidence: `dev/ffmpeg-build/manifests/TOOLCHAIN-MANIFEST.json`, `BOOTSTRAP.lock.json`, `TOOLCHAIN_PACKAGES.lock.json`; archived bootstrap replay logs.

# FFmpeg revision

FFmpeg n9.0.2 commit `946fcce07b6dcd0331c8cc609192aeff5e1924f8`. Original official upstream ZIP SHA256 `8cffa6ccf78df6d39d57bd61baaf19e8bf0a7d590eef0d838de69932e8de3572`. Binary version `9.0.2-wavecanvas-controlled`.

# x264 revision

Exact commit `0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee`. Original VideoLAN ZIP SHA256 `d8f276b5a7595ff9608890a32863dc51d8fd97454e908b4dd90ede8fb4b2490a`. Snapshot version display `0.165.x` reflects the absence of .git history, not an unknown source revision. No revision counter is fabricated.

# Additional dependencies

zlib v1.3.2 commit `da607da739fa6047df13e66a2af6b8bec7c2a498`, original official ZIP SHA256 `21de001766abb1f5bfdfb3c23aa42d30a6bbd7eddd37131d5e7fe89c5ec068f8`. Required for native PNG extraction used in existing export QA/image diagnostics. Native FFmpeg AAC remains the production encoder. No external AAC, MP3, Vorbis or Opus encoder libraries were added.

Project storage accepts WAV/MP3/FLAC/OGG/M4A/AAC/Opus; browser picker also accepts audio/*. Built-in FFmpeg decoders/demuxers remain enabled rather than using disable-everything. Compiler runtimes and Windows interface imports are recorded below; installed tools such as compiler zstd/GMP are not linked into the product merely because they are installed.

# Configure flags

Static Windows x64, enable-gpl/enable-version3, enable-libx264/enable-zlib, disable-shared/autodetect/doc/debug/ffplay/network/hwaccels. Explicit static pkg-config prefix, `-static -static-libgcc`, recorded linker map. All native audio decoder/demuxer/filter support retained. Full actual command and paths are in `licenses/FFmpeg/BUILD_CONFIG.txt` and `dev/ffmpeg-build/manifests/BUILD-MANIFEST.json`; no undocumented flags. Production args remain raw BGRA pipe, libx264 medium/CRF18/yuv420p, 1920x1080/60, native AAC 320k and MP4 faststart.

# Build scripts

`dev/ffmpeg-build/scripts/bootstrap.ps1`, `build.ps1`, `build.sh`, `locked-toolchain.py`, `stage-sources.py`, `record-build.py`. Source ZIP contains the standalone build-scripts layout and original source archives. Tested bundle-layout offline staging, locked toolchain bootstrap and source/provenance recording against the successfully built workspace. These are the same recipes used for the actual build; no manual configure sequence is needed. Full general-toolchain downloads require network, while source snapshots are available offline.

The first compile linked executables but metadata copy failed because config.log lives in ffbuild/. Corrected the script and reran the build successfully. Byte-preserving staging avoids needless incremental source timestamp changes. These are build-script fixes; no upstream source patch.

# Patches

WaveCanvas source patches: none. Original-file comparison verified 10,956 FFmpeg/x264/zlib files against the included original ZIPs, with zero changes. `patches/PATCHES.md`. This claim concerns the three application dependencies, not the upstream patch state of MSYS2's general compiler distribution.

# Output hashes

| Binary | Bytes | SHA256 |
|---|---:|---|
| ffmpeg.exe | 32895488 | 31d7c4ea1a71e50cef1132782779742f3f4aae53015e2c0765db3b303ea81d13 |
| ffprobe.exe | 32694272 | 95184847a8d81488180abc16178b52d12a93acb437f30d55a161b9dbfc8359d6 |

# Feature verification

22 isolated checks PASS, bound to those hashes. Actual version/buildconf/encoder/decoder/demuxer/muxer/protocol commands succeeded; libx264/native AAC/MP4 and ffprobe verified. PE imports contain Windows/UCRT system DLLs only. No additional shipped DLLs are required.

# CLI smoke

Unchanged production command with synthetic 300 raw BGRA frames passed 1080p60/yuv420p/H.264/AAC, A/V difference <1/60 second and moov-before-mdat faststart. All seven supported audio extensions decode/probe/transcode successfully. After vendor replacement, the isolated test was rerun without relying on prior generated outputs: WAV/FLAC/AAC/M4A are regenerated; 125,568 bytes of fixed synthetic MP3/OGG/Opus fixtures preserve decoder coverage without requiring optional encoder libraries or an old Gyan executable. Their test-only generator/hash provenance is in dev/tests/fixtures/controlled-ffmpeg-audio/MANIFEST.json.

# WaveCanvas short export

Before promotion, old packaged WaveCanvas used the dev-only WAVECANVAS_TEST_FFMPEG override. 300 frames, zero dropped, correct codecs/resolution/fps; original project/media/lyrics hashes, sizes and mtimes unchanged. Gyan vs controlled short raw sample hashes match exactly and whole decoded short SSIM=1.000000. The temporary override exists only in the dev harness; no production resolver change.

# Vendor replacement

Promoted only after feature/CLI/seven-format/packaged-equivalent 300-frame checks passed. Replaced ffmpeg.exe/ffprobe.exe and provenance, versions/configuration, source/hash/license metadata. Current shipped docs describe controlled FFmpeg, not Gyan. Historical distribution/preparation reports and original Git history remain. Old ignored preparation ZIP/staging/license materials were archived under ignored workspace/history; unrelated old dependency license resources were removed from the current allowlist.

# Source closure

PASS under the explicit engineering classification in `dev/ffmpeg-build/manifests/CLOSURE-REVIEW.json`. Every archive in the linker manifest is covered: seven internal FFmpeg libraries, libx264, libz, GCC libgcc/libgcc_eh/libatomic, MinGW C/POSIX runtime and Windows interface/import libraries. The complete FFmpeg/x264/zlib snapshots are included.

GCC 16.2.0-4 standard runtime uses GPLv3 plus Runtime Library Exception 3.1. MinGW CRT/winpthreads 14.0.0.r426.g4564ee4b5-1 implement standard C/POSIX/Windows interfaces and are normally supplied with the compiler. These are individually documented System Library exclusions under GPLv3 section 1, which includes standard-interface components normally packaged with a Major Component compiler and having publicly available source. Actual linked pthread clock/misc/nanosleep/thread objects are recorded rather than overlooked. Windows/UCRT imports are OS system components. Complete installed notices (including MIT/BSD/ZPL/public-domain and GCC exception) and exact package hashes are retained.

Excluded compiler/OS source has sourceStatus=N/A with reasons, not invented exact upstream patch/source PASS. The toolchain binaries are general purpose build tools and are not redistributed in installer/source ZIP. No non-system codec library is excluded. Source closure is scoped to controlled FFmpeg/ffprobe, not the historical Gyan dependency inventory.

# GPL source artifact

`release/WaveCanvas-1.0.0-GPL-Source.zip`: 52,352,069 bytes; SHA256 `e33292b8e4dc2a8218aaf4289434fb0c8d3aa2c7d816c96bad1731e9bbb9b255`.

Contains sources/, upstream/, build-scripts/, patches/, manifests/, licenses/, build-evidence/, README.md, SOURCE-MANIFEST.json and FILE-HASHES.json. 11,010 files. Integrity validator checks every ZIP file hash, every original source file against original upstream archives, exact linker review coverage, inner/outer manifests, output hashes and script/no-patch evidence. Source ZIP cannot contain its own digest; only that digest is stored in the outer manifest. No URL-only substitute or PREPARATION label remains on the formal artifact.

# Full regression

| Suite | Development | Installed packaged |
|---|---:|---:|
| Project | 51/51 | 51/51 |
| Preferences | 28/28 | 28/28 |
| Options | 43/43 | 43/43 |
| Fonts | 22/22 | 22/22 |
| Electron | 48/48 | 48/48 |
| Export | 34/34 | 34/34 |

Node 125/125 PASS. Browser 589 PASS/10 pre-existing FAIL: all ten failure labels match the prior release baseline exactly, no new failure. Export determinism checks exact audio/lyric state, max 1/255 pixel difference in <0.1% channels for Canvas/compositor, repeated decoded SSIM >=0.99; development and installed repeated-video SSIM=1. Full package allowlist audit: 94 entries, 431.92 MiB, no dev/tests/node_modules/compiler/source archive inside runtime.

# 3612-frame export

Installed controlled runtime: 3612 frames, zero dropped; 1920x1080, 60/1 fps, H.264/yuv420p and AAC. Video 60.200000 seconds, audio 60.186122 seconds, difference 0.013878 <0.016667 second. Saved project/audio/lyrics/images remain byte/size/mtime unchanged. Full-video decoded comparison against the existing Gyan full export SSIM=0.999062 >=0.99. This does not require identical MP4 bytes across FFmpeg builds.

# Performance

Short same-project comparison: Gyan 7410.4705 ms vs controlled 6714.8043 ms, ratio 0.9061 (about 9.4% faster observed). Prior full Gyan 85524.4615 ms vs controlled 64651.095 ms, ratio 0.7559 (about 24.4% faster observed). Installed short 6796.642 ms. These are local individual measurements, not universal speed guarantees; prior full timing came from the prior baseline run. No >15% performance regression observed, no encoder settings optimized.

# Installer rebuild

`release/WaveCanvas-Setup-1.0.0.exe` rebuilt by npm run release:build, unsigned NSIS x64 per-user, version 1.0.0. Installed controlled binary/license resource hashes match current vendor/licenses. Start Menu/association/version identity checked. Installed launch, all packaged regressions, 300-frame export and Open Source Licenses UI PASS. Uninstall/reinstall final sanity 11/11 PASS; normal user business files and the real project/media are unchanged. Reinstalled the verified app to restore its pre-task availability.

Earlier sanity attempts are retained as uninstall-first-attempt.json and uninstall-second-attempt.json: the first observed a surviving Start Menu shortcut in the upgraded state; the fresh cycle removed it. The second passed uninstall but the harness falsely rejected the one-entry reinstall because Windows PowerShell 5 unwraps a single PSCustomObject and its .Count differs from array counting. Fixed the dev harness to poll the complete uninstall state and force array counting; final cycle passed. No installer or product implementation was changed to hide a failure. Initial cross-volume hard-link setup in the gate test also failed; switched the dev fixture setup to ordinary file copies and all eight gate checks passed.

| Artifact | Old Gyan bytes | Controlled bytes |
|---|---:|---:|
| ffmpeg.exe | 105423872 | 32895488 |
| ffprobe.exe | 105221120 | 32694272 |
| Installer | 169102235 | 133533842 |
| Complete source ZIP | N/A (preparation only) | 52352069 |

# Release hashes

Installer SHA256 `be1b61ebd7812bcb169182e0e7db871e3ca61feb2af50f2e96c6f34983ee25b6`.
WaveCanvas.exe SHA256 `fb9ab8fc01dbc336eee0e0f513c019479baad03676f7eae47238636c814893a3` (245,726,720 bytes). Updated packaged metadata changes its integrity/hash even though app/electron code is unchanged. Both runtime binary hashes and source ZIP hash are above. Full RELEASE-HASHES.txt is in release/ and copied into bounded report evidence.

# GPL checklist

18/18 verifiable requirements PASS, evidence paths in root RELEASE_GPL_SOURCE_CHECKLIST.md. WaveCanvas original MIT attribution is preserved byte-for-byte in installed licenses. Standalone subprocess/pipe separation reviewed; no FFmpeg libraries linked into WaveCanvas. Compiler System Library exclusions are explicit, not source claims.

# release:check --public

PASS. Gate requires controlled source identity, reviewed inventory, complete ZIP presence/hash in RELEASE-HASHES, complete checklist/notices, packaged runtime hash binding and full Python archive content verification. Eight integration checks verify unpublished complete co-delivery passes; missing ZIP, wrong hash, missing delivery strategy, false publication without URL, wrong runtime binding and missing recipe fail closed. Historical preparation/status-flip fixtures still fail closed.

# Release readiness

Technical RC=true; signed=false; GPL source gate=PASS; artifactReady=true; publicReleaseReady=true; published=false. Source ZIP is ready beside its matching installer. No final official WaveCanvas release URL exists or is invented. No artifact-readiness blocker remains. Before actual publication, decide the official release URL and publish installer, source ZIP, hashes and notices together; add the real URL to release metadata. Signing is optional for this explicitly unsigned release. No publication was authorized or performed.

# Known limitations

No bit-for-bit reproducibility promise across machines. General purpose toolchain retrieval requires network; exact package hashes prevent accepting replacements. System compiler/OS component source exclusions are reviewed assumptions stated above, not claims that MSYS2 source/patch sets were independently reconstructed. The existing ten browser failures remain. Earlier uninstall observations are retained rather than omitted. No global environment changes, new hardware/codec features or legal certification.

# Legal disclaimer

This report records engineering provenance, delivery strategy, license texts and technical verification. It is not a legal opinion or certification; classification of System Libraries is explicit for review.

Evidence: `dev/reports/archive/controlled-ffmpeg-2026-10-04/verification-summary.json`, individual regression JSONs/logs, release-status.json, public-gate-qa.json, installed-sanity.json, license-ui-qa.json, uninstall-sanity.json, version/config/toolchain/linker/source manifests, full-probe.json and saved comparison results. Large compiler/source/build/media artifacts remain ignored.
