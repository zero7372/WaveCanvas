# WaveCanvas System Font Enumeration Patch

日期：2026-10-03。基於 `b5a2aa1`，只處理 Local Font Access 枚舉與 family 字串 persistence。沒有 font embedding、Collect 字體複製、missing-font warning、native addon、registry scraping 或 Release Engineering。

## API

`app/system-fonts.js` 先檢查 `'queryLocalFonts' in window`，呼叫 `window.queryLocalFonts()`，只取 `font.family`。沒有呼叫 `font.blob()`，不讀、複製或保存字體 bytes/path。`load()` 為 renderer document 內唯一共享 Promise，三個 dropdown 不各自 query。

Desktop 在 editor focus 後載入；font control 的 focus／pointerdown 也可啟動同一 Promise。Browser 僅在 font control 操作時 query，允許瀏覽器正常 permission flow。Export renderer 沒有 font dropdown，也不執行枚舉；直接使用 project family 字串 rendering。

API 行為參考 [Chrome Local Font Access](https://developer.chrome.com/docs/capabilities/web-apis/local-fonts)；能力範圍是 Chromium 可見的 local font metadata，不是另建 Windows font scanner。

## Permission behavior

`electron/main.cjs` 的 `setPermissionCheckHandler`／`setPermissionRequestHandler` 僅對 bundled `app/index.html`、primary editor WebContents、main frame 的 `local-fonts` 授權。其他權限、其他窗口、Help／export／外部頁面仍拒絕。沒有新增 raw filesystem、shell 或字體 IPC。

Electron 自訂 permission handlers 控制授權，trusted editor 不顯示額外 permission UI；實測 `navigator.permissions.query({name:'local-fonts'})` 為 granted。Browser 普通權限被拒絕時沿用 safe list。單一 query Promise 記錄成功／失敗，不在相同 document 反覆要求 permission；下次重新啟動 document 才重新嘗試。參考 [Electron session permission handlers](https://www.electronjs.org/docs/latest/api/session)。

## Enumerated family count

目前 Windows 主機 development 與 packaged Electron 均取得 **106 installed families**，加上4個 CSS generic families，共 **110 dropdown choices**，明顯多於原11項。

實際確認 Calibri、Cambria、Consolas、Bahnschrift、Malgun Gothic、Yu Gothic 均出現。CJK 還包含 Microsoft JhengHei UI、Yu Gothic UI；結果保存於本輪 evidence。沒有使用 GDI、PowerShell、registry 或 helper executable 建立產品清單；不要求等於前一輪 GDI audit 的184。

## Canonical list

`canonical()` 對 family trim、移除空值／非字串、case-insensitive deduplication，保留第一次合理 display name。使用 `Intl.Collator(undefined, {sensitivity:'base', numeric:true})` 作 locale-aware sorting。

system-ui／sans-serif／serif／monospace 固定在頂部。Canonical families 為 frozen array；`bindSelect()` 在 Song Info、Primary Lyrics、Secondary Lyrics 三個 UI 中共用。只在清單或 current value 改變時重建 options，不產生 change event、不更新 runtime。

## Fallback

API missing、permission denied、SecurityError、一般 failure、empty／只有無效 family 都使用原11項 safe list。Project Open／Save 不等待 font enumeration，失敗不阻止專案／選單操作；沒有新的巨大 permission UI 或 warning UI。

Rendering 保留原 fallback stack：Microsoft JhengHei、PingFang TC、Noto Sans CJK TC、Noto Sans JP、system-ui、sans-serif。原 Georgia／Times New Roman 的 serif tail、Courier New 的 monospace tail 保留。

## Project persistence semantics

`.waveproj` 仍是 project v1；font family 仍只保存名稱字串。不保存 dropdown index、installed flag、font path 或 enumeration metadata。`normalize()` 僅 trim／空值預設，不再根据 whitelist／installed list／本機 availability 改寫合法字串。

原 Lyrics／Song Info schemas、runtime project validation、serializer／layout banks／export snapshot 共用這個 string normalization。未知 family 可經既有 presets／project loader 正常讀回；例如 Bahnschrift、Some Weird Font、思源黑體 TC 都可完整 Save/Open。Factory defaults 仍固定 system-ui，不受本機結果或排序影響。

既有 Node tests 的「未知字體變 system-ui」期待更新為保留原字串，符合本轮明確要求；不是放寬其他驗證。原 cleanup classification manifest 的歷史 SHA256 不改寫；新增 `dev/notes/system-font-enumeration-source-hashes.json` 只記三個有意修改的 font source/UI hashes，repository regression 仍檢查其他 retained sources／FFT／sampling／parsers。

## Missing saved font behavior

`bindSelect()` 將 canonical list 不含的 exact current family 暫時插在該 dropdown 頂部，不顯示 missing warning。也保留與 enumerated display name 大小寫不同的 current identity，避免 silent canonicalization。

枚舉完成、Project Open、同步 options 不 mark dirty、不把 family 變成 system-ui。只有既有 dropdown change listener 收到使用者選擇才更新 runtime／preview、mark dirty、保存新 family；舊暫時 option 在不再選用後移除。

## fontStack safety

任意非 generic family 先用 CSS quoted string 放第一順位；雙引號、backslash、控制字元使用 CSS hexadecimal escapes。Spaces、CJK、Unicode、comma／semicolon／braces 都留在單一 family 字串内，不拼成其他 CSS declarations。

專案原字串不因 CSS escaping 改寫。測試包括 Arial、Bahnschrift、Calibri、Cambria、Consolas、Microsoft JhengHei UI、Yu Gothic UI、思源黑體 TC、spaces、Unicode／emoji、quotes、backslash、punctuation；實際 Chromium `CSS.supports('font-family', stack)` 驗證合法。

## Editor / Export consistency

整條 `.waveproj → loader → runtime → editor preview → export snapshot → dedicated app/export.html renderer` 保留 same family strings。對不存在的 Some Weird Font，Editor／export CSS 都先使用該名稱，再自然 fallback，metadata 不寫回 fallback 字體。

專項測試使用真實 dedicated export HTML／`WaveCanvasExportStage.prepare()`，不修改 encoder／clock／capture，也不增加 production test hook；音訊 fixture 只作 export preparation。現有300-frame deterministic export 回歸另外照常執行。

## Browser behavior

Browser 沒有新增 native backend。API unavailable 使用 safe list；permission denied 保留 safe list與未知 current option。正常 Browser 的 request 由瀏覽器決定；Electron 中另開無 preload 的 standalone page 實測 permission denied，不能利用主 editor 的授權取得字體。

## Tests

| Suite | Development | Packaged |
|---|---|---|
| Node | 120/120 | 共用來源 unit tests |
| 新增 Fonts integration | 22/22 | 22/22 |
| Project | 51/51 | 51/51 |
| Preferences | 28/28 | 28/28 |
| Options | 43/43 | 43/43 |
| Electron | 48/48 | 48/48 |
| Export QA | 34/34 | 34/34 |
| Browser | 589 PASS／10 known FAIL | standalone Browser suite |

新增8個 Node cases：single metadata query、trim／空值、case-insensitive duplicate、locale sort、generics、API missing、NotAllowedError、SecurityError、一般failure、empty fallback、 arbitrary project names／CSS escapes／factory default、missing current option同步。Fonts integration 各22項包含真實 API／六指定families、三清單一致、clean startup、installed/missing/CJK Save/Open、current injection不dirty、preview、export snapshot、dedicated export HTML、使用者改選dirty與disk strings、Chromium CSS.supports、窄permission policy及無native backend頁面的安全fallback。

這版 Electron 拒絕 local-fonts 後，`queryLocalFonts()` 回傳空陣列；實測 browser permission=denied、status=empty、safe11＋current option共12。測試最初期待 NotAllowedError，調整為驗證真實 denied／empty行為；產品原本已正確處理 empty fallback。不可見 document 的 SecurityError fallback 亦觀察到，unit包含該錯誤。

300-frame repeated export：兩版各兩次，audio／lyrics exact，SSIM=1；Canvas／compositor 使用既有 max1/255、changed channels<0.1%門檻，沒有放寬。Browser 主頁432/10、五專項157/0，failure labels與Options基準完全一致。

Test-only 修正：Browser helper 增加 `--disable-backgrounding-occluded-windows`，避免本機遮蔽導致 image.decode／Cover cache等待逾時；初次影像專項因此未完成，重新執行恢復原baseline。Options helper 在關閉 Preferences 後明確等待dialog移除，避免close事件尚未完成就重開。沒有修改 production image／capture／Preferences實作，也沒有放寬任一功能 assertion。

小型 metadata、checks、metrics／logs見 [evidence inventory](archive/system-fonts-2026-10-03/README.md)，不保存font bytes、巨大 raw export payload、影片或profiles。Maintenance links／script audit與staged diff check通過。

## Packaged verification

`dist/win-unpacked/WaveCanvas.exe` 的真實 Local Font Access query 可用，未 mock enumeration；106 installed families／110 choices、permission granted，六個指定 Windows family 均可見。三個 dropdown 一致、normal project clean、Save/Open 與 dedicated export family identity 均有實測。完整 [packaged families](archive/system-fonts-2026-10-03/enumeration-packaged.json) 與 [persistence evidence](archive/system-fonts-2026-10-03/persistence-packaged.json) 已保存。

## Build size

Before：597,637,896 bytes／569.9519 MiB（Options build）。After：597,641,627 bytes／569.9555 MiB。增量 **3,731 bytes／約0.0036 MiB**，沒有 dependencies/native modules 或數十 MiB 增長。Build allowlist90 entries，不含 dev/tests/reports/node_modules。

## Known limitations

- 可見集合由 Chromium/Windows 決定，不宣稱涵蓋 GDI 或其他應用程式 private font collection；目前106不必等於GDI184。
- API 結果不含安裝來源分類；system-wide／per-user／third-party family 一律可列，只要 Chromium 提供。沒有另外安裝新字體去做 per-user／Office／Adobe provenance matrix。
- CJK 可見名称、Bahnschrift family 已驗證；不讀 font bytes，因此不解析 variable axes／格式或每個 face 的來源。
- Local Font Access 可因 browser／policy／permission 限制不可用，safe list fallback 是預期行为；同 document 不重試，避免重複 permission request。
- 原 Browser baseline10項 failures 與 Chromium PNG 微量 rounding 仍需如實保留。
- 本輪完成即停止，不開始 Release Engineering。
