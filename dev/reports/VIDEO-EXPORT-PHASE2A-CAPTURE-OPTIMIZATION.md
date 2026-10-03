# Video Export Phase 2A — Capture optimization

完成日期：2026-10-03（Asia/Taipei）。只修改 Chromium offscreen capture pipeline；正式 encoder 維持 libx264 medium CRF18 / AAC。正式結果 **66.825 秒，0.901× realtime，达到 <90 秒 target 與 60–75 秒 stretch 區間**。

## Git baseline

Git 2.53.0.windows.1 正常。現有工作目錄與父目錄沒有 .git；README/package/reports/notes 無原 remote，常見 H:\WaveCanvas、H:\雜項、H:\usersync、Documents/source/repos 的有限 inventory 也沒有 WaveCanvas clone/backup。未猜測 remote、未下載覆蓋 source，沒有 reset/clean/force-push。

依使用者明確 fallback 授權建立新的本地 repository。Baseline commit：**a09cc58179a4af2d153cdda8783492e1fcd2bf0c**，message: WaveCanvas baseline before Video Export Phase 2A。沒有恢復原歷史，沒有設定 remote。未配置全域 Git 身分，以 command-scope 作者 WaveCanvas Local Baseline / wavecanvas-local@localhost 記錄 baseline。

161 個 tracked files 包含 source、tests、fixtures、reports、tools 與 vendor binaries/license/provenance。node_modules、dist、cache、dev/downloads、dev/tests/artifacts 忽略追蹤，但全部保留磁碟原檔。Git baseline 建立後才開始 capture 修改。最終 optimization 目前保留可 review 的 working-tree diff。

## Baseline regression gate

修改前：Node 95/95、Project 51/51、Electron 48/48、Export integration 28/28，以及 packaged build/allowlist 成功。logs 位於 dev/tests/artifacts/phase2a-pre-regression/；Export results 位於 export-development-1791018825777/results.json。

完整閱讀 Phase 1 與 Home GPU benchmark 報告，保留 deterministic clock、offline analysis、full Stage、原 FFT/listener、原 Project/lyrics/preset 語意、CPU encoder 與 one-frame backpressure。

## Baseline

Home Phase 1：total123.503秒、realtime0.487×、pure capture31.747ms、P9537.156ms。相同真實專案 source duration60.186104秒、3612 frames。

本輪在相同硬體/專案/encoder 重跑細分 baseline：total125.981秒、pure capture31.815ms、P9537.252ms。多存了 frame0/1/2/30/60/120/600、相鄰 raw PNG 與完整 semantic state，因此 observer overhead 大於之前只存0/60/120的 Home benchmark；純 capture timer 排除這些選定幀存檔。

## Pipeline breakdown before optimization

3612 samples，單位ms；nearest-rank P95/P99，中位索引 median；total為累積秒。逐幀只存數值，不 spam console。

| Stage | mean | median | P95 | P99 | max | total s |
|---|---:|---:|---:|---:|---:|---:|
| updateMs | 0.320 | 0.300 | 0.500 | 0.600 | 10.200 | 1.155 |
| animationMs | 0.047 | 0.000 | 0.100 | 0.200 | 0.500 | 0.168 |
| barrierMs | 23.120 | 24.200 | 26.100 | 26.600 | 27.800 | 83.511 |
| paintWaitMs | 0.098 | 0.093 | 0.142 | 0.209 | 1.117 | 0.356 |
| cropMs | 0.015 | 0.013 | 0.017 | 0.041 | 4.775 | 0.054 |
| bitmapMs | 3.115 | 3.085 | 3.622 | 4.056 | 7.763 | 11.251 |
| copyMs | 4.458 | 3.105 | 7.870 | 8.395 | 11.505 | 16.102 |
| firstPaintWaitMs | 0.042 | 0.039 | 0.067 | 0.112 | 0.286 | 0.152 |
| firstCopyMs | 2.976 | 1.581 | 6.324 | 6.843 | 8.861 | 10.751 |
| firstBitmapMs | 1.574 | 1.546 | 1.928 | 2.229 | 6.044 | 5.685 |
| firstCropMs | 0.007 | 0.006 | 0.009 | 0.022 | 0.218 | 0.024 |
| firstInvalidateMs | 4.615 | 3.297 | 8.011 | 8.579 | 12.102 | 16.671 |
| secondPaintWaitMs | 0.056 | 0.050 | 0.085 | 0.138 | 1.063 | 0.203 |
| secondCopyMs | 1.481 | 1.464 | 1.759 | 2.016 | 5.361 | 5.351 |
| secondBitmapMs | 1.541 | 1.523 | 1.840 | 2.133 | 5.644 | 5.566 |
| secondCropMs | 0.008 | 0.007 | 0.009 | 0.017 | 4.768 | 0.030 |
| secondInvalidateMs | 3.102 | 3.061 | 3.619 | 4.097 | 9.167 | 11.206 |
| captureMs | 31.815 | 31.912 | 37.252 | 38.045 | 41.813 | 114.917 |
| stdinMs | 1.407 | 1.371 | 1.745 | 2.255 | 6.397 | 5.081 |

主要成本：double-native-RAF/style barrier 23.120ms；first toBitmap 1.574 + Buffer.from 2.976ms；second toBitmap 1.541 + copy 1.481ms；兩次 paint event 等待 0.098ms；stdin 1.407ms。

重要：invalidate() 在此環境可同步發送 cached paint。firstInvalidate/secondInvalidate 的呼叫耗時因此包含 handler 內的 crop/bitmap/copy，與這些細項**重疊**，不能重複加總為獨立 compositor 成本。原兩次 invalidate 並不保證兩次新的 Chromium commit。

## Experiments

全部相同 snapshot、audio、renderer、1080p60、libx264 medium CRF18 / AAC。Short 300 frames 用於迭代；601 frames 覆蓋 frame600；只有通過 correctness 的候選才跑 full3612。raw state、timer samples、ffprobe、source hashes/size/mtime 驗證都保存。

額外 test-only 16×16 DOM witness 把 frame index 編入顏色，每幀讀 BGRA 驗證收到当前 compositor 幀。witness 只存在受控驗證影片，不在正式輸出。它可影響 DOM damage/raster 與 native scheduling；因此最終性能使用沒有畫面內 witness 的 production full run，不能把不同 run 的差值全歸因於單一機制。

| Mode | Frames | Total s | Pure capture ms | Witness errors | Artifact directory |
|---|---:|---:|---:|---|---|
| baseline | 3612 | 125.981 | 31.815 | 未啟用額外畫面內 witness | phase2a-baseline-1791019108107 |
| baseline | 300 | 14.778 | 31.168 | 8 | phase2a-baseline-1791019421933 |
| max-rate | 300 | 8.721 | 9.400 | 300 | phase2a-max-rate-1791019674147 |
| max-rate-single | 300 | 8.686 | 9.220 | 299 | phase2a-max-rate-single-1791019686592 |
| no-discard-readback | 300 | 14.741 | 30.955 | 10 | phase2a-no-discard-readback-1791019285219 |
| one-raf | 300 | 9.881 | 14.330 | 300 | phase2a-one-raf-1791019623781 |
| production | 3612 | 66.825 | 15.062 | 未啟用額外畫面內 witness | phase2a-production-1791020395089 |
| sentinel | 300 | 15.724 | 23.933 | 0 | phase2a-sentinel-1791019751292 |
| sentinel-stream | 601 | 19.846 | 19.436 | 0 | phase2a-sentinel-stream-1791019964262 |
| sentinel-stream | 3612 | 83.844 | 18.944 | 0 | phase2a-sentinel-stream-1791020064012 |
| single-explicit | 300 | 9.993 | 14.336 | 300 | phase2a-single-explicit-1791019597958 |
| single-paint | 300 | 14.745 | 31.070 | 5 | phase2a-single-paint-1791019579242 |
| snapshot-max | 300 | 12.383 | 18.528 | 140 | phase2a-snapshot-max-1791019699005 |
| snapshot-one | 300 | 13.731 | 24.343 | 92 | phase2a-snapshot-one-1791019637497 |
| snapshot-two | 300 | 15.221 | 32.494 | 0 | phase2a-snapshot-two-1791019655057 |
| snapshot-two | 601 | 28.509 | 34.128 | 0 | phase2a-snapshot-two-1791019814266 |
| snapshot-zero | 300 | 13.001 | 22.062 | 147 | phase2a-snapshot-zero-1791019508757 |
| zero-raf | 300 | 7.989 | 5.136 | 300 | phase2a-zero-raf-1791019612026 |

original double-paint 加 witness 仍出現8/300個 frame identity 錯誤；移除 discard readback 10/300；single-paint5/300；one RAF / zero RAF與高 native rate變體有大量 stale frames，**皆拒絕採用**。先前選定少量幀的 Phase 1 correctness 測試不足以證明每幀 freshness。本輪也看到原 frame0 compositor 沒有包含已存在於同幀 Canvas state 的 Cover，屬於舊 cached surface，未為了匹配錯誤舊像素而保留它。

官方 capturePage+two RAF 的601-frame reference每幀 witness皆成功，作為獨立當前幀 reference。snapshot-zero/one/max-rate皆有 stale問題，snapshot-two約32ms並無實質速度收益。後續不採用 capturePage production replacement。

sentinel 初版在 render完成後 attach/invalidate，300幀皆正確，但約23.93ms；改成**advance前訂閱自然 paint**，省掉每幀 cached invalidate/readback，601幀平均19.436ms且所有身分正確。

sentinel-stream full witness：83.844秒、18.944ms mean、23.754ms P95，3612 witness checks零錯誤。它與独立reference的frame0/1/2/30/60/120/600 audio、Canvas、DOM/CSS、particles、bass與Song Info及composite全部精確相同。

## Final architecture

1. 專用 offscreen surface為1920×1081，DPR1/zoom1；完整 Stage 仍然exact1920×1080，沒有縮放或降低解析度。
2. Stage以外第1081列有兩個1px metadata pixel：frameIndex+1的24-bitRGB與其逐channel反碼，alpha必須255。它們不在Stage內、不進編碼。
3. Main在advance之前訂閱 paint。Renderer維持frameIndex/60虛擬時間、按原規則交付audio/RAF、pause WAAPI、await ready、同步currentTime，然後更新metadata。
4. 不再等待兩次 real RAF，也不固定 invalidate/capture兩次。只接受metadata與当前index一致的自然 compositor paint；舊queued paint被拒絕，內容時間不再advance。
5. 在callback中使用官方 toBitmap()產生owned copy。width1920時直接取前8,294,400bytes的Buffer view，省掉NativeImage crop與額外Buffer.from；width增加時用固定8.29MB row buffer去邊界，不縮放。
6. controller依舊await每個stdin write callback後才下一幀，queue depth1，row buffer不會在consumer完成前覆寫。
7. 10秒timeout、renderer crash/destroy、cancel都清除paint listener/timer並拒絕pendingcapture；不以舊幀作fallback。若硬體不支援可靠paint，明確失敗比輸出stale影片安全。

fixed first-discard readback已移除；少量queued stale自然paint仍須讀像素才能驗證identity，不能宣稱完全不存在reject readback。actual1920×1081時沒有full-frame二次copy，也不需要重用nativeBitmap，因toBitmap的獨立copy提供安全ownership。Rounded width fallback才使用bounded reusable row buffer。

WAAPI每幀ready成本只有約0.04–0.06ms，且新動畫/新的ready promise可在歌曲中建立。沒有改成僅initialization await，以免改變動畫語意；不是本輪瓶頸。

## Final performance

Production full run：[aggregate](../tests/artifacts/phase2a-production-1791020395089/aggregate.json)、[MP4](../tests/artifacts/phase2a-production-1791020395089/export.mp4)、[ffprobe](../tests/artifacts/phase2a-production-1791020395089/ffprobe.json)。正式 output 無16×16 witness；畫面外metadata row已排除。

| Metric | Final |
|---|---:|
| Total | 66.825 s |
| Relative realtime | 0.901× |
| Pure capture mean / median | 15.062 / 14.907 ms |
| Capture P95 / P99 / max | 18.691 / 21.426 / 27.426 ms |
| Legacy controller mean | 16.174 ms（包含selected states/PNG觀察成本） |
| Render update | 0.319 ms |
| WAAPI ready/currentTime | 0.045 ms |
| Forced style/zero-RAF barrier | 0.273 ms |
| Paint wait after render request completes | 12.130 ms |
| Crop / Stage view | 0.004 ms |
| toBitmap / extra buffer copy | 1.741 / 0.000 ms |
| FFmpeg write callback | 1.731 ms |
| Analysis | 1.009 s |
| Rendering wall / FFmpeg lifetime | 64.788 / 65.247 s |
| Final drain | 0.459 s |
| Frames / dropped / queue | 3612 / 0 / 1 |
| Electron sampled peak working set | 1005.070 MiB |
| FFmpeg PID-scoped sampled peak working set | 889.879 MiB |
| Renderer selected-frame maximum JS heap | 22.030 MiB |
| Output | 29465759 bytes / 28.101 MiB |

productionpaintWait量測listener收到acceptedpaint之前、renderrequest完成之後的gap，不包含toBitmap。實驗sentinel-stream的舊paintWaittimer包含render/bitmap子成本；該欄不能與production直接逐項相減，總capturetimer則一致。各stage與IPC/主程序observer有少量overlap，不宣稱表格精确加總為capturemean。

## Correctness / A/V sync

ffprobe：H.264、yuv420p、1920×1080、60/1、AAC、3612 decoded frames。Video 60.200000s，AAC 60.186122s，end difference **13.878ms <16.667ms**。frame count與sequentialclock確認沒有drop。時間軸仍以frameIndex/60；未偷frame或降低畫質。此為clock/mux endpoints驗證，非人工逐拍聽覺同步宣稱。

production与独立current-frame reference之selectedpixels/semantic比较：[comparison](../tests/artifacts/phase2a-production-1791020395089/comparison.json)。完整witness run另證明3612/3612每幀身分。原Phase1raw composite在少數初始/轉場幀有stale，因此同時保存舊comparison差異與正確當前幀reference，沒有把修正stale誤稱成byte-identical舊輸出。

Cover在原Canvas內，非獨立DOM；以完整Canvas像素與Circle幾何/particles/bass狀態比較cover位置/旋轉/反應。Background transform、Lyrics DOM/computed style、Song Info DOM/style直接比較。raw/full Stage包含全部layers；允許既有max1/255且changedchannel<0.1%的Chromium rounding，未放寬容差。

所有真實source directory的hash/size/mtime在每次測試前後不變。未重寫原.waveproj、edited lyrics或媒體。

## Improvement / KPI

相對Home Phase1：total123.503→66.825s，下降**45.892%**；capture31.747→15.062ms，下降**52.557%**；P9537.156→18.691ms。

相對本輪細分baseline：total下降46.956%、purecapture下降52.660%。兩輪observer成本與系統負載不同，這是本機單輪實測，非統計顯著硬體benchmark。

**Minimum<105、target<90、stretch60–75均達成。** Electron memory約1GiB，比Home原976.258MiB增加約2.951%，未超過2×。

## Final regression

Node **99/99**、Project development **51/51**、Electron development **48/48**。完整 Export QA 重跑 **28/28**，涵蓋 minimize/resize/zoom、重複匯出、取消保護既有目標、partial cleanup、缺 FFmpeg、audio decode failure、encoder failure、renderer crash 與 circle/square/linear/particles/bass。

打包版 Electron **48/48**、Project **51/51**、真實專案 short export **7/7**：H.264 / 1080p / 60 FPS / 300 frames / AAC，原專案檔案 hash/size/mtime 不變。最終 build audit **78 entries / 569.96 MiB**。Helper syntax 與 git diff whitespace 檢查通過。

Logs：[final regression](../tests/artifacts/phase2a-final-regression/)。完整 QA 成功 artifact：[export repeat](../tests/artifacts/export-development-1791020970261/results.json)；打包版：[project](../tests/artifacts/project-packaged-1791021094552/)、[export](../tests/artifacts/export-packaged-1791021102951/)。最終 production frame0/60/600 另做目視檢查，Cover、Song Info、背景、歌詞與頻譜正常。

保留首次 QA 的失敗：[initial QA](../tests/artifacts/export-development-1791020568759/results.json)。frame60 audio samples / lyrics exact；Canvas PNG byte equality 失敗，但 decode 後只有 **1 channel 差 1/255（ratio 0.00000012056）**；完整 composite 原容差通過。未修改或放寬該 strict assertion，未修改應用程式後完整重跑 28/28 通過。[pixel evidence](../tests/artifacts/export-development-1791020568759/canvas-rounding-analysis.json)。這項 exact PNG assertion 有 Chromium rounding 的非穩定性，不能宣稱所有重新啟動皆 byte-identical。

Browser 回歸使用 test-only 獨立 sandbox BrowserWindow / session，沒有 Node/preload。初始 harness 的 default-session HTTP 阻擋與字串 escape 問題已修正；沒有放寬正式 app 的網路限制。另修正兩個既有 browser tests 的舊 Cover clear selector，指向現有 Media footer；只有 test selector 改動，未改 UI 或 assertion。

Browser 最終 **589 PASS / 10 FAIL**，其中主套件 browser.html 為432/10；repository smoke14/0、factory defaults31/0、SRT31/0、Linear Cover20/0、templates61/0。**沒有宣稱 Browser 全綠。** 10項失敗集中於舊 preset/reset default、Square geometry、layout/preset roundtrip 與 Recent Projects 期待。

為隔離本輪變更，harness 的 `--baseline` 從 Git baseline commit 讀取全部原始 app 檔案到獨立 artifact 子目錄，以相同 current tests（包含修正後的 clear selectors）執行；没有覆寫工作 source。Baseline 同樣 **589 PASS / 10 FAIL**，所有 failure labels 完全一致，證明這些是既有測試期待問題，不是 capture 優化新增 regression：[baseline comparison](../tests/artifacts/browser-regression-1791021247931/baseline-comparison.json)、[baseline results](../tests/artifacts/browser-regression-1791021346767/results.json)。本輪未更動既有 defaults、Square 或 Recent Projects 行為來滿足過時 assertions；後續可單獨維護主套件的期待值。

## Known limits

- 本輪實測RTX3080Ti/driver616.56/Electron44.5.1；不能保證所有GPU/driver/實體DPI相同速度或像素。DPR1/zoom1/Stagebounds仍有runtimeguard。
- frame-identity paint驗證解決觀察到的cachedpaint問題；sentinel表面/色彩不符則fail-safe timeout，不盲目fallback舊doublepaint。
- toBitmap還有每frame8.29MB owned allocation/readback，尚未移除GPU→CPU傳輸；沒有無限queue或預先保存所有frames。
- JS heap是selectedframe sample、working set是一秒/12frame sample，非絕對peak；FFmpeg memory以實際encoderPID篩選。
- 既有FFmpeg再散布/簽章限制仍見Phase1report；本輪沒有release/installer。
- cancelled/error的普通cleanup已列入regression；突然斷電/強制殺Main仍有既有partial殘留限制。
- 主 Browser suite 尚有10項既有失敗，已用原 baseline app 重現；exact Canvas PNG equality另有極少量 GPU rounding 非穩定性。詳見 Final regression，不將这些限制隱藏為全綠。

## Phase 2B recommendation

先在其他GPU/driver與DPI驗證identity-row paint流程、長歌記憶體穩態及效能重複性；再決定是否調查剩餘GPU→CPU readback。保留CPUencoder；正式NVENC只作未來負載/畫質選項評估。本輪停止，未做NVENC production、HEVC、AV1、4K、customsettings、sharedtexture/Direct3D/CUDA/WebCodecs/nativeaddon或PluginSystem。

## Official API references

[Electron offscreen rendering](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering)、[setFrameRate/invalidate](https://www.electronjs.org/docs/latest/api/web-contents#contentssetframeratefps)、[NativeImage.toBitmap owned copy](https://www.electronjs.org/docs/latest/api/native-image#imagetobitmapoptions)。亦讀取node_modules/electron/electron.d.ts（44.5.1）的API contracts；未使用privateAPI或新第三方renderinglibrary。
