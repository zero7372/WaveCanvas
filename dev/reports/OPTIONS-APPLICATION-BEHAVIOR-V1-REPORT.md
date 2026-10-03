# WaveCanvas Options & Application Behavior v1

日期：2026-10-03。基於 `d4f9eeb8`，本輪完成應用程式 Options；不實作下一輪 Release Engineering。README 更新限 Options 與測試入口。

## Settings schema

保留 `format: wavecanvas-settings`、`version: 1`。唯一 canonical defaults 在 `app/app-settings.js`，Main 與 renderer 共用；load 補預設，Save 嚴格驗證 whitelist／型別，未知欄位拒絕。

| 分類 | 欄位與預設 |
|---|---|
| General | startupMode=home；rememberWindowBounds=true；confirmUnsavedClose=true |
| Project | askNameOnCreate=true；autosaveEnabled=true；autosaveIntervalMinutes=5；recentProjectsLimit=10 |
| Playback | defaultVolume=1；autoPlayOnLoad=false |
| Interface | uiScale=1 |
| Export | defaultDirectoryMode=last-used；customDirectory=null |

Settings 使用原本 atomic temp→rename、單一 write queue。六分類 Preferences modal 保留 Save／Cancel；控制項、folder picker 與 Restore Defaults 都只改草稿。Save 成功才 persist＋apply；失敗留在 dialog 顯示錯誤。

## Preferences vs state

`app.getPath('userData')/settings.json` 只保存 Preferences。新增同目录 `application-state.json`，保存 normal window bounds／maximized、lastExportDirectory，Main 使用獨立 atomic queue。last project 沿用 `recent-projects.json`，沒有新的完整 project state 副本；`.waveproj` format 不變。

Restore Defaults 恢復五組偏好、不刪 raw Recent history、projects、backups 或 application-state。UI Reset 後 Save 使用明確的 reset mode，避免將恢復預設的 Recent limit=10 當成刪除歷史指令。Home 仍只顯示目前 limit；往後正常 Recent 更新／一般 Preferences Save 按目前上限裁切。

## General

提供啟動行為、記住視窗、未儲存關閉確認。視窗偏好修改不會移動當前視窗；下次保存／啟動才生效。關閉確認 Off 只影響 app/window close。

## Startup behavior

預設 Home。Reopen Last Project 使用 Recent 第一筆，透過正式 Open Project loader；missing path／invalid JSON／不可開啟時回 Home，正常啟動不 dirty，不改名稱或保存內容。

選擇一致的安靜啟動 UX：即使 autoPlayOnLoad=true，startup reopen 仍保持 paused。只有使用者主動載入 project/audio 才自動播放；Preferences UI 已說明。

## Window state

Remember On 在正常關閉前保存 `getNormalBounds()` 和 `isMaximized()`；啟動前讀 settings/state，ready-to-show 前恢復 maximized。Remember Off 忽略且保留舊 state，使用 factory size（1560×960，依 work area 縮小）。

Restore helper 檢查整數與最小合理尺寸、目前 display workArea；不存在的第二螢幕／完全 offscreen bounds 回 factory/default 位置。仍在 display 上的 oversized bounds 會縮小並夾回 workArea，避免保留已不存在的桌面範圍。Normal／maximized、On／Off、第二螢幕拔除與 reduced work area 都有測試。

## Dirty close behavior

On 保留 Save／Don't Save／Cancel；Off 對 dirty app close 直接 discard。正式 Open/New 仍經原 guard，不會因關閉偏好而丟資料。External file association 尚未實作，本輪沒有新增 bypass。Window state flush 在 Main finishClose 完成後才關閉。

## Project options

沿用新建命名、具名 never-saved Save As、rename/display name、manual save、autosave scheduler 與每 project 最多10份 backups。Autosave intervals 仍為1／3／5／10／15分鐘；關閉或更換間隔先清舊 scheduler，沒有新增 timer。

## Recent limit

支援5／10／15／20、預設10，非法 load 值 fallback10。一般 Preferences Save 即時 trim 磁碟 metadata、通知 Home 更新；順序不變，不刪 project files。重用原 Recent subsystem，沒有掃讀所有 project files。

## Playback

UI 顯示0–100%，內部0–1；非法 load fallback1、非法 Save 拒絕。Default volume 只套用下一個新 project/media session，不在 Preferences Save 強制覆蓋当前音量。

Autoplay 預設 Off。主動載入成功且 audio canplay、沒有 decode error／missing media 才播放；media selection token／file identity 避免舊 canplay 誤播。Startup reopen 靜音。原 local-audio FFT、sampling 與 listener semantics 原檔保留，應用層行為在新增 controller／project loader 外圍處理。

## UI scale

80／90／100／110／125%，非法 load fallback100%。Save 立即更新 CSS `--ui-scale`，縮放 Home／editor chrome／inspectors／transport／dialogs。沒有改 BrowserWindow zoomFactor。Preferences 尺寸按 scale 限制 viewport、內容可捲動。

五種 scale 驗證 Stage、DPR、project snapshot；80／100／125 額外驗證 sidebar／transport／dialog viewport，保存截圖。人工查看80與125畫面，控制項可用、沒有超出 viewport。

## Stage isolation

沒有對 Stage 或其 ancestor 套 zoom。Canonical Stage 固定1920×1080；visualizer geometry、lyrics coordinates、export resolution、frameIndex/60 virtual clock、capture path 都保持原實作。Scale 只觸發既有 preview-fit resize；export renderer 使用原固定 Stage。

300-frame 重複 export 在 Preferences 與 UI scale 改變前後比較，audio／lyrics exact，Canvas／compositor 維持原 max1/255、changed channels<0.1% 門檻，不放寬期待值。PNG byte equality 仍保留 diagnostic。

## Export directory

| 模式 | Native Save dialog default directory |
|---|---|
| Last used | 上一次成功完成並 commit target 的輸出資料夾 |
| Project folder | Main 已知 current projectPath 所在資料夾 |
| Custom | Native Choose Folder 選定且仍存在的資料夾 |

Custom／project folder 失效或 project 未存時 fallback last-used；last-used 也不存在則保持系統 Save dialog location。Unicode／spaces、deleted custom、unsaved project、所有模式都有測試。只改 defaultPath 的 directory，原 filename sanitizer 不變。

只有成功輸出 rename 後更新 lastExportDirectory；取消 Save dialog／取消 export／失敗不更新。成功 export 後若 state 寫入失敗只記錯誤，不把已完成的影片說成失敗。

## Advanced actions

Open WaveCanvas Data Folder 經窄 settings IPC，在 Main 使用固定 `app.getPath('userData')`＋`shell.openPath`。Renderer 不能指定任意 shell command／path，也沒有 raw filesystem、shell、ipcRenderer。Directory picker 也在 Main，返回選定 directory 字串；sender／mainFrame 驗證保留。

目前沒有穩定 production logs/diagnostics directory，因此不新增假的 Open Logs 按鈕。Restore Defaults 保留確認與草稿 Save 語意。

## Settings migration

舊 v1 只有 Project 三欄時補新 defaults，原 askNameOnCreate、autosaveEnabled、autosaveIntervalMinutes 不變；讀取不改寫或刪舊檔。Malformed／不符 format-version fallback canonical defaults，Save 仍走原 atomic store。不 bump schema version。

## Browser behavior

Standalone Browser 無 persistent Preferences backend，使用 defaults；Preferences disabled／Desktop App 提示，沒有另建 LocalStorage settings。Electron-only native動作不可用，不 crash。Browser regression 保留既有 baseline，failure labels 必須一致。

## Tests

最終驗證均使用隔離 userData，透過 native `--user-data-dir` 在 Main 初始讀取前指定；secondary-instance 也使用同一測試 profile。Test-only inspector／dialog mocks 不打包，沒有新增 production test hook。

| Suite | Development | Packaged |
|---|---|---|
| Node `npm test` | 112/112 | 共用來源 unit tests |
| Project | 51/51 | 51/51 |
| Preferences | 28/28 | 28/28 |
| Electron | 48/48 | 48/48 |
| 新增 Options | 43/43 | 43/43 |
| Synthetic Export QA | 34/34 | 34/34 |
| 實際專案 short export | — | 7/7；300 frames、H.264/AAC、1080p60 |
| Browser | 589 PASS／10 known FAIL | Browser standalone suite |

Options 包括 startup home／valid／missing／invalid、silent reopen、normal/maximized/Off/offscreen、close On/Off 與 Open/New guard、volume0/0.5/1與 decode failure、五种 UI scales、native directory defaults、Reset draft／原始歷史保留與完整 quit/restart persistence。Unit helper 額外涵蓋第二螢幕移除、reduced display、全部 recent limits、deleted folder／未存專案 fallback、invalid schema、migration與 backups 保留。

Development／packaged 各重複兩次300-frame export（第二次改 UI scale125%及其他 Preferences），SSIM=1，audio／lyrics exact；[development pixel metrics](archive/options-2026-10-03/determinism-development.json)、[packaged pixel metrics](archive/options-2026-10-03/determinism-packaged.json) 保存原 tolerance 與 byte-equality diagnostic。Cancel 輸出到另一資料夾，驗證 last-used 不被覆蓋且 partial 清除。實際專案 source/media/lyrics 的 hash／size／mtime 前後不變。

Browser 主頁432/10，加上五專項157/0；[failure-label comparison](archive/options-2026-10-03/browser-comparison.json) 與 cleanup baseline 完全一致。FFmpeg／ffprobe vendor 與 packaged [SHA256 一致](archive/options-2026-10-03/vendor-hashes.json)。

測試工具修正：初次額外 packaged Export QA 的 missing FFmpeg／non-zero cases 操作了 development module，所以兩項注入沒有作用；改為 app.asar module identity 後全套34/34。最初 Options packaged 測試也曾在 dialog close event 前重開 Preferences，改成等待 dialog 移除後通過；這些修正只在 test harness。早期 Electron 並行負載及 secondary profile 啟動造成測試 timing/lock 問題，改用同 profile與依序 GUI/export 回歸後48/48，沒有放寬 FFT／layout 期待值。

小型結果、logs與80/100/125 screenshots 保存於 [evidence inventory](archive/options-2026-10-03/README.md)；影片、profiles、巨大 raw diagnostic payload 保持 ignored generated artifacts，沒有納入 Git/build。

## Build size

`npm run electron:build` 成功；[build audit](archive/options-2026-10-03/build-audit.json)：win-unpacked **597,637,896 bytes／569.9519 MiB**，allowlist **90 entries**，不含 dev/tests/reports/node_modules。相對 cleanup 的約569.94 MiB 增量只有少量 runtime code，沒有數十 MiB 增長。Development unpacked build；FFmpeg binaries／encoder／package licensing configuration 未修改，沒有新增 installer、signing 或 file association。

## Known limitations

- Browser 原有10項期待值 failures，不能宣稱全套全綠。
- Window state 保證正常關閉保存，不新增強制終止／斷電 recovery；顯示器拔除 helper 測試，不是實際熱插拔多螢幕驗證。
- UI scale 本機 Windows/DPR1 驗證；其他 DPI／較小螢幕仍需額外 hardware QA。
- Chromium PNG 可能微量 rounding；以既有 pixel tolerance 驗證，不宣稱 byte-identical。
- Logs 按鈕未提供，因為没有稳定 production logs directory。
- 現有 GPL FFmpeg release obligations、installer、signing 等仍是既有獨立 Release Engineering 工作。本輪結束，不新增產品功能。
