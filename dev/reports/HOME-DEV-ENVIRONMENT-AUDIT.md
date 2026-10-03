> 維護註記（2026-10-03）：generated videos／暫存輸出已清除；小型證據連結改到 archive，靜態 baseline fixtures 改到 dev/tests/fixtures/baselines。下文數值為當時 milestone 實測，不代表本輪重跑。

# Home development environment audit

日期：2026-10-03（Asia/Taipei）。專案根目錄：`H:\WaveCanvas\Audio visualizer`。

## Repository

package.json、package-lock.json、app/、electron/、dev/、vendor/ffmpeg/、README.md 與 VIDEO-EXPORT-PHASE1-REPORT.md 均存在。真實專案位於相鄰 `H:\WaveCanvas\Untitled\Untitled.waveproj`，現有正常 Project loader 可解析相對媒體路徑，無需修改原始檔。

此搬移目錄及父目錄沒有 .git；Git 可執行，但 `git status` 回傳 `fatal: not a git repository`。未自行初始化 Git 或猜測 remote；若需要原有 commit history，須從原來源補回 .git 或提供正式 clone 來源。這不阻擋現有 build/test/export。

## Hardware / software

| 項目 | 結果 |
|---|---|
| CPU | Intel Core i5-12600KF，10 physical / 16 logical cores |
| RAM | 34,175,283,200 bytes（約 31.83 GiB，可用硬體總量） |
| GPU | NVIDIA GeForce RTX 3080 Ti，12,288 MiB VRAM |
| NVIDIA driver | 616.56（Windows GPU API：32.0.16.1656） |
| Idle/context GPU sample | GPU 12%，video encoder 0%；其他桌面工作亦可能影響此值 |
| Windows | Windows 11 專業版，10.0.26300，x64 |
| PowerShell | 7.6.5 |
| Node / npm | 24.14.0 / 11.9.0；符合此 repo Electron >=22.12 要求 |
| Git | 2.53.0.windows.1 |
| Electron / Chromium | 44.5.1 / 152.0.7977.130 |
| electron-builder | 26.15.3 |
| FFmpeg / ffprobe | bundled Gyan 9.0.2-essentials_build-www.gyan.dev |
| Encoders listed | libx264、h264_nvenc |
| Python | 現有 scripts/tests 無需要；未安裝 |
| Visual C++ Runtime | Electron 與 FFmpeg 實際啟動正常；無缺 DLL 證據，未加裝 |

FFmpeg SHA256 `3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec`；ffprobe SHA256 `f0d36ecbbdd3bcfac3efa078c96c7271c2e68b3810595552ac3b7f17e9a65c52`。與 Phase 1 provenance 完全一致，未更換 binary。

## Dependency changes

執行 `npm.cmd ci --cache .npm-cache --no-audit --no-fund`：成功重新安裝 lockfile 固定的 284 packages。Electron 首次使用下載對應 binary；未升級 Node major、未修改 lockfile、未安裝系統套件。

第一次 Electron regression 在 Codex 執行沙箱內因 userData lock/crypto 與 Electron sandbox install-directory ACL 檢查失敗。於主機權限下重跑同一 command 後 48/48 成功；未改 ACL，未停用 Electron sandbox，未修改系統 execution policy。硬體 CIM 查詢也在主機權限下完成。

## Baseline smoke / build

| 驗證 | 結果 | 證據 |
|---|---|---|
| npm test | 95/95 pass | 本次命令輸出；加入診斷計時後亦 95/95 |
| npm run electron:test | 48/48 pass | dev/reports/archive/milestone-evidence/electron-development/results.json |
| npm run project:test | 51/51 pass | dev/reports/archive/milestone-evidence/project-development-1791017821484/results.json |
| node dev/tools/export-smoke.cjs | 7/7 pass，真實專案 5 秒 / 300 frames | dev/reports/archive/milestone-evidence/export-development-1791017848982/results.json |
| npm run electron:test:build（最終） | 48/48 pass | dev/reports/archive/milestone-evidence/electron-packaged/results.json |
| npm run export:test:build（最終） | 7/7 pass，正式 libx264 / 300 frames | dev/reports/archive/milestone-evidence/export-packaged-1791018392738/results.json |
| npm run electron:build | 成功；allowlist 77 entries / 569.95 MiB | dist/win-unpacked/WaveCanvas.exe；audit-electron-build output |

真實 short export 為 H.264 / 1920×1080 / 60 FPS / AAC，原專案全檔 hash/size/mtime 不變。Electron regression 驗證正常啟動、音訊、歌詞與 Project 工作流程，使用 repo 現有 smoke script。

## Manual steps

缺失關鍵開發依賴：無。需人工安裝套件：無。版本控制歷史未隨資料夾搬入，若需繼續 Git 工作應補回正式 repository metadata。

環境 gate 已通過，允許後續 GPU benchmark；NVENC 實際 1080p60 / 60-frame probe 成功，兩條 full export 均通過 3612 frames / AAC / A/V endpoint 檢查；效能與限制另記於 VIDEO-EXPORT-HOME-GPU-BENCHMARK.md。
