# WaveCanvas 實機效能檢查

每台電腦填一份。Intel iGPU 公司筆電與 RTX 3080 Ti 桌機尚未在本輪代為實測。Synthetic / CI 結果不能替代此表。

## 環境

| 項目 | 紀錄 |
|---|---|
| 日期／機器 | |
| CPU／GPU | |
| 作業系統 | |
| Browser／完整 Chromium version | |
| 螢幕解析度／browser viewport | |
| Windows 顯示縮放／DPR | |
| Stage 顯示尺寸（overlay） | |
| 硬體加速設定 | |
| chrome://gpu：Canvas／Compositing／Rasterization 狀態 | |
| Software rendering／GPU disabled／遠端桌面 | |
| 電源模式／接電／背景程式 | |

## 可重現測試

1. `node dev/tools/serve.cjs`，開啟 `http://127.0.0.1:8765/dev/tests/performance.html`。
2. 設定每個情境 60 秒，點 Run A–E benchmark。保持頁面前景、Stage 可見、不開 DevTools／不縮小視窗。結果 JSON 可選取複製。
3. 測试頁使用固定 1920×1080 Canvas，但 iframe viewport 為 960×640，Stage 顯示尺寸較小。另開產品 `/?profile=1`，使用自己的素材與實際工作 viewport 再跑一次；不可把縮小 Stage 的數據當作實體 1920×1080 display certification。
4. 產品 console：`WaveCanvasPerf.reset()` 開始；60 秒後 `WaveCanvasPerf.snapshot()`。Current FPS 是最近 frame；Min FPS 是最慢單一 frame 的倒數。long frame = RAF 間隔 >25 ms；不是所有超過 16.67 ms 的 clock jitter。
5. 清楚記錄素材：音訊長度／格式、圖片尺寸、LRC 句數、Settings／Preset。每台機器使用同一份素材與設定。

| 情境 | Avg FPS | Min FPS | Avg frame ms | Long frames | 肉眼卡頓／操作延遲 |
|---|---:|---:|---:|---:|---|
| A Idle：Stage、無播放 | | | | | |
| B Basic：Audio、Circle、Cover | | | | | |
| C Lyrics：雙語、Glow | | | | | |
| D Full：4096 圖片背景＋blur、Cover、雙語、Song Info bass、粒子 | | | | | |
| E Full＋Timing：waveform、playhead、follow | | | | | |
| Square＋旋轉＋bass | | | | | |
| Linear horizontal／vertical | | | | | |

## 30 分鐘 memory / lifecycle

使用 Full＋Timing 播放較長音訊；若重播需記錄 seek。每 5 分鐘執行 Audio／Cover／LRC Load→Replace→Clear，再重新載入；開關 Timing、切 Settings tabs、Home↔Editor、匯入相同 Preset。記錄 browser Task Manager 的整體 memory 與 console heap（若提供），兩者不要混用。

| 時間 | JS heap MB | Browser process memory MB | Active Object URLs | Timing cache／DOM／RAF 異常 | 卡頓 |
|---|---:|---:|---:|---|---|
| Start | | | | | |
| 5 min | | | | | |
| 10 min | | | | | |
| 15 min | | | | | |
| 20 min | | | | | |
| 25 min | | | | | |
| 30 min | | | | | |

`snapshot().activeURLs` 包含仍使用的音訊、圖片、下載 URL；不必永遠為零。全部清除、Reset 且不保留下載時應歸零。多次 GC 後比較 retained heap；僅憑一次上升不能判定 leak。DevTools heap snapshot 可檢查 detached DOM、AudioBuffer retained path；操作前記錄 DevTools 本身的干擾。

## 操作／DPR

- [ ] 左右面板、Timing 開關與 browser resize 保持 16:9，Stage 不越界。
- [ ] DPR 1／1.25／1.5／2：主 Canvas 仍為 1920×1080。
- [ ] 持續 Ctrl＋Wheel zoom／Alt＋Wheel scroll 與 Follow，無明顯卡頓。
- [ ] Seek、Pause、Undo／Redo、LRC Export、Preset、四種 geometry 正常。
- [ ] Cover／4096 背景、glow／blur 視覺與效果一致。
- [ ] 無 console error；重複操作不增加同名 RAF／audio graph。

不在此輪新增 Preview Quality。若實機 D／E 持續掉幀，附上結果與 Performance trace 再決定後續改善。
