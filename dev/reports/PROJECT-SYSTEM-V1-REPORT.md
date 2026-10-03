> 維護註記（2026-10-03）：generated videos／暫存輸出已清除；小型證據連結改到 archive，靜態 baseline fixtures 改到 dev/tests/fixtures/baselines。下文數值為當時 milestone 實測，不代表本輪重跑。

# WaveCanvas Project System v1

本輪新增可讀 JSON `.waveproj`、Desktop native Save/Open/Collect、dirty-aware autosave、rolling backups、unsaved guards 與 Recent Projects。沒有改 FFT mapping、wallpaperAudioListener、Visualizer 幾何、字幕 parser、SRT/LRC 原檔或 Preset format；沒有新增套件。

## 1. Schema

```json
{
  "format": "wavecanvas-project",
  "version": 1,
  "appVersion": "0.1.0",
  "projectId": "stable UUID",
  "name": "Project Name",
  "createdAt": "ISO timestamp",
  "modifiedAt": "ISO timestamp",
  "state": {
    "settings": {
      "properties": { "originalPropertyKey": { "value": "schema value" } },
      "standalone": { "inputGain": 1, "visualizer": {}, "lyrics": {}, "background": {}, "text": {} },
      "layouts": {
        "circle": { "visualizer": {}, "properties": {}, "text": {} },
        "square": { "visualizer": {}, "properties": {}, "text": {} },
        "linear": { "visualizer": {}, "properties": {}, "text": {} }
      }
    },
    "media": { "audio": null, "cover": null, "background": null, "primary": null, "secondary": null },
    "lyrics": { "primary": null, "secondary": null }
  }
}
```

properties 保留現有 schema keys。file/directory 設定值清空；實際媒體只在 media 保存 absolute／relative reference，不保存 Blob URL 或 binary。Lyrics documents 保存 source/name/id/sourceFormat/fileOffsetMs/metadata/events，SRT 保留 sourceCue/sourceWarnings；event 保存 stable id/source/timeMs/lines/rawText/type。Layout banks 僅存原 layout 專屬 propertyKeys／Song Info position，不把全域媒體放進 bank。

## 2–4. Architecture / IPC / Save–Open

- app/project-model.js：Browser／Node 共用格式驗證、stable serialization、canonical content comparison。拒絕非法 JSON、format/version、非有限數值、不安全欄位、無效 document IDs／media URLs；專案上限 16 MB。
- app/project-serializer.js：獨立完整 Project serializer，非 Preset serializer；capture 全 runtime／layout banks／edited documents，prepare 使用現有 schema normalizers。
- app/project-controller.js：dirty、pending media registration、save/open/new/collect 交易、restore 與一個 autosave scheduler。
- app/project-ui.js：File／Project 選單、快捷鍵、狀態、Recent cards、Browser fallback。
- electron/project-ipc.cjs：只接受主 Renderer／main frame 的窄 IPC，native dialogs、媒體 reference grants、交易 tokens、close guard。
- electron/project-store.cjs：讀寫、atomic replacement、backup、copy/relative collect、recent persistence。
- electron/preload.cjs：contextBridge 暴露 waveCanvas.project；不暴露 fs、raw ipcRenderer 或任意執行。

Untitled Save 使用 native Save As；已有路徑 Save 直接保存。Save As 更新 filename/name/path/baseline，保留 identity；relative media refs 以舊專案位置 rebase，避免另存到別處後失效。Open 驗證後先準備媒體，再替換 session，edited documents 最後 restore；失敗時回復舊 session。新版 project 顯示「專案版本較新，無法由目前 WaveCanvas 開啟」。

HTML File inputs 繼續匯入音訊／圖片／字幕；Preload 用 [Electron webUtils.getPathForFile](https://www.electronjs.org/docs/latest/api/web-utils) 取得 native-backed File 的路徑，Main 驗證 slot／副檔名／檔案並授權 reference。JS 合成 File 沒有磁碟路徑，不能冒充 external media；專案載入生成的 File 由已授權 reference 關聯。readMedia 僅可讀 Main 準備交易中的 slots，不能任意 readFile。

## 5–7. Dirty / Autosave / Comparison

Runtime property／standalone settings mutation、媒體 commit/clear、lyrics document revision 都標記 dirty；150 ms debounce 以完整 canonical state 再確認。播放／Pause／Seek／動畫／Inspector／Timing zoom 不改 state，不 dirty。狀態顯示已儲存／未儲存／儲存中／錯誤；window title 為 `* Name — WaveCanvas` 或 `Name — WaveCanvas`。

一個 setInterval 固定 300000 ms，不在 Open/New 建立新 timer；pagehide 清理。只有 saved path＋dirty 且不 busy 才嘗試 autosave。第二層使用排序後的完整 state JSON 字串比較（無 hash collision），排除 metadata/name/createdAt/modifiedAt；同內容清除 false dirty，跳過 write。modifiedAt 只在真正 Save 更新。Autosave 成功後 clean；失敗保留 dirty 與低干擾錯誤，等下一 interval／manual save，不每秒重試。

## 8–10. Atomic Write / Backups

同目錄唯一 `.tmp`，exclusive create、write、fsync、close，最後 rename replacement；不 truncate/unlink 原專案。Replacement 失敗保留舊檔，清理 temporary。Manual Save 不 backup；Autosave 必須先成功 backup 才 overwrite。

`app.getPath('userData')/Backups/<projectId>/<ISO-safe-time>-<unique>.waveproj`。通常 Windows 位於 `%APPDATA%/WaveCanvas/Backups/`；真正位置以 Electron userData 為準。Backup 僅 project JSON；relative media refs 轉成原 source absolute paths，避免移到 userData 後失去 base。每次 backup 後排序保留 10 份；cleanup 失敗只 warning，不阻擋 save。Save As/Collect 同 identity 共用同一組 10 份，這是本版明確語意。

## 11–13. Guards / Lyrics / Paths

Dirty close/Open/New 都走儲存／不儲存／取消；Untitled 儲存進 Save As，取消 Save dialog 中止原操作。操作期間 editor/home inert，避免 native dialog／restore 途中變更 state。關閉 dirty 視窗先 preventDefault，Renderer 完成 guard 後 Main 才允許 close。

Timing Editor 修改後的完整 documents 保存於 `.waveproj`，不用重讀原字幕來還原。保留 stable IDs、offsets、interlude 與 SRT raw sourceCue；Undo/Redo history 不保存，restore 使用既有 document revision 通知。Audio restore 等 metadata／error／timeout，排空 emptied 通知後才 restore documents，避免新音訊把已還原字幕清掉。

Relative refs 以 project directory resolve；missing media 保留 reference，列 Missing Media 與 slot 提示，不 crash。原字幕缺檔時仍能用 embedded edited document。單純改 settings 不會消失 missing refs；缺檔 Collect 中止。

## 14–17. Collect / Collision / Switch / Recent

```
Project Name/
  Project Name.waveproj
  media/audio/
  media/artwork/
  media/background/
  media/lyrics/
```

先檢查全部 references，缺失中止；建立新目的子資料夾，只 copy 外部媒體，不收集 app/Electron/dev/builtin assets。Media filename collision 用 `_2`, `_3`，同來源同類別可共用副本；已存在 destination directory 使用新 suffix，不 overwrite 既有資料。Failed collect 僅清理由當次操作新建的子資料夾。輸出 refs 使用 `/` relative paths，原始檔案完全不寫入。

完成詢問切換／繼續目前專案；繼續保持原 current path／refs／dirty，切換 restore copied project、activate path、clean baseline。Autosave 不 copy media。

Recent 儲存 userData/recent-projects.json，最多 10 筆，path/name/lastOpenedAt/layout；case-insensitive absolute path dedupe，Open/Save/SaveAs/Collect switch 更新。Home 顯示 layout builtin thumbnail、name/path/time/open；missing recent 顯示找不到與明確移除，不自動刪除，不在 `.waveproj` 保存。

## 18. Browser / Security

Browser 沒 preload API，Project controller 不啟用、commands disabled 並標 Desktop App 功能；原媒體／Preset／LRC workflow 保留。Electron contextIsolation=true、sandbox=true、nodeIntegration=false 未變。Main IPC 驗證 sender 與 main frame，native data grants 限 slot／transaction，preload 不暴露 generic filesystem，依 [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security) 維持隔離。原 CSP 限制仍未處理，這不是正式安全稽核。

## 19–20. Tests / Scenario

Node 89/89 通過（含單一 300000 ms scheduler 跨 New/Open／pagehide cleanup、backup 10 份、原子失敗、filename collision、Recent persistence）。Project 開發 Electron smoke 51/51、packaged exe 51/51 通過。Browser 已實際確認 Project commands disabled、Circle Editor 可用、16:9、縮圖、Preset/LRC 控件與 console error=0；截圖 project-browser.png。原 Electron compatibility smoke 開發版 48/48、packaged 48/48；build allowlist 68 entries，約 368.96 MiB，排除 dev/。

Project smoke 是實際 Electron process、實際磁碟媒體／project/backups／collect copies；dialog responses 由 test-only Main inspector 控制，不打包測試 hook。跨重啟 Save/Open、edited SRT/LRC、layout banks、autosave、failure injection、collect搬移、unsaved guards 已包含。最新完整 logs／results.json 位於 歷史 generated output（project-{development；已清除）,packaged}-<timestamp>/；Node log 為 project-node-results.txt。

要求的 20 步 smoke 以自動化等效流程執行：New＋Circle，native-backed WAV/Cover/background/Primary SRT/Secondary LRC，retime，Background/Song Info，Save As，close/relaunch/open，驗證資料，修改 setting，呼叫同 autosave handler 模擬 interval，確認 backup，Collect，搬移新 test folder，reopen。不宣稱 Windows OS dialog 人工點選或實際等待 5 分鐘。

歷史 byte-hash 檢查透過 project-baseline.cjs 精確移除本輪 additive accessors／project methods／source-file notifications／CSS 後仍比對原始 hash；沒有更改歷史 expected hashes，FFT/listener/rendering/parser/sampling 的原 hash 保護仍在。

## 21. Known Limits

- Windows x64 當前機器，未簽章 Development Build；不是 installer/release。
- Native dialog 已串接，測試使用受控回傳值，OS dialog 的手動 QA 尚未執行。
- 未實際等待 5 分鐘、多小時 autosave soak、硬體 crash／斷電；測試同 handler 與 simulated write failure，不能保證硬體層完整 durability。
- readMedia 為 Main read＋Renderer Blob/File；音訊上限 1 GiB、圖片 100 MiB、字幕 1 MiB，超大音訊可能有記憶體成本。本輪無 streaming/protocol redesign。
- Missing Media 僅提示，沒有專用 Relink UI；可用原選檔入口替換。原字幕缺失仍保留 edited documents，但 Collect 需要所有 referenced sources。
- Backup absolute refs 依原媒體存在；backup 本身不含媒體，不能當完整 portable folder。
- Backup retention 按 projectId 共用，同 identity 的 Save As 副本不是獨立 backup pools。
- 只有 version 1，沒有 migration／unsaved crash recovery／ZIP／subtitle write-back。
- Video Export／FFmpeg／Installer／File Association／Plugins／Preferences／Local Profile／Cloud Sync／Custom Title Bar 未開始。

README 已更新；沒有將一次性測試決策加入 AGENTS.md。

本輪檔案：新增 app/project-{model,serializer,controller,ui}.js、electron/project-{ipc,store}.cjs、dev/tests/project.test.cjs／project-baseline.cjs、dev/tools/project-smoke.cjs 與本報告。修改 electron/main.cjs／preload.cjs、app/index.html／standalone.css、runtime-adapter.js（settings banks import/export）、local-audio.js（load accessor）、local-files.js（committed File accessor）、lyrics-runtime.js（document restore）、lyrics-ui.js（source File commit notification）、timing-model.js（reserve restored document serial，避免新匯入誤共用 document identity）、package.json、README 與歷史測試的 additive-baseline 比對。原歷史 manifest／hash 值不改；測試 artifacts 留 dev/，不打包。
