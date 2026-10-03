> 維護註記（2026-10-03）：generated videos／暫存輸出已清除；小型證據連結改到 archive，靜態 baseline fixtures 改到 dev/tests/fixtures/baselines。下文數值為當時 milestone 實測，不代表本輪重跑。

# Electron Phase 1 — Windows Desktop Shell + Development Build

本輪新增 Electron 外殼與 Windows x64 unpacked build；既有 Renderer JS／CSS、FFT、listener、Audio、Lyrics、Timing、Geometry、Preset 及 Templates 程式未修改。新增唯一 app 資產為從既有 CSS WaveCanvas 標記繪製的 PNG icon。

## 1–3. Versions / Dependencies

| 項目 | 版本 | 分類 |
|---|---|---|
| Electron | 44.5.1 | devDependency；MIT |
| electron-builder | 26.15.3 | devDependency；MIT |
| WaveCanvas metadata | 0.1.0 | 首次建立早期版本，非 1.0 release |
| 開發環境 | Node 24.18.0 / npm 11.16.0 | Windows x64 |

沒有 production dependency 或額外 test framework。加入 package.json／package-lock.json，版本固定。`.npmrc` 使用 repo-local npm cache；Electron 44 首次 require 時才下載 binary，launcher 提供 repo-local Electron cache。Builder 重用 node_modules/electron/dist，同樣不用全域 Electron cache。electron-winstaller 的非必要 install script 未啟用，未製作 installer。

## 4. Main / Preload / Renderer

- electron/main.cjs：app lifecycle、原生視窗、單一實例、local loading、安全限制與錯誤回報。
- electron/preload.cjs：無 bridge／IPC／Node API 暴露；現有 browser API 足夠。
- app/index.html：原樣使用既有 HTML／JS／CSS。所有相對 asset paths 在 file:// 與 Browser 均可運作。
- dev/tools/electron-run.cjs：開發、start、builder 的 CLI launcher。
- dev/tools/electron-smoke.cjs：本機 test-only Main inspector driver；不打包、不在正常啟動開 inspector。

## 5. BrowserWindow

目標 1560×960，依螢幕 work area 縮小；minWidth=1000、minHeight=680，較小螢幕再以 work area 為上限。frame=true，原生 title bar／minimize／maximize／restore／close；沒有 custom title bar 或 frameless。背景色 #17191e，ready-to-show 後顯示。

title、app name、Windows AppUserModelId 與 exe ProductName／FileDescription 都是 WaveCanvas。BrowserWindow 與 build 使用 app/assets/wavecanvas.png，沿用既有圓框／五條聲波設計；PNG 的產生器位於 dev/tools/generate-app-icon.cjs。

## 6–7. Local Assets / Browser Compatibility

以 loadFile(app/index.html) 載入，沒有 localhost、server 或遠端 runtime 依賴。三張 builtin template PNG、全部 JS／CSS、中心圖片都已在 packaged exe 測試。沒有 Browser compatibility fix，沒有修改 app/index.html 或既有 runtime。

Help 可開啟 bundled README 的隔離視窗，其他新視窗與外部導覽拒絕。正常視窗保留 DevTools 能力；dev 自動開啟，start／packaged 不自動開啟。

## 8–9. File Import / Web Audio

原 HTML File inputs 正常使用；WAV、PNG、Primary LRC、Secondary SRT 有實際磁碟檔案匯入驗證。另以合成 File 測試 Primary SRT＋Secondary LRC、Primary LRC＋Secondary SRT、多語文字與 Primary `...` 間奏。

Web Audio playback、Pause、decimal Seek、analyser／原 FFT signal、bass reaction、waveform decode，以及三種 geometry 在播放下有音訊資料均通過。未改 mapping 常數、wallpaperAudioListener 或原 pipeline。沒有 disableHardwareAcceleration、強制 GPU 或軟體 renderer 指令，交由 Electron／Chromium 預設選擇。

## 10. Preset / LRC Export

原 Blob＋anchor download 不需 compatibility fix。Preset JSON 與 Unicode LRC 在 Electron development／packaged 實際寫入測試目錄並驗證內容。測試的 Main listener 僅設定下載目的地；正式 app 沒有自訂 save dialog／download IPC，沿用 Chromium 的正常下載行為。

Preset File import、Factory Reset、三種 Template apply 通過。LRC 匯出保留 UTF-8 與原 serializer，不新增 SRT Export。單值 Restore handler 未修改，其原 Node regression 通過。

## 11. Single Instance / Lifecycle

requestSingleInstanceLock()；第二個 instance 退出，既有視窗若 minimized 則 restore、show、focus。實際測試第二次啟動：只剩一個主視窗且已還原／聚焦。

whenReady、activate、second-instance、window-all-closed 均處理。關閉主視窗直接 app.quit，Help／DevTools 不留下背景程式；測試已確認程序正常退出，不加 unsaved-work interception。

## 12. Security / Errors

contextIsolation=true、nodeIntegration=false、sandbox=true、webSecurity=true、webviewTag=false，未允許 insecure content。Renderer 實測 require／process／native bridge 不存在。Preload 不暴露 fs、child_process、IPC、任意執行或檔案 API。HTTP／HTTPS／WS／WSS runtime requests 拒絕；無遠端頁面、telemetry 或 crash upload。

Main uncaughtException、unhandledRejection、主頁 load failure、render-process-gone 會記錄並回報錯誤後退出；Renderer console error 傳到 Main stderr，dev mode 能見所有 console 等級。

原 Web App 沒有 CSP，這輪保留，dev mode 會出現 Electron CSP warning。沒有新增 unsafe-eval 或關閉 CSP；完整 CSP／custom protocol hardening 留待後續 security phase，不能視為已完成正式 release security audit。隔離／sandbox 的設定參照 [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)。

## 13. npm Scripts

| 指令 | 用途 |
|---|---|
| npm run electron:dev | Desktop + 自動 DevTools |
| npm run electron:start | Desktop，不自動 DevTools |
| npm run electron:build | Windows x64 --dir，再 audit |
| npm run electron:test | 開發 Electron compatibility smoke |
| npm run electron:test:build | 真正 unpacked exe smoke |
| npm test | 既有 Node harness |
| npm run browser:start | 原 loopback Browser server |

## 14–17. Build Output / Contents / Size

入口：dist/win-unpacked/WaveCanvas.exe。必須保留同目錄 DLL、pak、locales、resources 等 Electron runtime，不是單檔 portable exe。ProductName／FileDescription=WaveCanvas，version=0.1.0，Authenticode=NotSigned；尚無 installer、code signing、auto update。

明確 allowlist：app/**/*、electron/**/*、package.json、License.txt、README.md。Builder 移除 package 的 devDependencies／scripts／build config，app.asar 無 dev/、tests、reports、screenshots、benchmark、node_modules 或 cache。

因自訂 Electron dist 保留上游 default_app.asar，afterPack 在已驗證的生成 dist 目錄中移除該 Getting Started demo；不修改 node_modules 或原始專案檔案。resources 只含 app.asar。原 MIT License 在 archive 內，Electron／Chromium 隨附 notices 保留。

Build 約 369 MiB（精確 bytes／MiB 與 62 個 archive entries 見 dev/reports/archive/milestone-evidence/electron-build-audit.json）；沒有極端體積優化。Build audit 為 postelectron:build，每次成功 build 都會執行。

## 18. Electron Smoke

開發 start：48/48；dev＋自動 DevTools：48/48；實際 packaged WaveCanvas.exe：48/48。涵蓋 visible Home、security flags、local loading、三張模板與三種 layout、合成＋磁碟媒體、Web Audio／bass、播放／Pause／Seek、Cover revoke、雙語混用／間奏、waveform／drag／fine／manual／history／zoom、Preset／LRC 真正下載、Factory reset、minimize／maximize／restore／resize、單一實例聚焦、關閉退出。

測試經 Main inspector 執行 dev-only renderer fixture，沒有測試 API 或 native bridge 留在 production app。檔案匯入使用真實 file input 的 programmatic selection；Windows OS picker 與 Save dialog 未手動逐一操作。每次下載使用新目錄，避免既有檔案造成 interrupted；保留歷次測試產物。

紀錄：歷史 generated output（electron-{development；已清除）,devtools,packaged}/results.json、console.txt、editor.png。下載也在各自目錄。最終測試不含 Renderer error／fatal load error。

## 19. Browser Regression

原 Browser standalone smoke 14/14，47 個 script／CSS URLs、三張縮圖、Home／Editor、WAV 載入正常。原 Node tests 79/79，含受保護 FFT／listener／renderer hashes，既有 file paths／schema／preset／Factory 亦通過。沒有停用 tests 或改演算法；未重跑所有大型歷史 browser suites。

## 20. Known Limits / Scope

- 只驗證目前 Windows x64 機器；沒有 Intel／AMD／NVIDIA 多機矩陣、30 分鐘 soak 或 60 FPS 長時間 benchmark。
- Electron 音訊 smoke 使用 WAV，沒有以真實 MP3／FLAC 做解碼矩陣；原 accept 與 browser pipeline 保留。
- Windows Snap 與 taskbar icon 的視覺驗收未手動進行；保留原生 frame 與 icon，minimize／maximize／restore／resize 已實測。
- 未簽章，屬 Development Build；完整目錄不能拆成只有 exe。
- 原 CSP warning 尚存；ASAR allowlist 不是加密或安全邊界。
- .waveproj、Project Save／Load、Video Export、FFmpeg、Preferences、Local Profile、i18n、Custom Title Bar、Installer、File Association、Auto Update、Plugins 均未開始。

新增／修改檔案：electron/、package.json／lock、.npmrc、.gitignore、app/assets/wavecanvas.png、dev/tools 的 launcher／smoke／icon generator／afterPack／build audit、dev/tests renderer smoke／fixtures／artifacts、README 與本報告。沒有修改既有 app code；沒有新增永久 AGENTS 規則。
