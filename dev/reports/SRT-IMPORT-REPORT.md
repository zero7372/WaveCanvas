# SRT Import 技術報告

本輪只新增 SRT 匯入，不增加套件。既有 LRC parser、Lyrics renderer、Timing Editor、Audio／FFT、Geometry 與 Preset 程式保持原樣；新增來源格式資訊透過現有 Lyrics Runtime 傳到 UI。

## 1. Parser / Adapter

- `srt-parser.js`：獨立解析 SRT 時間、序號、文字及 warning，無 DOM 或播放依賴。
- `lyrics-import.js`：統一驗證 `.lrc`／`.srt` 與檔案大小，依副檔名選擇 parser；既有無副檔名的程式呼叫仍視為 LRC。
- `timing-model.js`：將 SRT cues 轉成既有可編輯 document，不另建 renderer。

## 2. Internal Model

時間以整數毫秒表示，`00:00:12,500` → `timeMs: 12500`。按起始時間排序，同時間依原 cue 順序排序。SRT event ID 使用來源軌與原 cue 順序，例如 `primary-srt:0`，重複匯入相同內容時 ID 穩定；document ID 仍每次更新，供既有換檔／歷史清除機制辨識。

```json
{
  "sourceFormat": "srt",
  "events": [{
    "id": "primary-srt:0",
    "source": "primary",
    "timeMs": 12500,
    "lines": ["Hello world"],
    "rawText": "Hello world",
    "type": "lyric",
    "sourceCue": {
      "sourceFormat": "srt",
      "sequence": 1,
      "sequenceRaw": "1",
      "order": 0,
      "startTimeMs": 12500,
      "endTimeMs": 15200,
      "rawLines": ["<i>Hello</i>", "world", ""]
    }
  }]
}
```

## 3. 起訖時間保存

`event.timeMs` 是目前可編輯的 start time；`sourceCue.startTimeMs`／`endTimeMs` 是原始匯入資訊。校時不修改 sourceCue，snapshot 深複製 rawLines，避免外部讀取者意外改動來源。Renderer 忽略 endTime；字幕跨空隙仍持續到下一句，最後一句到歌曲結束才離場。原 endTime 可能因校時而早於目前 start time，這代表原始資訊，並非新的字幕 duration。

## 4. 多行文字

每行 trim、忽略空行，以空格合併成一個 lyric event，保留所有非空文字。序號與時間行不進入文字。原文字行保存在 sourceCue.rawLines。

## 5. Markup 清理

清除 `<i>`／`<b>`／`<u>` 等 tags，`<br>` 轉空格；解碼常見與數值 HTML entities，無效 code point 轉 replacement character。沿用現有純文字 DOM 顯示，不執行 HTML 或字幕樣式。

## 6. Primary / Secondary

轉成 Timing document 後沿用 `toParsed()` → 既有 merge → 既有 renderer。LRC+LRC、SRT+LRC、LRC+SRT、SRT+SRT 均支援。容差、兩軌 offset、缺句及同時間處理維持原規則。Primary 決定 timeline；Primary 清理後精確等於 `...` 才啟用既有間奏，Secondary 的 `...` 不改事件類型。

## 7. Timing Editor

雙軌直接進入原編輯器。拖曳、fine adjust、manual timestamp、Undo／Redo 僅更新 timeMs；zoom、fit、播放頭、follow 與 waveform 不依來源格式分支。未新增 end-time 操作。

## 8. LRC Export

原 serializer 使用目前 timeMs 與清理後文字產生 UTF-8 LRC。SRT 可匯入後另存 LRC，既有下載名稱以 `.lrc` 結尾；不覆寫來源，不新增 SRT Export。Preset 不包含 sourceCue、字幕內容或來源檔案，version 不變。

## 9. Error Handling / 限制

- 使用 File.text() 支援 UTF-8／BOM；無 legacy encoding detector。
- 支援 LF／CRLF、額外空白行、缺失／不連續序號、相鄰時間塊及末尾沒有空行。
- 不合法時間、倒置起訖、空 cue 各自跳過並累積 warning；全部無有效 cue 時 throw，由原 UI catch 顯示錯誤，原 document 保留。
- 最多 1 MB／10,000 cues，start time 不超過既有 Timing 上限 599999999 ms。
- 非標準定位附加語法、VTT／ASS、字幕樣式及 end-time renderer 均不支援。
- 測試使用合成 UTF-8 SRT，尚未以使用者實際剪映輸出檔案做人工驗收。
- 瀏覽器已驗證 LRC 下載 Blob 與檔名；未確認下載檔案實際落地。

## 10. 驗證結果

`node --test tests/srt.test.cjs tests/lyrics.test.cjs tests/timing.test.cjs`：24/24 通過。涵蓋標準 SRT、毫秒與小時、BOM／換行、多行／markup、空 cue、無序號／不連續序號、invalid cues、排序／穩定 ID、重複時間、混合格式、tolerance／seek／interlude、retime／history／serialize 與壞檔保留原資料。

Chromium `/tests/srt-browser.html`：31/31 通過。涵蓋兩個 file input、實際 File.text() change handler、格式標籤、雙軌顯示、seek、Timing 拖曳／手動校時／細調／Undo／Redo／zoom、LRC 匯出入口、混合格式、warning、壞檔保留與 Preset 排除來源資料。捕捉的 error／unhandledrejection 為零。選檔資料由測試頁 DataTransfer 建立，不代表 OS 選檔視窗已人工驗證。

加跑背景／Inspector／Square／Templates 的 Node 檢查後，合計 46/46 通過；14 個變更 JS／CJS 的 syntax check 通過。

14 個受保護檔案的 SHA-256 比對通過，包含原 LRC parser、Lyrics renderer／CSS、Timing Editor、Audio／FFT、Geometry 與 Preset／Factory。依本輪要求未重新執行大型 Audio／FFT regression。

紀錄：`tests/artifacts/srt-results.txt`；畫面：`tests/artifacts/srt-import.png`。測試頁不由產品入口載入。

## 修改檔案

產品：新增 `srt-parser.js`、`lyrics-import.js`；修改 `timing-model.js`、`lyrics-runtime.js`、`lyrics-ui.js`、`wavecanvas-shell.js`、`index.html`。

文件：更新 `README.md`，新增本報告。不新增永久 AGENTS 規則。

驗證：新增 SRT Node／browser tests 與 artifacts；LRC／Timing 測試載入新 adapter；既有 background／inspector／square／templates 的歷史雜湊保護排除本輪授權變更檔案，原雜湊快照不改，新 SRT 保護清單覆蓋本輪不可變更模組。
