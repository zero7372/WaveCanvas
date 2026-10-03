# App Polish & Preferences v1

完成日期：2026-10-03（Asia/Taipei）。範圍只有 app preferences、專案命名、Save/Collect default filename 與 autosave scheduler；未更動 Preview/FFT/listener、Preset、encoder 或 Phase 2A capture。

## Git

- Phase 2A commit：`e39de7528326fa58ea9fc0307928911107246f8d`，`Optimize deterministic video export capture pipeline`。
- 原 baseline：`a09cc58179a4af2d153cdda8783492e1fcd2bf0c`，未 amend/squash/reset。
- Preferences commit：本報告與實作共同收錄在獨立 `Add project naming and Preferences v1` commit；其完整 SHA 由 `git log -1 --format=%H --grep="^Add project naming and Preferences v1$"` 查得，完成訊息亦直接提供。報告不嘗試把自身 commit SHA 寫進自身內容。
- Phase 2A diff 在開工前與上一輪已驗證檔案核對後才提交；沒有其他來源的變更。未清理 artifacts/downloads/dist/cache 或使用者資料。

## Settings schema / storage / atomic save

Canonical defaults：`app/app-settings.js`。JSON：

```json
{
  "format": "wavecanvas-settings",
  "version": 1,
  "project": {
    "askNameOnCreate": true,
    "autosaveEnabled": true,
    "autosaveIntervalMinutes": 5
  }
}
```

Main 的 `settings-store.cjs` 使用 `app.getPath('userData')/settings.json`，實際路徑由 Electron 決定，不 hardcode username，也不寫到 repo/.waveproj。Recent 仍是獨立 recent-projects.json。

不存在檔案時只回傳 defaults，不建立檔案。Invalid JSON/未知版本不 crash；合法 envelope 的有效欄位保留，其餘逐欄 fallback，未知欄位忽略並警告。更新時嚴格驗證窄 patch，不接受 raw path、fs 或任意 IPC。修改操作依序排隊，避免 concurrent patches 遺失。

保存沿用 `atomicWrite`：同資料夾 exclusive temp → write → fsync → close → rename replace。失敗保留原檔並清理本次 temp，沒有 rolling backups。失敗不套用 renderer settings；UI 顯示錯誤並可重試。

`settings-ipc.cjs` 只允許 primary window 的 main frame sender，get/update/reset 與 changed event。Preload 只 expose 方法，不 expose fs/path/ipcRenderer。contextIsolation=true、sandbox=true、nodeIntegration=false 保持。

## Preferences UI

File → Preferences…，只有 Project 三項實際有 backend 的設定。沿用現有 surface/text/accent CSS variables 與標準 HTML dialog，沒有新 framework/design system。

Cancel/Esc/關閉只捨棄本次草稿；Save 成功才 persist + apply。Autosave Off 時 interval disabled。Restore Defaults 先開簡單確認，只改 dialog 草稿，仍須 Save；不清專案、Visualizer、Recent 或 backups。保存途中防止關閉以避免假 Cancel，失敗顯示 status。

## New Project / Rename

Ask On：New Project 先顯示共用 Project Name dialog。初始 input focus/select，Enter submit、Esc cancel；blank/全空格/控制字元/超過128 Unicode code points 拒絕，合法文字 trim。New 有「稍後命名」→ Untitled，Rename 沒有 skip。

New cancel 不建立、不改 project/view；確認名稱後仍經原 unsaved Save/Don't Save/Cancel guard 才替換 session。Ask Off 直接 Untitled，但 guard 保持。Browser 沿用原簡單 New fallback，無第二套 LocalStorage preferences。

File → 重新命名專案…，更動 metadata.name，更新 title、mark dirty；不 rename/move 檔案。相同名稱不額外 dirty。`projectName` 是 controller state 的顯示名稱 alias，`projectPath` 仍可 null；名稱不代表已存檔。

## Serialization / legacy fallback / filename

沿用 `.waveproj` `format=wavecanvas-project, version=1, name`，沒有 bump。舊專案缺少 name 時在 Main open 以 .waveproj filename basename fallback，無 basename 才 Untitled；下次 Save 正式保存 name。

Canonical dirty comparison 包含 name + state，忽略 identity/timestamps。Preferences 不在 serializer，也不 dirty project。Title：`<Name> — WaveCanvas` / `<Name> * — WaveCanvas`。

第一次 Ctrl+S 仍是 native Save As。Save As 每次以 sanitize(name)+.waveproj 作 default；已有 path 時保留目前資料夾，但不強迫使用舊 basename。選擇 `final-v3.waveproj` 不覆蓋 display name，也不推測 audio basename。

`project-names.js` 的 sanitizer 移除 `< > : " / \\ | ? *`/控制字元，移除尾端 dot/space，Windows CON/PRN/AUX/NUL/COM/LPT reserved names 加底線，空結果→WaveCanvas Project。Filename bounded128 UTF-16 units、不拆 emoji surrogate；display name 原值不受影響。例：My Song: Final? → My Song Final.waveproj。

## Collect / Recent

Collect 新 folder 與 .waveproj 使用同一 sanitized display name，原 collision suffix/copy/missing-media/copy-only semantics 保持；內嵌 name 不變。Recent 以保存的 project.name 更新，在成功 Open/Save/autosave 時同步；Home 只讀 recent cache，不大量讀 project files。

## Autosave / timer lifecycle

`autosave-scheduler.js` 控制單一 timer：同設定不重建；interval 改變先 clear 再 set；Off clear；re-enable 重建；pagehide dispose，dispose idempotent。Interval1/3/5/10/15分鐘，預設值只定義於 schema。

仍只有 saved path + dirty + 非 busy/saving/exporting 才 periodic write。從未儲存的具名專案也不 autosave、不建立 temp/recovery。Off 不刪 backup、不停 manual save/dirty/close guard；controller 的 explicit autosave 也檢查 enabled。每 project 保留10 backups，backup failure/retention 舊行為保持。

## Tests / packaged build

測試全部使用 isolated temp/profile userData；UI integration 使用 inspector harness 與 Chromium keyboard events，不 ship test hooks。

| 檢查 | 最終結果 |
|---|---|
| Node | 106/106 |
| Preferences / naming UI development | 28/28 |
| Preferences / naming UI packaged | 28/28 |
| Project development / packaged | 各51/51 |
| Electron development / packaged | 各48/48 |
| Export full integration QA | 32/32；兩次各300 frames，Preferences 在中間改變 |
| Packaged real project short export | 7/7；H.264 / 1080p60 / AAC / 300 frames |
| Browser | 589 PASS / 10既有 FAIL，與Phase 2A failure labels完全一致 |
| Build | 88 entries / 569.98 MiB；allowlist通過，無dev/node_modules |
| Syntax / diff whitespace | 通過 |

Artifacts：[UI development](../tests/artifacts/preferences-development-1791022512556/results.json)、[UI packaged](../tests/artifacts/preferences-packaged-1791022843709/results.json)、[Project development](../tests/artifacts/project-development-1791022516885/results.json)、[Project packaged](../tests/artifacts/project-packaged-1791022855430/results.json)、[Export QA](../tests/artifacts/export-development-1791023024796/results.json)、[export determinism](../tests/artifacts/export-development-1791023024796/determinism.json)、[packaged export](../tests/artifacts/export-packaged-1791022920998/)、[Browser comparison](../tests/artifacts/browser-regression-1791022644306/phase2a-comparison.json)。其他完整log在dev/tests/artifacts/preferences-*.txt；全部被Git ignore但保留磁碟。

Settings tests涵蓋missing/valid/partial/invalid JSON/invalid enum/version、atomic failure、concurrent writes、reset、restart與isolated userData。Controller fake timers測saved/unsaved/clean/dirty、5→1分鐘、Off/manual save/re-enable與dispose，scheduler standalone測不重複timer；原backup retention10份與錯誤保護仍通過。UI測Enter/Esc/focus、trim/blank/later/Ask Off、Rename dirty/path、Save As default/名稱不被檔名覆蓋、Collect、Recent、legacy缺name與process restart。打包版Preferences/Rename畫面另做目視檢查，無裁切、焦點outline與按鈕層級正常。

Export新增Preferences change前後snapshot完全相等的assertion，輸出SSIM=1，samples/lyrics exact，完整畫面原容差通過。Phase 2A capture / clock / Stage / pixel helper與FFT/listener檔案相對e39de75的diff為空，未重新聲稱本輪跑過3612幀效能benchmark；本輪要求的300幀實際走同一正式optimized capture。

首次與重跑的舊strict Canvas PNG byte equality各有frame60失敗，保存於[initial](../tests/artifacts/export-development-1791022587014/results.json)、[repeat](../tests/artifacts/export-development-1791022863406/results.json)，其完整composite僅1 channel差1/255、SSIM=1；這是Phase 2A已記錄的rounding。為避免只靠反覆執行直到剛好byte-equal，本輪明確維護QA：samples/lyrics仍exact，Canvas額外decode像素比較，使用**原本full compositor max1/255、changed<0.1%**門檻，完整compositorassertion不變；`pngBytesEqual`另保存diagnostic。不是更動renderer、encoder或放寬full Stage容差。最終32/32包含新增3個decoded Canvas checks。

Browser current套件432/10，其餘5個專項全部通過；逐項與前輪Phase 2A已保存的同套件結果比較，10項failures相同。沒有把已知failures誤報全綠，也沒有順便修改舊defaults/Square/Recent行為。

## Known limitations

- Preferences v1 只有指定三項；沒有 Theme/Language/GPU/Export quality 等假設定。
- 主 Browser suite 的10項 baseline failures 仍需另案維護期待值；本輪比對 labels，沒有為此改舊 defaults/Square 行為。
- Chromium exact Canvas PNG bytes 有上一輪已知的極少量1/255 rounding 不穩定性；完整 composite 使用原容差，不放寬。
- Autosave 是既有專案檔的定時保存與10份 previous-file backup，沒有新增 never-saved recovery、cloud sync 或 crash recovery。
- Native dialog 的最終路徑仍由使用者選擇，且 filesystem permission/長完整路徑錯誤由既有 save error handling 回報。
- 初次 UI harness 的 Enter 事件缺少 Chromium text dispatch、dialog close event 未等待、截圖未等待 paint 均屬測試工具問題，修正後重跑；未加入正式 app 的特殊測試入口。

完成後停止，未做 Repo Cleanup、Installer、File Association、FFmpeg licensing、NVENC/HEVC/AV1/4K、Plugin、full i18n。
