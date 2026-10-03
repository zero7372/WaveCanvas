> 維護註記（2026-10-03）：generated videos／暫存輸出已清除；小型證據連結改到 archive，靜態 baseline fixtures 改到 dev/tests/fixtures/baselines。下文數值為當時 milestone 實測，不代表本輪重跑。

# Template Selection Screen / Media Panel UI Polish

1. **Template data structure**：`builtin-templates.js` 提供 immutable definitions，每筆有 id、name、subtitle、description、thumbnail、previewVideo、layout；共用 `VisualizerTemplates.apply(id)`。`template-selection-ui.js` 迭代資料生成 UI，新增模板只需新增 definition 與相應資產。
2. **Card structure**：article → 16:9 img → content（h3、subtitle、description、button）。三張 desktop 卡片等寬、文字與按鈕對齊；較窄時換成兩欄／單欄。使用原暗色工具介面，沒有 hover 動畫。
3. **固定文案**：下表逐字使用提供內容；三個按鈕皆為「使用此模板」，accessible label 加對應名稱以區分。
4. **Thumbnail path**：assets/templates/builtin_circle_default.png、builtin_square_default.png、builtin_linear_default.png。原圖位於上層工作目錄，原樣複製而未移除或加工；Node 比對 SHA-256 相同。
5. **Apply flow**：Home card click → factory clone → activate target bank → update visual properties / standalone appearance → existing shell showView(EDITOR)。不匯入任何示範素材，也不呼叫 Preset reset 來清除資產。
6. **影響 state**：套用目標完整 visualizer（含 cover geometry）、Inspector spectrum/specific/position/bass 的 properties、粒子外觀參數、背景 color/image sizing/offset、standalone background、Song Info appearance。音訊 FFT 設定、Input Gain、Lyrics appearance/content/timing、Song Title/Artist、圖片來源、backgroundsource、音訊 URL／播放位置及兩份 LRC 文件保留。其他 Layout 的 session edits 仍保留；選用某模板會明確重新套用該 Layout 基準，與一般切換保留 state 的語意不同。
7. **previewVideo**：三筆均為 null，僅作未來 metadata。UI 始終建立 img，不建立 video，不做任何影片解碼或 hover playback。
8. **Media Panel**：只 reparent 既有 clear buttons 至相同 footer，保留選檔／清除事件與原 input DOM。hidden input wrappers 保留；主要歌詞的普通重複狀態文字隱藏，error／warning 仍可顯示。檔名、metadata、輔助訊息與 actions 間距統一。
9. **順序**：Cover＝選取／替換 → 清除；Primary＝選取／替換 → 清除歌詞；Secondary＝選取／替換 → 清除次要歌詞。三者垂直排列，不調整 Audio 的既有操作區。
10. **Danger style**：`.danger-button` 使用低調紅字／紅棕底／邊框，hover 紅色稍增強；主操作維持藍灰色，整張卡片不染紅。
11. **Confirmation**：原 handler 本來沒有 confirm；本輪直接保留，沒有添加 dialog。實際載入素材後按三個 clear 按鈕，測試 confirmation 呼叫數為 0，清除正常。
12. **Tests**：Targeted Node 13/13；最終 Node regression **69/69**；Chromium template/media targeted **61/61**、Factory/Preset relevant regression **31/31**，合計 **92/92**。1280/980/720/420px Home containment、縮圖比例與 button alignment、無媒體 launcher、既有 Cover/background/audio URLs 與 LRC 保留、clear、Preset roundtrip、Stage 16:9、87 個 Restore buttons 均通過。無 page errors／unhandled rejection。Factory generator／schema checks 與變動 JS syntax 通過。
13. **限制**：縮圖是使用者提供的靜態示意，可能包含歌曲、封面、歌詞示範；套用僅導入本輪指定的 Factory 基準，不會讓示範媒體或歌曲文字進入 Editor。沒有遠端來源、下載、動態預覽、完整 Template inheritance 或 persistence。未重新執行完整音訊 browser calibration／實際 Wallpaper Engine 宿主人工驗收。

| Name | Subtitle | Description |
| --- | --- | --- |
| Circle | 環形頻譜 | 以封面為中心的環形音訊頻譜，適合主視覺置中的構圖。 |
| Square | 方形頻譜 | 圍繞封面的方形頻譜框架，適合對稱、穩定的視覺配置。 |
| Linear | 直線頻譜 | 橫向或直向的直線頻譜，搭配可獨立配置的封面位置與樣式。 |

## 檔案與範圍

新增 builtin-templates.js、template-selection-ui.js、三份 PNG 副本、Node/browser targeted fixtures。修改 index.html、wavecanvas-shell.js、standalone.css；更新 README 與歷史 UI guards 中允許 shell 變更的註記。歷史 hash snapshot 保留，新的 template-protected-hashes.json 保護其餘禁止修改的模組。

main.js、visualizer-geometry.js、linear-cover.js、audio-adapter.js、local-audio.js、runtime-adapter.js、presets.js、Factory source/adapter、Lyrics renderer/runtime/UI、Timing editor/model、background renderer 全部 byte-identical。沒有新增套件；沒有修改 Plugin、Electron、Project Save/Load、Export；不需更新 AGENTS.md。

證據：dev/reports/archive/milestone-evidence/templates-results.txt、templates-factory-regression.txt；截圖 templates-home.png、templates-media.png。測試入口 dev/tests/templates-browser.html、dev/tests/factory-defaults-browser.html；Node 為 npm test。
