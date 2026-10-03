# WaveCanvas 1.0.0

Windows x64 per-user NSIS installer, projects/preferences/options/fonts and deterministic 1080p60 H.264/AAC export. Setup includes an assisted wizard, repository-license acceptance, selectable installation directory, optional desktop shortcut, English / Traditional Chinese installer languages and expandable installation details. Installer language does not change the application UI or preferences. UserData and projects survive uninstall. Application features and production export command are unchanged.

This release uses WaveCanvas controlled FFmpeg 9.0.2 with exact FFmpeg/x264/zlib revisions in licenses/FFmpeg/SOURCE_INFO.txt. Complete corresponding source is distributed alongside the installer as WaveCanvas-1.0.0-GPL-Source.zip with RELEASE-HASHES.txt. GPL artifact readiness PASS; artifactReady=true; publicReleaseReady=true; published=false. The official release URL has not been decided. Publishing must attach installer, complete source ZIP, notices and hashes together.

Unsigned: Windows Unknown Publisher remains expected. Code signing is not configured. Browser baseline retains 10 pre-existing failures (589 passing checks); no new regression. No GitHub publication, automatic updater or new codec/hardware export features are included.
