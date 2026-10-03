# WaveCanvas third-party notices

2026-10-03. Packaged with the unsigned RC. License inventory and corresponding source delivery remain incomplete: PUBLIC RELEASE BLOCKED.

## WaveCanvas own code

package.json declares MIT；原始 [License.txt](License.txt) 保留。MIT不取代下列元件授權。原有copyright attribution與新增程式碼權利鏈仍需review，不能因bundle GPL executable就直接改全repo license。

## FFmpeg executable distribution

- Project: [FFmpeg](https://ffmpeg.org/)。Copyright (c) 2000–2026 the FFmpeg developers；ffprobe顯示2007–2026。各source file完整copyright仍須保留。
- Provider: [Gyan 9.0.2 essentials](https://github.com/GyanD/codexffmpeg/releases/tag/9.0.2)。Version `9.0.2-essentials_build-www.gyan.dev`。
- Binary license: GPL-3.0-or-later；[GPL全文](vendor/ffmpeg/LICENSE)、[provider metadata](vendor/ffmpeg/README.txt)、[binary hashes](vendor/ffmpeg/BUILD.json)。無擔保；使用者的再散布／修改權利依GPL，不受WaveCanvas總包條款取消。
- FFmpeg source revision: `946fcce07b6dcd0331c8cc609192aeff5e1924f8`。此commit URL只表示provenance，**不是完整corresponding-source delivery**。
- x264 binary 與實際 H.264 SEI: `core 165 r3223 0480cb0`；VideoLAN 官方 commit `0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee`。此為 upstream mapping，未證明 Gyan 無額外修改。
- Planned complete source asset: **WaveCanvas-1.0.0-GPL-Source.zip**，須完整後才產生此正式名稱。
- Internal preparation asset: **WaveCanvas-1.0.0-GPL-Source-PREPARATION.zip**；含六份 upstream snapshots、manifest、hashes、configuration 與 evidence，**不是完整 Corresponding Source**。
- Release location: **<OFFICIAL_RELEASE_URL>** — unresolved release metadata；public release 前必須替換。預定完整 source 與 installer 同頁免費提供，不採 written offer。
- Exact provider patches、matching build recipe、static transitive source closure、完整 dependency notices: **BLOCKED**。
- This software is based in part on the work of the Independent JPEG Group (FFmpeg-derived code); provider modifications to those files remain unverified.

## Libraries compiled into the Gyan executables

下表為notice inventory起點，版本取provider README；source/license/copyright全文需依**實際revision**補齊，不是把整份binary license套給每個library。全部外部library versions在 [audit evidence](dev/reports/archive/ffmpeg-licensing-2026-10-03/current-build.json)。

| Component | Project／reported version | License/source preparation |
|---|---|---|
| libx264 | [VideoLAN x264](https://www.videolan.org/developers/x264.html), v0.165.3223 / 0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee | upstream snapshot 與 COPYING 已取得；GPL-2.0-or-later header；provider patches／recipe 仍 BLOCKED |
| libx265 | [x265](https://www.videolan.org/developers/x265.html), 4.3-45-g116b875 | FFmpeg GPL dependency；exactrevision／license/copyright待收 |
| libxvid | [Xvid](https://www.xvid.com/), v1.3.7 | FFmpeg GPL dependency；exactsource／notice待收 |
| libvidstab | [vid.stab](https://github.com/georgmartius/vid.stab), v1.1.2-214-ge2445c4 | reported upstream commit 已為 LGPL-2.1-or-later；附 LICENSE、COPYING.LESSER、RELICENSE.md；FFmpeg 仍列 GPL group，provider state 待確認 |
| librubberband | [Rubber Band](https://breakfastquay.com/rubberband/), v4.0.0 | GPL-2.0-or-later route；tag snapshot／COPYING 已取得，provider state 待確認 |
| AviSynthPlus | [AviSynthPlus](https://github.com/AviSynth/AviSynthPlus), v3.7.5-383-g5c82777b | GPL with interface exception；snapshot 與 license.rst 已保留；Windows runtime loading，不宣稱 bundled avisynth.dll |
| libass／FreeType／FriBidi／HarfBuzz | [libass](https://github.com/libass/libass), [FreeType](https://freetype.org/), [FriBidi](https://github.com/fribidi/fribidi), [HarfBuzz](https://github.com/harfbuzz/harfbuzz) | 各自license與copyright，不统一填GPL；exactversion見evidence，pending |
| libaom／libvpx／libwebp／libvmaf | [AOM](https://aomedia.googlesource.com/aom/), [libvpx](https://chromium.googlesource.com/webm/libvpx/), [WebP](https://developers.google.com/speed/webp), [VMAF](https://github.com/Netflix/vmaf) | BSD／Apache等依exactsource texts逐項核對，pending |
| GMP／GnuTLS／libssh／other libraries | [GMP](https://gmplib.org/), [GnuTLS](https://www.gnutls.org/), [libssh](https://www.libssh.org/)；其餘全部見provider README | 各自version／license／notice／source closure待補；未列table不表示可省略 |
| Hardware interfaces | [AMF](https://github.com/GPUOpen-LibrariesAndSDKs/AMF), [nv-codec-headers](https://github.com/FFmpeg/nv-codec-headers), [oneVPL](https://github.com/intel/libvpl) | SDK/header/runtime各自條款；driver不一律視為需附source或自動豁免，pending review |

完整 explicit inventory 在 installed `FFmpeg/DEPENDENCIES.json` 與 repository/source preparation `dev/release-source/DEPENDENCIES.md`，涵蓋全部 53 外部／hardware enable flags。MPL／dual license 另列，未一律標為 permissive。Exact source-license closure 與 transitive graph 仍 BLOCKED；不因 permissive/static/runtime label 默認排除 source。Selected texts 在 installed `FFmpeg/dependencies/`，upstream sources 保留各檔 copyright；尚非完整 notices collection。

## Electron, Chromium and npm

Electron 44.5.1／Chromium runtime是另一个distribution inventory；installed output已有LICENSE.electron.txt與LICENSES.chromium.html，應保留并驗證。其ffmpeg.dll不是上述Gyanffmpeg.exe。npm build/test devDependencies和實際packaged runtime分開審核，不硬塞入GPL段落；完整runtime attribution/source obligations另做release audit。

## Release gate

See FFmpeg/SOURCE_INFO.txt and RELEASE_GPL_SOURCE_CHECKLIST.md. Provider exact dependency revisions, patches, recipes and complete source archive are not yet delivered. No compliance certificate or public release readiness is claimed.
