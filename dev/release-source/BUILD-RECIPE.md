# Build recipe status: BLOCKED

Verified inputs: x86-64 static GPLv3-or-later FFmpeg, GCC 16.2.0 (Rev3, MSYS2), binary `-buildconf` flags in configuration/BUILD_CONFIG.txt, provider settings/versions in configuration/PROVIDER-README.txt. The provider site reports UCRT64 toolchain/packages. NASM and pthreads are reported by the bundled provider README; exact NASM, linker, make, MSYS2 package and winpthreads revisions are absent.

FFmpeg's `configure`, Makefiles and build documentation are in sources/ffmpeg. x264's configure/Makefile, Rubber Band build files and other acquired projects' upstream instructions are retained. These are upstream build systems, **not the matching Gyan build orchestration**.

No executable rebuild recipe is supplied because the required dependency closure and provider environment cannot be established. Copying the known flags into a guessed build command would not reproduce or prove correspondence to the bundled executables.

Required provider recipe details:

1. Lock MSYS2 UCRT64 environment, compiler/binutils/runtime packages, assembler and build tools, compiler/linker flags and environment variables.
2. Lock direct and transitive source trees, submodules, generated source inputs and patches. Review System Library / general-tool exclusions individually; record reasons rather than silently omit sources.
3. Supply dependency configure/build/install commands, actual topological build order and static `.pc` / link flags. The unknown transitive graph prevents establishing that order now.
4. Supply FFmpeg configure command (including environment-derived flags), build/install/strip commands and build logs/config.h/config.mak. Confirm whether the README's libmfx entry is an alias/stale metadata; current explicit flags enable libvpl.
5. Validate a clean build against binary capabilities, licenses and source state. Byte identity is useful evidence but not treated as the only legal test. Record any differences; never replace the production binary in this task.

`package-gpl-source.py` packages and verifies materials only; it is not a compiler/build script. Build recipe completion remains BLOCKED.
