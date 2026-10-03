# WaveCanvas 1.0.0 GPL Source Delivery / Public Release Gate

2026-10-03，Windows x64。Technical RC=true；signed=false；GPL source gate=BLOCKED；publicReleaseReady=false。本輪完成可驗證的 source preparation、installed license resources、hashes 與防止誤報 ready 的 release gate。**沒有把缺少 provider provenance 的材料標成完整 Corresponding Source。**

## Bundled binary verification

重新執行 RC 的兩支 binary，未沿用舊 report 作為驗證結果。Vendor、RC 與本輪重新安裝的 executable hashes 均相同。

| Binary | Bytes | SHA-256 |
|---|---:|---|
| ffmpeg.exe | 105423872 | 3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec |
| ffprobe.exe | 105221120 | f0d36ecbbdd3bcfac3efa078c96c7271c2e68b3810595552ac3b7f17e9a65c52 |

版本 `9.0.2-essentials_build-www.gyan.dev`；compiler `gcc 16.2.0 (Rev3, Built by MSYS2 project)`；binary `-L` 為 GPLv3-or-later。完整 `-version`、`-buildconf`、`-L` 保存於 [fresh evidence](archive/gpl-source-2026-10-03/binary-verification.json) 旁的六份 txt。完整 buildconf 也保存於 [BUILD_CONFIG.txt](../../licenses/FFmpeg/BUILD_CONFIG.txt)，隨 installer 安裝；包含 `--enable-gpl --enable-version3 --enable-static --enable-libx264`，未啟用 `--enable-nonfree`。

## Exact FFmpeg mapping

[Gyan 官方 release](https://github.com/GyanD/codexffmpeg/releases/tag/9.0.2) 與 bundled README 指向 `946fcce07b`；[FFmpeg 官方 commit](https://github.com/FFmpeg/FFmpeg/commit/946fcce07b6dcd0331c8cc609192aeff5e1924f8) 解析為 `946fcce07b6dcd0331c8cc609192aeff5e1924f8`。已另查官方 annotated tag `n9.0.2`，tag object `ce8f11b9fac4cd7ccfb41ca7c01bc17f5cda8cc3` 解參照後正是此 commit；證據 [ffmpeg-tag.json](archive/gpl-source-2026-10-03/ffmpeg-tag.json)。因此 exact upstream mapping=PASS，不只依賴「9.0.2」字樣。

[Gyan 官方 build page](https://www.gyan.dev/ffmpeg/builds/) 列 build date 2026-09-19；GitHub release published_at 為 2026-09-20T06:40:33Z；FFmpeg commit committer date 為 2026-09-17T23:19:50Z。三者含義不同，不混作 compiler timestamp。官方 page 指出 UCRT64 toolchain/packages；完整工具/package revisions 仍未知。

已下載官方 FFmpeg repository 的 exact commit ZIP，保留原始 archive 與 hash；取得 upstream source 不等於證明 Gyan source tree 沒有 patches。

## libx264 mapping

不只使用 provider 的 `v0.165.3223`。本輪讀取 binary 字串，並用 RC 真正 encode 一幀 H.264；其 SEI 顯示 `x264 - core 165 r3223 0480cb0`。VideoLAN 官方 API 將 hash 解析為 `0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee`。證據：[SEI](archive/gpl-source-2026-10-03/x264-sei.txt)、[binary strings](archive/gpl-source-2026-10-03/binary-strings.json)、[official commit response](archive/gpl-source-2026-10-03/x264-commit.json)。

已由 VideoLAN 官方 API 下載該 commit source ZIP，保留 `COPYING` 與 GPL-2.0-or-later source headers。**Upstream revision mapping=PASS；Gyan exact source state / patches / build recipe=BLOCKED。** 沒有把 binary version 字串當成 no-patch 證明。臨時一幀 bitstream 已移除，文字證據留存。

## GPL dependency audit

[DEPENDENCIES.json](../../licenses/FFmpeg/DEPENDENCIES.json) 對完整 buildconf 的 **53 個 explicit external/hardware enable flags** 建立 entries；[readable inventory](../release-source/DEPENDENCIES.md) 列版本、preliminary license families 與 mapping 狀態。包含 GPL、LGPL、permissive、MPL、dual-license、system/runtime/header interfaces，沒有只處理 x264。

補查的 GPL/interface-exception component 包括 AviSynthPlus；Windows FFmpeg 用 runtime loading，不能因 enable flag 宣稱 bundled avisynth.dll。採保守方式保留 source/header/license snapshot。Reported AviSynthPlus、vid.stab short hashes 已由 upstream API 解析；provider modifications 未證明。

重要更正：Gyan 報告的 vid.stab commit `e2445c4081658318223762a696eb1c645c2d7168` 內有 LGPL-2.1-or-later LICENSE、COPYING.LESSER 與 RELICENSE.md。不能以舊 v1.1.2 的 GPL label 覆蓋此 commit。FFmpeg exact LICENSE.md/configure 仍把 vid.stab 列在 GPL group；兩份證據均保留，provider state 仍 BLOCKED。[Exact upstream license](https://github.com/georgmartius/vid.stab/blob/e2445c4081658318223762a696eb1c645c2d7168/LICENSE)。

Rubber Band/Xvid 已取得 version-matched upstream archives，但無 provider source-state attestation。x265 binary string `4.3+45-116b875` 與 README 一致；官方 Bitbucket commit lookup 回覆 Commit not found，未以非官方 mirror 填補為 exact lock。證據 [revision-research.json](archive/gpl-source-2026-10-03/revision-research.json)。

所有靜態 linked source 不能因 LGPL/permissive 標籤就省略。Provider 未提供完整 transitive graph/static link map，許多 direct libraries（如 fontconfig、iconv、GnuTLS、GMP、bzlib、lzma、zlib）連版本都未列。Inventory 列 potential transitive candidates，明確標為未確認 linked；未自行加入 System Library/general-tool exemptions。Header、driver、GCC/MinGW runtime exclusions 仍需實際資料逐一判斷。License classifications 除取得的 exact texts 外均為 preliminary，**不是完整 SBOM 或法律證明**。

## Source artifact contents

[Preparation artifact](../../release/WaveCanvas-1.0.0-GPL-Source-PREPARATION.zip)：73,110,995 bytes（69.72 MiB），12,093 ZIP entries。名稱含 PREPARATION，README/manifest 明確 BLOCKED。未產生會誤導的正式 `WaveCanvas-1.0.0-GPL-Source.zip`。

Archive 含 `sources/{ffmpeg,x264,avisynth,vidstab,rubberband,xvid}/`、六份原始 upstream archives、README、SOURCE-MANIFEST.json、DEPENDENCIES.json/md、BUILD-RECIPE.md、PATCHES.md、完整 configuration、selected licenses、fresh primary/binary evidence、FILE-HASHES.json。完整 FFmpeg source 包含 COPYING 與 upstream build systems，各 upstream 檔案保留 source copyright。npm dependencies 沒有混入 source tree。

[package-gpl-source.py](../tools/package-gpl-source.py) 驗證原始 archive hashes，建立 source directories，逐一讀取／decompress 所有 ZIP entries、核對 inner manifest 與每個 file digest，再實際解壓至 ignored staging temporary directory並核對解壓檔案。Result：[ARTIFACT.json](../release-source/ARTIFACT.json)。不是只確認 ZIP filename 存在。大型 source trees/archives 都留在 ignored `release/gpl-source/`／`release/`，沒有 commit 到 Git。

## Build recipe

[BUILD-RECIPE.md](../release-source/BUILD-RECIPE.md) 記錄 compiler、configuration、static/pthreads/NASM 線索、已取得 upstream build files與仍缺的 matching orchestration。Provider [repository tree response](archive/gpl-source-2026-10-03/provider-repository-tree.json) 只有 README/.github support 資料；inspected release assets 是 binary packages，沒有完整 matching source/scripts attachment。這是本輪查得的範圍，未聲稱全網絕不可能取得。

Matching dependency commands/build order、patches、MSYS2 package locks、compiler/linker/environment flags、generated configure files、strip/install commands 未取得；recipe=BLOCKED。沒有把已知 flags 拼成猜測 command 後聲稱能重建現有 binary。

## Patches

[PATCHES.md](../release-source/PATCHES.md)：本輪沒有對取得的 upstream snapshots 套 WaveCanvas patches，沒有更動 vendor binary。Gyan FFmpeg/dependency patches=UNKNOWN。沒有用「none known」取代必須證明的 no-patch state。

## Binary/source manifest

[SOURCE-MANIFEST.json](../release-source/SOURCE-MANIFEST.json) 包含兩支 binary 的 name/bytes/hash/version、FFmpeg/x264 revisions、每份取得的 archive URL/hash/size、全部 dependency entries、patch/recipe/static/source/license/delivery 狀態。Installed 等價檔為 `licenses/FFmpeg/SOURCE_MANIFEST.json`，release 的 `source-info/SOURCE_MANIFEST.json` 也核對 byte identity。

`sourceArchive`/`sourceArchiveSha256` 保持 null，因完整 archive 尚不存在；`preparationArchive` 與 external ARTIFACT.json 正確記錄準備包，不冒充 formal source asset。Artifact JSON 另以 sourceManifestSha256 綁定 mapping，避免循環自我 hash。

## Hashes

| Artifact | SHA-256 |
|---|---|
| Rebuilt installer | b7e6f25ef95b442aef4126c8852cfa1fa7b52177cba8a4a6cd01ed00d4fe9c8c |
| GPL source PREPARATION ZIP | cc383c4c9143844508113b8fbad8b08d8076567d112de050908f970431d95fce |
| FFmpeg upstream ZIP | 8cffa6ccf78df6d39d57bd61baaf19e8bf0a7d590eef0d838de69932e8de3572 |
| x264 upstream ZIP | d8f276b5a7595ff9608890a32863dc51d8fd97454e908b4dd90ede8fb4b2490a |

其他 source archive hashes 全列於 manifest；[release hash snapshot](../release-source/RELEASE-HASHES.txt) 包含 installer、unchanged executable pair、licenses、docs、source manifest、preparation ZIP 與 ARTIFACT.json。正式完整 source ZIP hash 尚無。

## THIRD_PARTY_NOTICES

[THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) 與 installed copy 同步，列正式 planned filename、實際 preparation filename、未定 URL、GPL/source blockers、x264 mapping、AviSynthPlus、vid.stab exact upstream license 更正與 IJG attribution。完整 dependency notice collection 仍未完成，沒有寫成「source available online」。Electron/Chromium notices保留，npm／自身 source distribution 邊界獨立處理。

原 [MIT License.txt](../../License.txt) 與 `licenses/WaveCanvas-LICENSE.txt` byte-identical，原 2017 Karteek Suryadevara/V3ng3nc3 attribution 未移除或改成 GPL。原 checklist 的 rights chain/distribution boundary review 仍需完成，單純保留 attribution 不等於完成該 review。

## Installed license resources

因 installed SOURCE_INFO/notices 實際改變，依要求重新 build NSIS installer；app、electron、vendor、原 MIT 檔案沒有程式碼變更。WaveCanvas.exe hash仍是 `af76b2dc18fb047858b4edaabb1e7a1d6b3f5bb1e60c67a54ef584cee3c46b62`。Installer 169,102,235 bytes（161.27 MiB），增加的材料為 license metadata/text，source ZIP 未打進 installer/resources/app.asar。

新 [license allowlist](../tools/license-resources.cjs) 與 package build filter/audit 同步，17 files：原材料、full BUILD_CONFIG、dependency inventory與七份 selected dependency license files。新 installer 已 per-user 安裝至原位置。

驗證：[installed sanity](archive/gpl-source-2026-10-03/installed-sanity.json) **27/27 PASS**，含所有 installed license hashes、兩支 binary hashes、existing normal user business files、version/registry/association/shortcut、unsigned、沒有 source ZIP；[installed license API/UI](archive/gpl-source-2026-10-03/license-ui-qa.json) **3/3 PASS**。初次 sanity test 用錯 Installed Apps DisplayName（實際含 version）；UI harness曾缺 log directory及未等待 async dialog。只修正 dev QA harness後重跑通過；沒有因這些測試問題修改 app。初次輸出留存，最終結果如上。

## Release URL/source delivery strategy

Git remote 為空，使用者確認尚無 repo/release URL。`<OFFICIAL_RELEASE_URL>` 明確為 **unresolved release metadata**；沒有捏造 owner/repository。預定正式 source archive免費與 binary installer 在同一 fixed release entry 同步提供，採直接 source delivery；不引入未授權／不必要的 written offer。[GPLv3 text](../../licenses/FFmpeg/LICENSE) 的 source distribution條款作為 review 依據。

本轮沒有 push、publish、聯絡 provider、簽章或 certificate setup。Endpoint 尚未確定，不能測試公開免費下載可用性。

## RELEASE_GPL_SOURCE_CHECKLIST result

[Checklist](../../RELEASE_GPL_SOURCE_CHECKLIST.md)：8 PASS、10 BLOCKED、1 N/A。PASS 都有 evidence path，範圍限定為已證明的事實。整體 **BLOCKED**：來源 closure/patches/recipe/notices/full correspondence/delivery/rights review 尚未全部完成。

## release:check

`npm run release:check` 技術完整性 **PASS (exit 0)**；報告 signed=false、GPL source gate=BLOCKED、publicReleaseReady=false。新檢查包括 complete/preparation asset 區別、artifact／manifest／release hash binding、installed resource與release docs同步；public gate檢查 dependency states/exclusions、patch provenance、matching recipe、complete archive/inner contents、notices與 URL/placeholders。

`npm run release:check -- --public` **預期拒絕 (exit 1)**；[public check evidence](archive/gpl-source-2026-10-03/public-gate-check.txt)。沒有將技術 PASS 誤作 public readiness。完整狀態與 reasons 在 [release-status.json](archive/gpl-source-2026-10-03/release-status.json)。當所有前置 gate 通過時，還會由 verify-gpl-source.py 檢查 ZIP contents/inner manifest/source directories/recipe/patch evidence/hash coverage；missing/invalid materials fail closed。

Node tests **125/125 PASS**（含三項 GPL gate negative tests）；[test output](archive/gpl-source-2026-10-03/node-tests.txt)。Python scripts syntax parsing PASS；package extraction/hash checks PASS；repository maintenance/local-links audit PASS。沒有重跑 frozen core 全 export QA，因 app/electron/vendor 與 WaveCanvas.exe 均未變更；既有完整 workflow/export QA仍見前輪 release report。

## Git

基準 `490deec` 未 amend。Commit subject：`Prepare GPL corresponding source artifacts`；不使用暗示 gate 已完成的 completion subject。此 report與小型 manifests/metadata/scripts/notices/hash snapshot一起 commit；大型 staging與ZIP依既有 /release/ ignore規則留作本機 artifacts。Final commit hash／clean tree由 commit後的 git log/status驗證，最終回覆列出。No push/publication。

## Final public release status

| Status | Result |
|---|---|
| Technical RC | true |
| Signed | false — separate status; Windows Unknown Publisher / SmartScreen仍可能出現 |
| GPL source gate | BLOCKED |
| Public release ready | false |

## Remaining blockers

最小人工提供／決定事項：

1. **Provider matching build/source provenance**：Gyan 此 binary pair 的完整 direct/transitive source locks（含 x265）、local/generated source changes、patch set或有證據的 no-patch聲明、工具鏈 package versions、matching dependency/FFmpeg build/install scripts/logs。這份材料可一起關閉 source closure、recipe、patch與 exact notices工作；目前 primary查得資料不足。若取得不到，需要另案決定是否改用可控、可交付完整 source 的重建 binary；本輪沒有進行替換。
2. **Release metadata**：決定官方 repo/release destination或等價固定 endpoint，之後同步上傳完整 source／installer，替換 placeholder並驗證免費可取得。單填 URL 無法解除其他 source blockers。
3. **Distribution review**：完成既有 rights chain/distribution boundary與全數 exact-source copyright/license notices review。Selected texts不是全部所需 materials；不能由準備包推定全數授權完成。

不需要人工猜出每個 missing revision；應取得 matching provider資料，再由工程驗證。現有 ZIP、hashes、installed files與 source mapping已完成可進行的工作，阻塞項保留具體證據及需求。

## Legal disclaimer

此為工程 source provenance／delivery audit，不是法律意見或合規認證。Unknowns 未推定為免除義務；technical gate PASS不等於法律合規。本輪所留資料支持 preparation facts，不能代替完整 matching Corresponding Source。
