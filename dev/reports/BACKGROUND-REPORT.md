> 維護註記（2026-10-03）：generated videos／暫存輸出已清除；小型證據連結改到 archive，靜態 baseline fixtures 改到 dev/tests/fixtures/baselines。下文數值為當時 milestone 實測，不代表本輪重跑。

# Background Image 重整與驗證

本輪只修改背景圖片與必要的 schema、Preset 相容層和測試。FFT mapping、wallpaperAudioListener、Visualizer Geometry、Lyrics、Timing Editor、Shell／Project、Electron／Export 均未改動其功能。受保護程式以 SHA-256 比對，測試全數通過。

## 1. 移除項目

- `#bgimg1`／`#bgimg2` DOM、crossfade CSS 與交替圖片回呼。
- slideshow 狀態、切換計時、間隔倍率、隨機圖片取得與 bridge／本地圖片列表 API。既有一秒 timer 現在只維護 FPS。
- `backgroundsource` 的選項 3。舊訊息的 3 在統一 adapter 轉成圖片來源 2；影片選項 4 維持先前純色 fallback。
- schema 的 `customrandomdirectory`、`slideshowInterval`、`slideshowIntervalMultiplier`，以及新模式已不適用的 `imageoptions`。單張背景固定 cover；Overlay 的 `imageoptions1` 保留。
- 對應 UI、翻譯與舊 directory 選圖提示。上述舊鍵只留在 compatibility 忽略清單與遷移測試，不含執行功能。

schema 現在為 **98 項：86 runtime keys + 12 metadata**，有效原 property 控制項為 **54**。不是新增另一套原 WE 設定表。

## 2. 新資料結構與資料流

Preset v1 中的 `standalone.background`：

```json
{
  "enabled": true,
  "mode": "infinity",
  "baseScale": 1.08,
  "driftAmount": 18,
  "driftSpeed": 1,
  "bassScaleAmount": 0.035,
  "bassAttack": 140,
  "bassRelease": 850,
  "offsetX": 0,
  "offsetY": 0,
  "opacity": 1,
  "blur": 0,
  "backingColor": "#000000"
}
```

File → Object URL → 共用 image-cache 載入／解碼 → 原 `backgroundimage` property → 同一 `#bgimg`。

UI／Preset → `VisualizerRuntime.updateStandalone()` → schema 驗證與統一 state → UI subscription + background-stage → 圖片 style／transform。

圖片成功載入才替換，選取背景會自動切為圖片來源並啟用圖片。壞檔、取消、競態與舊 URL 回收沿用既有 helper。Preset 不保存 Object URL、圖片檔案或路徑。

## 3. Infinity Drift

使用 Gerono lemniscate：`x = A sin(θ)`、`y = 0.45 A sin(2θ)`。相位按 RAF 的實際 dt 推進，以 2π 循環；預設 A=18 canonical px，每圈 60 秒。速度範圍 0.25–2×（每圈 240–30 秒），幅度 0–60 px。首尾位置與導數相同，沒有旋轉、bass 或隨機位移。

保留 offsetX／Y（canonical px），只在 Infinity 顯示與生效；調整漂移速度不重設相位。Home／隱藏分頁停止 RAF，返回時延續相位，不補算背景停留時間。

## 4. Bass Pulse

固定 `translate3d(0,0,0)`，忽略已保存的 Infinity offsets。只讀取既有處理完成的 `audioSample[0..4]`，正值加總後限制在 0–1；不改原 listener、FFT、增益、頻帶或音訊圖。

重用 `VisualizerLyricsRuntime.envelope` 的數學 helper，背景只持有自己的 scalar envelope，沒有操作任何 Lyrics state 或 renderer。放大與回復分別採用 140／850 ms 的指數平滑；scale = 安全基礎縮放 × (1 + envelope × 0.035)。預設最大額外縮放 3.5%，可調 0–10%。Pause／End 回復至基礎縮放，回復完停止背景 RAF，Play 再啟動。

## 5. UI

Background 保留原圖片來源、單張選檔與純色選項，加入啟用、動作模式、opacity、blur、底色、基礎縮放。兩種模式依 schema 的 `mode` metadata 顯示各自控制項。Bass 隱藏 drift／offset；Infinity 隱藏 bass amount／attack／release。停用圖片仍保留 source 與底色。

13 個新／保留的 Standalone 背景欄位由 `background-schema.js` 生成，不手工維護第二份控制項定義。bool、combo、slider、color 都走統一更新入口並反向同步。

## 6. Preset 相容

- 原 JSON `format`、`version: 1` 不變。
- 缺欄位使用 defaults，未知欄位忽略，有限數值 clamp；非法型別、NaN／Infinity 原子拒絕。
- 舊 `backgroundsource: 3`／`{value:3}` 安全轉成 2，並回報 migration warning。
- 舊 `mode: slideshow` 轉成 infinity；舊目錄／間隔／圖片尺寸 keys 安全忽略，不進入 runtime 或新匯出。
- 舊 preset 無法恢復圖片，仍需重新選圖，與既有不保存媒體資源的規則一致。
- Reset 恢復背景 defaults 並依既有規則清除圖片來源。

## 7. 效能

只在有效圖片、Editor／可見分頁時運行背景 RAF；每幀更新同一圖層的 transform，不解碼、不重建 DOM、不讀 layout。漂移 point object 重用；blur／opacity／背景底色等只在設定變更時更新。安全縮放按設定更新計算，包含漂移幅度、offset 與三倍 blur 半徑。

測試 Chromium 154、DPR 約 1.2、fixture viewport 960×640，主 Canvas 1920×1080，顯示 Stage 約 456×257。使用合成音訊、4096×4096 背景、Cover、雙語歌詞與粒子。每場景測量 8 秒：

| 場景 | 重整前平均 FPS | 重整後平均 FPS | 前／後 >25ms 幀 |
|---|---:|---:|---:|
| A Idle | 60.0003 | 60.0008 | 0／0 |
| B Basic | 60.0000 | 60.0010 | 0／0 |
| C Lyrics | 59.9987 | 59.9987 | 0／0 |
| D Full | 59.9993 | 60.0018 | 0／0 |
| E Full + Timing | 60.0010 | 60.0018 | 0／0 |

獨立 Full 背景模式測量：Infinity 60.0003 FPS、背景 JS 平均 0.0256 ms/frame；Bass Pulse 60.0025 FPS、0.0233 ms/frame；兩者 >25 ms 幀皆為 0、無 page error。JS 耗時不包括 compositor／GPU 全部成本。初次 A–E 的 profiler 將新增背景 callback 歸入 Song Info；新增專用 `background.frame` label 後的模式測量已分開記錄。

## 8. 測試

- Node **42/42**，Chromium **375/375**。
- **50** 個 JS／CJS syntax 檢查通過；schema 與 project.json **98** 項同步。
- Infinity：10,001 個相位採樣、位移界限、首尾位置／導數、blur／offset 邊緣覆蓋。
- Bass：只讀低頻、異常 sample 保護、輸入限幅、單調 attack／release、固定中心、Pause 回復。
- 圖片：PNG／JPEG／WEBP、非方形、單次 decode、取消、壞檔、快速換圖、URL 回收。
- UI：兩種模式切換／專用欄位、enabled、runtime state、opacity／blur／底色；既有 Overlay 回歸。
- Preset：新模式往返、舊 slideshow、缺欄位、未知鍵、clamp、非法設定／JSON；原子拒絕。
- 既有 FFT 校準、增益、Pause／Seek、Cover、Geometry、Lyrics 與 Timing regression 通過。
- 保護 hash：audio-adapter.js、wallpaperAudioListener、visualizer-geometry.js、lyrics-runtime.js、lyrics-stage.js、timing-editor.js、timing-model.js、wavecanvas-shell.js 均與本輪開始時一致。

證據：`dev/reports/archive/milestone-evidence/background-results.txt`、`background-before.json`、`background-after.json`、`background-modes.json`、`background-ui.png`。

## 9. 已知限制與修改檔案

- 不宣稱 GPU／全螢幕／低階裝置全都達 60 FPS；真實 Wallpaper Engine 未執行，已通過模擬宿主。
- Infinity 完整 60 秒循環以數學採樣與接縫測試驗證；本輪未做 60 秒人工觀看。
- 安全縮放可能高於 baseScale，極大 offset／blur 會增加裁切，避免露出黑邊。
- 切換模式立即套用新模式，不增加額外跨模式 crossfade；循環與 bass 回復自身平滑。
- 原有透明圖片、瀏覽器解碼限制及大圖 GPU 記憶體成本仍存在。

新增：`background-motion.js`、`background-stage.js`、背景 Node／Browser 測試、本報告與測試證據。

修改：`background-schema.js`、`background-ui.js`、`main.js`（僅背景與 slideshow 清理）、`index.html`、`local-files.js`、`runtime-adapter.js`、`property-compatibility.js`、`project.json`、生成的 `property-schema.js`、`presets.js`、`settings-ui.js`、`ui-zh-tw.js`、`performance-profile.js`（僅新增背景 label）、`README.md`，以及對應回歸測試／效能頁與歷史 Timing baseline HTML 的背景部分。沒有新增套件；不需更新 AGENTS.md。

## Infinity Drift 速度調整

使用者確認原動畫有運行，但速度太慢，因此只把 1× 的循環從 180 秒縮短為 60 秒（3 倍速度），保留 18 px 幅度與原軌跡。driftSpeed 數值與 Preset v1 格式不變；已存 Preset 相同速度倍率會使用新的 60 秒基準。新增 renderer lifecycle regression，覆蓋 paused、Bass → Infinity、disable → enable、Home → Editor 與分頁隱藏／恢復。原內嵌舊工作頁保留未重載；不改 FFT 或其他核心功能。
