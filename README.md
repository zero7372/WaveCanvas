# WaveCanvas

English | [繁體中文](README_zh-TW.md)

A Windows desktop tool for creating music visualizers, lyric videos, and synchronized audio-reactive visuals.

## Why I made WaveCanvas

WaveCanvas is, quite literally, a vibe-coded project.

I came across a lot of online music visualizer and lyric video tools, but many of them felt more complex and professional than what I actually wanted to use.

And if I really need that level of control, I would rather just use After Effects.

So I decided to build something simpler and more direct: load a song, create a visualizer, add lyrics, adjust timing, and export a video without having to learn an entire professional workflow first.

WaveCanvas was built around a very simple idea: it should be easy enough that I would actually want to open it and use it.

Because of that, some parts of the workflow may still feel unconventional or imperfect compared with traditional video-editing software. The project has always prioritized simplicity and practical use over trying to become a full professional editor.

A large part of WaveCanvas was developed with the help of GPT and Codex. They assisted throughout the process, from prototyping and architecture to debugging, testing, the project system, video export, and release engineering. I guided the product direction and made the decisions about what to build.

Version 1.0 does not mean WaveCanvas is perfect. It simply means it has reached the point where I am comfortable releasing it publicly and using it myself.

I plan to keep improving it over time, fixing awkward parts of the workflow and adding features when they genuinely make the tool better.

## Features

- Music visualizer layouts with Circle, Square, and Linear styles.
- Bilingual lyrics, LRC and SRT import, and a Timing Editor.
- Song Info, background image modes, and presets.
- `.waveproj` projects with Save / Save As, autosave, backups, and Recent Projects.
- Collect Project to copy external assets into a portable project folder.
- Installed system font enumeration.
- Deterministic MP4 export: H.264 / AAC at 1920×1080, 60 fps.
- Windows installer with English and Traditional Chinese setup languages.

## Installation

Download **WaveCanvas-Setup-1.0.0.exe** from [Releases](https://github.com/zero7372/WaveCanvas/releases). Version 1.0.0 targets Windows x64.

The assisted setup wizard lets you choose the installation directory and optionally create a desktop shortcut. It supports English and Traditional Chinese, creates a Start Menu shortcut, and associates `.waveproj` files with WaveCanvas. Uninstalling preserves projects and application settings.

**The installer is currently unsigned.** Windows SmartScreen or an Unknown Publisher prompt may appear for this reason. Code signing is not configured for version 1.0.0.

Installer languages are English / Traditional Chinese; application localization is currently incomplete, and the existing interface contains both languages.

## Quick Start

1. Create or open a project.
2. Load an audio file.
3. Choose a visualizer layout and adjust its appearance and background.
4. Import or edit lyrics and timing if needed.
5. Preview the song and visuals.
6. Export an MP4 video.

## Project Files

`.waveproj` files save project state, media paths, edited lyrics and timing, and visual settings. Save / Save As, autosave, backups, and Recent Projects help you continue working later.

Projects reference media files. **Collect Project** copies external assets and updates their references to create a folder structure that is easier to move between computers. It does not create a ZIP package or embed fonts; keep the collected folder together and install the required fonts on the destination computer.

## Supported Inputs

- **Audio:** WAV, MP3, FLAC, OGG, M4A, AAC, and Opus.
- **Lyrics:** LRC and SRT.

## Export

The current export target is **MP4 with H.264 video and AAC audio, 1920×1080 at 60 fps**.

WaveCanvas exports from a dedicated deterministic render pipeline rather than recording the visible editor window. Export uses a fixed timeline and the CPU H.264 encoder.

## Building from Source

Run these commands from the repository root on Windows x64. The development baseline is Node.js 24.14.0 / npm 11.9; Electron and electron-builder versions are pinned in `package-lock.json`.

```powershell
npm ci
npm run electron:start
```

Build the unpacked desktop application:

```powershell
npm run electron:build
```

The output is `dist/win-unpacked/`. Keep the whole directory together; the executable depends on the adjacent runtime files.

Build the installer and check release artifacts:

```powershell
npm run release:build
npm run release:check
npm run release:check -- --public
```

The installer output is `release/WaveCanvas-Setup-1.0.0.exe`. Public checks also require the complete matching GPL source ZIP and source metadata; an installer build alone does not assemble all corresponding-source materials. See the [controlled FFmpeg build guide](dev/ffmpeg-build/README.md) and [GPL source checklist](RELEASE_GPL_SOURCE_CHECKLIST.md) for the existing scripts and source-delivery requirements.

Node regression tests run with `npm test`. The separate browser suite runs with `npm run browser:test`; its recorded baseline includes 10 pre-existing failures (589 passing checks). The supplied 1.0.0 artifacts passed Technical RC, GPL source gate, and the public release check according to the [controlled rebuild report](dev/reports/CONTROLLED-FFMPEG-REBUILD-REPORT.md). Rerunning the full release check requires the unpacked build outputs omitted from the portable publish package.

## Licensing

The WaveCanvas repository uses the **MIT license**, including its original MIT-derived portions. The original copyright and attribution to **Karteek Suryadevara / V3ng3nc3** remain in [License.txt](License.txt).

The bundled standalone FFmpeg / ffprobe runtime has separate licensing: the controlled FFmpeg build with x264 is **GPL-3.0-or-later**. WaveCanvas invokes these executables as separate processes. Their licenses do not replace the repository's MIT notice.

**WaveCanvas-1.0.0-GPL-Source.zip** is provided alongside the matching installer in the [same GitHub Release](https://github.com/zero7372/WaveCanvas/releases/tag/v1.0.0), with `RELEASE-HASHES.txt`. It contains the pinned FFmpeg, x264, and zlib sources, build recipes, manifests, hashes, and license texts. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and runtime licensing details.

## Known Limitations

- The installer is unsigned; Windows may show SmartScreen or Unknown Publisher prompts.
- Application localization is incomplete.
- The current export target is 1080p60 H.264 / AAC. Version 1.0 does not offer 4K, HEVC, AV1, or production GPU / NVENC export.
- Some workflow choices differ from conventional video editors.
- Plugins and cloud sync are not available in version 1.0.

## Credits

- **Karteek Suryadevara / V3ng3nc3** — original MIT-derived work; the original copyright and license notice are retained.
- **GPT and Codex** — AI-assisted development tools used for design, implementation, debugging, and testing, with product direction and decisions guided by the project author.
- **FFmpeg** — audio processing and video encoding runtime.
- **x264** — H.264 encoding in the controlled FFmpeg build.
- **zlib, Electron, and Chromium** — supporting libraries and desktop runtime; their notices are included with the distribution.
