# WaveCanvas 開發指引

## 位置與語言
- 開發 repo：`GitHub-Publish-Package/repo-public`（`origin` 為 `zero7372/WaveCanvas`）。外層的 `repo/` 不是開發來源。
- 說明與 commit message 用繁體中文（台灣用語）；識別字維持英文。

## 測試
| 指令 | 內容 | 需要 |
|---|---|---|
| `npm test` | Node 單元測試，CI 會跑 | Node |
| `npm run browser:test` | Electron 內的瀏覽器回歸測試 | Electron、視窗環境 |
| `npm run export:test` | 匯出流程 QA | Electron、`vendor/ffmpeg` |
| `npm run export:test:real` | 完整 1080p60 真實匯出 | 同上，耗時較久 |
| `npm run release:build`、`npm run release:check -- --public` | 打包與公開發布閘門 | 完整 GPL 原始碼 ZIP |

## 介面結構
- 設定的分組、順序和顯示名稱集中在 `app/layer-structure.js`；既有控制項由各 `*-ui.js` 建立後，`app/wavecanvas-shell.js` 依這份清單移到圖層。新增設定時要加進清單，否則使用者看不到。
- 只在部分排列有效的列，用 `data-layout-hidden` 隱藏（`app/inspector-ui.js`），不要動 `hidden`，那是條件顯示在用的。
- 排列之間各存一份的設定列在 `app/factory-layout-defaults.js` 的 `propertyKeys`，其餘共用。

## 容易踩到的地方
- **原始碼雜湊測試：** `dev/tests/fixtures/baselines/*-protected-hashes.json` 用 SHA256 鎖住部分模組（`main.js`、音訊、歌詞繪製、Timing Editor 等）。真的需要修改時，把檔案加進對應測試的略過清單，註明原因，並補上行為測試；不要直接更新雜湊。
- **版本號：** 一律讀 `package.json`，發布文件名稱跟著版本走（`RELEASE-NOTES-<version>.md`、`WaveCanvas-<version>-GPL-Source.zip`）。
- **匯出時間軸：** 匯出使用虛擬時鐘（`app/export-clock.js`），不能依賴 `requestAnimationFrame` 的實際時間或動畫事件。
- **相容性：** `.waveproj` 與 Preset 都是 v1。新增欄位必須可省略，舊檔案讀取後的輸出要維持不變。
- **`main.js`：** 來自上游（MIT），除非必要不要重構。

## 歷史資料
- `dev/release-source/` 是 GPL 準備階段的舊資料，內容仍標示 `BLOCKED`，不代表目前發布狀態；目前的來源是 `licenses/FFmpeg/SOURCE_MANIFEST.json`。
- `dev/reports/archive/` 是已封存的證據，不要改寫。
