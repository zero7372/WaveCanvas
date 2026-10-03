#!/usr/bin/env bash
set -euo pipefail
work=$1
jobs=${2:-8}
prefix="$work/prefix"
mkdir -p "$work/build" "$prefix" "$work/output"
export PATH="/ucrt64/bin:/usr/bin"
export PKG_CONFIG_LIBDIR="$prefix/lib/pkgconfig"
export PKG_CONFIG_PATH="$PKG_CONFIG_LIBDIR"
export LC_ALL=C
# Build only from pinned, hash-verified source snapshots staged by build.ps1.
cd "$work/src/zlib"
make -f win32/Makefile.gcc -j"$jobs" CC=gcc AR=ar RC=windres CFLAGS='-O2 -Wall' libz.a
mkdir -p "$prefix/lib/pkgconfig" "$prefix/include"
cp libz.a "$prefix/lib/"
cp zlib.h zconf.h "$prefix/include/"
sed -e "s|@prefix@|$prefix|g" -e 's|@exec_prefix@|${prefix}|g' -e 's|@libdir@|${exec_prefix}/lib|g' -e 's|@sharedlibdir@|${libdir}|g' -e 's|@includedir@|${prefix}/include|g' -e 's|@VERSION@|1.3.2|g' zlib.pc.in > "$prefix/lib/pkgconfig/zlib.pc"
mkdir -p "$work/build/x264"
cd "$work/build/x264"
"$work/src/x264/configure" --prefix="$prefix" --host=x86_64-w64-mingw32 --enable-static --disable-cli --disable-opencl --disable-avs --disable-lavf --disable-ffms --disable-gpac --disable-lsmash --extra-ldflags='-static -static-libgcc'
make -j"$jobs"
make install
mkdir -p "$work/build/ffmpeg"
cd "$work/build/ffmpeg"
"$work/src/ffmpeg/configure" --prefix="$prefix" --target-os=mingw32 --arch=x86_64 --cc=gcc --cxx=g++ --enable-gpl --enable-version3 --enable-libx264 --enable-zlib --enable-static --disable-shared --disable-autodetect --disable-doc --disable-debug --disable-ffplay --disable-network --disable-hwaccels --extra-version=wavecanvas-controlled --extra-cflags="-I$prefix/include" --extra-ldflags="-L$prefix/lib -static -static-libgcc -Wl,-Map,$work/output/LINK-MAP.txt" --pkg-config-flags=--static
make -j"$jobs"
cp ffmpeg.exe ffprobe.exe "$work/output/"
for tool in ffmpeg ffprobe; do
    "$work/output/$tool.exe" -version > "$work/output/$tool-VERSION.txt" 2>&1
    "$work/output/$tool.exe" -buildconf > "$work/output/$tool-BUILD_CONFIG.txt" 2>&1
    "$work/output/$tool.exe" -L > "$work/output/$tool-LICENSE.txt" 2>&1
    objdump -p "$work/output/$tool.exe" > "$work/output/$tool-PE.txt"
done
cp config.h ffbuild/config.mak ffbuild/config.log "$work/output/"
pacman -Q > "$work/output/packages.txt"
gcc --version > "$work/output/compiler.txt"
ld --version > "$work/output/linker.txt"
nasm --version > "$work/output/nasm.txt"
make --version > "$work/output/make.txt"
pkg-config --version > "$work/output/pkg-config.txt"
sha256sum "$work/output/ffmpeg.exe" "$work/output/ffprobe.exe" > "$work/output/SHA256.txt"
