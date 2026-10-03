# WaveCanvas Release Engineering v1

2026-10-03，baseline `918beff`，開始時 working tree clean。Release Engineering 獨立 commit；未修改 FFT、visualizer、lyrics/timing model、project format、preferences/options semantics、export clock/capture 或 font enumeration/persistence。版本 metadata、installer、shell open 與 licensing delivery 是本輪範圍。

## Version / identity

WaveCanvas 1.0.0；canonical source 為 package.json。Main `app.getVersion()` 提供 About 與 project writer version，沒有在 renderer 另寫 1.0.0。Windows ProductVersion 自動展開為 1.0.0.0。ProductName / executable / shortcuts / uninstall / window identity 一致；appId 保留 `com.wavecanvas.desktop`。中性 author / CompanyName 為 WaveCanvas contributors；原 MIT attribution 保留於 License.txt，未偽造公司或 publisher。PNG 原圖轉七尺寸 ICO：16/24/32/48/64/128/256。

## Installer

NSIS assisted per-user x64；`npm run release:build` 自動 staging / hash / health audit，產生 `release/WaveCanvas-Setup-1.0.0.exe`。沒有另一套 installer framework、code-sign certificate 或 updater。Config 位於 package.json，少量 NSIS include 位於 dev/installer.nsh：固定 current-user mode、quoted open command、移除自有 extension default。

## Install path

實測 `C:\Users\peter\AppData\Local\Programs\WaveCanvas`。採 builder 的 Windows UserProgramFiles known-folder 路徑，未硬寫 Program Files；不用 elevation，HKCU 有一份 uninstall entry，HKLM 未新增 WaveCanvas 安裝。

## Shortcuts

Start Menu / Desktop 預設建立 WaveCanvas，target / icon 均為安裝後 WaveCanvas.exe。實際 Start Menu shortcut 已透過 Windows shell 啟動並驗證 visible window / persisted settings / fonts。Desktop 可透過 NSIS `--no-desktop-shortcut` opt-out；沒有新增巨大自訂 wizard。QA temporarily injects inspector / isolated profile into shortcut arguments and restores the original empty arguments after dispatch.

## Uninstall

兩次實際 silent uninstall 均 exit 0，移除 executable、Start Menu / Desktop links、ProgID / open command / extension default 與 Installed Apps entry。由 installer 執行解除安裝，未以手動刪檔冒充 QA。[Installer evidence](archive/release-engineering-2026-10-03/installer-qa.json)。

## UserData behavior

`deleteAppDataOnUninstall=false`。正常 AppData 原資料未拿來開啟測試 app；全部 GUI 測試先以 native `--user-data-dir` 隔離。解除安裝前後核對正常 AppData 與 workflow profile 的 settings / application-state / Recent / Backups，以及外部 project / media SHA256，保持一致。Workflow profile 真正建立十份 rolling backup。Reinstall 載入所有自訂 preference groups 與 Recent；沒有手動移除 AppData。

## File association

HKCU `.waveproj` → `WaveCanvas.Project`，description WaveCanvas Project、executable icon、open command：`"…\WaveCanvas.exe" "%1"`。安裝／解除安裝／重裝都驗證 registry；兩個參數都有 quotes。[Shell evidence](archive/release-engineering-2026-10-03/release-shell-final.txt)。

## Single-instance project open

electron/external-project.cjs `projectArgument()` 只從 Node/Electron 已解析 argv 挑 absolute、非 switch、無 NUL 的 `.waveproj`；不 split command string、不 eval、不執行內容。Main cold queue / second-instance 把路徑存為 private token，project-ipc 提供 take / open / discard token；renderer 排在既有操作之後，使用相同 `guard()`、`storage().open()`、serializer.prepare / restore / activate / Recent pipeline。Cancel 消耗請求並保留目前 edits；Save 寫回後切換；Discard 不寫回。confirmUnsavedClose Off 不會繞過 external-open guard。

## Licensing resources

resources/licenses 明確 allowlist：WaveCanvas-LICENSE.txt、THIRD_PARTY_NOTICES.md、FFmpeg/LICENSE、PROVIDER-README.txt、BUILD_INFO.json、SHA256.txt、SOURCE_INFO.txt、SOURCE_MANIFEST.json。重用 vendor GPL / README / BUILD.json，不更換 FFmpeg binary。Electron LICENSE.electron.txt 與 LICENSES.chromium.html 也保留；Chromium ffmpeg.dll 與 Gyan ffmpeg.exe 分開記錄。

## THIRD_PARTY_NOTICES

根目錄正式 notice 已 staging 並打包，列 FFmpeg、libx264、x265、xvid、vid.stab、Rubber Band 及其他 static component inventory / project URLs。非 GPL library 沒有統一錯標為 GPL。完整 exact-revision dependency copyright / license inventory 仍未完成，明示為公開發布 gate；原 MIT attribution 未覆蓋。

## GPL source delivery gate

**BLOCKED；publicReleaseReady=false。** Binary：Gyan 9.0.2 essentials，GPLv3-or-later，FFmpeg revision `946fcce07b6dcd0331c8cc609192aeff5e1924f8`；[provider release](https://github.com/GyanD/codexffmpeg/releases/tag/9.0.2) 再確認此 provenance。Binary SHA256 與既有 audit 完全一致。

[GPL source checklist](../../RELEASE_GPL_SOURCE_CHECKLIST.md) 分開評估 exact FFmpeg source、GPL dependencies、全部 static/transitive closure、patches、build/install recipes、configuration、完整 notices、correspondence 與 source access。只有 revision/configuration/hash provenance 已確認；provider versions 不等於完整 dependency lock，patches 不假設 none。

採 separate source attachment 與 installer 同一 fixed release entry、免費下載並附 SHA256 的 delivery strategy，依 [GPLv3 §6(d)](https://www.gnu.org/licenses/gpl-3.0.html)。實際 complete source archive / source hosting 尚不存在，SOURCE_MANIFEST.json 欄位為 null / BLOCKED，沒有冒充已交付 source，也沒有 written offer。Upstream exact-commit tarball URL 只是其中一部分。本輪未永久塞入數 GB 不完整近似 source。完整材料取得、copyright / rights-chain / aggregation review 後才可開公開 distribution gate。

## Open Source Licenses UI

Help → About WaveCanvas / Open Source Licenses；小型 native HTML dialog。app/release-ui.js 使用 textContent 顯示 fixed packaged resources，提供 Open Licenses Folder；own MIT、FFmpeg / libx264 GPL、source-info 與 incomplete status 可見。electron/release-ipc.cjs 檢查 primary webContents + mainFrame，只能讀固定 allowlist或開固定 licenses folder，preload 不暴露 raw FS / arbitrary IPC。About version 實測與 package version 相同；大型 GPL text 沒寫入 JS。

## Packaging allowlist

app.asar 94 entries：app / electron / required package metadata / README / own license。resources 僅 app.asar、ffmpeg、licenses；沒有 elevate helper。licenses 與 FFmpeg 逐檔 allowlist；app/electron bytes 與當前 source 比對。沒有 dev、tests、reports、node_modules、.git、cache、benchmark 或 source download。release 根目錄也有 allowlist；builder debug / unused blockmap 在 staging 移除。Installed package 同樣 audited。

## Installer sizes

| Artifact | Bytes | MiB |
|---|---:|---:|
| installerBytes | 169060450 | 161.23 |
| installedBytes | 597934068 | 570.23 |
| unpackedBytes | 597757018 | 570.07 |
| ffmpegBytes | 210722123 | 200.96 |

MiB = 2²⁰ bytes；NSIS 自行壓縮，未重壓或改動 FFmpeg binary。Installed 包含 uninstaller / installer metadata，因此稍大於 win-unpacked。

## Hash manifest

release/RELEASE-HASHES.txt 使用 SHA256：installer、WaveCanvas.exe、ffmpeg.exe、ffprobe.exe、licenses、source-info manifest、notices、release notes / checklists。`release:check` 驗證所有 entries 與固定 FFmpeg digest。沒有生成 source archive，沒有偽造 source archive hash。FFmpeg：`3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec`；ffprobe：`f0d36ecbbdd3bcfac3efa078c96c7271c2e68b3810595552ac3b7f17e9a65c52`。

## Fresh install QA

PASS，使用本機受控測試：開始時沒有 WaveCanvas installer entry / install directory / association，採 fresh isolated profiles。WindowsSandbox.exe 與 Get-VM 不可用；未宣稱 clean OS / VM coverage。安裝 exit 0、正確 executable metadata、Start Menu 啟動、Options / New Project、packaged FFmpeg 與 >11 font families 通過。未停用 Defender / SmartScreen / UAC。

## Association QA

PASS，實際 Windows shell cold / running open，不只直接呼叫 renderer API。為保護既有 AppData，暫時在實際 registry command 附 inspector / isolated profile switch，完成 dispatch 後恢復原 `"exe" "%1"`；registry 檢查證實恢復。Save / Discard / Cancel 全通過，confirmUnsavedClose Off 仍有 guard。Formal loader / media / name / font / Recent restore 通過。

## Unicode QA

PASS，中文、spaces、Ω、emoji 與 >260-character nested project path 由本機 Windows shell 正常開啟。未保證所有 Windows configuration、network shares 或更長 command-line 限制均相同；採 Node parsed argv，不自行去 quotes / split。

## Preferences / Options QA

Installed Preferences 28/28、Options 43/43。Startup、window state、New naming、autosave / interval、Recent limits、volume / autoplay、UI scale、export directory rules 均沿用既有測試。Reinstall profile 特別保存所有 groups，重開後完整相等；Preferences 不污染 project state。

## Font enumeration QA

Installed 22/22；實際 queryLocalFonts：**106 installed families + 4 generic = 110**。未知 stored family、CJK strings、Save/Open persistence、preview CSS fallback 與安裝路徑 dedicated export renderer 通過；没有重設 enumeration / normalization / persistence 或複製字體。

## Project workflow QA

Installed Project 51/51。另有完整同一專案 workflow：New / naming、audio、cover、background、primary LRC、secondary SRT、Bahnschrift、timing edits、Square settings、Save、process close、argv reopen，canonical full state 相等；saved appVersion 使用 package metadata。Same workflow 最後 export 300 frames 通過。

## Collect QA

PASS，收集後移至中文 test directory，再由正常 loader 打開；五種 media references 均 relative 且可載入，font family 仍為字串、沒有任何 ttf / otf / ttc / woff 字體檔。Project integration 也驗證原字幕不被 overwrite、missing media handling 與原專案 refs 保留。

## Export QA

Installed export QA 34/34、real short 7/7；300 frames H.264 1920×1080 / 60 FPS + AAC、expected frame count、A/V duration difference <25ms。兩次 deterministic export 的 decoded Canvas / compositor 最大差 1/255、一個 pixel，SSIM 1；audio/lyrics state exact。Cancel、missing FFmpeg、nonzero encoder、renderer crash、edge durations、三種 layout 均通過。

Full real project：60.186104s → 3612 frames、0 dropped、85.52s total、16.04ms average capture；H.264 / 1080p60 / AAC，原 project / media hashes、size、mtime 未改。此次是 packaging QA，並非重做 Phase 2A performance optimization；不宣稱與舊 benchmark 測試負載相同。

## Uninstall / reinstall QA

PASS，實測 1.0.0 uninstall → internal 1.0.0-rc.1 install → 1.0.0 upgrade → uninstall → reinstall；同一 `6c2bb522-748e-5bcd-a5ee-9a31dfd50b64` key，Installed Apps 只有一份。Uninstall / reinstall business-data / project / media hashes 相同；最後保留 1.0.0 安裝，所有 test app 已關閉。Internal installer 在 dist/upgrade-rc，未混入 release/；版本 override 只供 QA，未修改 canonical package.json。

## Regression

| Suite | Result |
|---|---|
| Node | 122/122 |
| Installed Project | 51/51 |
| Installed Preferences | 28/28 |
| Installed Options | 43/43 |
| Installed Fonts | 22/22 |
| Installed Electron | 48/48 |
| Installed export QA | 34/34 |
| Installed real short / full export | 7/7 each |
| Browser | 589 PASS / 10 known FAIL |
| Installer integration | 28/28 |
| Shell association | 11/11 |
| Full same-project workflow | 10/10 |
| Reinstall / actual Start Menu | 4/4 |
| Release health / package / maintenance audit | PASS |

Browser failure labels 與 baseline **逐條相同**，不是僅數量相同；[comparison](archive/release-engineering-2026-10-03/release-browser-comparison.json)。[Small QA evidence](archive/release-engineering-2026-10-03/release-node.txt) 已歸檔；large profiles / MP4 / progress diagnostics 留在 ignored dev/tests/artifacts。Writer metadata 最後調整後重跑 Node / Project / Fonts / Shell / same-project Export / Reinstall；核心 render/export modules 未變。

## Release checklist

[Release checklist](../../RELEASE-CHECKLIST.md)：Build、Installer、File Association、Preferences / Options、Fonts 與 regression QA PASS；Licensing / Signing / Distribution BLOCKED。`npm run release:check` 為 technical health check，通過並不解除公開發布 gate。

## Signing status

**signed=false；NOT CONFIGURED。** Installer 與 installed WaveCanvas.exe 的 Get-AuthenticodeSignature 都是 NotSigned、沒有 signer certificate。Builder 的 generic signtool log 不代表已簽署。Unknown Publisher / SmartScreen 可能顯示；沒有 self-signed、certificate procurement、security bypass 或 production signing。

## Public release readiness

`technicalReleaseCandidate=true`、`signed=false`、`publicReleaseReady=false`。技術 installer / workflow / QA 已通過；GPL static corresponding-source delivery、完整 exact dependency notices / review 與公開 source access 為明確阻擋項。Unsigned RC 不宣稱 production-signed 或 public release ready。

## Known limitations

Windows x64 / single controlled host；未完成 clean VM、不同 GPU / Windows N / per-user third-party font provenance 的跨機驗證。Export fixed 1080p60、CPU libx264；Chromium-visible font collection 不保證等同完整 Windows GDI collection。保留既有十個 Browser baseline failures。GPL complete source 與權利 / boundary review 未完成。沒有 auto update、NVENC production、HEVC、AV1、4K、font embedding、missing-font warning 或 1.1 新功能。

Reproduce: `npm ci`、`npm run release:build`、`npm run release:check`；GUI installed suites 使用 `WAVECANVAS_QA_EXE` 指向實際 installed executable，`--packaged` 配合 native isolated profile。Installer QA 需要已安裝 app、prepared workflow preservation profile 與 `node dev/tools/build-upgrade-fixture.cjs` 的 internal installer；它會修改 current-user install / shortcuts / association，並保留 userData。請讀腳本與報告後在受控 Windows QA 環境執行。
