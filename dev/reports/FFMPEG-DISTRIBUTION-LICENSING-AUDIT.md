# WaveCanvas FFmpeg Distribution & Licensing Audit

2026-10-03；基準 commit `271c08e8`，起始 working tree clean。這是 release 決策準備，沒有更換 binary、encoder、Project format 或 packaging config。

**This is a technical licensing and distribution audit, not legal advice.**

結論：Primary 採 A（bundle GPL FFmpeg + CPU libx264），但 source delivery 與法律邊界 review 是發布阻擋項。Fallback 採 C（advanced user-provided、經驗證的 GPL FFmpeg）；不是無設定的一般消費者版替代。B 留作未來研究，D 不作首版方案。

## Current build

先讀 Phase 1 report、README、vendor 的 LICENSE／README.txt／BUILD.json，再執行兩個 binary 的 `-version`、`-L`、SHA256 與 packaged copy 核對。完整 flags、library versions 與原始輸出保存於 [current-build.json](archive/ffmpeg-licensing-2026-10-03/current-build.json)。

| Item | 實際結果 |
|---|---|
| Version | `9.0.2-essentials_build-www.gyan.dev`，ffmpeg 與 ffprobe 相同 |
| Provider | Gyan Windows x64 essentials；gcc 16.2.0 Rev3／MSYS2 |
| Upstream source | `946fcce07b6dcd0331c8cc609192aeff5e1924f8`；README short hash 經 GitHub commits API 展開 |
| Linking | `--enable-static`；provider README: static=yes, shared=no。不是 WaveCanvas 靜態連結 libav* |
| License | binary `-L`：GPL version 3 or later；LICENSE 為完整 GPLv3 |
| Important flags | `--enable-gpl --enable-version3 --enable-static --enable-libx264` |
| Other GPL libraries | flags 含 libx265、libxvid、libvidstab、librubberband；未使用這些 codec 仍不能忽略已編入的授權 |
| Nonfree | configuration 未見 `--enable-nonfree` 或 libfdk-aac；這不是所有 dependency 已完成審核的證明 |
| Production | BGRA rawvideo stdin → libx264 medium／CRF18／yuv420p、native AAC320k、MP4／1080p60 |
| Encoder enumeration | libx264、h264_nvenc/qsv/amf/mf/d3d12va/vaapi、aac/aac_mf 存在；列出不等於 hardware runtime 可用 |

| Binary | Bytes | SHA256（vendor、BUILD、packaged 一致） |
|---|---:|---|
| ffmpeg.exe | 105423872 | `3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec` |
| ffprobe.exe | 105221120 | `f0d36ecbbdd3bcfac3efa078c96c7271c2e68b3810595552ac3b7f17e9a65c52` |

[Provider release](https://github.com/GyanD/codexffmpeg/releases/tag/9.0.2) 指向同一 FFmpeg commit；[Gyan build documentation](https://www.gyan.dev/ffmpeg/builds/) 是 provider 資訊入口。不要用浮動 latest URL 取代固定版本。

`--enable-gpl` 與 `--enable-version3` 及 binary 宣告確認這是 **GPLv3-or-later binary redistribution scenario**。FFmpeg 原始碼的 [LICENSE.md（本次commit）](https://github.com/FFmpeg/FFmpeg/blob/946fcce07b6dcd0331c8cc609192aeff5e1924f8/LICENSE.md) 列出 GPL components／external libraries 及 version3／nonfree 的影響。[x264 official licensing](https://www.videolan.org/developers/x264.html) 提供 GPL 或 commercial license；即使另購 x264 授權，也不會自動改變這份含其他 GPL components 的 Gyan binary。

## Current license state

| Scope | 已確認 | 尚未確認／發布缺口 |
|---|---|---|
| WaveCanvas source | package.json=MIT；root License.txt 是 MIT | copyright 行仍帶原作者／年份方括號，需確認 attribution／權利鏈及新增程式碼的權利；不能直接覆蓋原作者 |
| README | development warning／GPL／release compliance pending | 未宣稱 release-safe，維持 |
| FFmpeg executables | GPL text、provider README、version、flags、hashes，已打包三份metadata | exact complete corresponding source、dependency source／patches／build scripts、可取得的release source URL |
| Third-party notices | 原有 vendor license/provenance；本輪新增 [draft](../../THIRD_PARTY_NOTICES.md) | draft 未完成、未打包；所有 dependency copyrights／texts 仍待逐項收集 |
| Electron/Chromium | dist 有 LICENSE.electron.txt、LICENSES.chromium.html、另一個 ffmpeg.dll | 這個 Chromium media DLL 不是 Gyan exe；Electron／Chromium 與其他 npm/runtime notices 需獨立release audit |

技術邊界：electron/ffmpeg-runner.cjs 用 `spawn(binary, argumentArray)`、獨立 address space、標準 CLI／BGRA pipe／音訊檔與stderr；没有載入或連結 Gyan libav DLL，也不把 WaveCanvas project objects 傳進 FFmpeg。兩個 executable 隨同一套 app distribution 交付。

這支持「separate executable aggregation」的技術分析，**不直接裁定** WaveCanvas 必須改 GPL，也不保證 child process 一定免除 combined-work 問題。FSF 分析同時看通訊機制與語意；pipe 本身不是通行證，aggregate 的條款也不能限制個別 component 的權利。法律 review 應確認這份實際設計、EULA 與各來源權利。[GNU FAQ: aggregation](https://www.gnu.org/licenses/gpl-faq.en.html#MereAggregation)。

## Option A

**繼續 bundle GPL FFmpeg + libx264。** 離線、無 hardware encoder 的電腦仍可用 CPU 路徑；現有 quality、timing、錯誤／取消保護不必重寫。成本集中在來源可交付性與release治理。

不能只附 LICENSE 或 upstream Git link。對這兩個 static executables，須取得精確的 FFmpeg、所有需納入 corresponding source 的 linked libraries、patches、configure／build/install scripts、版本與license/copyright materials。未使用的編入 library 仍在inventory範圍。System Libraries／一般未修改工具是否排除須按實際條件判定；toolchain版本仍應記錄。

Provider README 的 FFmpeg commit、x264 `v0.165.3223` 等版本與 flags 是線索；尚未取得完整 dependency lock、patch set、recipe，也未重建驗證。**取得 provider 的完整匹配材料是第一個 gate**；若拿不到，後續另案以可控 recipe 重建 GPL FFmpeg、完整回歸、再核准production替換，不能以近似 source 冒充現有binary對應來源。

Online release 建議採 GPLv3 §6(d)：在同一release下載入口提供免費對應source與清楚指引；外部server可用但WaveCanvas仍負責可取得性。Physical/offline媒體另選§6(a)隨附source，或經review採§6(b) written offer（至少三年且符合持續support期間条件）；不要把偶爾非商業轉交用的§6(c)當一般release策略。[GNU GPLv3 §1/§4–6](https://www.gnu.org/licenses/gpl-3.0.html)。

## Option B

**Bundle LGPL-compatible FFmpeg，移除 libx264 與全部 GPL-only components。** Native AAC及MP4 mux不必依賴GPL encoder；NVENC／QSV／AMF可以在無GPL元件的build中提供，但各SDK/header/driver條件仍要審核。[FFmpeg hardware documentation](https://www.ffmpeg.org/general.html#Hardware-Acceleration)。

[BtbN build variants](https://github.com/BtbN/FFmpeg-Builds#build-variants) 明確有lgpl／lgpl-shared且排除x264/x265，是可調查供應商；本輪沒有下載或驗證某份LGPL binary，不能直接認證該variant全部依賴或能力。Gyan目前這份不是LGPL。

LGPL不等於沒有source義務。需確認LGPL2.1-or-later或LGPL3、每個library及static combination的修改／重新連結交付條件；若有動態libav DLL，仍须相對應source／notices及允許使用者替換的安排。WaveCanvas仍是獨立process的技術設計，但FFmpeg自身static libraries不可因此忽略。[LGPL2.1](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html)、[LGPL3](https://www.gnu.org/licenses/lgpl-3.0.html)。

FFmpeg **沒有現成的原生通用CPU H.264 encoder可直接代替libx264**；其官方codec表以external libx264／OpenH264提供software H.264。`h264` decoder存在不代表encoder存在。[FFmpeg supported codecs](https://www.ffmpeg.org/general.html)。

CPU候選是Windows Media Foundation（h264_mf）或libopenh264；兩者皆需品質／1080p60／rate-control／runtime availability驗證，不能保證等同CRF18。OpenH264 source為BSD2-clause，但Cisco預編譯binary有獨立條件，不能把其patent安排套用到自行static build或任意再打包DLL。[OpenH264 source license](https://github.com/cisco/openh264/blob/master/LICENSE)、[Cisco FAQ](https://www.openh264.org/faq.html)、[binary terms](https://www.openh264.org/BINARY_LICENSE.txt)。

因此B目前**沒有已驗證、合理universal且等質的CPU fallback**；不是說永遠無法建立。首版改成NVENC-only會排除其他廠牌／encoder失效的機器，不接受這項產品限制。

## Option C

**不bundle FFmpeg。** 外部路徑現在未實作；resolver固定vendor/resources，production args仍要求libx264。

| Mode | UX／Reliability／Offline | Security／version／distribution |
|---|---|---|
| 使用者自行安裝 | setup成本高、PATH衝突與support高；裝好後可離線 | 不自動執行PATH第一項；由使用者明確選路徑並驗證版本／能力。WaveCanvas沒交付binary的情境減少該binary再散布責任 |
| 首次啟動下載 | 較方便但首用依賴網路／proxy，失敗需retry | 如果WaveCanvas提供／mirror／控制binary下載，不可假設沒有conveying責任；第三方直連也要review角色。固定URL／hash／source materials，不能偷偷下載latest |
| Portable external path | 手動放入componentfolder後離線，便於固定版本 | 不混入app installer；hashmanifest與notice同包。若WaveCanvas另提供那包，仍是再散布 |
| Advanced executable setting | 對開發／進階用戶合理，一般用戶負擔高 | Main-only檢查及保存、非shell argv、source/version diagnostics；所有外部exe會以使用者權限執行，hash只證明identity不是安全性 |

可支持的策略：限定測過的GPL+libx264 build（同一品質路徑），驗證ffmpeg／需要时ffprobe的相容性、AAC／MP4／pixel formats、實際短encode與錯誤；未知hash標成unsupported而非阻止所有用戶自選。存於userData，不讓renderer arbitrary spawn。自動下載必須有trusted release manifest、固定digest、atomic install、failure rollback與offline說明。

## Option D

**Separate codec pack／installer optional component。** Core可變小，已有pack可離線，但首次下載、多套版本、更新／解除安裝、missing codec提示增加維護。Pack若由WaveCanvas散布GPL binaries，source與notices義務仍然存在；optional checkbox或不同zip檔不會自動改變combined-work判斷。參照前述GNU aggregation與GPL §6。

若未來採用，pack需自己的version／binary-source manifest／source endpoint、core允許的版本range及獨立安全更新，安裝通知要說明未裝時無法export。首版不值得為了表面授權分包增加此成本。

## H.264 encoder compatibility

以下license impact是component分析，非整份binary的最終license。Quality為工程預期，無本輪跨硬體比較；編入encoder仍可能在runtime失敗。

| Encoder | License impact | NVIDIA? | Intel? | AMD? | CPU fallback? | Quality／Availability | FFmpeg build implication |
|---|---|---|---|---|---|---|---|
| libx264 | GPL route，現有build GPL3+ | 否 | 否 | 否 | 是，本身CPU | 現有medium/CRF18基準；CPU負載高 | enable-gpl/libx264及source closure |
| h264_nvenc | 本身不要求x264 GPL；SDK/header/driver另審 | 是，支援NVENC的GPU+driver | 否 | 否 | 無 | 依GPU世代／設定；既有3080Ti測過，不代表全NVIDIA | nvenc/ffnvcodec；不允許GPL leftovers冒稱LGPL |
| h264_qsv | 同上；Intel runtime授權另審 | 否 | 是，支援QSV的Intel裝置+driver | 否 | 無可靠通用CPU保證 | iGPU停用／VM／driver可能不可用 | libvpl或對應QSV實作與runtime檢查 |
| h264_amf | 同上；AMD SDK/runtime另審 | 否 | 否 | 是，支援AMF的GPU+driver | 無 | 需AMD真機；quality不可照抄CRF | enable-amf與driver驗證 |
| h264_mf | system codec，wrapper可在LGPL build使用 | 否 | 否 | 否 | 候選，系統software MFT | 可不依賴GPU；OS media components、resolution/rate-control待測 | enable-mediafoundation；software與hardware枚舉分開 |
| libopenh264 | BSD source；Cisco binary條件／patents分開 | 否 | 否 | 否 | 候選CPU | 非x264相同preset／CRF；需畫質與效能bench | enable-libopenh264及source/binary路徑審核 |
| FFmpeg native H.264 | 不存在通用software encode替代 | — | — | — | 否 | decoder不可當encoder | 不能只指定-c:v h264就算fallback |

Hardware wrappers依據[FFmpeg official documentation](https://www.ffmpeg.org/general.html#Hardware-Acceleration)，MF依據下節來源；本輪只列舉現有binary capabilities，未做LGPL PoC或新增GPU測試。

既有Home report：x264123.503s、NVENC123.020s，差0.391%；FFmpeg CPU平均12.551%→1.807%。Phase2A CPU正式路徑已降至66.83s／0.901×realtime。資料来自 [Home benchmark](VIDEO-EXPORT-HOME-GPU-BENCHMARK.md) 與 [Phase2A report](VIDEO-EXPORT-PHASE2A-CAPTURE-OPTIMIZATION.md)，不同實驗不可推定Phase2A後NVENC收益。保留CPU是相容性／既有品質的決策，不是保證任何弱CPU都能即時encode。

Release minimum test coverage：NVIDIA、Intel laptop iGPU、AMD、hardware encoder unavailable／disabled、VM／Windows media components缺失；每個失效情境都須能走已驗證CPU路徑或清楚報錯，不能假設所有laptop有NVIDIA。

## Windows alternatives

Media Foundation有[H.264 encoder](https://learn.microsoft.com/en-us/windows/win32/medfound/h-264-video-encoder)、[AAC-LC encoder](https://learn.microsoft.com/en-us/windows/win32/medfound/aac-encoder) 與 [MPEG-4 sink](https://learn.microsoft.com/en-us/windows/win32/medfound/mpeg-4-file-sink)。理論上可用native helper完成H.264+AAC+MP4，system software MFT是可行研究方向，不需只支持RTX。

FFmpeg同commit的 [mfenc.c](https://github.com/FFmpeg/FFmpeg/blob/946fcce07b6dcd0331c8cc609192aeff5e1924f8/libavcodec/mfenc.c) 提供h264_mf、hw_encoding選項（預設0），並指出Windows N預設缺MF。仍須測1080p60、格式轉換、timestamps、AACdelay、B-frame PTS/DTS、cancel及atomic output；設定hw_encoding=0不等於所有系統一定有可用software codec。

WebCodecs支持顯式timestamps／queue管理，但spec不要求任何特定codec，AAC/H.264須在實際Electron版本用isConfigSupported與encode測試；還要另做MP4 mux。[W3C WebCodecs](https://www.w3.org/TR/webcodecs/)。完整DOM compositor frame必須接入同一deterministic capture，不能改成只錄canvas或realtime MediaRecorder來替代現有品質。

Electron現有offscreen paint是capture能力，不是H.264/AAC/MP4 export服務；即使Chromium有媒體codec，也不能據此斷言完整組合可用。Native MF helper／WebCodecs均有較高工程成本，本輪不實作、不更改renderer security或export architecture。

## Build size

MiB=2^20 bytes。現有exe pair **200.89MiB**，vendor含metadata **200.96MiB**；unpacked約**569.94MiB**，扣掉整個Gyanvendor約**368.98MiB**。Electron的ffmpeg.dll仍在core，不因移除Gyan而消失。

| Option | Unpacked planning | Installer／download planning | Maintenance |
|---|---|---|---|
| A | 現有約569.95MiB + 新notices少量 | 尚無installer；下載規劃150–250MiB，低信心，須實際壓縮量測 | 維持一個vendor/source closure |
| B | 約368.98 + S MiB；S是新LGPL runtime實測值 | Core compressed + LGPL compressed；若假設S=30–200MiB，總約399–569MiB unpacked，非已量測承諾 | build／CPU fallback／多GPU矩陣較重 |
| C | 約368.98MiB + 外部path功能少量；使用者另裝runtime佔磁碟 | Core規劃120–220MiB，另下載FFmpeg；數字為粗略budget | binary支援版本與diagnostics成本高 |
| D | Core約368.98MiB；裝現有pack後仍約569.95MiB | Core budget120–220MiB + pack；總成本不因分包消失 | 兩套release/update/version矩陣 |

上述installer ranges是工程budget，**不是測得的NSIS大小**，壓縮算法、assets、簽章、架構會改變結果。Gyan網站當次essentials zip約109MB（十進位）、7z約34MB，含ffplay等，不等同只包這兩個exe的installer增量。來源archive大小未取得，不計入appbinary估算；source下載及hosting另預算。LGPL標籤本身不保證體積小，裁剪無需codec可能降低大小但需另做格式相容性audit。

## Compliance artifacts

以下是針對A的redistribution obligation／delivery matrix；法定條件與建議交付品分開，不把About menu當萬用合規保證。

| Area | Required preparation | Current status／gate |
|---|---|---|
| License／notices | 保留GPLv3全文、copyright、no-warranty及各library原notice；修改須記錄 | GPL全文已存在；dependency texts／copyright bundle未完成 |
| Corresponding source | 精確FFmpeg與納入義務的linked依賴、patches、build/install scripts | 只有commit/version線索，不足；release blocked |
| Source delivery | Online採§6(d)明確免費下載；offline另設§6(a)/(b) | 未有公開endpoint／written offer，不能當已完成 |
| Manifest（工程建議） | binary ↔ source ↔ dependency revisions ↔ recipe/patches ↔ hashes | 本輪binary核對完成；其餘待補 |
| Build validation（工程gate） | clean rebuild與patch review、功能回歸；記錄非byte-identical的原因 | 本輪沒有source rebuild；byte-identical不是單獨法定測試 |
| Rights／EULA | GPL component權利不能被總包條款取消；source修改／reverse-engineering限制須review | own MIT與GPL分界待review；不得整包宣稱onlyMIT |
| Installation information | 視GPLv3 User Product交付／鎖定條件判定適用性 | 普通unpacked app非鎖定硬體產品；不能推定所有未來installer都免除 |
| Patents | H.264/AAC等專利與地域／商業分發另review | LGPL／GPL／GPU／Cisco安排不是全球patent clearance |

GPL部分對照repo內vendor LICENSE及 [GPLv3](https://www.gnu.org/licenses/gpl-3.0.html)；FFmpeg提供的[legal checklist](https://ffmpeg.org/legal.html)主要是linking LGPL libraries情境，不能原封套到本案GPL exe。專利是獨立release review項目。

建議installed layout（**proposal，尚未改package.json**）：

```text
WaveCanvas/
  LICENSE.electron.txt
  LICENSES.chromium.html
  resources/
    app.asar                  # app own MIT License.txt、README
    ffmpeg/
      ffmpeg.exe
      ffprobe.exe
      LICENSE                 # GPLv3完整原文
      README.txt              # provider原文
      BUILD.json              # 現有metadata保留
      SOURCE_INFO.txt         # 固定release source網址／manifest digest
      licenses/               # 每個library全文／copyright notices
    docs/
      THIRD_PARTY_NOTICES.md
      FFMPEG-SOURCE-MANIFEST.json
```

另在release下載頁提供 `source-distribution/<release-id>/corresponding-source.tar.xz` 與hashmanifest；不用塞进產品repo或app.asar。

以未來 `WaveCanvas v1.0.0` 為例（**名稱範例，未建立tag／網址**）：release manifest綁WaveCanvas tag/full SHA、上表兩個binary SHA、FFmpeg full commit、provider9.0.2、configure flags、compiler16.2.0、每個dependency exact revision、source tarball hashes、patches hashes、recipe hashes。下載頁並列app與source；SOURCE_INFO中的URL必須是實際部署且可下載的immutable release endpoint，不能留example.com／TODO後發布。

流程：取得材料→核對dependency closure（README版本不是全部鎖定資料）→保存tarballs／patches／recipe→clean rebuild／檢查來源匹配→產生release/source manifest→同時publish binary/source→獨立環境測下載與hash→封存該release全部材料。比對結果不符就阻擋；upstream消失仍由自有mirror提供，保留舊binary仍可下載期間的source。

Third-party draft按實際included libraries分類；FFmpeg內部不同BSD／Apache／LGPL條款仍須保留，不可通通填GPL。npm／Electron／Chromium notices另章。本輪draft不是完整SBOM或redistribution完成聲明。

## Installer implications

下一輪需copy上述notice/sourceinfo/license files，擴充extraResources精確filter與build allowlist；現在audit要求resources只有app.asar/ffmpeg、FFmpeg恰5files，會拒絕新docs/licenses。不要只新增文件卻漏掉package allowlist。

建議installer license頁清楚區分WaveCanvas MIT／第三方授權，附source連結；installed全文可離線查看，release下載頁也顯示。Help → Open Source Licenses值得實作，提供本地notices／GPL全文及source URL。這是可發現性建議，非聲稱特定menu或逐一click接受GPL是普遍法定要求。EULA不得覆蓋GPL元件權利。About UI不應要求上網才看license。

## Decision matrix

Low/Medium/High表示負擔；UX/Compatibility欄以括號註明好壞，避免數值方向混淆。

| Option | Compliance complexity | UX | Compatibility | Size | Engineering cost | Maintenance |
|---|---|---|---|---|---|---|
| A Bundle GPL | High：完整source closure／delivery | Low負擔：裝完可離線 | Low風險：已有CPUfallback | High：現有570MiB | Low功能改動／Medium release工作 | Medium：單套可控vendor/source |
| B Bundle LGPL | Medium–High：依賴、LGPL仍有義務 | Medium：新fallback／quality差異 | High風險：GPU與CPU候選未驗證 | Medium–High：取決裁剪，不由license保證 | High：encoder策略及回歸 | High：多硬體與build矩陣 |
| C User-provided | Low binary交付／Medium邊界review | High負擔：設定與support | Medium–High：版本漂移，限定build可緩解 | Low core；使用者仍另裝codec | Medium：安全resolver／capability診斷 | High：外部build支援 |
| D Optional pack | High：GPLpack仍需完整材料 | Medium：下載與missingcodec | Medium：pack/core版本匹配 | Low core／High總安裝 | Medium–High：packinstaller/updater | High：兩套release與安全更新 |

## Recommendation

**Primary: A，bundle GPL FFmpeg + libx264，完成source-first release gates後才公開。** 最小產品改動、現有CPUfallback、離線UX與已驗證quality優先；檔案體積及GPL治理成本接受。不是立刻核准現有Gyan binary發布。無完整對應來源就停在development狀態，另案建立可控GPLbuild，不能省略gate。

**Fallback: C，advanced user-provided GPL FFmpeg（維持libx264）。** 若無法取得／交付bundle的source材料或不能接受其分发工作，發布不含Gyan的advanced版，明確揭露需自裝相容runtime、不能裝完即export。優先明確path／pinned compatibility，避免首啟動隱性下載；若由WaveCanvas提供外部pack，回到A/D義務。此選項需要獨立實作，不宣稱目前已可用。

B作未來compatibility PoC：先驗證MF／OpenH264 softwarefallback再考慮LGPL路線；D留待有獨立component更新需求時。任何策略的GPLcombined-work、copyright／EULA與patent結論均需專業review。

## Implementation checklist

1. Release owner確認WaveCanvas MIT attribution／權利鏈，審核separateprocess設計與EULA；不改原作者copyright作為捷徑。
2. 向provider取得現有binary的完整source／dependency revisions／patches／recipes；無法取得則選controlled GPL rebuild的另案方案或C，保持release gate關閉。
3. 對FFmpeg與全部編入dependencies建立version/license/copyright/source inventory；static libraries／非GPL notices都涵蓋，System Libraries例外逐項判定。
4. 完成THIRD_PARTY_NOTICES.md草稿的所有pending，加入完整license files；獨立收集Electron/Chromium/npm實際交付項，不把devDependencies全部混入GPL。
5. 產生固定release source archive、SOURCE_INFO與binary-source-build hashmanifest；移除所有placeholder，clean rebuild／來源核對並封存結果。
6. 部署source和app同一release入口；測免費取得／digest，訂保留與mirror責任。physical／offline另決定source delivery；如用written offer，指定履行owner與期間。
7. 下一輪修改package extraResources、build audit與installercopy；新增Help本地licenses入口、下載頁／installer notices；review rights／translation一致性。
8. 做四類hardware+無encoder相容性、Node／Project／Electron／Export／Preferences／Browser regression、packaged file/source link/hash audit；改binary必須重新跑determinism與真實short/full export。
9. Security update將binary與matching source同步更新，不能只換exe；保留舊release證據。
10. Patent／jurisdiction與法律review結束後，按實際完成交付項記錄release decision；不以本報告或draft宣稱fully legally compliant。

本輪validation：binary版本／license／flags與vendor、BUILD、packaged hash一致；資料與來源交叉核對；maintenance audit（25份Markdown／52個local links）、本輪README/audit/draft全部19個local links、repository tests3/3及staged diff check通過。沒有production code/config變更，因此未重跑耗時GUI/export或rebuild；既有dist不因文件更新自動成為新release build。本輪沒有LGPL下載、compatibilityproof、source全量下載或hosting發布。

## Legal disclaimer

**This is a technical licensing and distribution audit, not legal advice.** 本文區分已驗證技術事實、官方條款、工程建議與未驗證候選。Current release-safe：**尚未完成發布準備**；不是宣稱GPL禁止分發，也不是對產品整體合法性的保證。
