# System Font Enumeration evidence

2026-10-03。僅保存metadata與小型結果；沒有font bytes/files、user project、影片、raw frame payload或test profiles。

- `enumeration-*.json`：實際Local Font Access的canonical family names、counts、permission；metadata only。
- `persistence-*.json`：installed/missing/CJK strings、dedicated export CSS、特殊名稱CSS.supports、Browser denied／empty fallback。
- `fonts-*.json`：新增integration checks。
- `project/preferences/options/electron/export-*.json`：既有回歸checks；`determinism-*.json`保留300-frame重複輸出的原pixel tolerance／SSIM。
- `browser-comparison.json`／`browser-results.json`：589 PASS／10 known FAIL及Options基準labels對照。
- `build-audit.json`：90 entries、597641627 bytes，無dev/node_modules。
- `*.txt`：command logs；`font-browser-final.txt`是最終Browser run，exit1對應既有10 failures。`font-browser.txt`是初次影像等待未完成、`font-browser-retry.txt`是停止的同條件診斷重跑；其他suite logs為最終通過結果。
- `browser-initial-occlusion.json`：初次測試中影像decode等待未完成；test-only取消遮蔽節流後專項全數恢復。

Artifact run ID/path僅作provenance；suite每次建立新fixtures，不依賴archive重跑。
