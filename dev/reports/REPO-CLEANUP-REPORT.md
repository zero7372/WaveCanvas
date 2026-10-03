# Repository cleanup / maintenance

2026-10-03。只清理明確 generated/disposable outputs，整理 fixtures、工程文件與維護入口；沒有修改產品功能。

## Before size

Logical bytes（含 ignored files、不跟隨 links）：[before snapshot](archive/repo-cleanup-2026-10-03/before-size.json)。刪除前 Git working tree clean，HEAD `031f81868dfd40c35cb612aeb3a5c3bd5b0f05b3`。

| Directory | MiB |
|---|---:|
| Total | 3136.202 |
| app | 1.902 |
| electron | 0.042 |
| vendor | 200.960 |
| dev | 1478.543 |
| dev/tests | 1054.803 |
| dev/tests/artifacts | 1054.501 |
| dev/reports | 0.133 |
| dev/downloads | 423.422 |
| node_modules | 449.043 |
| dist | 688.445 |
| .git | 82.875 |
| .electron-cache | 150.679 |
| .npm-cache | 69.433 |
| .electron-builder-cache | 14.101 |

Nested paths overlap，不相加為 total。前次569.98MiB是win-unpacked build size；此處dist688.45MiB還包含其他generated build內容，因此兩者不矛盾。

## Deleted

明確 whitelist：dist、dev/tests/artifacts、dev/downloads、.electron-cache、.npm-cache、.electron-builder-cache。所有絕對路徑先驗證位於本repo且不是reparse point，再用PowerShell LiteralPath刪除。沒有git clean/reset，也沒刪node_modules/.git/vendor。

downloads的重複FFmpeg zip/解壓ffplay/ffmpeg/ffprobe可刪，是因正式vendor LICENSE/README/BUILD/provenance仍完整，兩個runtime SHA256与BUILD逐項核對通過。未更換build。

## Kept

保留全部產品app/electron、vendor、node_modules、tests、Factory fixtures、milestone reports、仍可重跑的benchmark/audit/generator tools。

## Moved

**10個實際測試依賴**從artifacts移至dev/tests/fixtures/baselines：5個protected-hashes JSON、linear-cover geometry/schema before、square geometry before、index-before.html、timing-editor-before.js。先copy並SHA256核對，再更新test paths與baseline HTML base/script paths。刪除前Node106/106通過。它們現在正式Git追蹤，不再靠ignored舊輸出存在。

選擇100個小型historical evidence files，共769182 bytes，保留於[archive inventory](archive/milestone-evidence/index.json)。重要aggregate只移除大幅frame state/payload，明確標為compacted；metrics與comparison保留。不留大型MP4、profile或CPU trace；小型已有報告引用的images/text仍可留。大型影片連結改成「歷史generated output已清除」，沒有偽裝影片仍存在。

舊classification manifest仍保留原original/sha256；moved fixture記previousDestination，明確disposable records標removed-generated-during-cleanup/evidenceArchive。Classification test保持retained source/fixture byte protection，報告文件允許維護；不是移除全部保護assertions。

## .gitignore changes

原本已忽略node_modules/dist/artifacts/downloads及三個repo-local cache；補*.log及root temp/output/screenshots。沒有忽略reports/tests/vendor/license/provenance/package-lock。

## README changes

README重寫成12個維護入口sections：Project Overview、Development Setup、Run、Test、Build、Repository Structure、Project System、Video Export Architecture、Preferences、Known Limitations、Maintenance Notes、Release Preparation Notes。

明確區分已完成能力與未實作NVENC/4K/Installer等；記錄reference benchmark與GPL development build/release compliance待辦。保留security/deterministic/compatibility/FFT maintenance規則，未全面改產品文件語言或UI。

## Dead reference fixes

reports本體未移動或刪除；artifact clickable links改archive，無法保留的輸出改歷史註記；舊scripts/、tests/*.html路徑修正。新增preferences:test、preferences:test:build、browser:test、build:audit、repo:size scripts。現有全部integration/benchmark tools保留維護價值，沒有移除仍被引用的工具。Build audit現在會自行建立output parent，避免fresh cleanup後build失敗。

新增audit-repo-size與audit-maintenance helpers：前者read-only size inventory；後者檢查README/reports local links、package command targets與baseline entry。One-off cleanup preparation script執行完即刪，不留死工具。

## Tests

| Suite | Result |
|---|---|
| Node | 106 PASS / 0 FAIL，最後一次於 artifacts 再清除前執行 |
| Project integration | 51 PASS / 0 FAIL |
| Electron development | 48 PASS / 0 FAIL |
| Electron packaged | 48 PASS / 0 FAIL |
| Export short regression | 32 PASS / 0 FAIL；含重複匯出、determinism、取消、錯誤、layouts |
| Preferences | 28 PASS / 0 FAIL |
| Browser | 589 PASS / 10 FAIL；10項label逐項與Phase2A基準一致，沒有新增failure |

原始log與小型validation JSON保存在 [cleanup evidence](archive/repo-cleanup-2026-10-03/)。大型影片、frame states與本輪重新產生的artifacts在驗證後再次清除。

首次Project/Electron回歸暴露了initial dependency scan漏掉dev/tools裡的timing-review.wav引用；原generated WAV已刪，沒有宣稱找回原檔。改為正式追蹤的synthetic integration-tone.wav（PCM16 mono/8000Hz/30s/220Hz），兩個helper使用它做import/seek/project references測試；其生成參數與用途記於fixtures/README.md。最終回歸均通過。Preferences首次有1項confirmation後立即assert的async timing failure；helper等待草稿checkbox完成更新後，再保留原「尚未persist」assert，最終28/28通過。產品Preferences流程未修改。

app/、electron/、vendor/相對031f8186沒有任何diff，所有產品功能、Project format、export architecture保持原狀。

Maintenance link/script audit通過（24份Markdown／46個local links）。Git whitespace check通過，僅排除原樣歸檔的FFmpeg nvenc-help.txt：該歷史命令輸出原本帶trailing spaces，為保留證據不改寫其內容。

## Rebuild

刪除舊dist後重新執行electron:build，成功產生dist/win-unpacked/WaveCanvas.exe。首次sandbox build無法下載缺少的builder tools（EACCES）；在已授權的host build環境重跑成功。Allowlist為88 entries／569.94MiB，未包含dev或node_modules；packaged Electron48/48通過。完整dist另含builder metadata，約569.95MiB。

## After size

刪除後、驗證前：[after-delete snapshot](archive/repo-cleanup-2026-10-03/after-delete-size.json)，736.465MiB。驗證後再次清除generated artifacts與repo-local caches，保留fresh rebuilt dist與小型工程證據；[after snapshot](archive/repo-cleanup-2026-10-03/after-size.json)記錄最終檔案集合（commit前量測，Git新增objects有少量容量差）。

| Directory | MiB |
|---|---:|
| Total | 1307.438 |
| node_modules | 449.043 |
| vendor | 200.960 |
| app + electron | 1.944 |
| dev（含docs/tests/tools/fixtures/archive） | 1.998 |
| dist（fresh rebuilt） | 569.951 |
| .git（含已stage的新objects） | 83.406 |
| artifacts / downloads / repo-local caches | 0 |

## Space saved

以before3136.202MiB與after1307.438MiB計算，减少1828.764MiB（58.311%）。此數字包含重新build的dist及已stage的Git objects，不以中途刪除後736.465MiB冒充最終結果。

## Known remaining large directories

node_modules保留供主要開發機開發；vendor包含正式FFmpeg；.git保留工程歷史；final dist是本輪rebuild驗證輸出。沒有壓縮Git歷史、換vendor build或清系統全域cache。使用者repo外projects/media/SRT/LRC/AppData settings/backups均未修改。
