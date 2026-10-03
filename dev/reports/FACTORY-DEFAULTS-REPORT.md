# Factory Layout Defaults / Per-Control Restore Default

1. **JSON 映射**：factory-defaults/circle.json、square.json、linear.json 是 Circle.json、square.json、Linear.json 原樣副本，未修改 Dropbox 原檔。每份 54 properties 保留 key / value 結構；測試逐欄核對全部來源數值。
2. **集中來源**：generator 產生 factory-defaults-data.js，附 SHA-256；factory-layout-defaults.js 以來源覆蓋 schema fallback，deep freeze、clone-on-use。只有 Circle/Square 未提供的五個 Linear Cover 欄位使用原 schema fallback。
3. **正式基準**：完整 snapshot 包含 86 runtime properties 與所有 standalone sections。主要差異見下表；WE 仍使用 project.json defaults。
4. **Linear Cover**：X/Y=50/50、Size=30、Shape=circle、Rotation Speed=0 RPM，完全採用來源值，保留正負 RPM 原語意。
5. **State 分離**：Runtime 存可編輯副本；每個 session bank 保存 visualizer、Inspector spectrum/specific/position/bass properties、Song Info X/Y。Scope keys 依既有 Inspector metadata 推導。Audio、Background、Lyrics、Particles、FPS、實際 Cover 來源共用；切換前保存 outgoing bank，目標初次使用才 clone Factory。Preset 不改 Factory 或 inactive banks；非法更新先拒絕，不污染 banks。
6. **Per-control Restore**：restore-default-ui.js 加強既有 schema-generated DOM，87 組 numeric pair 加 compact ↺、中文 tooltip、accessible labels。file/text/dropdown/bool/color 不加，原 input handlers 保留。
7. **Context-aware**：VisualizerRuntime.restoreDefault(scope,key) 查目前 Layout Factory，只改指定 key，經 updateProperties / updateStandalone。相等時 disabled/dim，容差 1e-7 * max(1, abs(default))；Preset 值不是新的 default。
8. **Global Reset**：保留目前 Layout，套其完整 Factory，其他 Layout session 編輯不重設；維持既有圖片清除行為，保留音訊／LRC。三份 Input Gain 均為 3×，Reset 狀態文字同步。
9. **New Project**：首次 browser runtime 使用 Circle Factory，Square/Linear 首次切入使用自己的 Factory。Home「繼續編輯」保留工作階段，不增加素材清除或新工作流程。
10. **測試**：targeted Node 22/22；最終 Node regression 65/65；Chromium Factory UI 31/31、Linear Cover 20/20。Source exact values、clone/freeze、banks、單值 restore、floats、Preset 舊欄位／不可變性／原子拒絕、Global Reset、WE 舊 defaults 均通過。實際點擊 Cover Y ↺，40→50，Size=38／RPM=-0.8 保留。

| Layout | 正式基準重點 |
| --- | --- |
| Circle | circleradius=160、barwidth=4、barheight=230、secondcircle=false、原 px offset X/Y=0、Song Info Y=78 |
| Square | foldedDiagonal、rotation=90、squareSize=256、height=180、barCount=64、barWidth=8、gap=4、X/Y=50/50、Song Info Y=80 |
| Linear | horizontal、X/Y=50/100、width/height=1920/400、rotation=0、barCount=64、barWidth=8、gap=4、mirror=none、anchor=center、Song Info Y=75 |

## 修改範圍與驗證

新增三份 factory JSON、generator、factory-defaults-data.js、factory-layout-defaults.js、restore-default-ui.js、targeted Node/browser fixtures。調整 runtime-adapter.js、presets.js、index.html script order、settings-ui.js Reset 文字、standalone.css，更新測試 expectations 與 README。

歷史 hash snapshot 保留，本輪允許修改的 runtime/preset 改由新的行為測試涵蓋。未修改 main.js、visualizer-geometry.js、linear-cover.js、layout-schema.js、audio-adapter.js、local-audio.js、Lyrics、Timing、Particle renderer、Electron、Project Save/Load、Video Export。

Circle/Square draw trace、Linear spectrum geometry/trace 保持基準；FFT mapping / wallpaperAudioListener SHA-256 不變。兩個 browser runner 無 page errors／unhandled rejection；Cover cache、clipping、旋轉、bass/shake、Preset 同步回歸通過。Schema check 98 entries、Factory generator check、JS syntax checks 通過。

Browser 紀錄為 tests/artifacts/factory-defaults-results.txt、factory-linear-cover-results.txt；截圖 factory-restore-default.png。可用 node scripts/generate-factory-defaults.cjs --check 核對來源、node --test tests/*.test.cjs 重跑必要 regression。

## 相容性與限制

Preset format/version 仍為 1，仍輸出 active-layout 平面 snapshot。缺欄位使用目標 Factory，沒有 layout 的舊 preset 用 Circle。inactive layout 編輯只保留當次 session；未新增跨 session persistence。Global Reset 的完整 snapshot 含共用設定，會重設共用粒子／背景／Input Gain；单值 ↺ 不影響其他設定。

未重跑完整歌曲播放／所有歷史 browser suites 或實際 WE 宿主人工驗收。沒有新增套件，不需更新 AGENTS.md。
