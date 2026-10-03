> 維護註記（2026-10-03）：generated videos／暫存輸出已清除；小型證據連結改到 archive，靜態 baseline fixtures 改到 dev/tests/fixtures/baselines。下文數值為當時 milestone 實測，不代表本輪重跑。

# Video Export Home GPU Benchmark

日期：2026-10-03（Asia/Taipei）。本輪完成環境 audit 與 benchmark/bottleneck investigation，未開始正式 Phase 2。

## Hardware

Intel Core i5-12600KF，10 physical / 16 logical cores；RAM 34,175,283,200 bytes（31.83 GiB）；NVIDIA GeForce RTX 3080 Ti，12,288 MiB VRAM；driver 616.56。

## Environment

Windows 11 Pro 10.0.26300 x64；PowerShell 7.6.5；host Node 24.14.0 / npm 11.9.0；Git 2.53.0.windows.1；Electron 44.5.1 / Chromium 152.0.7977.130；electron-builder 26.15.3；bundled Gyan FFmpeg/ffprobe 9.0.2，SHA256 與 Phase 1 相同。

環境 gate：npm ci 成功；Node 95/95、Electron 48/48、Project 51/51、真實 Export short 7/7、electron build/allowlist 通過。詳見 [environment audit](HOME-DEV-ENVIRONMENT-AUDIT.md)。搬移資料夾未包含 .git，未猜測 remote 或建立新歷史。

## Electron GPU status

app.getGPUFeatureStatus()：gpu_compositing=enabled、rasterization=enabled、2d_canvas=enabled、webgl=enabled、video_decode=enabled、video_encode=enabled。app.getGPUInfo('complete')：active NVIDIA RTX 3080 Ti；ANGLE D3D11，GaneshGL，sandboxed=true；Microsoft Basic Render Driver 為 inactive。未調整 GPU policy，未發現 software fallback。

完整 API 輸出：[libx264 GPU](archive/milestone-evidence/home-benchmark-1791017938374/gpu.json)、[NVENC GPU](archive/milestone-evidence/home-benchmark-1791018092716/gpu.json)。這些是 Chromium feature/active-device 資訊，並非單一 compositor 的 GPU 利用率量測。

## Company laptop baseline

| 指標 | Phase 1 |
|---|---:|
| Audio duration / frames | 60.186104 s / 3612 |
| Average / slowest capture | 38.564 / 165.896 ms |
| Audio analysis | 1.101 s |
| Rendering wall | 164.207 s |
| Encoder lifetime | 165.531 s |
| Final drain | 1.324 s |
| Total / realtime | 167.157 s / 0.360× |
| Dropped / peak queue | 0 / 1 |
| Electron working set | 約 1651.51 MiB |

原來源：VIDEO-EXPORT-PHASE1-REPORT.md section 24。舊測試為 packaged；本次 full A/B 為 development，相同 production modules、相同 FFmpeg bundled binary，另附少量測試觀察成本；不能單憑此跨主機差值歸因於 GPU，CPU、driver、OS、字型與系統負載亦不同。

## Home libx264 baseline / Home NVENC diagnostic

先完整跑 production libx264 medium CRF18，再跑 test-only NVENC。正常 Project loader 開啟相鄰 Untitled.waveproj；snapshot JSON A/B 完全相同，原 project/media 未修改。相同 renderer、timeline、60 Hz clock、offline analysis、1080p、AAC320k；正式 ffmpeg-runner.cjs 的 args 與 UI 預設維持 libx264。

NVENC 在 Main inspector 測試程序暫時替換 arguments：-c:v h264_nvenc -preset p6 -rc vbr -cq 18 -b:v 0 -pix_fmt yuv420p。先讀當前 build 的 [encoder help](archive/milestone-evidence/home-benchmark-1791018092716/nvenc-help.txt)，再以 60 幀 1080p60 color input 實際啟動 encoding probe 成功。未把 NVENC 加入 UI，未引入 HEVC/AV1/4K。

| 指標 | Home libx264 | Home NVENC |
|---|---:|---:|
| Source audio duration | 60.186 s | 60.186 s |
| Frames / dropped / peak queue | 3612 / 0 / 1 | 3612 / 0 / 1 |
| Analysis | 0.990 s | 0.946 s |
| Pure capture mean | 31.747 ms | 31.960 ms |
| Capture median / P95 / P99 | 31.774 / 37.156 / 38.510 ms | 32.125 / 36.859 / 37.862 ms |
| Pure capture maximum | 65.461 ms | 41.866 ms |
| Legacy controller average | 31.969 ms | 32.179 ms |
| Rendering wall | 121.439 s | 121.282 s |
| FFmpeg lifetime | 121.958 s | 121.524 s |
| Final drain | 0.519 s | 0.242 s |
| Total | 123.503 s | 123.020 s |
| Relative realtime | 0.487× | 0.489× |

FFmpeg lifetime 與 rendering 重疊，不是純 encoding 耗時。Pure capture timer 包住原 capture()，排除 frame0/60/120 的狀態讀取及保存 PNG；legacy controller timer 也包含這三幀觀察成本，因此 legacy max 分別為 299.094 / 285.409 ms，不能當純 capture max。總時間包括約 804.523 / 789.682 ms 選定幀診斷及 wrapper 開銷，並保留原 raw hashes/progress/memory 採樣。

## Capture pipeline breakdown

每個 frame 只累積數值；沒有逐幀 console。單位 ms；3612 samples/run；median 採排序中位索引，P95/P99 採 nearest-rank。Renderer native timer 解析度可使非常短的操作顯示 0。

| Stage | x264 mean | median | P95 | P99 | max | NVENC mean | median | P95 | P99 | max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| updateMs | 0.315 | 0.300 | 0.500 | 0.700 | 11.400 | 0.288 | 0.300 | 0.500 | 0.600 | 9.500 |
| animationMs | 0.044 | 0.000 | 0.100 | 0.200 | 0.300 | 0.042 | 0.000 | 0.100 | 0.200 | 0.400 |
| barrierMs | 23.330 | 24.400 | 26.400 | 27.000 | 32.400 | 24.412 | 25.100 | 26.900 | 27.400 | 28.200 |
| paintWaitMs | 0.104 | 0.092 | 0.174 | 0.242 | 5.033 | 0.091 | 0.082 | 0.168 | 0.248 | 0.888 |
| cropMs | 0.016 | 0.012 | 0.027 | 0.138 | 0.293 | 0.015 | 0.010 | 0.018 | 0.123 | 2.770 |
| bitmapMs | 7.067 | 6.077 | 10.884 | 11.846 | 26.389 | 6.615 | 5.702 | 10.000 | 10.817 | 12.245 |
| captureMs | 31.747 | 31.774 | 37.156 | 38.510 | 65.461 | 31.960 | 32.125 | 36.859 | 37.862 | 41.866 |
| stdinMs | 1.617 | 1.351 | 2.461 | 7.491 | 33.823 | 1.367 | 1.234 | 1.845 | 2.436 | 224.114 |

updateMs：音訊交付、virtual timeline/RAF/render 更新。animationMs：WAAPI ready 與 currentTime 同步。barrierMs：強制 style resolution 與原雙 native RAF paintBarrier；這是同步等待，不能稱純 GPU raster cost。paintWaitMs：兩次 invalidate→paint callback 等待之和。cropMs/bitmapMs：兩次 callback 裁切與 toBitmap+Buffer.from 成本之和，第一張 discard 也仍照原 pipeline 執行。stdinMs：原 writable write callback/backpressure 的完整 await。Main↔renderer IPC、其餘 style/JS 與 observer overhead 構成 pure capture 與細項之差。

主要成本為 paintBarrier (23.330 ms) 與兩次 bitmap copy (7.067 ms)。本輪未移除 barrier、paint 或 copy。

## Raw frame bandwidth

1920×1080×4=8,294,400 bytes/frame；60 FPS 輸入需求 497,664,000 bytes/s = 474.609 MiB/s。實際 rendering wall 對應平均 raw delivery：x264 235.274 MiB/s、NVENC 235.579 MiB/s。

實測兩次 toBitmap+Buffer.from 合計 7.067 / 6.615 ms/frame；pipe callback 1.617 / 1.367 ms/frame。這是成本分解，不以理論頻寬替代量測，也不把 callback reciprocal 宣稱為持續 pipe benchmark。

## CPU/GPU utilization

每秒 PowerShell Get-Process cumulative CPU 差值，以 16 logical CPUs 正規化，100% 表示用滿整機；以 process name electron/ffmpeg 分組，可能包含同名其他程式，非 Windows 整機 CPU 指標。NVIDIA 數據為整張 GPU，包含 Editor preview、桌面及其他程序；本輪未做 exclusive GPU profiler。初始 GPU sample 約12%，結果應视為現有桌面環境單輪診斷。

| 指標 | x264 mean / max | NVENC mean / max |
|---|---:|---:|
| Electron CPU | 15.496 / 19.782 % | 14.138 / 19.531 % |
| FFmpeg CPU | 12.551 / 29.974 % | 1.807 / 4.513 % |
| GPU utilization | 39.463 / 56.000 % | 47.656 / 56.000 % |
| Video Encode utilization | 0.000 / 0.000 % | 12.598 / 99.000 % |

NVENC 實際啟用且 FFmpeg CPU 平均下降約 85.605%。此負載收益未轉化成顯著 export wall-time 收益。

## Memory

| 指標 | libx264 | NVENC |
|---|---:|---:|
| Electron app.getAppMetrics sampled peak working set | 976.258 MiB | 1002.305 MiB |
| Host electron process-name sampled peak working set | 1028.852 MiB | 995.211 MiB |
| FFmpeg sampled peak working set | 892.891 MiB | 419.129 MiB |
| Entire GPU used memory mean / max | 3024.553 / 3211.000 MiB | 3343.746 / 3473.000 MiB |

Working set 採樣頻率與時間不同；非 JS heap、private bytes 或絕對峰值。GPU memory 不是 WaveCanvas 專屬 VRAM。

## A/V sync

| Run | Video duration | AAC duration | End difference |
|---|---:|---:|---:|
| libx264 | 60.200000 s | 60.186122 s | 13.878 ms |
| NVENC | 60.200000 s | 60.186122 s | 13.878 ms |

兩者 ffprobe 確認 H.264 / yuv420p / 1920×1080 / 60/1 / 3612 frames / AAC，尾端差均小於 16.667 ms。這驗證 frame-clock/mux endpoints，不宣稱已人工逐拍聽覺驗證。

frame0/60/120 已抽 decoded PNG 並目視確認 Background、Cover、Circle Visualizer、Primary/Secondary Lyrics、Song Info、particles 與低頻幾何/背景反應。frame0 依原時間軸仍是 intro，Cover/lyrics 尚未完成進場；兩條 path 相同。

[比較證據](archive/milestone-evidence/home-benchmark-1791018092716/comparison.json)：snapshot 完全相同，selected audio vectors、lyrics DOM、正規化背景 transform/style 相同；Canvas/raw composite frame0/120 完全相同。frame60 Canvas/raw composite 僅一個 channel 差1/255，比例 0.0000121%，符合 Phase 1 max1/255、changed channels<0.1% 容差。初次嚴格 Canvas PNG byte-equality 檢查因此失敗；進一步解碼定位為上述 Chromium rounding，未改 renderer 或放寬既有容差。Lossy H.264 outputs 不應要求 byte-identical。

## Output sizes

libx264 29400523 bytes / 28.039 MiB；NVENC 76386567 bytes / 72.848 MiB，約 2.598×。CQ18 與 CRF18 不代表等畫質/等bitrate；本輪未做 quality-matched rate-distortion 調校，不能宣稱 NVENC 此設定更優。

## Bottleneck conclusion

**A. Capture-bound。**

libx264→NVENC total 123.503→123.020 s，僅省 0.483 s / 0.391%。單輪結果不支持統計顯著的速度改善。Capture 31.747→31.960 ms 幾乎不變；stdin 1.617→1.367 ms、drain 0.519→0.242 s，佔比小。Pure capture 平均占 capture+stdin 約 95.152%。

Company→Home pure capture 38.564→31.747 ms，下降 17.678%（約 1.215× throughput）；用相同 legacy controller field 比較則下降 17.101%。Total 比舊機下降 26.115%。3080 Ti 確實被 Chromium 使用，但 capture 仍約32ms，成本集中於 offscreen sync/copy；不能從兩台電腦 A/B 斷言 GPU raster 單獨造成多少收益。

## Recommended Phase 2

1. 優先在隔離實驗中調查雙 native RAF barrier 與 queued-paint freshness，同時維持 deterministic animation 和舊 paint 排除驗證；先確認可減少等待再選架構。
2. 調查第一個 discard paint 是否能避免不必要的 crop/toBitmap/Buffer copy；必須保留 callback-owned pixel lifetime 和 frame0/60/120 semantic/cancel/error regression。
3. 將 NVENC 保留為可選 CPU/記憶體負載方向，先做等畫質/檔案大小比較與不同driver fallback規劃；不以目前0.39%差值作為優先加 encoder selector 的理由。

以上僅建議，未實裝正式 Phase 2；未加 shared texture/Direct3D/CUDA/WebCodecs、stage flattening、renderer rewrite 或大型 performance refactor。

## Artifacts / rerun / source protection

- [libx264 aggregate](archive/milestone-evidence/home-benchmark-1791017938374/aggregate.json)、full video（歷史 generated output 已清除）、[ffprobe](archive/milestone-evidence/home-benchmark-1791017938374/ffprobe.json)
- [NVENC aggregate](archive/milestone-evidence/home-benchmark-1791018092716/aggregate.json)、full video（歷史 generated output 已清除）、[ffprobe](archive/milestone-evidence/home-benchmark-1791018092716/ffprobe.json)
- 每個資料夾含 benchmark.json（每幀計時及selected states）、gpu-samples.csv、process-samples.jsonl、utilization.json、raw/decoded/canvas frame0/60/120、results.json。
- 兩次真實來源全目錄 SHA256/size/mtime 前後相同；沒有寫入或搬動 Untitled project/media。
- Re-run：順序執行 node dev/tools/home-gpu-benchmark.cjs，再加 --nvenc；執行 summarize-home-benchmark.cjs、compare-home-benchmark.cjs。NVENC probe 失敗即停止該run並保存錯誤，不冒充可用。
- 本輪變更：可選 capture/renderAtFrame 計時、dev/tools 三份診斷 helper、README 與兩份報告。Production FFmpeg args、encoder default、UI、timeline、FFT/listener 與原始專案維持。

## Final production verification

診斷結束後重建 dist/win-unpacked/WaveCanvas.exe，allowlist 77 entries / 569.95 MiB 通過；最終 Node 95/95、packaged Electron 48/48、packaged 正式 libx264 short export 7/7 通過。診斷未啟用的 production path 維持 300 frames / H.264 / 1080p60 / AAC。證據：dev/reports/archive/milestone-evidence/electron-packaged/results.json、dev/reports/archive/milestone-evidence/export-packaged-1791018392738/results.json；真實來源 hash/size/mtime 再次不變。
