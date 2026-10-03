# WaveCanvas

## Project Overview

WaveCanvas 是本地音樂視覺創作工具，正式入口為 Electron desktop app；Browser standalone 用於預覽與回歸測試。Runtime 採用原有 Circle／Square／Linear、歌詞、Song Info 與背景模組。

已完成：Electron desktop app、`.waveproj` Project System v1、autosave／10 份 backup、Collect Project、Recent Projects、Preferences v1，以及 deterministic 1080p60 H.264／AAC export。正式 encoder 是 CPU `libx264 medium / CRF 18`，capture 已採 Phase 2A optimized offscreen pipeline。

已建立 NSIS per-user Installer 與 `.waveproj` File Association。未提供正式 NVENC、HEVC／AV1、4K、Plugin System、Account／Cloud Sync 或 Auto Update。

## Install / Release status

WaveCanvas **1.0.0 Unsigned Release Candidate**。Installer 位於 `release/WaveCanvas-Setup-1.0.0.exe`，per-user 安裝於 Windows 使用者 Programs 目錄，建立 Start Menu 與 Desktop shortcuts。解除安裝保留 AppData settings、Recent、window state、backups、projects 和 external media。

雙擊 `.waveproj` 可冷啟動或交給既有 instance；未儲存修改使用 Save / Don't Save / Cancel。Help 提供 About 與 Open Source Licenses；安裝目錄 resources/licenses 附原始 MIT attribution、GPL 全文、FFmpeg build/source/hash 資料。

**publicReleaseReady=false**：GPL static FFmpeg 的完整 corresponding source、patches、recipes 與固定 source release attachment 尚未交付；code signing 尚未配置。此 RC 僅供內部驗證。Unknown Publisher 是 unsigned build 的預期狀態；不需停用 Windows security protections。詳見 [GPL checklist](RELEASE_GPL_SOURCE_CHECKLIST.md)、[release checklist](RELEASE-CHECKLIST.md)、[release notes](RELEASE-NOTES-1.0.0.md)。

Build from source: `npm ci` → `npm run release:build` → `node dev/tools/release-check.cjs --generate` → `npm run release:check`。package.json 是 version 單一來源；release/ 可重建，不提交大型 binary。原有 developer / maintenance 工作流程保留。

Limitations: Windows x64、unsigned、fixed 1080p60 CPU H.264/AAC；Chromium-visible fonts 不保證等同完整 Windows GDI collection；Collect 不嵌入字體。Browser 保留 589 PASS / 10 known FAIL baseline。

## Development Setup

主要開發機為 Windows x64。已驗證 Node.js 24.14.0／npm 11.9；Electron 44.5.1 與 electron-builder 26.15.3 固定於 package-lock.json。從包含 package.json 的 repository root 執行：

```powershell
npm ci
```

`.npmrc` 使用 repo-local `.npm-cache`；Electron／builder launcher 同樣使用 repo-local cache。首次安裝或清 cache 後可能需要網路重新下載 build tools。主要開發機的 node_modules 保留；可重建輸出不納入 Git。

## Run

```powershell
npm run electron:start
npm run electron:dev
npm run browser:start
```

`electron:dev` 開啟 DevTools。Browser server 預設 `http://127.0.0.1:8765/`，redirect 至 `/app/index.html`。Browser 沒有 desktop Project persistence、Preferences persistence 或 Video Export，不另做 LocalStorage settings system。

## Test

```powershell
npm test
npm run project:test
npm run electron:test
npm run export:test
npm run preferences:test
npm run options:test
npm run browser:test
```

Node tests 使用明確 static fixtures；Electron integration 使用隔離 test userData 與 test-only Main inspector 控制 native dialogs，不打包測試 hook。`export:test` 涵蓋重複 300 幀匯出、Preferences 前後 determinism、取消／錯誤保護及 layouts。Browser 主套件有 10 項已知舊期待值 failures；清理前基準為 589 PASS / 10 FAIL，需比較 failure labels，不能宣稱全綠。

真實專案 short/full export helpers 預設讀取 repo 外相鄰 `../Untitled/Untitled.waveproj`，不重寫 source/media/lyrics；缺少該測試專案時需先提供合適唯讀輸入，不要把使用者專案搬進 repo。測試會建立可清除的 `dev/tests/artifacts/`，不依賴上次執行留下的輸出。

手動專項頁面位於 `/dev/tests/`：`browser.html`、`repository-smoke.html`、`factory-defaults-browser.html`、`srt-browser.html`、`linear-cover-browser.html`、`templates-browser.html`。Performance baseline 頁面使用 `fixtures/baselines/index-before.html`，不再從 artifacts 載入 fixture。

## Build

```powershell
npm run electron:build
npm run build:audit
npm run electron:test:build
npm run project:test:build
npm run preferences:test:build
npm run options:test:build
npm run export:test:build
```

輸出為 `dist/win-unpacked/WaveCanvas.exe`，需保留整個 win-unpacked 目錄的 DLL／pak／locales／resources，不是單檔 exe。Build 會自動執行 allowlist audit；只包含 app、electron、package metadata、README／License 与 vendor FFmpeg，不含 dev/tests/reports/node_modules/cache。最近 build 約 569.98 MiB；這是 development unpacked build，尚未完成公開 release 的簽章／安裝流程。

## Repository Structure

| 路徑 | 用途 | Git／清理原則 |
|---|---|---|
| app/ | Browser／export renderer runtime、assets、Project／Preferences UI | 保留；功能變更另案 |
| electron/ | Main／preload、窄 IPC、Project／settings stores、export controller | 保留 |
| vendor/ffmpeg/ | 正式 ffmpeg.exe／ffprobe.exe、LICENSE／README／BUILD hashes | 保留，不任意替換 build |
| dev/tests/ | Node／Browser regression | 保留 |
| dev/tests/fixtures/ | 靜態字幕與 baselines | 保留並追蹤，不能當 generated output |
| dev/tests/artifacts/ | 測試影片、profiles、截圖、logs／results | ignored，可重建；可清除 |
| dev/fixtures/ | Factory Defaults 原始資料 | 保留 |
| dev/tools/ | launcher、generators／checkers、audits、integration／benchmark helpers | 保留仍有維護用途者 |
| dev/reports/ | milestone 決策報告 | 保留 |
| dev/reports/archive/ | 小型歷史 metrics／result evidence、cleanup snapshots | 保留；大型影片已清除 |
| dev/notes/ | 歷史分類 manifest、來源 hash 紀錄 | 保留 |
| node_modules/ | 開發依賴與 installed Electron runtime | ignored；主要開發機保留 |
| dist/、dev/downloads/、repo-local caches | 可重建／重複下載內容 | ignored，可明確清除 |

## Project System

`.waveproj` 是 readable JSON，`format=wavecanvas-project, version=1`。保存 complete settings/layout banks、原始媒體 references 與已編輯的 bilingual lyric documents／stable event IDs，與 Preset 分離。

顯示 `name` 與 projectPath 分離；具名未存檔專案 Ctrl+S 仍開 native Save As。New 預設可輸入名稱、取消或稍後命名為 Untitled；Rename 只改 metadata／dirty，不移動檔案。Save As 不以選定 basename 覆蓋顯示名稱，預設 filename／Collect folder/file 使用 sanitized name。舊 v1 缺 name 時從 file basename fallback。

只有已存檔且 dirty 的專案可 autosave；每次先保留 previous-file backup，每 project 最多 10 份。Never-saved projects 不建立 recovery/temp project。Close／Open／New 保留 Save／Don't Save／Cancel guard。Collect copy originals、改 relative refs、collision suffix；Recent 保存 name/path/time/layout，Home 不掃讀全部 project files。Missing Media 有明確回報。

## Video Export Architecture

Renderer 保持 `frameIndex / 60` 虛擬時鐘、offline audio analysis、原 FFT／listener 與 WAAPI ready/currentTime 同步。Main 在 advance 前訂閱 offscreen paint，用 Stage 外的 identity row 驗證當前 compositor 幀；只送原 1920×1080 pixels，metadata 不進影片。Native repaint rate240獨立於內容60 FPS。

`toBitmap()` owned buffer 取 Stage view，避免多餘 full-frame copy；rounded stride 使用 bounded row buffer。Capture／stdin write 逐幀 await，queue depth1；timeout／renderer failure 不拿 stale frame 補位。正式 FFmpeg 保持 CPU H.264 medium／CRF18／yuv420p 與 AAC，取消／錯誤保護既有 target。

Home RTX 3080 Ti／i5-12600KF reference：60.186s project、3612 frames、66.83s total、0.901× realtime、avg capture15.06ms、0 dropped、A/V endpoint error13.878ms。這是單機 reference benchmark，不是最低系統需求或跨 GPU 效能保證。

Test-only benchmarks 位於 dev/tools，與 production encoder path 分離。可用 `node dev/tools/capture-benchmark.cjs --mode=production --full` 重建數據；compare helpers 需要新產生的 benchmark.json/raw frames，不讀精簡 archive 當作完整 run。

## Options / Preferences

File → Preferences… 分為 General、Project、Playback、Interface、Export、Advanced。Cancel／Esc 捨棄草稿，只有 Save 成功才 persist＋apply。Restore Defaults 需確認且仍須 Save，恢復全部偏好但保留專案、Recent 原始歷史、backups、視窗及匯出位置紀錄；Home 仍按恢復後的 Recent limit 顯示。

- General：預設啟動 Home，可重開最後專案；不存在或 invalid 時回 Home。記住視窗 normal bounds／maximized，驗證目前 displays；關閉確認只控制 app/window close，Open／New 仍有 dirty guard。
- Project：沿用命名與 autosave（1／3／5／10／15 分鐘，預設5）；Recent limit 支援5／10／15／20，預設10。一般 Save 即時裁切列表，不刪專案。
- Playback：預設音量0–100%，只套用下一個 media/project session；自動播放預設 Off，只在使用者成功載入且 audio ready 時生效。啟動重開專案保持靜音。
- Interface：80／90／100／110／125%，Save 即時改 application chrome；canonical Stage 1920×1080、DPR 與 export 座標不變。
- Export：Last used／Project folder／Custom folder；Custom 使用 native picker。成功匯出才記錄 last folder；目錄失效或專案未存時 fallback last-used／system Save dialog。
- Advanced：Main 的窄 API 開啟 Data Folder。沒有穩定 logs directory，因此沒有假的 Logs 按鈕。

Main 使用 `app.getPath('userData')/settings.json`，獨立 `wavecanvas-settings` v1 JSON、canonical defaults、load validation 與 atomic temp→rename。Renderer 只有窄 API，沒有 raw fs/path/ipcRenderer。Interval 改變先 clear 再重建單一 scheduler，Off 不影響 manual save／dirty／close guard。正式 settings 不寫進 project 或 repo；tests 使用 isolated userData。

新版補齊舊 v1 缺少欄位，保留原 naming／autosave 值。`application-state.json` 獨立保存 window／lastExportDirectory；最後專案沿用 `recent-projects.json` metadata，不把 project state 放入 settings。

## Known Limitations

- Browser 主套件仍有10項 baseline failures；其他專項與 desktop regressions 分開記錄。
- Chromium raw PNG bytes 有微量 rounding 不穩定性。Audio／lyrics exact；Canvas／full composite 用既有 max1/255、changed channels<0.1% 門檻，byte equality 保留 diagnostic。
- Capture 仍有 GPU→CPU readback；其他 GPU／driver／DPI與長歌記憶體仍需驗證。
- Autosave 沒有 never-saved crash recovery；強制終止 Main／斷電可能留下既有 partial output。
- 真實 project export tests 需要相鄰唯讀 fixture；不存在時不可假裝測過。

## Maintenance Notes

不要隨意改 FFT/listener semantics；Project format 更動要考慮 backward compatibility；Export timeline 保持 deterministic。Renderer 不取得 raw fs／child_process。Production export 與 test-only benchmark 分開，每個 major change跑適當 regression。

`npm run repo:size` 回報 logical file bytes（包含 ignored files、不跟隨 symlinks）；nested directory 數字有重疊，不可直接相加。清理前確認 Git status、查測試依賴與 vendor hashes，只刪明確 disposable 路徑；不要使用 git clean -fdx。Repo-local caches 可清，系統全域 cache／AppData／使用者 projects 不在清理範圍。

歷史分類 manifest 保留原 checksum；必要 baselines 已移出 artifacts，明確記錄 removed-generated disposition，不讓舊輸出成為測試前置條件。小型歷史證據見 [archive inventory](dev/reports/archive/milestone-evidence/README.md)。

工程入口：[Project System](dev/reports/PROJECT-SYSTEM-V1-REPORT.md)、[Video Export Phase 1](dev/reports/VIDEO-EXPORT-PHASE1-REPORT.md)、[Home GPU benchmark](dev/reports/VIDEO-EXPORT-HOME-GPU-BENCHMARK.md)、[Phase 2A capture](dev/reports/VIDEO-EXPORT-PHASE2A-CAPTURE-OPTIMIZATION.md)、[Preferences v1](dev/reports/APP-POLISH-PREFERENCES-V1-REPORT.md)、[Repo cleanup](dev/reports/REPO-CLEANUP-REPORT.md)。其他視覺／UI milestone 報告仍在 dev/reports。

## Release Preparation Notes

目前 bundled FFmpeg 是 **GPL build**（見 vendor/ffmpeg/BUILD.json、LICENSE、README provenance與hashes）。Unsigned RC 供內部驗證；公開 redistribution 前仍需完成 release licensing compliance，不宣稱 release-safe。

發布策略、source delivery gates 與 encoder 相容性評估見 [FFmpeg distribution/licensing audit](dev/reports/FFMPEG-DISTRIBUTION-LICENSING-AUDIT.md)；[Third-party notices](THIRD_PARTY_NOTICES.md) 與 licenses/ 已打包，完整 dependency notices 與 corresponding-source delivery 仍 BLOCKED。

Release Engineering v1 已提供 Installer、File Association 與 licensing UI / resources；code signing 未配置，source delivery gate 未完成。NVENC／HEVC／AV1／4K未正式整合。
