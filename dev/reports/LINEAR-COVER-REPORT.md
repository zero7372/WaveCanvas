# Linear Cover / Artwork 回報

此為上一輪歷史報告。暫時 fallback 已由正式 Factory Layout Defaults 取代；目前 Linear Shape=circle、RPM=0，Preset／Restore 流程見 FACTORY-DEFAULTS-REPORT.md。

1. **真正原因**：main.js 的 Circle path 繪製 Logo，而 visualizer-geometry.js 只有 Square branch 繪製 Artwork；Linear 沒有任何圖片 branch。不是圖片未 decode、z-index 或 clipping 失效。
2. **獨立 geometry**：standalone.visualizer 新增 coverX、coverY、coverSize、coverShape、coverRotationSpeed。X/Y 是 stage 百分比；Size 是圖片最長邊相對 1080 高度的百分比。Circle 使用的 eqpositionx/y、circleradius 與 Square 的 positionX/Y、squareSize 都不被這些欄位覆寫。
3. **Shape**：Square 模式顯示完整矩形來源，保持自然比例，不做圓形 clipping。Circle 模式依較短邊取置中正方形來源，避免非方形圖片拉伸。
4. **Circle clipping**：先以 Artwork 中心 translate、共享 bass scale，再在 local (0,0) 建立圓形 mask。圖片在同一中心旋轉，mask 與震動不會分離。獨立於 Linear 頻譜的整體位置／rotation／orientation。
5. **Timing／方向**：速度單位 RPM，angle += speed × 6 × deltaSeconds。正數順時針、負數逆時針、0 靜止；絕對值越大越快。elapsed clock 使用 performance.now()，不按 frame count 累加。切換 Layout／Shape 或換圖時重置時間 anchor，保留速度與角度，不補算隱藏期間。
6. **Bass／opacity**：直接沿用 main.js 傳入的 appearance.bass.center（原 avg1）與 shakeX/Y。Linear baseHalf 加上同一份 avg1，再轉成以圖片中心為軸的 scale；沒有第二套 FFT／bass 計算。Opacity 使用既有 circleopacity，Linear 有圖片時 UI 顯示封面不透明度及 cbassmultiplier 的封面低頻放大；Circle／Square 的原 opacity path 不改。Canvas 全局震動 blur 亦沿用原流程。
7. **State／UI**：Linear 專區新增封面 subgroup，全部 inputs 沿用 schema generator 與 updateStandalone。Rotation Speed 只在 Circle Cover 顯示，Square Cover 隱藏但不 reset。切換三個 Layout 不改任一方的位置／尺寸／速度值。共用 opacity／bass 效果仍是一份既有 runtime state。
8. **Preset**：presets.js、format version 1 及 Restore handler 完全未改。export 自動保存新增 schema 欄位；舊 preset 缺欄位使用暫時安全 fallback（50/50、30%、Square、0 RPM），其他既有 schema defaults 完全未改。沒有開始 Factory Defaults、Template 或新的 Restore workflow。來源圖片／Object URL 仍按原格式排除，Preset import 清除圖片來源的既有行為保留。
9. **測試**：targeted Node 5 項通過，檢查 transform、非方形圖片、clipping、opacity、15/30/60/120 FPS 等速旋轉、正負／零／不同速度、bass + rotation + shake、切換／clock jump、schema／legacy fallback。與改動前 renderer 比對 Circle／Square draw traces、Linear geometry／無圖片時 draw trace 一致。Targeted Chromium 20 項通過，包含真實 PNG 選檔、cache、UI、共用效果、Preset／舊 Preset／切換與 native Linear renderer 確實 drawImage。沒有完整重跑全部 Browser regression。

一次必要 Node 回歸：59 項通過，含既有 FFT／listener hashes、Audio、Cover、Geometry、Preset、Lyrics、Timing。syntax check 與 project schema check 亦通過。main.js、audio-adapter.js、local-audio.js、runtime-adapter.js、presets.js 保持既有 hash；visualizer-geometry.js 只加 Linear Cover hook，其 Circle／Square 分支與原 geometry 邏輯未修改。

修改檔案：linear-cover.js（新增）、visualizer-geometry.js（Linear hook）、layout-schema.js（5 個新增欄位）、layout-ui.js 的既有 generator 不變；inspector-policy.js、inspector-ui.js、settings-ui.js、ui-zh-tw.js、index.html 接入控制與載入。另新增 targeted tests／改動前 snapshots，調整 Inspector 保護測試中這輪有意變更的 geometry／schema 範圍；歷史 hash 記錄不覆寫。README 已同步。

證據：tests/artifacts/linear-cover-results.txt、linear-cover.png。限制：暫時 fallback 尚未作 Factory Default 設計；未對完整歌曲／Wallpaper Engine 宿主重新人工驗收，Circle／Square 由原繪製 trace 及 main.js hash 比對保護。

