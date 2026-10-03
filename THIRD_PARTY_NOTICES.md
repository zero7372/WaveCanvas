# WaveCanvas 1.0.0 third-party notices

WaveCanvas retains its original MIT license and copyright attribution in License.txt and licenses/WaveCanvas-LICENSE.txt. No attribution is removed or relicensed.

The shipped runtime is the **WaveCanvas controlled FFmpeg build**, GPL-3.0-or-later with libx264; FFmpeg n9.0.2 `946fcce07b6dcd0331c8cc609192aeff5e1924f8`, x264 `0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee`, zlib v1.3.2 `da607da739fa6047df13e66a2af6b8bec7c2a498`. WaveCanvas invokes standalone ffmpeg/ffprobe processes through pipes, without linking these libraries into the MIT application. Native AAC is used. Zero WaveCanvas source patches.

Source package distributed alongside the WaveCanvas 1.0.0 installer: **WaveCanvas-1.0.0-GPL-Source.zip**. Every distribution must provide this complete ZIP beside its matching installer and RELEASE-HASHES.txt. The official delivery location is [WaveCanvas 1.0.0 on GitHub Releases](https://github.com/zero7372/WaveCanvas/releases/tag/v1.0.0).

The ZIP contains complete pinned FFmpeg/x264/zlib snapshots, original archives, controlled recipes, toolchain locks, configurations, hashes and license texts. FFmpeg GPL/LGPL texts and original per-file notices remain in source; x264 GPLv2-or-later permits the GPLv3 combined build, and zlib retains its permissive license.

Compiler runtime libraries are explicitly reviewed under GPLv3 section 1 System Libraries: GCC libgcc/libgcc_eh/libatomic (GPLv3 plus Runtime Library Exception 3.1), MinGW C runtime and winpthreads standard POSIX runtime, plus Windows interface imports. Their exact MSYS2 binary package locks and complete installed licenses, including MIT/BSD/ZPL/public-domain notices, are retained. They are normal compiler components implementing standard interfaces, with publicly available source, and are not additional codec dependencies. This does not claim pristine upstream source/patch reconstruction of MSYS2's compiler packages. See manifests/CLOSURE-REVIEW.json in the ZIP and licenses/FFmpeg/DEPENDENCIES.json.

No third-party runtime DLL is required beyond Windows/UCRT OS components. Electron/Chromium and their notices remain in the builder's runtime LICENSE and LICENSES.chromium.html. Build tool dependencies are not product runtime dependencies. Engineering provenance review is not legal certification.
