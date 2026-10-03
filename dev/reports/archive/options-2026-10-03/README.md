# Options v1 validation evidence

2026-10-03。此處只保存本輪最終小型結果與畫面，不包含完整 media、profiles、raw frame/progress payload 或 user projects。

- `*-development.json`／`*-packaged.json`：各 suite checks；`export-real-packaged.json` 是正式 project loader＋唯讀外部專案300-frame short export。
- `determinism-*.json`：300-frame repeated export 的 audio/lyrics exact、Canvas/compositor 原 pixel tolerance、SSIM 與 byte equality diagnostic。
- `browser-results.json`／`browser-comparison.json`：589 PASS／10 known FAIL與基準 labels 對照。
- `build-audit.json`／`vendor-hashes.json`：package allowlist、logical bytes、vendor/packaged FFmpeg SHA256。
- `options-scale-0.8.png`、`options-scale-1.png`、`options-scale-1.25.png`：最終 development UI screenshots。
- `*.txt`：各最終 command output；Browser command exit1 對應既有10 failures。
- `export-packaged-initial-injection-failure.json`：test-only mock 曾指向 development module，兩項 error injection未作用；runtimeRoot 修正後 packaged suite全套34/34。

Artifacts 絕對路徑可能保留本機測試 run ID，只作 provenance；tests 自行建立新 artifacts，不依賴本 archive。
