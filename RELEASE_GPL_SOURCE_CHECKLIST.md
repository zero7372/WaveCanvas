# WaveCanvas 1.0.0 controlled FFmpeg GPL artifact checklist

Status: engineering artifact readiness PASS; published=false. A source ZIP must always accompany the matching installer. Unpublished official URL metadata is separate from artifact readiness.

| Requirement | Status | Evidence |
|---|---|---|
| Exact FFmpeg source | PASS | manifests/SOURCES.lock.json; full sources/ffmpeg/ |
| Exact x264 source | PASS | manifests/SOURCES.lock.json; full sources/x264/ |
| Additional dependency source | PASS | sources/zlib/; matching original archive |
| Static library inventory | PASS | BUILD-MANIFEST.json linkedArchives; CLOSURE-REVIEW.json |
| System library exclusions | PASS | CLOSURE-REVIEW.json per-library compiler/Windows classification |
| Toolchain versions and packages | PASS | TOOLCHAIN-MANIFEST.json; TOOLCHAIN_PACKAGES.lock.json |
| Controlled build recipe | PASS | build-scripts/bootstrap.ps1, build.ps1, build.sh |
| Patch provenance | PASS | patches/PATCHES.md; 10956 original source files compared; zero changes |
| Configure flags | PASS | build-evidence/BUILD_CONFIG.txt; BUILD-MANIFEST.json |
| Binary hashes | PASS | vendor/ffmpeg/BUILD.json; licenses/FFmpeg/SHA256.txt |
| License closure | PASS | licenses/FFmpeg/dependencies/ and toolchain/; original source file notices |
| WaveCanvas attribution | PASS | License.txt byte-identical to licenses/WaveCanvas-LICENSE.txt |
| Process boundary review | PASS | standalone subprocesses/pipes; no linking into MIT application |
| Complete source artifact | PASS | release/WaveCanvas-1.0.0-GPL-Source.zip; FILE-HASHES.json |
| Offline source snapshots | PASS | all three sources/ and upstream/ original archives included |
| Build self-sufficiency | PASS | standalone script layout verified; pinned general tools separately bootstrapped |
| Co-delivery readiness | PASS | source ZIP beside installer; RELEASE-HASHES.txt; SOURCE_INFO.txt |
| Integrity gate | PASS | dev/tools/verify-gpl-source.py; npm run release:check -- --public |

General purpose tools/compiler System Libraries are explicitly reviewed exclusions, not source mappings claimed PASS. This is not legal certification. Historical Gyan preparation remains in Git history and prior reports; it is not the shipped runtime.
