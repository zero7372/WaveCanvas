# WaveCanvas — Standalone Audio Visualizer

保留原 Wallpaper Engine Canvas 2D 視覺核心，提供本地音訊、Cover、依 schema 生成的有效設定面板與 Song Info、固定 16:9 預覽、Square / Linear geometry、LRC／SRT 匯入與雙語歌詞及 JSON Preset。現支援 Browser standalone 與 Windows Electron Development Build，現支援 Electron-only 1080p60 MP4 影片輸出。Phase B/C 的 FFT mapping 與 wallpaperAudioListener 維持人工驗收版本，測試會比對兩者 SHA-256。

## 啟動

Repository 現分為 `app/`（正式 browser runtime）與 `dev/`（測試、工具、報告）。本文件單獨提到的 runtime JS／CSS 檔名均相對於 `app/`；測試與工具指令從 repository root 執行。

```text
app/                  index.html、JS、CSS、project.json、assets/templates/
dev/tests/            Node／browser tests、fixtures 與 artifacts/
dev/tools/            loopback server、schema／Factory 產生器
dev/fixtures/         factory-defaults/ 原始 JSON 快照
dev/reports/          歷史報告與 hardware checklist
dev/notes/            分類前後逐檔路徑與 SHA-256 清單
electron/            Windows Main Process 與極薄 Preload
package.json          開發、測試與 unpacked build 指令
README.md
License.txt
```

分類與保留驗證見 [Repository Classification Report](dev/reports/REPOSITORY-CLASSIFICATION-REPORT.md)。原有產物皆保留；Electron／electron-builder 為 devDependencies，Renderer 沒有新增 runtime dependency。

設計上可以直接開啟 `app/index.html`；全部 schema 以普通 `<script>` 載入，沒有 `fetch(project.json)` 或 ES module 的本地檔案限制。

本次已實際驗證本地 HTTP 啟動：

```powershell
node dev/tools/serve.cjs
```

開啟 http://127.0.0.1:8765/ ，會導向 `/app/index.html`。Server 只綁定 loopback，只提供專案目錄。音訊選擇與解碼都在本機完成，沒有上傳。從 Home 選擇 New Project，進入 Editor 後在左側 Media 選取 WAV、MP3、FLAC 或其他瀏覽器支援的格式；使用底部 Transport 播放、暫停、Seek、回到起點與調整播放音量。載入不會自動播放。

## Windows Electron 開發與 Development Build

測試環境：Windows x64、Node 24.18.0／npm 11.16.0；Electron 套件要求 Node >=22.12。從 repository root 執行：

```powershell
npm ci
npm run electron:dev    # 原生視窗 + 自動開 DevTools
npm run electron:start  # 不自動開 DevTools
npm run electron:build  # Windows x64 unpacked，附內容 allowlist 檢查
```

第一次啟動／build 會下載 Electron binary，快取在 repository 內；build 使用同一份 binary。Development Build 位於 `dist/win-unpacked/WaveCanvas.exe`，直接啟動，不需要 localhost server。**整個 win-unpacked 目錄都必須保留，不能只搬走 exe。**目前版本 0.1.0，未簽章、沒有 installer／auto update。

Main／Preload 位於 electron/；Renderer 載入 app/index.html。使用原生 title bar、contextIsolation、sandbox，禁用 Renderer Node integration。Project v1 透過窄 IPC 處理專案檔案；媒體匯入、Web Audio、Preset／LRC 匯出仍使用原 HTML File inputs 與 Blob downloads。

```powershell
npm test
npm run electron:test
npm run electron:test:build
```

Electron smoke 僅在本機測試程序啟用 Main inspector，測試結束會退出；正常 dev／start／build 不開 inspector port。測試資料、下載與畫面全部留 dev/，不打包。完整結果與限制見 [Electron Phase 1 Report](dev/reports/ELECTRON-PHASE1-REPORT.md)。


## Video Export Phase 1

Desktop App 載入音訊後，使用工具列「輸出影片…」或 File →「輸出影片…」，選擇 MP4 路徑。Untitled 與未儲存修改可直接輸出，不要求先 Save。輸出固定 H.264 / 1920×1080 / 60 FPS / yuv420p，原音訊由 FFmpeg 轉 AAC 320 kbps。開始後暫停 Preview 並鎖定編輯控制；可取消，結束後恢復播放位置與播放狀態。Browser 此操作停用。

Main 使用獨立 sandboxed offscreen renderer，共用 Stage 的 Canvas、DOM Lyrics、Song Info、背景、Cover、particles 與 CSS。內容以固定 frame clock 推進；離線音訊使用原 FFT mapper 與原 listener。捕捉完整 Chromium paint，逐幀以 BGRA pipe 送 FFmpeg，等待 backpressure；先寫同目錄 partial，成功才替換目的檔。失敗／取消保留既有目的檔。

FFmpeg development 路徑為 vendor/ffmpeg/ffmpeg.exe；packaged 路徑為 resources/ffmpeg/ffmpeg.exe。隨附 Gyan 9.0.2 essentials GPLv3 build，保留 LICENSE、README.txt 與 BUILD.json。包含 libx264 及其他 GPL options。此為 Development Build，尚未完成公開再散布所需的完整 corresponding-source 合規準備，不能据此宣稱 release-safe。

測試：npm run export:test（UI、合成影片、取消與錯誤），npm run export:test:real（唯讀真實專案完整歌曲），npm run export:test:build（packaged 真實專案短片）。所有輸出存放 dev/tests/artifacts。5 分鐘音畫時鐘測試與完整結果見 [Video Export Phase 1 Report](dev/reports/VIDEO-EXPORT-PHASE1-REPORT.md)。

## WaveCanvas 工作介面

### Home GPU benchmark（internal diagnostics）

環境 audit 與 baseline regression 通過後，從 repository root 順序執行：

```powershell
node dev/tools/home-gpu-benchmark.cjs
node dev/tools/home-gpu-benchmark.cjs --nvenc
node dev/tools/summarize-home-benchmark.cjs
node dev/tools/compare-home-benchmark.cjs
```

使用相鄰 `../Untitled/Untitled.waveproj` 的正常 Project loader，全程檢查來源 hash/size/mtime。所有結果存入 `dev/tests/artifacts/home-benchmark-*`。NVENC 僅在測試 Main inspector 程序中暫時替換 FFmpeg arguments；正式 UI 與 libx264 medium CRF18 預設不變。Native clock 計時包含兩次 paint 的 crop/copy，沒有更動 deterministic timeline 或 paint barrier。

本機環境與完整 A/B 結果見 [Home environment audit](dev/reports/HOME-DEV-ENVIRONMENT-AUDIT.md) 及 [Home GPU benchmark](dev/reports/VIDEO-EXPORT-HOME-GPU-BENCHMARK.md)。

### Video Export Phase 2A capture

正式 capture 在推進虛擬時間前訂閱 offscreen paint，以 Stage 外的一列 frame identity／反碼確認收到當前 compositor 幀；只把原本的 1920×1080 Stage 像素送 FFmpeg，metadata row 不進影片。保留 WAAPI ready/currentTime 同步；移除雙 native RAF 與固定兩次 invalidate/readback。Native repaint rate 為 240，內容時間與輸出仍為 frameIndex/60、60 FPS。

`toBitmap()` 的獨立像素副本直接取 Stage Buffer view，省去額外 `Buffer.from()`；Windows surface width 多出邊界時使用有界 row buffer 裁邊，不縮放。Capture/write 維持逐幀 await、queue depth 1；收到舊 paint 會拒絕，10 秒逾時或 Renderer 停止則終止輸出，不拿舊幀補位。Preview、Project、FFT/listener、正式 libx264 medium CRF18 均維持。

診斷工具：`node dev/tools/capture-benchmark.cjs --mode=production --full`；實驗 modes 僅存在 dev/tools。Browser regression：`node dev/tools/browser-smoke.cjs`。結果、原流程 stale-paint 調查及限制見 [Phase 2A capture report](dev/reports/VIDEO-EXPORT-PHASE2A-CAPTURE-OPTIMIZATION.md)。

### Desktop Project v1

Electron 支援可讀 JSON `.waveproj` 專案：File → 開啟專案（Ctrl+O）、儲存（Ctrl+S）、另存新檔（Ctrl+Shift+S）、收集專案。Browser 中這些操作會停用；原 Preset 與 LRC 匯出保持可用。

專案保存完整 runtime settings、Circle／Square／Linear 個別狀態、Background、Song Info、雙語 edited lyric documents／timing／stable IDs，以及本地媒體路徑。原始 SRT／LRC 不會被 Save、Autosave 或 Collect 改寫。播放位置、Undo history、Object URL、視窗位置不保存。

已存檔且 dirty 的專案每 5 分鐘檢查一次；內容相同就不寫檔。Autosave 成功視為正式保存；先在 Electron userData 的 `Backups/<projectId>/` 保存舊版，每個 projectId 保留最近 10 份。Backup 的相對媒體參照會轉成原來源絕對路徑，方便手動開啟。Untitled 不會偷偷建立 recovery／temp project。關閉、Open／New 前若有變更，會詢問儲存／不儲存／取消。

收集專案只複製素材，建立 `<專案名稱>/<專案名稱>.waveproj` 與 `media/audio/`、`artwork/`、`background/`、`lyrics/`。新專案使用 relative paths，可整包搬移；缺檔中止收集，重名加安全序號，目的資料夾已存在則建立新名稱。完成後可選切換或繼續原專案。Save As／Collect 保留 projectId。Recent Projects 保存於 userData，最多 10 筆；缺失項目只在使用者按移除時刪除記錄。

```powershell
npm run project:test        # 開發 Electron 專案完整流程
npm run project:test:build  # 真正打包 exe 的專案流程
```

測試使用獨立 userData 與受控 native dialog 回傳值，不代表 Windows 對話框已逐一手動點選。架構、schema 與限制見 [Project System v1 Report](dev/reports/PROJECT-SYSTEM-V1-REPORT.md)。

`wavecanvas-shell.js` 管理 Home／Editor 導覽、素材資訊、Inspector 分頁與 Transport，重用既有 runtime、選檔入口和設定控制項。回 Home 只暫停播放，保留目前素材與設定。Browser 的 New Project 保留原先進入／繼續 Editor 行為；Desktop 的新增專案則先處理未儲存提示，再清除素材並使用 Factory Defaults。頁面重新載入仍會清除未儲存的素材，不提供 Untitled crash recovery。

- Editor 為 Media／Preview／Inspector 三欄，左右面板可獨立收合；窄視窗將面板移到預覽下方，面板內容獨立捲動。
- Inspector 分為視覺、歌詞、歌曲資訊、背景、音訊五個 tabs，設定更新仍走統一 runtime 入口。
- Preview 保持 16:9 和 1920×1080 canonical 座標，面板收合只改變顯示比例；Fit 與支援環境的全螢幕入口在 Transport。
- Preset 選單提供既有 JSON 載入、保存與 defaults reset，資料格式保持原樣。
- Home 直接顯示 Circle／Square／Linear 三張內建模板卡片，使用此模板會套對應 Factory 視覺基準並進入 Editor，保留已載入素材。Desktop App 已支援 Recent Projects、Open / Save Project 及影片輸出；Browser 專案與影片輸出按鈕停用；Lyrics Timing 為可收合的逐行 LRC 校時工具。
- WE 模式不顯示 Standalone Shell。

內建模板資料位於 `builtin-templates.js`，由 `template-selection-ui.js` 產生 16:9 靜態縮圖、名稱、副標題、描述及套用按鈕。縮圖位於 `assets/templates/builtin_{circle,square,linear}_default.png`；新增卡片只需新增 definition。`previewVideo=null` 保留未來欄位，目前不建立 video 或播放預覽。

模板恢復目前 Factory 的排列／封面 geometry、頻譜、粒子參數、背景與 Song Info 外觀。音訊設定、Input Gain、Lyrics、Song Title/Artist、已載入圖片／音訊／LRC 保留，其他 Layout session edits 不重設；一般 Inspector Layout 切換仍保留當前編輯值。縮圖中的示範媒體不會隨模板載入。

Media Panel 的 Cover／Primary LRC／Secondary LRC 操作固定為「選取／替換」在上、紅色低調 danger 清除按鈕在下，直接沿用原 handler、不跳確認框。普通重複的歌詞檔名狀態訊息隱藏，error／warning 仍顯示。詳細 mapping、測試與限制見 [TEMPLATES-UI-REPORT.md](dev/reports/TEMPLATES-UI-REPORT.md)。Targeted browser 頁面為 `dev/tests/templates-browser.html`。

Visualizer Inspector 依實際作用範圍排列為：排列、頻譜外觀、當前 Layout 專區、位置與變換、低頻反應、粒子、其他。`inspector-policy.js` 只描述 UI 的分類／適用範圍，不複製 schema 值；`inspector-ui.js` 在既有 Shell 完成後搬移原控制項，不重建 inputs 或另存設定。切換 Layout 只更新 visibility，保留數值、控制項事件與各專區收合狀態。

共用頻譜外觀只保留三種 renderer 都使用的色彩模式、顏色、不透明度、彩虹偏移與隨機色節拍門檻（後兩者按色彩模式顯示）。Circle 的 `audiocount/barwidth/barheight` 與 Square／Linear 的 `barCount/barWidth/height` 使用不同 runtime key，因此各自放在 Layout 專區。中心底色、第二層形狀、原圖片旋轉與頻譜間距只供 Circle／Square 使用；Linear Cover 額外沿用中心低頻縮放與不透明度，見下方專節。全域低頻區只含三種模式都有效的畫布震動／模糊強度與門檻。

Circle 僅顯示原始 px 偏移；Square／Linear 使用既有位置百分比與整體幾何旋轉。Circle 頻譜起始角度、中心裁切角度、頻帶取樣偏移分開命名；Square 的幾何旋轉會加上既有 `barsrotate` 附加角度。Style 2 粒子仍使用原 renderer，其顏色控制不受留存的 Style 1 彩虹開關遮蔽；圖片不存在時不顯示圖片旋轉速度。property／Preset key、format version 與 renderer 保持；Standalone baseline 依 Factory Layout Defaults。完整 UI 分類見 `dev/reports/INSPECTOR-REPORT.md`，目前 defaults 見 `dev/reports/FACTORY-DEFAULTS-REPORT.md`。

直接 `file://` 啟動未完成實際瀏覽器驗證：目前使用的瀏覽器測試工具只允許 HTTP/HTTPS。WAV 與 MP3 已實際播放；測試 Chromium 對 FLAC 回報 `probably`，但未以真實 FLAC 檔案驗證解碼。

## Lyrics Timing Editor

從 Editor 底部展開 Lyrics Timing。時間刻度、waveform、播放頭與 Primary／Secondary 區塊共用橫向時間軸；仍使用原本的 audio element 與 Transport，不建立第二個播放器。

- 單擊區塊選取事件，左右拖曳時顯示草稿時間，放開後提交。Snap 支援 Off／10／50／100 ms，預設 10 ms。時間限制為 0 至音訊長度；沒有音訊時可校時至 LRC 格式上限。
- 選取後可用 ±10／±100 ms 按鈕或方向鍵細調，Shift＋方向鍵為 ±100 ms；也可輸入 `mm:ss.xxx`。非法輸入標示錯誤並保留舊時間。手動與細調不套用 drag Snap。
- 點擊 ruler／waveform 或拖曳播放頭會 Seek。雙擊區塊／「跳至此句」會 Seek 到扣除 runtime offsets 的播放位置，以便立即驗證 Preview。
- Zoom In／Out 以 viewport 中心定錨；Ctrl＋滾輪以游標指向的時間定錨。Alt＋滾輪只水平捲動；普通滾輪保留垂直捲動。Follow Playhead 接近視窗右側時才向前捲動，手動操作後暫停跟隨 3 秒。
- 顯示與編輯的是 **Raw LRC timestamp**。檔案 offset、globalOffsetMs、secondaryOffsetMs 另外標示，不寫入事件時間。兩個獨立 LRC 的資料和校時互不影響，merge tolerance 仍由原 runtime 處理。
- 同檔相同時間的雙語屬於一個可編輯事件，兩行一起移動；額外同時間內容保留在原始資料及匯出中，播放仍依原規則只用前兩行。事件 ID 在載入時分配，跨事件拖曳與排序不改 ID。
- `...` 顯示為間奏區塊。Primary 與 Secondary 仍分軌保留；原 interlude、慣性動畫、glow 規則保持。
- Undo／Redo 只管理校時，最多 200 步。快捷鍵為 Ctrl＋Z／Ctrl＋Y／Ctrl＋Shift＋Z，僅在 Timing 區域操作，文字欄位保留原生 undo。換／清除任一 LRC 或更換 Audio 會清除校時歷史。
- 匯出 Primary／Secondary LRC 使用目前的 Raw 事件，UTF-8、毫秒時間、保留可支援 metadata 與 file offset。另存為 `*-timed.lrc`，不覆寫來源檔案；下載未啟動時可用旁邊的下載連結。Preset 不保存 LRC 或校時歷史。

模組：`timing-model.js` 提供 editable documents、座標與 history；`lyrics-runtime.js` 新增只讀 `getDocument(source)` 和 `retime(source, id, timeMs, snapMs)`，完成修改後沿用原 merge／render 流程；`timing-editor.js` 管理 DOM 和互動。`lrc-parser.js` 額外提供來源逐行資料與 metadata，原 parse／merge 語意不變。

`waveform-cache.js` 使用獨立 OfflineAudioContext 解碼 PCM，不連接 playback graph。每 128 samples 建立跨聲道 min/max，建立不同密度的 peaks 金字塔，PCM 掃描分批讓出主執行緒；完成後只保留 peaks。換檔使用版本號取消過期結果，Audio 清除時釋放 cache。超過 512 MB 的音訊略過 waveform，播放／校時仍可使用；很長的音訊完整解碼仍有暫時的記憶體成本。

播放時只更新播放頭、active markers 和必要的 follow scroll；不重新 parse、建立區塊或生成 waveform。區塊在載入／校時時更新，縮放／Resize 只調整位置，ruler／waveform 只繪製目前 viewport。長時間軸上限 8,000,000 CSS px，會限制最高 zoom，以避免瀏覽器尺寸上限。

全域 UI scaling 未實作。應用非輸入區域的 Ctrl＋滾輪不會觸發 page zoom；只有時間軸區域執行 timeline zoom。

## 設定單一來源

`project.json.general.properties` 是主要 schema。保留 98 項 property：86 個相容資料鍵及 12 個 metadata；本輪移除幻燈片三個設定及舊圖片尺寸選項。`property-compatibility.js` 區分有效設定與退役項目；目前 Standalone 顯示 54 個原 property 控制項與 11 個 metadata，不顯示 Clock、舊 Text、內建影片及無效果控制項。原 key 保持原樣，包括 `resposive`。

`property-schema.js` 是由 schema 產生的部署副本，包含完整 metadata、conditions、options、範圍與來源 SHA-256。不要手動編輯副本。修改 `project.json` 後執行：

```powershell
node dev/tools/generate-schema.cjs
node dev/tools/generate-schema.cjs --check
```

WE 與 Standalone UI 都使用同一入口與 `{ key: { value } }` 格式：

```javascript
VisualizerRuntime.updateProperties({ resposive: { value: 40 } });
VisualizerRuntime.getSettings(); // 86 項設定的副本
VisualizerRuntime.getSchema();   // 全部 98 項 schema，供設定面板生成控制項
VisualizerRuntime.subscribe((settings, standalone) => {}); // state -> UI 同步
VisualizerRuntime.updateStandalone({ inputGain: 1.25 });    // 另存的 Standalone 設定
```

WE 的 `wallpaperPropertyListener.applyUserProperties()` 轉送到相同入口。初始化時先建立 Canvas，再套用完整 defaults 與啟動前收到的 WE 更新，最後訂閱音訊。後續更新只傳遞 patch，避免每次修改都重建全部粒子。沒有預設 value 的 directory 以空字串表示尚未選取。更新依 schema 驗證；未知 key 與 text properties 不進入 runtime state。

退役與相容資料：

- Clock、舊 Text、內建影片、schemecolor 與舊 blur keys 留在歷史 schema，更新時安全忽略，不再觸發繪製、字體載入或 prompt。
- rainbow passthrough 僅保留於 WE 訊息，不顯示 Standalone 控制項。
- 舊背景影片模式（4）統一回退至純色（1）。原三段 WebM、preview.jpg 與 font/ 已移除。
- bassshaketext／txtbassmultiplier 保留為 Song Info bassReaction／bassStrength 的同步別名，不建立第二套設定。

## WE／Standalone 能力選擇

`runtime-adapter.js` 集中管理宿主能力：

- 有 `wallpaperRegisterAudioListener` 時，註冊一次原 listener；不啟動本地音訊 UI 或 Web Audio graph。
- 沒有該 API 時，使用本地 audio 與 Web Audio adapter。
- 背景只支援單張圖片；舊幻燈片來源（3）轉為單張圖片（2），不再請求隨機圖片。
- 檔案 URL 處理集中於 adapter；內建影片播放模組已移除。
- 原宿主全域 API 不被覆寫。property listener 保留其他既有 methods。

本次 WE 相容性以模擬宿主驗證，未在真實 Wallpaper Engine 中執行。音訊註冊已移出 `window.onload`，在 body 結尾完成 Canvas 初始化後立即執行，符合 WE 文件建議。

## 本地音訊資料流與 FFT

```text
File → Object URL → HTMLAudioElement
                      → MediaElementAudioSourceNode → destination（立體聲播放）
                                                    → AnalyserNode（分析）
                      → Float32 dB FFT → 64 頻帶 → 128 格相容陣列
                      → 原 wallpaperAudioListener
                      → pinkNoise / 頻率平滑 / 時間平滑 / 鏡射
                      → 原 run() / bass reaction / particles
```

- `fftSize = 8192`，`smoothingTimeConstant = 0`，保留原 listener 的 smoothing。
- `getFloatFrequencyData()` 取得 dB，轉線性功率：`10^(dB/10)`。
- 前 8 個頻帶每帶 32 Hz，涵蓋 0–256 Hz；其餘 56 帶對數分布到 `min(20000, Nyquist)`。前 3 帶為 0–96 Hz，前 5 帶為 0–160 Hz，供原低音反應使用。DC bin 排除。
- 使用 FFT bin cell 與頻帶的比例重疊分配能量，避免邊界 bin 被重複計算。
- Blackman window 平均平方值為 `0.3046`。每帶映射為 `min(1, 1.5 × 2 × sqrt(power / 0.3046))`。`1.5` 為此視覺核心的固定輸入增益，不影響播放音量。
- 每個 FFT bin 不高於 −100 dB 時視為零。陣列後 64 格複製前半部；原 listener 只消費前 64 格，仍自行建立視覺鏡射。
- 約 30 次／秒傳入 listener，保留小數時間餘數以免 RAF 抖動使更新降為每三幀一次。暫停、Seek、換檔或結束時送零值，讓原 smoothing 自然衰減。
- 每個 audio element 只建立一個 source node；換檔重用 graph 並回收舊 Object URL。

WE 文件沒有公開精確頻帶邊界或其內部幅度處理。這是經校準的相容映射，不宣稱和 WE FFT 完全相同。本地 analyser 使用聲道下混，與原 WE listener 只讀左聲道不同；立體聲相位抵消仍可能讓分析變弱。播放保持原立體聲。8192 點 FFT 的分析窗長約為 171 ms（48 kHz）或 186 ms（44.1 kHz）。原動畫仍依幀率累加，沒有改為固定時間步進。

其他保留的既有限制：Style 1 的 `canvas.heights` 拼字問題尚未處理；本輪不更動原 particles／FFT 演算法。

## Cover 與本地圖片

左側 Media 的 Cover 選取／替換入口重用 `logoimage` file input。支援 PNG、JPG/JPEG、WEBP；沿用原圓弧 clipping、旋轉與縮放，非方形圖仍按原矩形縮放後裁切，不新增裁圖演算法。

```text
File -> Object URL -> VisualizerImages.load()（一次解碼／快取）
     -> VisualizerRuntime.updateProperties({ logoimage: { value: URL } })
     -> 共用 setLogo / getLogo -> 原 Canvas clip / drawImage
```

`image-cache.js` 同時供 WE 路徑與 Standalone Object URL 使用，render loop 不再建立 Image。`local-files.js` 管理成功圖片、待載入圖片、換檔版本與 URL ownership。新圖成功解碼後才替換，壞檔保留上一張；取消不變更；快速換圖只提交最後一筆。舊 URL、失敗／取消的候選 URL、清除與離開頁面都會回收。

同一個 helper 也支援單張 `backgroundimage`、`backgroundimagef`。選取背景圖片成功後自動啟用圖片來源；取消、壞檔與快速換圖沿用同一套快取及 URL 回收機制。

### 單張背景圖片動作

背景只有單張圖片，統一以 cover 填滿；疊加圖片維持獨立圖層。`background-schema.js` 生成 13 個 Standalone 控制項，經 `updateStandalone({ background: { ... } })` 更新，Preset 保存在 `standalone.background`：

- `enabled`、`mode`（預設 `infinity`）、`baseScale`（1.08）。
- `opacity`（1）、`blur`（0 px）、`backingColor`（黑色）。
- Infinity：`driftAmount`（18 px）、`driftSpeed`（1×，每圈 60 秒）、`offsetX/Y`（0，canonical 畫布像素）。
- Bass Pulse：`bassScaleAmount`（0.035）、`bassAttack`（140 ms）、`bassRelease`（850 ms）。此模式忽略已保存的 offsets，固定置中。

`background-motion.js` 計算 Gerono 無限曲線 x=A·sin(phase)、y=0.45A·sin(2phase)。`background-stage.js` 只更新同一 DOM 圖層的 transform；Bass Pulse 讀取既有 audioSample 前五格（總和限於 0–1），重用現有視覺 envelope helper，僅改縮放，不建立 FFT 或 analyser。暫停後柔和回復；Home／分頁隱藏停止背景 RAF，重新顯示時延續漂移相位。

依漂移、offset 與三倍 blur 半徑自動加大安全縮放，避免黑邊；因此大 offset／blur 的實際縮放可能超過設定的 baseScale。Bass 額外縮放不超過其設定比例。每幀不讀取 layout、不建立 Image、不重建 DOM；選檔後只解碼一次供快取。

模式專用控制項依 mode 顯示；disabled 時隱藏圖片但保留檔案和底色。舊 Preset 缺少新欄位時使用 defaults，`mode: slideshow` 安全轉成 infinity。已移除 `customrandomdirectory`、`slideshowInterval`、`slideshowIntervalMultiplier`、`imageoptions`；舊鍵只留在 compatibility 忽略清單，不進入 runtime／Preset。Preset v1 格式不變，不包含圖片或 Object URL。

## Settings UI

設定面板使用繁體中文。`ui-zh-tw.js` 僅管理顯示文字（86 個 properties、12 個 metadata、幾何設定與選項），不修改原 schema、property key、選項值或 Preset 格式；新增設定時應一併補上翻譯。

`settings-ui.js` 依 schema 的 order 排序，套用 compatibility policy 後生成 54 個有效設定列與 11 個 metadata。Song Info 使用獨立 schema；不維護第二份原 property 設定表。

- bool -> checkbox；slider -> range 與即時數值欄；color -> picker 與 HEX 顯示，更新時轉回 WE RGB float；combo -> 原 options 的 select。
- 3 個 file -> 本地單張圖片選取／清除。
- 原分組保留 Audio、Background、Circle、Center / Position、Bars、Particles、Overlay、Bass、Other；Clock / Text 改為獨立 Song Info。
- condition 用限制式 parser 解讀，不使用 eval；暫時不適用的控制項隱藏，值仍保留，切回適用模式時恢復。Geometry、背景及自訂歌詞背光顏色同樣不顯示灰掉的控制項。
- schemecolor、blurvalue、blurclkvalue、blurtxtvalue、舊 font index 及 rainbow 說明不再顯示。
- 全部 property 修改經 `updateProperties()`，runtime subscription 反向同步 UI。面板可收合、分組可收合；桌面停靠右側，窄視窗停靠下方，縮小預覽區而不覆蓋它。WE 模式隱藏整個 Standalone UI。

## Song Info 與系統字型

`standalone.text` 由 `song-info-schema.js` 管理，共 18 項：enabled、title、artist、alignment、positionX／Y、scale、lineGap、titleSizeRatio、artistSizeRatio、fontFamily、color、borderEnabled／Color／Width／Blur、bassReaction、bassStrength。預設啟用，Song Title／Artist，白色，Title 48px／700，Artist 31.2px／400；Factory X=50%，Y 為 Circle 78%／Square 80%／Linear 75%，同一組縮放。空文字隱藏對應行，兩行皆空時隱藏整組。

DOM 為 song-info-layer → song-info-content → title／artist；使用 textContent，不執行 HTML 或 browser prompt。所有變更經 updateStandalone({ text: ... })，同步 UI、DOM 與 Preset。文字位置使用 canonical 1920×1080 stage。

系統字型選項為 system-ui、Arial、Segoe UI、Microsoft JhengHei、Noto Sans、Georgia、Times New Roman、Courier New、monospace、sans-serif、serif，只有本機已安裝字型與 CSS fallback，不載入檔案。原生 select／option 加 font-family 預覽；平台若不顯示 option 字型，選取欄與舞台文字仍提供實際預覽。舊 preset 的已移除字型名稱安全回退 system-ui。

邊框採繼承的 -webkit-text-stroke，搭配 paint-order: stroke fill 與 text-shadow；blur=0 為硬邊框，增加 blur 加柔和光暈；width=0 或 border off 清除所有邊框／shadow，不複製文字 DOM。

Bass 使用既有 audioSample 前五格，原 Text 比例公式為 1 + sum × (strength/8) / 80，再乘整體 scale。預設 bassReaction=false、strength=80，範圍 0–640；不改 audio source、FFT 或 wallpaperAudioListener。Clock 的所有變數、draw、Date／AMPM／星期與時鐘更新都已移除；既有每秒 timer 僅維護 FPS。

Preset version 維持 1，保存全部 text appearance／content；缺少 standalone.text 時使用 defaults。舊 Clock／Text properties 忽略；匯入驗證完成後才套用，Reset 還原 Song Info。未加入 metadata 自動讀取、Electron 或影片輸出。

## Factory Layout Defaults / 單值恢復預設

正式來源保存在 `dev/fixtures/factory-defaults/`；`dev/tools/generate-factory-defaults.cjs` 產生附 SHA-256 的 `factory-defaults-data.js`，`factory-layout-defaults.js` 集中管理 immutable / clone-on-use baseline。來源已有值全部保留，schema 只補缺欄位；這不是 Template。

Standalone 首次使用 Circle Factory；各 Layout 的位置、幾何、頻譜、封面設定及 Song Info X/Y 使用獨立 session bank，切換不 reset。音訊、背景、歌詞、粒子、實際圖片來源共用。Linear 正式值：X/Y=50/100、1920×400、Cover X/Y=50/50、Size=30%、Circle、0 RPM；Square 正式 mapping：Folded Diagonal、rotation=90°。WE defaults 與原演算法保留。

數值控制旁的 ↺ 依目前 Layout 恢復單一 Factory 值，相等時變淡／停用。全域 Reset 保留目前 Layout，套其完整 Factory；三份 Input Gain 均為 3×。Preset v1 保持，載入值不會成為新 default，缺欄位使用目標 Factory。inactive layout bank 不另寫入 active-layout Preset；Desktop Project v1 會獨立保存三種 layout bank。

來源核對：`node dev/tools/generate-factory-defaults.cjs --check`。Targeted UI：`dev/tests/factory-defaults-browser.html`；完整映射與限制見 [FACTORY-DEFAULTS-REPORT.md](dev/reports/FACTORY-DEFAULTS-REPORT.md)。

## Preview Stage 與 Geometry / Layout

DOM 結構為 `workspace -> preview-container -> stage`，`settings-panel` 為 workspace 的另一個子元素。Standalone stage 的 CSS 與 Canvas backing 都固定為 1920×1080；`preview-stage.js` 使用 ResizeObserver，根據 preview-container 的可用寬高計算 `min(width/1920, height/1080)`，等比例縮放整個 stage。DOM 背景／overlay 的 px、Canvas 的位置、字體與粒子都共用此 canonical 座標系。設定欄開關與 resize 只改 display scale，不重設 Canvas 或幾何尺寸；`VisualizerStage.toStage()` 可將 client 座標轉回 stage 座標。WE 保留宿主全畫面 sizing。

Geometry / Layout 分組來自獨立 `layout-schema.js`，不加入原 project.json properties。全部新設定經 `VisualizerRuntime.updateStandalone({ visualizer: { ... } })` 更新，並使用同一份 runtime state 同步 UI、渲染與 Preset。

```text
原 wallpaperAudioListener -> 已處理 audioSample[]
                          -> Circle：原 renderer（不改演算法）
                          -> Square：shared band peaks -> mirrored geometry -> draw
                          -> Linear：sampleIndex -> magnitude -> geometry -> draw
```

`visualizer-geometry.js` 使用同一個 processed spectrum 的前 64 格，不額外做 FFT、pinkNoise 或 smoothing。Linear 按 barCount 重取樣；Square 將完整頻帶分組取 peak，按排列規則分配至方形周邊，對稱柱共用顏色。color callback 沿用原色彩／rainbow／beat color；bass 數值由原 run() 提供。

- Radial Circle：預設模式，繼續使用原 Circle、Bars、Center properties；新增 geometry 參數停用，不替換它們的語意。
- Square（方形頻譜）：`squareSpectrumLayout` 有三種 mapping，見下方。barCount 是整框總量，取最接近的 4 倍數，64 即每邊 16 條。Square size 定義中心邊長，原 bass multipliers 控制中心與 bars 距離反應。預設 outward，仍支援 inward、rotation、原 auto rotation、Cover 與第二層 shape；中心為方形 clipping，inward bars 畫在中心圖上方。
- Linear：horizontal / vertical、position X/Y、width、height、rotation、bar count、bar width、gap、mirror、reverse、amplitude direction、anchor。無中心 Logo；其他背景與粒子仍走原渲染，Song Info 為獨立 DOM layer。
- Position X/Y 為 stage 百分比，50/50 即 960/540。其餘尺寸是 stage px。Horizontal 的 width 是排布長度、height 是振幅尺度；Vertical 的 height 是長度、width 是振幅尺度。
- Linear 在指定長度內，以 bar width / gap 的比例分配筆畫與間隔（gap 是權重，非固定像素）；Square 使用矩形 bars，以一致厚度／間隔比例排列，兩端保留 corner inset。Anchor 將 Linear 位置點對齊沿主軸的起點／中央／終點。Rotation 圍繞該位置點。
- Linear 的 None 使用單向 0–63 頻帶；Mirror Around Center 為低→高→低、中心 peak 成對；Dual Opposite 在基線兩側畫相同頻帶的相反振幅。Reverse 反轉取樣順序。Amplitude direction 的 Up/Right、Down/Left、Both sides 決定 Linear 延伸方向。Square 的對稱規則由 Spectrum Layout 決定，不使用 Linear mirror 選項；舊 preset 中的 mirror 值仍保留，格式不變。

Square Spectrum Layout（只有 Square 顯示）：

- `symmetric`（原 schema fallback；Standalone Factory 使用 foldedDiagonal）：保留原對稱方形。每邊由中央向兩端映射低→高頻；四邊共用頻帶與顏色。64 bars 使用 8 個頻帶群。
- `topBassMirror`：頂邊中央為低頻起點，分成水平鏡像的兩條路徑，沿左右側邊到下邊中央逐步提高頻率。側邊與下邊不重啟低頻。64 bars 使用 32 個頻帶群。
- `foldedDiagonal`：以右上、左下兩角為折點，Top → Right、Bottom → Left 各形成高→低→高的折疊序列；低頻位於兩個對角折點，中高頻沿各自相鄰邊遠離折點。四邊沒有各自重啟頻帶，旋轉 180° 保持相同頻率結構。64 bars 使用 16 個頻帶群。

三種 mapping 都完整覆蓋既有 audioSample 前 64 格，每群取 peak；Reverse 反轉群序，低／高頻位置也隨之反轉。顏色按頻帶中心映射到原 color callback 的 0–127 index，同群只計算一次，使隨機 beat color 仍保持該模式的對稱。幾何先在局部座標建立，之後整體套用 rotation，不重新分配頻帶。角落 inset、bar 寬度與間距共用同一套規則。

Preset 的 `standalone.visualizer` 保存全部 22 項 layout 設定（含 squareSpectrumLayout 與五項 Linear Cover）；format version 維持 1。缺項使用目標 Factory（Square 為 foldedDiagonal），未知項忽略，數值 clamp 並拒絕 NaN / Infinity，非法 enum／型別拒絕；舊 version 1 Preset 相容，缺少 visualizer 時使用 Circle Factory。Reset 保留目前 Layout 並恢復其 Factory。Circle、Linear、FFT mapping、wallpaperAudioListener 與 audio pipeline 演算法不受 defaults 調整影響。

## Linear Cover / Artwork

Linear 不再略過 Cover：`linear-cover.js` 由 geometry 的 Linear branch 呼叫，從同一個已解碼的 `logoimage` cache 繪製，先畫 Artwork 再畫頻譜。Circle／Square 原 Cover path 不變，Linear spectrum 的取樣／bar geometry 不變。

Linear 專區的「封面」欄位存於 `standalone.visualizer`：`coverX`／`coverY` 為 1920×1080 stage 百分比，`coverSize` 為圖片最長邊相對 stage 高度的百分比，`coverShape` 為 `square`／`circle`，`coverRotationSpeed` 為 RPM（正數順時針、負數逆時針、0 靜止）。Square 保留完整方形／矩形比例，不做圓形 clipping；Circle 將非方形來源置中裁切後使用圓形 mask。Rotation Speed 只在 Circle 顯示，切換 Shape 或 Layout 保留值。

Transform 順序為獨立 stage 位置＋原 shake 位移 → 原 bass enlargement 縮放 → 圓形 mask → 圖片中心旋轉 → 繪製；頻譜的位置、orientation、rotation 不會改動封面 transform。Bass 使用原 `appearance.bass.center`（avg1／cbassmultiplier），不另算 FFT。Linear 封面不透明度沿用 `circleopacity`，Inspector 在 Linear 有圖片時顯示「封面不透明度」與「封面低頻放大」。這兩個共用效果值不獨立複製；Circle／Square 的原圖像不透明度語意不變。

旋轉以 `performance.now()` 的 elapsed time 累積：RPM × 6 × deltaSeconds。切至非 Linear 或 Square Cover 時停止旋轉時間累積，恢復 Circle Cover 不補算隱藏期間；圖片替換／清除也重置 clock anchor。沒有每幀 decode、DOM 重建或新 audio graph。

Preset version 仍為 1，既有 presets.js／Restore handler 不變。舊 preset 缺少新增欄位時暫以 X/Y=50、Size=30%、Shape=Square、Speed=0 作安全 fallback；這不是 Factory Defaults／Template 的新設計，也未改任何既有 schema default。Targeted tests：`node --test dev/tests/linear-cover.test.cjs`，Chromium：`dev/tests/linear-cover-browser.html`（按 Run Linear Cover tests）。完整回報見 `dev/reports/LINEAR-COVER-REPORT.md`。

## Standalone Input Gain

位於 Audio 分組第一列，Standalone Factory 預設 3.0×（三份使用者 JSON），範圍 0.25×–4.0×。`runtime-adapter.js` 的 `deliverLocalAudio()` 在已驗收 FFT mapping 之後、原 listener 之前，統一乘上 inputGain。沒有額外限幅，確保只縮放幅度、不改變頻率分布；WE 原生 listener 路徑不使用它。

## LRC / SRT 匯入與雙語歌詞

Media Panel 的 Primary / Secondary Lyrics 均可選擇 `.lrc` 或 `.srt`，兩軌可混用，格式標籤依來源顯示；不會上傳。檔案需為 UTF-8，大小不超過 1 MB、最多 10,000 筆時間事件。LRC 支援 `[mm:ss]`、百分秒／毫秒、多個時間標籤、LF／CRLF、BOM 與 `[offset:+100]`；忽略 metadata、非法行與 Enhanced LRC 逐字標籤。有效檔案 offset 上限為正負 24 小時，使用最後一個有效值。

SRT 使用標準 `HH:MM:SS,mmm --> HH:MM:SS,mmm`，由 `srt-parser.js` 解析、`lyrics-import.js` 選擇格式，並轉成現有 Timing Model。每個 cue 的全部非空文字行以空格合併，清除字幕 HTML tags，再使用純文字顯示。支援 BOM、LF／CRLF、缺失或不連續序號與最後一塊沒有尾端空行；空 cue 忽略、非法時間跳過並顯示 warning，全部無效時顯示錯誤且保留原歌詞。

SRT start time 作為可校時的 `event.timeMs`；原始起訖時間、序號與文字行保存在 `event.sourceCue`，文件保留 `sourceFormat`。拖曳、細調及 Undo／Redo 不改原始 metadata。Renderer 仍顯示至下一句，最後一句顯示至歌曲結束，**不使用 SRT end time**。現有 LRC 匯出使用修改後的事件時間與純文字；沒有 SRT 匯出。Preset 格式不變，仍排除字幕內容。詳細規則、測試與限制見 [SRT-IMPORT-REPORT.md](dev/reports/SRT-IMPORT-REPORT.md)。

同時間戳依原輸入順序合併為 `{ timeMs, primary, secondary }`。只保留前兩條非空句，額外內容忽略並顯示 warning；單句只建立 Primary，不猜測語言。空白時間 cue 可清空當前歌詞。

双檔由 Primary 決定時間線。先保留所有精確時間配對，再在 `mergeToleranceMs` 內配對最近且尚未使用的 Secondary；預設 100 ms，超過容差不補猜，額外 Secondary 不另建事件。選用次要檔案時取代同檔內的 Secondary，清除次要檔案可恢復同檔雙語。更換主要 LRC 保留已選次要檔案；更換音訊或「清除歌詞」清除兩份來源。

```text
LRC / SRT files -> lyrics-import.js -> lrc-parser.js / srt-parser.js
                -> timing-model.js -> primary timeline + bounded secondary merge
audio.currentTime -> lyrics-runtime.js binary lookup -> active lyric event
                                                    -> lyrics-stage.js DOM pool
processed audioSample[0..4] -> attack/release envelope -> Primary back glow
lyrics-schema.js -> runtime standalone.lyrics -> Settings / Stage / Preset
```

主要時間查詢使用 `audio.currentTime * 1000 + primaryFileOffset + globalOffsetMs`；global offset 正值提早，負值延後，範圍 −5000～5000 ms。雙檔配對時，Secondary 的有效時間以 `audioTime + secondaryFileOffset + globalOffsetMs + secondaryOffsetMs` 校準，額外 offset 範圍 −2000～2000 ms。校準後的雙語仍是同一事件，一起依主要時間線切換。

`lyrics-runtime.js` 不依賴 Canvas、FFT 或 DOM；播放、暫停、Seek、結束與換檔由音訊事件同步。`lyrics-stage.js` 只在 Standalone 建立，使用固定 5 個 DOM item，Primary / Secondary 包在同一 `.lyric-content`，共同 translate / fade / blur / scale。一般切句使用可取消的慣性過渡與小幅 overshoot；Seek 立即定位並取消舊動畫。暫停保留當前句，背光衰減。背景分頁的動畫恢復後依 currentTime 重新定位。

固定顯示行為（不新增設定或 Preset 欄位）：runtime 分為 `PRE_LYRICS`、`ACTIVE`、`POST_LYRICS`。第一句到達前整個 layer hidden；首次自然入場同時帶入 Current 與 Next（若啟用且存在），不建立 Previous 空白占位。最後一句依使用者決定保留至歌曲播放結束，結束時立即沿原焦點方向將整個 stack 往上滑出一格並隱藏。離場時間沿用既有 transitionDuration；Seek 到歌曲結尾直接隱藏，Seek 返回會取消離場並重建正確焦點。音訊 duration 尚未取得時等 ended event，不猜測最後一句時長。

Primary trim 後精確等於 `...` 的 event 顯示三個獨立 dot span，隱藏普通文字及 Secondary，不使用 bass glow；其他含省略號的句子仍是普通歌詞。dot DOM 隨固定五個 item 一次建立並重用。間奏 duration 為下一事件時間減目前事件時間；cycle 數取 `max(1, round(duration/1800))`，每點 interval 為 `clamp(duration/(cycles*3), 250, 900)` ms，每 cycle 為三個 interval。三點依序使用平滑 sin² pulse，最大上浮 3 px／縮放 1.04；phase 直接取 `(有效音訊時間 - 間奏開始時間) % cycle`，含 global／file offset，因此 Seek 不重啟第一點、Pause 不前進。離開間奏重設 dots；reduced motion 停用 pulse。

背光只有 Primary 一層，從既有 processed spectrum 讀取低頻並經有界 attack / release envelope 調整 opacity、blur、spread，不改 FFT、listener、文字位置或原 visualizer 演算法。Secondary 預設字號比例 0.65、opacity 0.70，可獨立字型、字重、顏色、間距與 above / below。

Primary 使用同一個 envelope 的集中 text-shadow 高亮，加上原寬模糊背光，改善寬模糊光被不透明文字遮住後低音變化不明顯的問題。只有 current Primary 會高亮；Secondary 不新增光源，關閉背光時兩種光都清除。

38 項歌詞設定由 `lyrics-schema.js` 生成控制項，全部經 `VisualizerRuntime.updateStandalone({ lyrics: { ... } })` 更新，subscription 同步 UI。剩餘原 project.json 的 86 個 property keys 作為相容資料保留。字型只使用 system-fonts.js 的 11 個系統字型選項，並加入 Microsoft JhengHei、PingFang TC、Noto Sans CJK TC、Noto Sans JP 等 fallback；實際 CJK 字形仍依作業系統已安裝字型。

排版與既有視覺共用 1920×1080 stage。64 px 安全邊界、長句換行，最多 3 行；大字體／雙語上下文會降低為 1–2 行並截斷，避免溢出。未支援逐字 timing、karaoke、TTML、翻譯生成或自動辨識文字編碼。

## Preset

Export Preset 產生 JSON 與下載連結；若內嵌瀏覽器未啟動下載，可展開 JSON / Copy，複製後保存為 `.json`。本次已實際驗證 Copy JSON 與 JSON 實檔 Import；內嵌瀏覽器下載事件逾時，沒有確認下載落地，故保留這項驗證限制。

以下為格式節錄；實際 export 包含 54 個有效原 properties 及全部 Standalone 設定：

```json
{
  "format": "audio-visualizer-preset",
  "version": 1,
  "name": "Dark Sacred",
  "properties": {
    "barheight": { "value": 100 },
    "logoimage": { "value": "" }
  },
  "standalone": {
    "inputGain": 1.25,
    "visualizer": { "layout": "linear", "positionX": 50, "positionY": 70, "mirror": "center" },
    "lyrics": { "enabled": true, "secondaryEnabled": true, "secondaryFontSizeRatio": 0.65, "mergeToleranceMs": 100, "secondaryOffsetMs": 0 },
    "text": { "enabled": true, "title": "Song Title", "artist": "Artist", "fontFamily": "system-ui", "color": "#ffffff", "bassReaction": false, "bassStrength": 80 }
  }
}
```

格式與版本必須符合；properties 必須是 object。缺少欄位使用目標 Factory Layout defaults（沒有 layout 時為 Circle），未知欄位忽略；slider clamp min/max 並取整數（符合 UI step，避免 FFT 索引為小數），combo 非法選項使用 default，RGB 各分量 clamp 0–1。NaN、Infinity、無效型別與 corrupted JSON 拒絕，parse 完成後才套用。JSON 限制 1 MB。

Preset 包含 54 個有效原 property 與 Standalone Input Gain、visualizer、lyrics、background、text；不輸出退役項目。file / directory 值為 defaults 空字串；匯入不恢復路徑、Object URL 或 binary，並清除現有圖片與候選載入。音訊檔、播放位置、AudioContext 狀態不受 Preset 保存／匯入影響。Reset 保留目前 Layout，恢復其完整 Factory（含 86 項 runtime settings、Input Gain 3.0×），並清除圖片來源。

`standalone.lyrics` 保存全部 38 項 appearance / behavior，包含雙語設定；不包含 LRC 文字、檔名、路徑、Object URL、active index 或播放位置。舊 version 1 Preset 缺少 lyrics 時使用 defaults。匯入驗證完整設定後才套用，數值 clamp，NaN／Infinity／非法型別拒絕。Reset 恢復歌詞外觀 defaults；匯入與 Reset 保留當前載入的 LRC。

## 驗證

效能量測：產品加 `?profile=1` 啟用開發 overlay 與 `WaveCanvasPerf.reset()`／`snapshot()`；一般模式沒有 profiler hooks。`profileDetail=1` 額外計數 Canvas calls，會增加量測成本，只適合診斷。`/dev/tests/performance.html` 提供 A–E benchmark、geometry、waveform、resize burst 與媒體 lifecycle 檢查；`?baseline=1` 使用僅撤回本輪四項 Timing 優化的對照 fixture。這些頁面與基準 snapshot 不由產品正常入口載入。

量測結果、Before／After 與限制見 [PERFORMANCE-REPORT.md](dev/reports/PERFORMANCE-REPORT.md)，實機驗收表見 [PERFORMANCE-HARDWARE-CHECKLIST.md](dev/reports/PERFORMANCE-HARDWARE-CHECKLIST.md)。主 Canvas 固定 1920×1080；內嵌瀏覽器測試與縮小 Stage 不代表 Intel／RTX 實機 GPU 或 30 分鐘 memory 驗收。全部 Node tests 可用 `node --test dev/tests/*.test.cjs` 執行。

Lyrics Timing Editor 輪：Node **33/33**、Chromium **340/340** 通過，42 個 JS／CJS syntax 檢查與 102 項 schema 同步檢查通過。包含原 282 項回歸，以及座標／zoom anchor、毫秒 parse／serialize、stable IDs、Raw offsets、雙軌獨立、跨事件 drag、Snap／clamp、精確 decimal Seek、fine／manual edit、鍵盤 focus／Undo／Redo、waveform cache／快速換音訊、empty state、LRC export、長時間軸與播放中 resize。FFT mapper 與原 listener 的 hash 檢查通過。

完整瀏覽器紀錄為 `dev/tests/artifacts/timing-results.txt`，畫面為 `timing-editor.jpg`。`timing-review.wav` 為自行產生的 60／1000 Hz 合成音訊，`timing-primary.lrc`／`timing-secondary.lrc` 為測試資料；產品啟動不會自動載入這些素材。另透過實際 UI 選檔與滑鼠拖曳，確認 Primary 2.000→2.500 秒，Secondary 不變，Undo、10 ms 細調、手動 2.050 秒與正確 Preview focus。

下載連結內容已檢查，內嵌瀏覽器沒有回報 download event，因此尚未確認匯出檔案落地；保留可手動點擊的下載連結。長時間軸上限以模擬 LRC 驗證，尚未以數小時的真實音訊做 memory／decode 壓力測試。極矮視窗需捲動 Timing 區域才能操作全部控制項。file:// 與真實 WE 宿主的限制仍與前輪相同。

WaveCanvas UI Shell 輪：Node 25 項與 Chromium 282 項全數通過，JS syntax 與 schema 同步檢查通過。新增 Home／Editor 狀態保留、五個 tabs、左右與底部面板收合、1920×1080／1366×768／480×640 viewport 的 16:9 containment、Media 檔名／圖片尺寸／清除，以及自訂 Transport 播放／暫停／Seek／音量／回起點驗證。全部既有音訊、FFT、Cover、Lyrics、Song Info、Geometry、Preset 與背景回歸仍通過；FFT 與 listener 雜湊保持相同。完整紀錄為 `dev/tests/artifacts/wavecanvas-results.txt`，畫面為 `wavecanvas-home.jpg` 與 `wavecanvas-editor.jpg`。大尺寸 viewport 由瀏覽器測試 iframe 驗證，未在實體 1920×1080 螢幕上操作；全螢幕依宿主能力提供，尚未完成進入／退出的實測。

本輪資產清理／Song Info：Node 25 項與 Chromium 237 項全數通過。包含實際合成 WAV 播放驗證 Text bass、邊框／glow、空行、對齊、系統字型、Preset 相容與 Reset，以及全部既有音訊／Cover／Geometry／Lyrics 回歸。FFT 與 listener SHA-256 相同。

不需新增套件：

```powershell
node dev/tools/generate-schema.cjs --check
node --test dev/tests/runtime.test.cjs dev/tests/lyrics.test.cjs dev/tests/timing.test.cjs
```

啟動 server 後，開啟 `/dev/tests/browser.html` 並點擊 Run browser tests。這是獨立測試頁，不會被產品入口載入。測試建立短 WAV 與靜音的 Web Audio oscillator，涵蓋實際播放、Pause、Seek、換檔、壞檔、WE API 模擬及 44.1/48 kHz 的 FFT 校準。

Cover / Settings 輪驗證結果：Node 10 項、Chromium 85 項全部通過，schema 與 project.json 的 102 項一致。新增測試涵蓋 90 個設定控制項／12 個 metadata、雙向 state 同步、PNG/JPEG/WEBP 非方形圖片、單次解碼、快速換圖、取消／壞檔與 URL 回收、Gain 0.5／1／2 的幅度縮放、Preset 匯入匯出／缺欄位／未知欄位／clamp／損壞 JSON／Reset。完整瀏覽器記錄保存在 `dev/tests/artifacts/settings-cover-results.txt`。

Geometry 輪驗證結果：Node 12 項、Chromium 130 項全部通過。新增 1200×800、720×420、390×720、640×230 四種 preview window 尺寸 × settings 開／關，驗證 16:9、容器邊界與 1920×1080 mapping；另驗證 Square inward/outward、rotation 操作、Linear horizontal/vertical、三種 mirror、reverse、anchor、amplitude direction、resize 不改 settings，以及完整 layout Preset roundtrip／defaults／clamp／原子拒絕。原音訊與 FFT 校準測試仍通過，兩段已驗收程式的 SHA-256 保持不變。完整記錄在 `dev/tests/artifacts/geometry-results.txt`。

可開啟 `/dev/tests/geometry-gallery.html` 比較四種渲染畫面；它使用合成頻譜與原 listener，不代表真實音訊播放。只屬於測試頁，產品入口不載入。截圖在 `dev/tests/artifacts/geometry-review.png` 與 `geometry-settings.png`。

另以實際介面操作驗證 Copy JSON、Reset、選取 JSON 實檔匯入後恢復 Input Gain 1.25；匯出的測試 Preset 位於 `dev/tests/artifacts/ui-roundtrip-preset.json`。WE 模式仍以模擬宿主測試，內嵌瀏覽器的下載落地與 file:// 啟動未完成驗證。

Lyrics 輪：Node 20 項、Chromium 182 項通過，包含原 B/C、Cover、Settings、Geometry 測試。新增 parser、binary seek、offset、雙語 exact／tolerance／缺句／多句、共用慣性動畫、UTF-8 CJK／Latin 排版、38 控制項雙向同步、Preset 向後相容／原子拒絕，以及合成低頻 WAV 實際播放下的背光有界性與強度反應。結果在 `dev/tests/artifacts/lyrics-results.txt`；四種靜態排版可開啟 `/dev/tests/lyrics-review.html`，截圖為 `dev/tests/artifacts/lyrics-review.png`。此測試頁不由產品入口載入。

圖片背景／歌詞高亮修正輪：Node 21 項、Chromium 193 項全部通過，新增背景控制項、位移／不透明度／模糊／底色、原尺寸設定更新後保留位置、Preset／Reset／有限數值驗證、WE 設定隔離，以及實際低頻 WAV 驅動的 Primary computed text-shadow 變化與關閉背光檢查。記錄在 `dev/tests/artifacts/background-glow-results.txt`，介面截圖在 `dev/tests/artifacts/background-settings.png`。FFT 與原 listener 雜湊維持不變。

歌詞顯示行為輪：Node 23 項、Chromium 211 項全部通過。新增 intro 完全隱藏、Current／Next 同時入場、單行歌曲、精確省略號與 bilingual 忽略、間奏 phase seek／停止、音訊播放結束時整個 stack 往上離場、離場完成 hidden、快速 Seek 取消離場及 Seek 到歌曲結尾直接隱藏。結果在 `dev/tests/artifacts/lyrics-behavior-results.txt`；`/dev/tests/lyrics-behavior-review.html` 僅用於靜態歌詞狀態排版，截圖在 `dev/tests/artifacts/lyrics-behavior-review.png`。沒有新增 Lyrics Settings 或 Preset 欄位。

初次 Chromium 校準：60、1000、10000 Hz，peak amplitude 0.1／0.5／0.8，兩種取樣率共 18 組。未飽和輸入的頻帶向量 L2 分別為 0.1500、0.7500；高輸入逐帶限幅到 1。60 Hz 的 0.8 輸入可觸發原 `1.15` 震動門檻。L2 是整組頻帶的檢查量，不是每格輸出值。

來源：

- https://docs.wallpaperengine.io/en/web/audio/visualizer.html
- https://webaudio.github.io/web-audio-api/#fft-windowing-and-smoothing-over-time

保留原 MIT License 與 Karteek Suryadevara||V3ng3nc3（2017）copyright。已移除原 1.webm／2.webm／3.webm、preview.jpg、font/；不新增第三方素材。使用者本機音訊、圖片與歌詞不屬於隨附資產，權利由使用者自行確認。

