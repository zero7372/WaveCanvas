# Visualizer Inspector UX 盤點

後續 Linear Cover 階段新增 Linear 封面 subgroup，以及共用 circleopacity／cbassmultiplier 在 Linear 有圖片時的控制入口；原有分類其餘部分保留。最新功能與測試見 LINEAR-COVER-REPORT.md；以下記錄本次 Inspector UX 階段的分類與驗證。

## 1. 舊分類問題

舊 WE metadata 將 Bars、Circle、Center 分開，但沒有區分 renderer 的實際讀取來源：Square／Linear 下仍顯示 audiocount、barwidth、barheight、barsarc、userspectrumrotation 等 Circle-only 設定。eqpositionx/y 也不控制 Square／Linear 的位置。中心形狀、第二層形狀與部分低頻位移其實同時用於 Circle／Square，不能全部歸為 Circle-only。

## 2. 新結構

排列 → 頻譜外觀 → Circle／Square／Linear 當前專區 → 位置與變換 → 低頻反應 → 粒子 → 其他。三個 Layout 專區只顯示一個；其餘區域為可收合 sections，空區域隱藏。舊 metadata wrapper 保留成隱藏 integration hooks，不再呈現舊 WE 分組。

## 3. 真正共用

| 區域 | keys | 作用 |
|---|---|---|
| 頻譜外觀 | barcolortype, barcolor, baropacity | 三種 renderer 的色彩模式、顏色、不透明度 |
| 頻譜外觀（條件式） | userrainbowrotate, beattolerance | 彩虹偏移／隨機色節拍門檻；依色彩模式顯示 |
| 低頻反應 | bassshakemultiplier, bassshaketolerance | 三種 renderer 的畫布震動／模糊強度與門檻 |
| 粒子 | particlestyle, particlecolor, particleradius 等既有粒子欄位 | 不依 Visualizer Layout 改變；依原粒子 Style 顯示 |
| 其他 | frameratepersecond | 低於 35 FPS 時的原警告 |

normalize、noise、resposive、Input Gain 仍在 Audio tab；logoimage 選檔仍在 Media。Background／Overlay、Lyrics、Song Info 不重新分類。

## 4. Circle-only

Circle 專區：circleradius、circlearc、circlerotate、barwidth、barheight、barsarc、audiocount、userspectrumrotation、reverseright。Position：eqpositionx、eqpositiony（畫布像素偏移）。頻譜起始角度、中心裁切角度與頻帶取樣偏移分別命名，沒有虛構 Circle 整體旋轉設定。

## 5. Square-only

squareSize、squareSpectrumLayout、direction。三種 Spectrum Layout、inward/outward 與既有 geometry 不變。

## 6. Linear-only 與部分共用

Linear-only：orientation、width、anchor、mirror、amplitudeDirection。Square／Linear 共用既有 barCount、barWidth、gap、height、reverse，放在當前 Layout 專區；positionX、positionY、rotation 放在 Position。Linear 水平時 height 是振幅／width 是長度，垂直時相反，UI 說明此差異。

Circle／Square 共用：circlecolor、circleopacity、secondcircle、secondcirclecolor、secondcircleopacity、secondcircleradius、autologorotate、autologorotatespeed、autobarsrotate、autobarsrotatespeed、barsrotate、barcircledistance、cbassmultiplier、bbassmultiplier、c1bassmultiplier。原控制項移到當前專區，Linear 不顯示。bbassmultiplier 實際控制頻譜離中心的低頻位移，沒有改為音訊強度或柱長度。

## 7. Dead／misleading controls

沒有新增 disabled 控制項，沒有刪 runtime／Preset compatibility keys。移除視覺上的舊 metadata 分組與目前 Layout 的 no-op 控制項。先前已退役的 schemecolor、blurvalue、Clock／Text 等欄位維持既有 hidden/internal 處理，不改語意。Circle bar controls 不再於 Square／Linear 出現，Linear 不再出現中心形狀／中心低頻位移。

額外修正 UI 條件：沒有圖片時不顯示 autologorotatespeed；Style 2 的 particlecolor 不受留存的 Style 1 particlerainbow 遮蔽，Style 1-only opacity／twinkling 等仍按既有條件隱藏。沒有修改 Particle renderer 或新增效果。

## 8. Layout 切換

直接使用既有 runtime 訂閱；單一作用範圍的欄位固定留在對應專區，部分共用欄位搬移原 DOM node。沒有 reload、重建 Inspector、第二套設定 state 或切換時 reset。一般 property 條件與 Layout 適用範圍合併；選檔回呼也走同一條 UI sync。

## 9. Preset

原 presets.js 與 layout-schema.js 完全不變，format version 1 不變。import／export／reset 仍走原入口，squareSpectrumLayout 照常保存；舊 preset 缺欄位仍回 Symmetric。UI 分類不影響 internal keys 或數值。

## 10. 驗證

Node 54 項、Chromium 442 項通過，包含三個 Layout 的專區 visibility／順序、原 control node 身分保留、值／collapse state 保留、共用色彩五項設定的實際繪製效果、粒子條件、Preset roundtrip／legacy／reset。無 page errors 或 unhandled promises。

`node scripts/generate-schema.cjs --check` 確認 98 個 schema entries 相符。syntax check 涵蓋新增與修改 JS。inspector-protected-hashes.json 比對 main.js、visualizer-geometry.js、layout-schema.js、audio-adapter.js、local-audio.js、runtime-adapter.js、presets.js、Lyrics、Timing Editor 及 Shell 完全未變；另保留既有 FFT／wallpaperAudioListener hash 測試。Circle／Square／Linear rendering 演算法未修改。

證據：tests/artifacts/inspector-results.txt、inspector-square.png。Chromium 測試包含 WE API simulation，未以 Wallpaper Engine 宿主人工操作；此次只改 Standalone UI。
