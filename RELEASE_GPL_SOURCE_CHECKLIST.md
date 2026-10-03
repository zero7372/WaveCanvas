# GPL corresponding-source delivery checklist

WaveCanvas 1.0.0 internal unsigned RC. GPL source gate BLOCKED; publicReleaseReady=false. The PREPARATION ZIP is not complete Corresponding Source.

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| Binary version, size and SHA256 identity | PASS | dev/reports/archive/gpl-source-2026-10-03/binary-verification.json and fresh ffmpeg/ffprobe version/buildconf/L outputs |
| Exact FFmpeg upstream revision | PASS | provider-release.json, ffmpeg-commit.json: 946fcce07b6dcd0331c8cc609192aeff5e1924f8 |
| Exact x264 upstream revision mapping | PASS | x264-sei.txt, binary-strings.json, VideoLAN x264-commit.json: 0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee; provider patch state separately BLOCKED |
| Full build configuration captured | PASS | licenses/FFmpeg/BUILD_CONFIG.txt; complete binary output |
| All explicit external enable flags inventoried | PASS | licenses/FFmpeg/DEPENDENCIES.json: 53 entries; transitive closure not implied |
| Matching upstream source archives acquired and hashed | PASS | dev/release-source/SOURCE-MANIFEST.json: six primary upstream downloads; hashes verified by package-gpl-source.py |
| Preparation ZIP extraction / file hash integrity | PASS | dev/release-source/ARTIFACT.json; ZIP FILE-HASHES.json; does not prove complete correspondence |
| Complete matching FFmpeg source artifact delivery | BLOCKED | Upstream source acquired; Gyan patches / complete source delivery unverified |
| GPL / other linked dependency exact source states | BLOCKED | x265 116b875 unresolved; Rubber Band/Xvid provider state unknown; other exact trees absent |
| All static/transitive dependency source closure | BLOCKED | DEPENDENCIES.json; provider package locks / static link map absent; no assumed exclusions |
| Gyan / dependency patches | BLOCKED | dev/release-source/PATCHES.md; unknown is not none |
| Matching build/install recipe | BLOCKED | dev/release-source/BUILD-RECIPE.md; compiler/config known; scripts/environment/order absent |
| Complete exact dependency copyright/license texts | BLOCKED | Seven selected upstream dependency license files acquired; remaining exact-source notices unresolved |
| Binary/source correspondence for complete package | BLOCKED | Partial mappings only; no provider closure or validated matching build |
| Complete source ZIP and release hash binding | BLOCKED | Only GPL-Source-PREPARATION.zip exists; formal GPL-Source.zip intentionally absent |
| Free source access alongside installer (GPLv3 6(d)) | BLOCKED | <OFFICIAL_RELEASE_URL> unresolved; no publication performed |
| Physical media written offer | N/A | Direct online source delivery planned; no physical distribution or written offer |
| Original MIT attribution retained | PASS | License.txt / licenses/WaveCanvas-LICENSE.txt byte identity; original 2017 attribution retained |
| Own rights chain / distribution boundary review | BLOCKED | Attribution retention alone does not establish rights chain or all distribution obligations |

Evidence names refer to dev/reports/archive/gpl-source-2026-10-03 unless otherwise stated. Every public requirement must pass before clearing the gate. Signing is separate and remains false. release:check reports technical integrity and public status separately; --public fails while blocked. See dev/reports/GPL-SOURCE-DELIVERY-REPORT.md for minimal remaining inputs.
