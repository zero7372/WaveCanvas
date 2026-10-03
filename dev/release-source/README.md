# WaveCanvas 1.0.0 source preparation — BLOCKED

> Historical preparation material for the superseded provider runtime. This is not the current release source guide. WaveCanvas 1.0.0 now uses the controlled FFmpeg build and a complete corresponding-source ZIP; see [the current build guide](../ffmpeg-build/README.md) and [the current GPL checklist](../../RELEASE_GPL_SOURCE_CHECKLIST.md).

This material accompanies `9.0.2-essentials_build-www.gyan.dev`. It is **not complete Corresponding Source** and does not clear public distribution.

The preparation archive is `WaveCanvas-1.0.0-GPL-Source-PREPARATION.zip`. The intended complete release asset is `WaveCanvas-1.0.0-GPL-Source.zip`; that name must only be used after the closure, patches and build recipe are verified. Delivery URL: `<OFFICIAL_RELEASE_URL>` — unresolved release metadata, replace before public release. No owner/repository is invented.

Binary identities:

| File | Bytes | SHA-256 |
|---|---:|---|
| ffmpeg.exe | 105423872 | 3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec |
| ffprobe.exe | 105221120 | f0d36ecbbdd3bcfac3efa078c96c7271c2e68b3810595552ac3b7f17e9a65c52 |

`SOURCE-MANIFEST.json` maps binaries, acquired upstream archives and missing dependencies. `sources/` contains FFmpeg, x264, AviSynthPlus, vid.stab, Rubber Band and Xvid upstream snapshots. Each retains upstream license/copyright files. `licenses/` contains selected verbatim license texts; it is not the complete dependency notice collection. `configuration/BUILD_CONFIG.txt` is the complete binary buildconf output. `evidence/` contains fresh binary outputs and primary repository responses. `FILE-HASHES.json` hashes every included file other than itself.

FFmpeg upstream revision is `946fcce07b6dcd0331c8cc609192aeff5e1924f8`. x264's binary string and actual emitted SEI identify `r3223 0480cb0`, resolved by VideoLAN to `0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee`. These establish upstream revision mappings, not absence of provider modifications. Provider version strings with hashes resolve AviSynthPlus and vid.stab commits. Rubber Band/Xvid release archives are version-matched candidates; provider source state remains unproven. x265 `116b875` has not been resolved from the official repository. See `DEPENDENCIES.json`, `PATCHES.md` and `BUILD-RECIPE.md`.

To prepare/verify locally from the repository root:

1. Acquire the exact URLs recorded in `dev/release-source/SOURCE-MANIFEST.json` into ignored `release/gpl-source/upstream/`, verifying archive SHA-256 first. Never substitute a floating branch archive.
2. Run `python dev/tools/package-gpl-source.py` to assemble the preparation ZIP and verify all entries, inner manifests, source directories and hashes. No FFmpeg binaries, npm dependencies or installer are placed in this ZIP.
3. Run `npm run release:check`. Technical integrity may pass while GPL/public status stays BLOCKED. `npm run release:check -- --public` must fail until every public gate is satisfied.

Do not rebuild FFmpeg using guessed dependency versions. Obtain provider source locks (including transitive static libraries and local changes), patches or an explicit no-patch attestation, environment/toolchain package revisions, dependency configure/build/install scripts and link/build logs. Fill all unresolved entries, independently verify source closure, then construct the complete asset and host it free beside the installer. Direct synchronized source delivery is planned; this is not a written offer.
