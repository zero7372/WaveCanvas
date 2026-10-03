# WaveCanvas

[English](README.md) | 繁體中文

用來製作音樂視覺化、歌詞影片，以及隨音樂同步變化視覺效果的 Windows 桌面工具。

## 為什麼做 WaveCanvas？

WaveCanvas 是一個很典型的 vibe coding 專案。

我在網路上看過不少 Music Visualizer Online、音樂視覺化與歌詞影片相關工具，但很多工具對我來說功能太多、操作也偏向專業工作流程。

而如果真的要做到那麼細，我自己反而會直接去用 After Effects。

所以我最後決定乾脆做一個比較簡單、直接的工具——可以載入音樂、做視覺化、放歌詞、調整時間，然後直接輸出影片，不需要先學一整套複雜的工作流程。

WaveCanvas 一開始就是以「簡單、易用、我自己會願意打開來用」為優先，因此有些操作邏輯可能還不夠完美，也可能有一些地方跟傳統影音軟體的設計不太一樣。這個專案一直以簡單、實用為主，沒有打算變成完整的專業剪輯軟體。

這個專案大量透過 GPT 與 Codex 協助開發。從原型、架構、除錯、測試，到後來的專案系統、影片輸出與發布流程，都是在不斷迭代中慢慢完成的。產品方向，以及要做什麼、不做什麼，仍由我自己決定。

1.0 並不代表 WaveCanvas 已經完美，只代表它終於到了我願意正式發布、自己也真的會拿來使用的程度。

後續我會慢慢繼續修改、修正不合理的地方，並加入真正值得做的功能。

## 功能

- 音樂視覺化版面，支援 Circle、Square、Linear 樣式。
- 雙語歌詞、LRC 與 SRT 匯入，以及 Timing Editor 時間編輯器。
- Song Info 歌曲資訊、背景圖片模式與預設樣式。
- `.waveproj` 專案，支援儲存／另存新檔、自動儲存、備份與最近開啟的專案。
- Collect Project：將外部素材複製到方便搬移的專案資料夾。
- 列出系統已安裝的字型。
- 固定時間軸的 MP4 輸出：H.264／AAC、1920×1080、60 fps。
- Windows 安裝程式，支援英文與繁體中文安裝介面。

## 安裝

請從 [Releases](https://github.com/zero7372/WaveCanvas/releases) 下載 **WaveCanvas-Setup-1.0.0.exe**。1.0.0 版本適用於 Windows x64。

安裝精靈可以選擇安裝資料夾，以及是否建立桌面捷徑。安裝介面支援英文與繁體中文，會建立開始功能表捷徑，並將 `.waveproj` 檔案關聯至 WaveCanvas。解除安裝會保留專案與應用程式設定。

**目前安裝程式尚未簽章。** 因此 Windows 可能顯示 SmartScreen 或「未知的發行者」提示。1.0.0 版本尚未配置程式碼簽章。

安裝程式支援英文／繁體中文；應用程式本身的在地化尚未完成，目前介面中仍有中英混用的內容。

## 快速開始

1. 建立或開啟專案。
2. 載入音訊檔案。
3. 選擇視覺化版面，調整外觀與背景。
4. 視需要匯入或編輯歌詞與時間。
5. 預覽音樂與視覺效果。
6. 輸出 MP4 影片。

## 專案檔案

`.waveproj` 會保存專案狀態、媒體路徑、編輯過的歌詞與時間，以及視覺設定。儲存／另存新檔、自動儲存、備份與最近開啟的專案，讓你之後可以繼續編輯。

專案會參照媒體檔案。**Collect Project** 會複製外部素材並更新參照，建立較方便搬到其他電腦的資料夾結構。它不會建立 ZIP 封裝，也不會內嵌字型；搬移時請保留完整的收集資料夾，並在目標電腦安裝需要的字型。

## 支援的輸入格式

- **音訊：** WAV、MP3、FLAC、OGG、M4A、AAC、Opus。
- **歌詞：** LRC、SRT。

## 影片輸出

目前的輸出格式為 **MP4，H.264 影片搭配 AAC 音訊，1920×1080、60 fps**。

WaveCanvas 透過專用、固定時間軸的渲染流程輸出影片，不是錄製畫面上正在顯示的編輯器視窗。輸出採用固定時間軸與 CPU H.264 編碼器。

## 從原始碼建置

請在 Windows x64 上，從 repository 根目錄執行以下指令。開發基準為 Node.js 24.14.0／npm 11.9；Electron 與 electron-builder 的版本固定於 `package-lock.json`。

```powershell
npm ci
npm run electron:start
```

建置未封裝成安裝程式的桌面應用程式：

```powershell
npm run electron:build
```

輸出位於 `dist/win-unpacked/`。請保留整個資料夾；執行檔需要相鄰的執行階段檔案。

建置安裝程式並檢查發布檔案：

```powershell
npm run release:build
npm run release:check
npm run release:check -- --public
```

安裝程式輸出為 `release/WaveCanvas-Setup-1.0.0.exe`。公開發布檢查也需要完整且相符的 GPL 原始碼 ZIP 與原始碼中繼資料；只建置安裝程式不會自動備妥所有對應原始碼。現有指令與原始碼交付要求請參考 [controlled FFmpeg 建置說明](dev/ffmpeg-build/README.md)及 [GPL 原始碼檢查表](RELEASE_GPL_SOURCE_CHECKLIST.md)。

Node 回歸測試使用 `npm test`。獨立的瀏覽器測試使用 `npm run browser:test`；既有紀錄包含 10 項已知失敗（589 項通過）。依照 [controlled rebuild report](dev/reports/CONTROLLED-FFMPEG-REBUILD-REPORT.md)，隨附的 1.0.0 發布檔案已通過 Technical RC、GPL source gate 與公開發布檢查。可攜發布套件未包含未封裝的建置輸出，重新執行完整發布檢查時需要這些檔案。

## 授權

WaveCanvas repository 採用 **MIT 授權**，包括原先衍生自 MIT 專案的部分。[License.txt](License.txt) 保留 **Karteek Suryadevara／V3ng3nc3** 的原始著作權聲明與 attribution。

隨附的獨立 FFmpeg／ffprobe 執行階段另有授權：包含 x264 的 controlled FFmpeg build 採用 **GPL-3.0-or-later**。WaveCanvas 透過獨立程序呼叫這些執行檔。它們的授權不會取代 repository 的 MIT 聲明。

**WaveCanvas-1.0.0-GPL-Source.zip** 與相符的安裝程式會在 [同一個 GitHub Release](https://github.com/zero7372/WaveCanvas/releases/tag/v1.0.0) 提供，並附上 `RELEASE-HASHES.txt`。ZIP 包含固定版本的 FFmpeg、x264、zlib 原始碼、建置流程、manifests、hashes 與授權全文。第三方 attribution 與執行階段授權細節請參考 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 已知限制

- 安裝程式尚未簽章；Windows 可能顯示 SmartScreen 或「未知的發行者」提示。
- 應用程式在地化尚未完成。
- 目前輸出格式固定為 1080p60 H.264／AAC。1.0 不提供 4K、HEVC、AV1 或正式 GPU／NVENC 輸出。
- 部分操作流程與傳統影片編輯器不同。
- 1.0 尚未提供外掛與雲端同步。

## 致謝

- **Karteek Suryadevara／V3ng3nc3**：原先衍生自 MIT 專案的作品；原始著作權與授權聲明均保留。
- **GPT 與 Codex**：協助設計、實作、除錯與測試的 AI 開發工具；產品方向與決策由專案作者主導。
- **FFmpeg**：音訊處理與影片編碼執行階段。
- **x264**：controlled FFmpeg build 中的 H.264 編碼器。
- **zlib、Electron 與 Chromium**：支援函式庫與桌面執行階段；發布內容包含其授權聲明。
