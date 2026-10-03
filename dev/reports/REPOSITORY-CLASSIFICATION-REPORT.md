> 維護註記（2026-10-03）：generated videos／暫存輸出已清除；小型證據連結改到 archive，靜態 baseline fixtures 改到 dev/tests/fixtures/baselines。下文數值為當時 milestone 實測，不代表本輪重跑。

# Repository Classification — app / dev

本輪只移動檔案、修正路徑與更新入口說明，沒有 Electron、packaging、新套件、功能或演算法變更。

## 1. 新結構

```text
Audio visualizer/
├ app/
│ ├ index.html
│ ├ *.js / *.css
│ ├ project.json
│ └ assets/templates/       三張正式縮圖
├ dev/
│ ├ tests/                 全部原測試
│ │ └ artifacts/           歷史圖片、benchmark 結果、before 快照及 fixtures
│ ├ tools/                 三個原 scripts
│ ├ fixtures/factory-defaults/
│ ├ reports/               全部原報告與 checklist
│ └ notes/repository-file-manifest.json
├ README.md
└ License.txt
```

測試的 artifacts 保持 `dev/tests/artifacts/`，不拆開原 fixture／結果引用結構；不新增沒有內容的分類資料夾。

## 2. app/

52 個原檔案：正式 HTML、全部 runtime／UI／schema／visualizer／lyrics／timing／background／preset／template JS 與 CSS、`project.json`、三張 template thumbnails。JS／CSS 不再細拆，既有相互引用保持不變。

`project.json` 是 WE 與 property schema 的來源，因此與入口保留在 app/；其 `file: index.html` 仍能指向同目錄入口。`factory-defaults-data.js` 是正式 runtime 使用的產生資料，留 app/。

## 3. dev/

133 個原檔案：全部 tests 與 artifacts、三個原 scripts → tools、全部報告 → reports、三份 Factory 原始 JSON → fixtures/factory-defaults。新增分類保留 manifest、結構 Node test、browser smoke test 與本報告。

## 4. Root

保留原 README.md 與 License.txt（MIT 全文未變）。沒有 package／lock、npm dependencies、gitignore 或 build config 可搬移；沒有新增 ignore 規則。

## 5. 路徑修正

- app/index.html 的 Help 連結 → `../README.md`；其他 script／CSS／assets 相對路徑不變。
- Node tests 的 app root → `../../app`；歷史 artifact 路徑 → `../dev/tests/artifacts/`，Factory source → dev/fixtures/factory-defaults。
- Browser fixtures 的 app 入口與 srcdoc base → `../../app/`；直接載入的 runtime script 同步修正。
- performance baseline 的 index-before.html base → `../../../app/`；其舊 Timing Editor 引用 → dev/tests/artifacts。
- 產生器讀 app/project.json、寫 app/產生資料；Factory 原始來源改讀 dev/fixtures。
- Server 從 repository root 提供內容，`/` 以 302 導向 `/app/index.html` 並保留 query；既有 loopback／目錄邊界檢查不變。
- templates.test.cjs 原本比對 repository 外的使用者縮圖來源，相對層級多一層；外部原圖未搬動。

## 6. Package Scripts

目前沒有 package.json 或 package scripts。三個既有 Node 工具改從 `dev/tools/` 執行，未新增 dependency。`generate-schema.cjs --check` 與 `generate-factory-defaults.cjs --check` 均通過。產生資料檔頭的歷史 scripts 指令註記維持原文，實際使用新 README 指令；避免改動受 hash 保護的產生資料。

## 7. README

小幅更新 app 入口、工具／測試指令、report links、Factory source 路徑與目錄說明。歷史報告中描述當時環境的文字／絕對路徑保留；需要執行舊指令時以 root README 的現行路徑為準。沒有新增永久 AGENTS 規則。

## 8. Browser Standalone

分類後在獨立 8766 loopback server 驗證，既有使用者頁面未重新載入。Smoke 14/14 通過：root redirect、47 個 JS／CSS URL HTTP 200、runtime 初始化、CSS computed style、三張模板縮圖解碼、Help 文件、Home／Editor 導覽、Audio file UI、合成 WAV 匯入／檔名、返回 Home 與保留素材。未捕捉到 error／unhandledrejection。

一般啟動仍使用 `node dev/tools/serve.cjs`（預設 8765），正式入口 `/app/index.html`。已在跑的舊 server 可直接開 `/app/index.html`；要讓 `/` 使用新導向，需以新工具重新啟動 server。file:// 與實際 WE 宿主未重新實測。

## 9. Test Harness

既有 76 項 Node 測試搬移後全部通過，未刪除或停用測試。新增 3 項結構檢查通過：逐檔保留與 runtime hashes、全部靜態 HTML 引用、README Markdown links。最終完整執行 79/79 通過；app、dev/tools 與 dev/tests 的 76 個 JS／CJS syntax checks 通過。

執行：

```powershell
node --test dev/tests/*.test.cjs
node dev/tools/generate-schema.cjs --check
node dev/tools/generate-factory-defaults.cjs --check
```

Browser smoke：`/dev/tests/repository-smoke.html`。另外重跑搬移後的 SRT targeted harness，31/31 通過；未重跑全部大型 browser regression。

## 10. 用途不確定／保留項目

沒有無法分類的原檔案。`performance-profile.js` 屬於 profiling，但正式 index 及 main/runtime 已有 hooks，因此保留 app/，本輪不拆 runtime。歷史 before JS／HTML、重複截圖、舊測試 WAV／LRC／JSON 一律保留 dev/tests/artifacts。Factory 原始 JSON 是產生／驗證來源，正式 runtime 已使用產生資料，所以來源放 dev/。

## 11. 未刪檔確認

分類前 187 個檔案逐一建立 `{ original, destination, sha256 }` manifest；分類後 187 個目的檔皆存在且無名稱衝突。全部正式 JS／CSS、assets、project.json、Factory JSON、MIT License 與未修改的歷史 artifacts SHA-256 保持一致。只允許 HTML／工具／測試中的路徑與 README 文字變更；所有原檔案皆保留。

保留 manifest：`dev/notes/repository-file-manifest.json`。驗證紀錄與畫面：`dev/reports/archive/milestone-evidence/repository-smoke-results.txt`、`repository-smoke.png`、`repository-node-results.txt`。
