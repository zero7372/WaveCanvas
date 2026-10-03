# WaveCanvas Video Export Phase 1

完成日期：2026-10-03。此版本是未簽章的 Windows Development Build；影片輸出已實裝，尚不能宣稱可直接公開再散布隨附 FFmpeg。

## 1. Export architecture

Editor 取得目前記憶體中的 Project snapshot 與 Audio / Cover / Background / Overlay File bytes → 窄 IPC → Main 驗證並複製 snapshot → 專用 Export Renderer → 順序產生完整 Stage BGRA frame → Main pipe 至 FFmpeg → 同目錄暫存 MP4 → 成功後 rename 成正式輸出。

Untitled / Dirty 可直接輸出，不要求先儲存；沒有 Audio 時停用。Editor 不與 Export 共享可變狀態。正式 UI 永遠輸出完整歌曲；時間範圍僅供 Main-side 測試使用。

## 2. Dedicated renderer implementation

`app/export.html` 的 Stage markup 與 Editor 相同，共用 main、geometry、background、cover、lyrics、song-info、runtime/settings 等模組。沒有載入 Inspector、Media Panel、Timing Editor、Project controller、Recent、Autosave 或播放控制 UI。

`electron/export-render-window.cjs` 建立固定 1920×1080 的隱藏 offscreen BrowserWindow：backgroundThrottling=false、contextIsolation=true、sandbox=true、nodeIntegration=false、zoom=1、offscreen deviceScaleFactor=1。建窗後再次 setContentSize，避免 Windows 工作區限制初始尺寸。Export 頁強制 Stage 位於 (0,0)，並檢查 canonical bounds / DPR。

## 3. Full DOM + Canvas capture

使用 Electron offscreen Chromium compositor 的 paint NativeImage，包含 Canvas、DOM 歌詞、Song Info、圖片及 CSS 效果。每幀推進虛擬時間、等待動畫 ready / native paint barrier，再取兩次 invalidation 的第二次 paint，排除排隊的舊 paint。

在 paint callback 內立即裁切 (0,0,1920,1080)，複製 toBitmap 至獨立 Buffer，避免 Chromium 回收表面後像素被覆寫。Windows 隱藏視窗可能提供 1922×1081 表面，僅裁切邊界，不縮放。每幀必須恰為 8,294,400 bytes；尺寸過小或逾時即失敗。沒有使用 canvas.captureStream、MediaRecorder 或只截 Visualizer Canvas。

## 4. Deterministic render clock

`app/export-clock.js` 僅於 Export 頁替換 RAF、performance.now、Date.now、interval、Math.random 與 audio 時間 getters。frameIndex / 60 是唯一內容時間；每次只能順序推進一幀。真實 RAF 僅用於等待 compositor，不推進內容。

WAAPI 動畫暫停並依虛擬時間更新 currentTime；等待 animation.ready 後再捕捉。既有動畫程式繼續執行，不讓其依捕捉耗時自由播放。Export 不逐幀 seek 或播放 HTMLAudioElement。FPS 診斷數字在輸出時隱藏。

## 5. Offline audio analysis

`app/export-stage.js` 解碼原音訊；使用與 Preview 相同的預設 AudioContext sample rate，透過 OfflineAudioContext speaker downmix 成單聲道。PCM 轉移至 `app/export-audio-worker.js`，依時間順序分析。

8192 FFT、Blackman window、magnitude → dB，重用原 `audio-adapter.js` 的 createSpectrumMapper。每秒 30 次分析，與既有 Preview 音訊更新節奏一致；60 FPS 每兩幀送一次 mapped input。Cache 為連續 Float32Array，沒有每格 object。真實專案 cache 925,184 bytes。

## 6. Preview / Export FFT compatibility

沒有修改 FFT mapping 常數、audio-adapter、wallpaperAudioListener 或 main.js Visualizer 核心。原 64-bin mapping、Input Gain、pink noise、adjacent / temporal smoothing、128 audioSample expansion 與 bass bins 全部沿用統一 Runtime / 原 listener。

離線分析的 causal FFT window 以固定 sample index 結束，開頭不足補零；即時 Analyser 的硬體觀測時點及啟動延遲不可能完全一致，不能宣稱逐 sample 等同即時播放。已驗證校準範圍、96 Hz 峰值、128-bin 對應、有限值、重複分析及既有 FFT/listener regression。

## 7. Temporal smoothing

Mapper analysis 與送入 listener 都按時間順序處理，listener 保有原 smoothing state；並非每幀清空後獨立計算。內部 range 測試先從 frame 0 順序 warm up，再丟棄 range 前的影格，保留粒子、平滑與動畫狀態。

## 8. Particles / random / motion

Export 使用固定 seed 的 xorshift random 與 1/60 秒 RAF 步進，保留 Particle Style 1/2 的原 frame integration。Bass shake 可重現，Infinity Drift、Bass Pulse、Cover rotation、歌詞 focus / glow / interlude 都由固定時鐘及既有邏輯推進。Preview 的 random / clock 不受影響。

Circle / Square / Linear、兩種粒子、Linear 圓 Cover 負向旋轉與 Bass Pulse 已實際輸出驗證。沒有新增硬體 encoder 或改 Visualizer 演算法。

## 9. FFmpeg source / version / license

來源：[Gyan 9.0.2 essentials release](https://github.com/GyanD/codexffmpeg/releases/tag/9.0.2)。實際 `-version`：`9.0.2-essentials_build-www.gyan.dev`；`-L`：GPL version 3 or later。實際 build 含 `--enable-gpl --enable-version3 --enable-static --enable-libx264`，也含其他 GPL codec libraries；未見 --enable-nonfree。

保存原 LICENSE、README.txt、BUILD.json 與 SHA256，沒有新增 npm FFmpeg dependency。來源 README 指向 [FFmpeg source commit 946fcce07b](https://github.com/FFmpeg/FFmpeg/commit/946fcce07b)；Gyan 的 [build 說明](https://www.gyan.dev/ffmpeg/builds/)亦說明其 Windows static builds 為 GPLv3。

**尚未準備完整 corresponding source、第三方 library source / build materials 與再散布合規流程；releaseSafe=false。保留 notice 並不等於完成 GPL 義務，不能把整個 packaged build 只標成 MIT 後直接發布。** 此處是技術授權紀錄，非法律意見。

| Binary | Bytes | SHA256 |
|---|---:|---|
| ffmpeg.exe | 105,423,872 | 3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec |
| ffprobe.exe | 105,221,120 | f0d36ecbbdd3bcfac3efa078c96c7271c2e68b3810595552ac3b7f17e9a65c52 |

## 10. FFmpeg command

等效結構如下；實際由 spawn argument array 傳入，不拼接 shell：

```text
ffmpeg -hide_banner -nostdin -y
  -f rawvideo -pixel_format bgra -video_size 1920x1080 -framerate 60 -i pipe:0
  -ss <start> -i <temporary-original-audio>
  -map 0:v:0 -map 1:a:0
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p
  -frames:v <ceil(duration * 60)>
  -c:a aac -b:a 320k -t <frameCount / 60>
  -movflags +faststart <same-directory.partial.mp4>
```

正式 start=0。沒有 NVENC/QSV/AMF、codec/CRF/resolution selector 或 metadata customization。

## 11. Frame transport

1920×1080 BGRA rawvideo 經 Main child stdin 傳輸，不落地大量 PNG。Capture / write 逐幀 await，順序嚴格為 0,1,2…，處理變慢只增加匯出耗時，不改時間軸或丟幀。

## 12. Backpressure

每個完整 frame 等待 writable write callback 才開始下一幀，queue 最多一幀；不持續無限 write。FFmpeg stdin / close errors 都會終止 pipeline。測得 droppedFrames=0、peakQueueDepth=1。

## 13. Audio mux

Main 把原 File bytes 寫入獨立 temp audio input，FFmpeg 直接讀取並編碼 AAC 320 kbps。不錄 Web Audio output、麥克風或 loopback。來源不重新儲存，不要求特殊 AAC stream copy。實際 bitrate 依來源聲道及 AAC encoder 可低於 target，320k 是編碼目標。

## 14. Video quality

CPU libx264、medium、CRF18、yuv420p、opaque MP4、faststart。Stage 使用共用背景 / backing color。採用系統 font stack 並等待 document.fonts.ready，沒有重新附帶字型；不同電腦的字型 fallback 可能不同。

## 15. A/V sync

| 測試 | Audio duration | Video duration | Frames | 結尾差 |
|---|---:|---:|---:|---:|
| 真實完整 Stage | 60.186122 s（AAC stream） | 60.200000 s | 3612 | 13.878 ms |
| 五分鐘合成 encoder/clock | 300.001000 s | 300.016667 s | 18001 | 15.667 ms |

皆小於一幀 16.667 ms，符合 ceil 規則。亦測試 0.01 秒單幀、5 秒、10 秒。五分鐘測試使用合成 video/audio 驗證編碼與 A/V 時間軸，**不是五分鐘完整 DOM Stage capture benchmark**；完整 Stage 實測最長為本次 60.186 秒真實專案。ffprobe 的時間差驗證不等於人工逐拍聽覺校時。

## 16. UI / progress / cancel

工具列與 File menu 新增「輸出影片…」，使用 native MP4 Save dialog / overwrite 流程；預設 Project name.mp4，無名稱用 WaveCanvas Export.mp4。顯示準備、逐幀輸出、編碼、完成整理、frame count / percentage；不顯示虛構 ETA。

Editor 在匯出時 inert 並阻擋 Project keyboard shortcuts，獨立進度浮層與 Cancel 仍可用。暫停 Preview，完成 / 取消 / 失敗後恢復播放位置及 playing state。Autosave scheduler 保留但忙碌時跳過寫入。Browser 模式 Export disabled，提示 Desktop-only。

Cancel 會停止 renderer、終止 FFmpeg、等退出後清理；最終 rename 的短 commit 階段停用 Cancel，避免成功檔案被回報取消。完成後僅提供「開啟所在資料夾」，不自動啟動播放器。

## 17. Temp / atomic output

原 Audio 複本置於 OS temp 的 wavecanvas-export-* 目錄；輸出 partial.mp4 在正式目標同一目錄，以免跨磁碟 rename。只有 FFmpeg code=0 且沒有取消才 rename，失敗 / 取消不覆蓋既有 target。recursive cleanup 檢查 OS temp parent 與專屬 prefix。

正常失敗 / 取消會清理暫存；若 OS 拒絕清理會記錄錯誤。突然斷電或 Main 強制終止不保證自動清掉 partial，沒有本輪範圍外的啟動清理服務。

## 18. Errors / security

處理 payload / target 驗證、音訊解碼失敗、FFmpeg 缺失 / spawn / 非零退出、stdin錯誤、capture 尺寸 / timeout、renderer crash、取消與檔案系統錯誤；finally 停止 process / renderer、恢復 Editor。OOM 引發 renderer termination 時使用相同失敗路徑，不能保證 OS 殺掉整個 App 後仍可恢復。

Audio decode、缺少 FFmpeg、FFmpeg 非零退出、renderer crash、取消已注入實測；disk full、permission denied、OOM 未做破壞性故障注入，不宣稱全部已實測。

IPC 僅允許主 Editor sender/mainFrame；Export payload 僅給指定 export WebContents。Renderer 不可任意讀 FS、spawn、執行 FFmpeg command 或指定測試 range。限制 snapshot 16 MiB、Audio 1 GiB、單張圖 100 MiB、assets合計1.2 GiB；音訊最長6小時是安全上限，並非長檔效能保證。

## 19. Packaged paths

Dev：`vendor/ffmpeg/ffmpeg.exe`；Packaged：`process.resourcesPath/ffmpeg/ffmpeg.exe`。extraResources 僅包含兩個 binary 與三份授權 / provenance 檔。app.asar 只含正式 app / electron / package / MIT / README；build audit 驗證未包含 dev、tests、reports、artifacts 或 node_modules。

## 20. Build size

| 項目 | Bytes | MiB |
|---|---:|---:|
| Phase 1 前 unpacked build | 386,878,654 | 368.96 |
| Phase 1 後 unpacked build | 597,635,473 | 569.95 |
| FFmpeg + ffprobe | 210,644,992 | 200.89 |

最終 `dist/win-unpacked/WaveCanvas.exe` 已重建，未簽章；必須保留整個 win-unpacked 目錄，不能只搬 exe。Packaged binary hash 與 vendor 一致。沒有 Installer 或 File Association。

## 21. ffprobe / test matrix

| 驗證 | 結果 | 證據（dev/tests/artifacts 下） |
|---|---|---|
| Node / 原回歸 + export unit | 95/95 | export-node-results.txt |
| Development Project integration | 51/51 | project-development-1791010680182/results.json |
| Packaged Project integration | 51/51 | project-packaged-1791011022606/results.json |
| Packaged Electron regression | 48/48 | electron-packaged/results.json |
| Export UI / deterministic / failure integration | 22/22 | export-development-1791011280225/results.json |
| Circle / Square / Linear + particles / motion | 6/6 | export-development-1791011686475/results.json |
| 真實 packaged loader / 短片煙霧測試 | 7/7 | export-packaged-1791010785973/results.json |
| 真實 packaged 完整影片3612 frames | 通過 | export-packaged-1791010785973/export-result.json + ffprobe.json |
| 最終 build 真實短片（300 frames） | 7/7 | export-packaged-1791012245985/results.json |
| Browser disabled / 無 Console error | 通過 | export-browser-results.json |
| 五分鐘 A/V clock | 通過 | export-long-clock/ffprobe.json |

所有驗證影片為 H.264 / 1920×1080 / 60 FPS / yuv420p / AAC；完整真實影片3612 frames。Native Save dialog 的呼叫 / filter / 取消 / 返回路徑經自動化測試，OS dialog 的實際點選介面尚未人工操作。

## 22. Visual / deterministic regression

真實影片 frame120 已目視確認道路 Background、貓 Cover、Circle Spectrum、Primary / Secondary Lyrics、Song Info 及 particles；輸出不含 Editor UI / FPS 診斷。

5秒相同 snapshot 在 Editor minimized 與 restored、1100×700 / zoom1.25 狀態各輸出一次。frame0/60/120 的 audioSample、Canvas PNG 與 Lyrics DOM 相同；selected compositor RGB 採 ≤1/255 且異色 channel <0.1% 的容差。最新測試選定幀完全相同，早期測試有極少量 Chromium 1階 rounding。兩支完整 decoded MP4 SSIM=0.996804；**不保證 MP4 bytes 或所有 compositor pixels 跨執行 / GPU / 電腦完全相同**。

原 Project Save/Open/Autosave/Collect、Preset、音訊播放、FFT/listener、幾何、封面、歌詞及 Timing Editor 回歸通過。未實際切換實體顯示器125%/150%DPI；固定DPR1 / canonical buffer / Editor zoom獨立已自動驗證。

## 23. Synthetic performance

5秒300 frames 的一輪 minimized-window 測試：analysis170.7ms、平均capture33.831ms、最慢455.350ms、總12.665秒、2,063,103bytes，約0.395× realtime。首幀暖機及當時系統負載會影響數字，不能作通用硬體baseline。

## 24. Real project performance

使用 packaged App 正常 loader 開啟 `C:\Users\user\Documents\雜項\Untitled\Untitled.waveproj`，再以該 snapshot 完整輸出。

| 指標 | 實測 |
|---|---:|
| 解碼 Audio duration | 60.186104 s |
| Total frames | 3612 |
| Average capture | 38.564 ms |
| Slowest capture | 165.896 ms |
| Audio analysis | 1.101 s |
| Rendering wall time | 164.207 s |
| Encoder 存活時間（與 render 重疊） | 165.531 s |
| 最後 encoder drain | 1.324 s |
| Total | 167.157 s |
| MP4 | 28,842,799 bytes / 27.507 MiB |
| 相對 realtime | 0.360× |
| Dropped frames / peak queue | 0 / 1 |
| Sampled peak Electron working set | 1,731,731,456 bytes / 1651.51 MiB |

Memory 為 Main+GPU+Renderer+utility working sets 加總，排除 FFmpeg child，非 JS heap 或整機峰值。Encoding 與 capture 同時執行，因此165.531秒**不是純 encoder CPU 耗時**。現有數據較支持下一階段先調查 renderer / capture 成本，但本輪未實作 Phase 2。

完整輸出：[real-full.mp4](../tests/artifacts/export-packaged-1791010785973/real-full.mp4)。[ffprobe](../tests/artifacts/export-packaged-1791010785973/ffprobe.json)、[metrics](../tests/artifacts/export-packaged-1791010785973/export-result.json)、[frame120](../tests/artifacts/export-packaged-1791010785973/frame-120.png)。

## 25. Lyrics / source references / real data protection

Loader 正常解析 Audio / Cover / Background，恢復 Primary / Secondary 文件及 serialized edited timing。匯出直接 restore Project 內的 documents，不重新讀 LRC/SRT 覆蓋 Timing Editor 修改；SRT end time 仍沿用現有 renderer 語意。

自動比較所有 serialized media reference 字串及兩份 edited lyric documents（含時間、IDs、來源cue、offset、raw text等），確認保留 `.waveproj` 目前值，沒有猜測修改前路徑。是否符合使用者手動修改意圖仍由使用者人工確認。

真實資料夾全檔案 SHA256 / size / mtime 在測試前後相同，未重寫、搬移或刪除。所有 MP4、擷取圖、log、probe 與測試 state 均在 dev/tests/artifacts，沒有寫入 Untitled。

## 26. Known limitations / scope stop

- 輸出速度目前約0.36×，大型 PCM、decode及 Chromium合成仍占記憶體；沒有 streaming decode。
- Semantic state 可重現，跨GPU/系統 font fallback / Chromium rounding與有損H.264不保證影片 byte-identical。
- 五分鐘完整 Stage / 實體高DPI / OS Save dialog人工操作 / disk-full / permission / OOM故障注入尚未完成。
- GPL corresponding-source 與再散布合規準備未完成；Build未簽章，不宣稱 release-safe。
- 一般取消 / error可清理，但 Main被強制終止或斷電後可能留下partial。
- 本輪停止於1080p60 CPU H.264，沒有hardware encoding、4K、custom settings、Range UI、Installer或File Association。

## 修改檔案與文件

新增：app/export.html、export-clock.js、export-audio-worker.js、export-stage.js、export-ui.js；electron/export-preload.cjs、export-render-window.cjs、ffmpeg-runner.cjs、export-controller.cjs；vendor/ffmpeg 五份 runtime/license/provenance 檔；dev/tests/export.test.cjs 與 export 測試工具 / artifacts / 本報告。

修改：app/index.html（輸出入口）、app/project-controller.js（忙碌時跳過autosave write）、electron/main.cjs / preload.cjs（controller / 窄IPC）、package.json（build resources / 測試指令）、README.md、build audit及測試 harness。templates.test.cjs 使用已存在manifest雜湊取代先前已移除的外部fixture檔案依賴；沒有改Template圖片。沒有新增npm套件或改lockfile。

README已更新用法、架構、測試與GPL提醒；此報告保存一次性驗證證據。沒有新增永久AGENTS規則。原 Visualizer main.js、FFT mapping、wallpaperAudioListener、Audio pipeline未修改。

技術參考：[Electron WebContents](https://www.electronjs.org/docs/latest/api/web-contents)、[Web Audio FFT windowing](https://www.w3.org/TR/webaudio/#fft-windowing-and-smoothing-over-time)。
