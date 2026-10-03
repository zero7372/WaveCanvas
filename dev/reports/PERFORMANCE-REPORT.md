> 維護註記（2026-10-03）：generated videos／暫存輸出已清除；小型證據連結改到 archive，靜態 baseline fixtures 改到 dev/tests/fixtures/baselines。下文數值為當時 milestone 實測，不代表本輪重跑。

# Performance Profiling & Optimization

日期：2026-10-02。此輪只修改 Timing 外層重畫與版面事件處理，建立開發量測／測試工具；不重寫 renderer、Audio pipeline、Lyrics，也不變更 Preset 格式。

## 1. 方法與範圍

- `/?profile=1`：RAF callback 耗時、cadence、long frame、audio／timing／layout／Stage 狀態、bounded counters、Object URL 與 listener registration diagnostics。Overlay 建立一次，每 500 ms 更新文字。
- `WaveCanvasPerf.reset()`／`snapshot()`：可重現的量測區間。Current FPS 是最近間隔；Avg 是 frame 數／RAF 時間；Min 是最慢單幀倒數。long frame 門檻 >25 ms，允許 60 Hz clock jitter；dropped estimate 以 60 Hz 推算，並非 compositor 的實際 dropped frame 計數。
- Frame ms 是 RAF 間隔；JS callback cost 是同步耗時。兩者均不能代表完整 GPU frame time。巢狀 measure 是 inclusive，不可直接相加。
- `profileDetail=1` 額外包裝 Canvas methods。這會增加成本，不能與沒有 detail 的 FPS 當作完全相同條件比較。一般模式不修改原生 API、不產生 profiler overlay。
- Chromium CPU sampling 與約 22.30 秒 `devtools.timeline` trace；raw trace／CPU profiles 保存在 `tests/artifacts/`。GPU raster/composite 的完整耗時未取得，硬體加速狀態 **UNKNOWN**。
- A–E：相同 90 秒合成 WAV（8 kHz mono、60／1000 Hz）、512 PNG Cover、4096 PNG background、45 句雙語 LRC；先暖機 1 秒、每情境 8 秒。
- Chromium 154.0.0.0、Windows、native DPR 約 1.2。測試 iframe 960×640，主 Canvas 固定 **1920×1080**。Stage 為等比例縮小顯示；此為 **Synthetic / controlled browser benchmark**，不是實體 1920×1080 GPU 驗收。

## 2. Benchmark scenarios

| 情境 | Avg FPS Before／After | Min FPS Before／After | Frame ms Before／After | Long frames Before／After |
|---|---:|---:|---:|---:|
| A Idle | 60.00／60.00 | 58.14／58.48 | 16.667／16.667 | 0／0 |
| B Basic | 60.00／60.00 | 58.14／58.48 | 16.667／16.667 | 0／0 |
| C Lyrics | 60.00／60.00 | 58.48／58.48 | 16.666／16.666 | 0／0 |
| D Full | 60.00／60.00 | 58.14／58.48 | 16.666／16.666 | 0／0 |
| E Full + Timing | 60.00／60.00 | 58.48／58.48 | 16.667／16.667 | 0／0 |

FPS 已接近 refresh ceiling，細小差異是 clock／排程噪音，**不宣稱提升播放 FPS**。Before fixture 保存相同現有模組與 profiling hooks，僅回退這輪的 Timing 重畫／resize／backing-store 優化；`/dev/tests/performance.html?baseline=1` 可重跑。每次需保持頁面前景、Stage 可見，避免其他測試同時執行。

## 3. 證據與實際優化

| 項目 | Before | After | 原因／維持行為 |
|---|---|---|---|
| Waveform layout reads | 200 次 zoom，`scrollLeft` 708,600 次讀取 | 400 次讀取（每次 zoom anchor＋一次 draw） | 每次 draw 先讀取 viewport，像素迴圈重用；同一張 waveform 使用相同捲動座標 |
| Zoom 重複 draw | 200 次 zoom，400 次 draw | 200 次 draw | `layout(false)`，完成 anchor scroll 後再畫最終 viewport；不改 zoom／scroll／seek mapping |
| 密集 resize／view events | 100 次事件，100 次 layout，約 174.50 ms | 1 次 layout，約 1.00 ms | 合併至下一個 RAF；不重新 decode／build waveform，非 persisted pagehide 取消待執行 resize |
| Fractional DPR backing store | DPR 1.2000000477，200 次 redraw 造成 400 次 width／height 寫入 | 同尺寸重畫不再寫入 backing dimensions | 比較整數 backing height；保留 Canvas 原本 native truncation，實際高度與畫面一致 |

前三項對照：初次分階段對照的平均 waveform draw 約 **1.8245→0.1615 ms**，400→200 次、累計 **729.80→32.30 ms**。fractional DPR 額外問題是在後續尺寸寫入計數中確認：400→0 次。此項只比較 backing-store 配置次數，不宣稱單次 draw 延遲必然改善；各階段原始 JSON 分別保留，避免把不同測試混成同一數字。

沒有發現需要改 FFT、Lyrics、Canvas renderer 或 CSS effects 的播放瓶頸，因此未合併 loops、cache 圓形 trig、重寫 geometry、刪除 blur／glow、縮小主 Canvas 或增加 Preview Quality。

## 4. Render loops／Audio

- Visualizer、local audio、Lyrics、Song Info 各 1 個獨立 RAF；Timing 只在 Editor 可見、Timing 展開且播放時維持 1 個 RAF。resize 使用短期單次 RAF。沒有累積同名 pending callbacks。
- Local audio loop 約 60 Hz 判斷，真正 analyser／mapper／listener 約 **30 Hz**；只有 1 個 live media-element source／AudioContext graph。Waveform 使用 OfflineAudioContext decode，未建立第二套 AnalyserNode。
- 一般 A–E visualizer JS callback 約 0.18–0.28 ms。Lyrics 約 0.04–0.06 ms；Song Info 約 0.01–0.03 ms。Timing frame 約 0.28 ms；follow 中的 layout read 佔主要部分，但未造成測得的 missed deadline，先保留。
- Analyser 約 0.24–0.29 ms／次、mapping 約 0.08–0.10 ms／次、gain＋原 listener 約數微秒。這些小於 frame budget，未優化。
- `Date.now()` 主要為 Follow 的每幀一次手動介入判定；沒有大量重複 clock reads。新增 profiler 的 `performance.now()` 只在開發 query 啟用。

## 5. Canvas／Geometry

四種排列均另行跑 detail 診斷：Circle、Square＋rotation／bass、Linear horizontal、Linear vertical，含 dual mirror。Circle 視覺核心未修改。Square／Linear 共用同一 audioSample；geometry build 每幀產生有限 bar objects，但 5,000 次 64-bar build 約 10.4 ms，平均約 0.0021 ms，不需要加入新的 static cache。

Detail 下 visualizer 約 0.56–0.66 ms／幀，含 method instrumentation；Square／Linear draw 約 0.18–0.22 ms。clearRect 約 0.01–0.02 ms／次。粒子成本可透過 `Particle.draw`／`ParticlesStyle2.draw` measure 與 CPU profile 檢查。未觀察到每幀 gradient 建立；旋轉／bass 在原路徑運作。

## 6. Lyrics／DOM

- Active cue 原本就是 binary search，沒有改查找方式。Primary／Secondary 共用 pooled lyric item，語意與慣性 transition 完全沿用。
- Pool 大小固定；offsetHeight 只在 transition 時讀取，沒有每幀測量整份 LRC 或重建 lyric blocks。
- Glow 有 bounded attack／release，仍更新原有 CSS variables。此輪沒有改色彩／亮度／blur 或動畫。
- Timing markers 使用 binary lookup、只在 active ID 改變時修改標記；播放期間沒有 LRC parse、waveform build、block rebuild。

## 7. CSS paint／blur

約 22.30 秒 Full＋Timing trace：Paint 2,710 次、累計約 679.91 ms、單次最大 1.11 ms；Layout 1,504 次、累計 204.49 ms、單次最大 0.77 ms；UpdateLayoutTree 最大 0.61 ms。這些是 trace 中 renderer tasks，可能包含 overlay／測試容器，不是 GPU blur shader 或全部 composite 成本。

Follow 的 head style write 後讀 scrollLeft 仍會觸發 layout；此條路徑成本小，A–E 不掉幀，未做額外行為修改。沒有以刪效果取得效能。GPU/software rendering 仍需用實機 `chrome://gpu` 與 DevTools trace 查證。

## 8. Cover／Background

- 512 Cover 與 4096 background 實際載入。程式層以 Image cache／Object URL 版本防競態，replace／clear 正確 revoke。
- 四種 geometry 的穩態沒有新的 Object URL 或 `HTMLImageElement.decode()` 呼叫；沒有每幀 new Image／clone image。
- Decode measure 計數是 app 的 decode request／同步呼叫成本，不代表 browser CSS image decoder／GPU upload 的完整延遲。
- 此環境沒有大圖造成的穩態瓶頸證據，所以未加入 downsample cache，也未丟棄原始素材。

## 9. Waveform／Timing

| Synthetic PCM | Sample rate／channels | 建立時間（一次測量） | Peak cache | PCM temporary input |
|---|---|---:|---:|---:|
| 3 分鐘 | 8 kHz／mono | 18.8 ms | 180,032 bytes | 5,760,000 bytes |
| 10 分鐘 | 8 kHz／mono | 76.7 ms | 600,048 bytes | 19,200,000 bytes |
| 60 分鐘 | 8 kHz／mono | 418.1 ms | 3,600,032 bytes | 115,200,000 bytes |

這是 PCM build algorithm／多層 peaks cache 測試，**不含壓縮檔 decode，也不是 44.1／48 kHz stereo 60 分鐘實檔結果**。產品原本的 chunk yield／cancel guard／版本檢查保留。Zoom／scroll／resize 重用 peaks，只 redraw viewport；播放無 follow scroll 時不重畫 waveform。Follow 真正改變 viewport 才觸發 scroll redraw。

## 10. Memory／lifecycle

120 秒 Full＋Timing soak 每 10 秒取樣：DOM 固定 1,429、media URLs 固定 3、1 個 live audio graph、waveform levels 固定 16、每個 render loop 最多 1 個 pending RAF；JS heap 約 8.8–11.3 MiB 起伏。90 秒 fixture 播放結束後重新 seek／play，沒有重新載入媒體。

另做 30 次 Audio／Cover／LRC Load→Replace→Clear，含 Timing 開關、tabs、Home↔Editor、Preset import。清除後 URL = 0、DOM 固定 1,159、waveform cache = 0、audio listener registrations 不增加。沒有直接證據指出 app lifecycle leak。

Rapid replace 的 decode／GC temporary allocation 會使 heap 明顯上升；單輪 final 約 59.8 MiB，過程 25–71 MiB 起伏，**不能以此宣稱所有 retained memory 已釋放**。此工具不支援所嘗試的 HeapProfiler command，未完成強制 GC／retaining-path／detached DOM heap snapshot 驗證。不能從 JS heap 數值完整判定 GPU texture／native AudioBuffer memory。30 分鐘實機結果仍待填寫。

Profiler 的 listener registry 使用 WeakMap target keys；數值是 registration diagnostics，未追蹤 native once／AbortSignal 的自動移除，不能當作完整 active listener inventory。

## 11. Resize／DPR

Mock DPR 1／1.25／1.5／2 × 1366×768、480×640、960×640：Stage 等比例、contained、主 Canvas 1920×1080。既有回歸另涵蓋左右面板／Timing 開關、1920×1080／矮視窗與播放中 resize。

Mock DPR 只驗證 JS/backing store 邏輯，不等同 Windows 真正縮放與 GPU raster。Waveform 的 DPR 最大 2；主 Canvas 不乘 DPR。新 resize scheduler 合併同一 frame 的密集事件，正常 UI 最多延後一個 RAF。

## 12. Regression／自動測試

- Node：36／36；既有 33 項＋3 項 profiler 啟用／停用、RAF／URL／listener diagnostics、snapshot isolation。
- Chromium：完整 regression，新增一般模式 profiler 隔離、resize 合併、zoom scroll reads、fractional DPR backing reuse、播放不重建 timing DOM、cache reuse、Pause idle、動畫／pagehide cleanup。
- Chromium 結果：**352／352**，無 page errors／unhandled promises。新增 Pause 檢查等待原生 `pause` event 完成，避免把尚未送達的最後播放位置更新誤判為 idle 移動。
- Performance Lab：三種長度 peaks build、四種 geometry、大圖、A–E、30 media cycles、Mock DPR、120 秒 soak 檢查。
- 47 個 JS／CJS syntax 與 102 項 project schema 同步；原 44.1／48 kHz FFT 校準仍通過。
- FFT mapper SHA-256：`88BBCE2D97C18B8E8B2B0670860C362DEF8FD6BCD70D26AB9C38C5A57E78BFE4`。
- wallpaperAudioListener SHA-256：`53A04626F0AD059A88C264CE7E73E1E34CEC30BDF6F5BA3B2B174D297FC6C663`。

## 13. 修改檔案

- `performance-profile.js`：query-only instrumentation／overlay／console helpers。
- `index.html`：載入開發工具與 export instrumentation hooks。
- `timing-editor.js`：上述四項低風險優化、query-only scope measures、pending resize cleanup。
- `dev/tests/performance.html`、`performance-browser.js`、`performance-regression.js`、`performance.test.cjs`：可重現 benchmark／lifecycle／regression。
- `dev/tests/browser.html`／`browser.js`：加入新回歸。
- `dev/tests/fixtures/baselines/index-before.html`／`timing-editor-before.js`：Before fixture；其他 `performance-*` artifacts 為 JSON／trace／測試結果。
- `README.md`、本報告、`PERFORMANCE-HARDWARE-CHECKLIST.md`：操作方式、證據與實測表。

沒有新增 dependency。`main.js`、`audio-adapter.js`、Lyrics 語意／renderer、Preset schema 未改。

## 14. Manual checklist

見 [PERFORMANCE-HARDWARE-CHECKLIST.md](PERFORMANCE-HARDWARE-CHECKLIST.md)，分別在 Intel iGPU 公司筆電與 RTX 3080 Ti 桌機填寫 browser version、display／viewport、DPR、hardware acceleration、A–E Avg／Min、肉眼卡頓、Start／30 min memory。此輪未代填未實測的硬體數據。

## 15. Known limitations／停止範圍

8 秒基準無法保證長期 frame pacing；真實 GPU、全尺寸 CSS Stage、大量粒子、不同 codec、數小時高取樣率音訊與不同電源模式仍需實機測量。沒有啟用 Reduced Preview Quality，因為沒有低階硬體證據。pagehide cleanup 測試包含 synthetic event，不能完全代替 browser navigation／BFCache lifecycle。

`dev/reports/archive/milestone-evidence/performance-preview.jpg` 為 geometry 壓力測試後的開發介面截圖，overlay 的歷史 Min 包含刻意連續執行 5,000 次 build 的 CPU 任務；A–E 播放數據以各自 reset 後的 JSON／上表為準。

本輪完成後停止。沒有開始 Electron、Project Save／Load、Video Export、Options／Preferences、Profile account、i18n、Frameless Window 或其他產品功能。沒有新增長期 AGENTS 規則。
