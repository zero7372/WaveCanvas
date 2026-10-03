# Installer UX Polish + Installer Localization v1

Date: 2026-10-04. Windows x64, WaveCanvas 1.0.0, unsigned local release artifacts.
Evidence: [installer QA archive](archive/installer-ux-2026-10-04/).

## Previous installer behavior

The audited base is `db6a977`. electron-builder is pinned to 26.15.3 and Electron to
44.5.1. `oneClick` was already false: the previous setup felt like one-click because
there was no welcome/license/tasks page, directory selection was disabled, details
were suppressed and run-after-finish was disabled. This change improves the existing
assisted installer rather than claiming a previously enabled oneClick flag.

## NSIS config

`package.json` keeps appId `com.wavecanvas.desktop`, version `1.0.0`, the builder-derived
GUID `6c2bb522-748e-5bcd-a5ee-9a31dfd50b64`, x64 and
`WaveCanvas-Setup-${version}.${ext}`. `oneClick=false`, `perMachine=false`,
`allowElevation=false`, `packElevateHelper=false`, `deleteAppDataOnUninstall=false`
and Start Menu creation remain unchanged. Directory selection, license resource,
English/Traditional Chinese selection, Unicode NSIS and optional finish launch are
enabled. `createDesktopShortcut=false` disables builder's unconditional link; the
native optional desktop section now owns that same WaveCanvas link.

## Assisted installer

`dev/installer.nsh` uses supported builder include macros and native MUI pages:
Welcome → License → Destination → Additional Tasks / Ready summary → Installing
→ Finish. Back/Next/Install/Finish are native. The builder template has no dedicated
Ready page, so its summary is shown above the desktop task in the native Components
page. No full installer-script fork or new native plugin is used.

## Installation directory

Default remains `C:\Users\peter\AppData\Local\Programs\WaveCanvas`. Users can browse
or enter another writable path without changing the per-user/no-elevation strategy.
The native directory page supports other drives; QA actually installed on D:.
Builder's existing `instFilesPre` normalizes the destination to an application
subfolder when the chosen path does not contain `WaveCanvas`; that behavior is retained.

## License page

`License.txt` is the existing repository MIT license, including the original 2017
Karteek Suryadevara attribution. Package metadata says MIT. There is no independent
WaveCanvas EULA. The request's section 7 permits showing this existing repository
license; no new legal terms, translated license, copyright policy or EULA was invented.
`MUI_LICENSEPAGE_CHECKBOX` requires acceptance: Next is disabled beforehand and enabled
afterwards in both languages. Third-party notices/GPL are not substituted as the EULA.
The repository license hash remains unchanged.

## Installer languages

Only `en_US` and `zh_TW` are compiled. The native selector offers English and
`中文(繁體)` with `Please select a language / 請選擇語言`.
Traditional Chinese was automatically selected on this Traditional Chinese Windows
session; English was verified by explicit selection. NSIS uses its native language
fallback/locale matching for other hosts; other Windows UI locales were not separately
VM-tested. Selection remains within setup and does not create an app locale preference.

## English QA

The final artifact was walked through Welcome, unchecked/accepted License, default
Destination, Tasks, Installing, Show details, completion and Finish. Custom strings
are English, summary text is fully visible, the desktop checkbox is default checked,
and the optional Run WaveCanvas checkbox defaults unchecked. Selecting it successfully
launched the actual installed app. See `wizard-ui-evidence.json` final EN observations.

## Traditional Chinese QA

The final artifact was walked through the same native pages using the Unicode/spaces
destination. Native Browse dialog was opened and cancelled during path QA. Custom
Taiwanese terms include 安裝位置、其他工作、建立桌面捷徑、下一步、完成.
No missing strings or garbled Chinese were observed. Native NSIS translations are
retained. Finish launch succeeded from `D:\應用程式\WaveCanvas 測試`.

## Desktop shortcut

The native `WC_DESKTOP_TASK` Section provides a default-selected checkbox.
`WC_TasksPre` hides and marks other sections selected/read-only so application files
cannot be deselected. `customInstall` uses `SectionGetFlags`, `SF_SELECTED`,
`CreateShortCut` and the existing WinShell AUMI plugin. The UI checkbox was unchecked
and an actual default-path installation verified no desktop link; checked D: and
Unicode installations verified the link. `--no-desktop-shortcut` is respected.
`customUnInstall` removes this app's link unless builder is preserving shortcuts.
The final installer's silent `--no-desktop-shortcut` reinstall was also verified, then
default checked shortcut behavior was restored (`default-final-no-desktop.json`).

## File association

The association remains fixed and correctly described by the pre-install summary.
The existing quoted HKCU command is preserved: `"<installed WaveCanvas.exe>" "%1"`.
There is no optional association checkbox or custom registry workflow. Final payload
QA passes cold Windows shell open, existing instance delivery, Cancel/Save/Discard
dirty guards, Chinese/spaces paths, restored font family, Recent Projects and host-
supported >260-character Unicode/emoji project paths on all three install locations.
The inspector harness temporarily selects an isolated test profile and restores the
real registered shell command immediately after dispatch.

## Details view

`ShowInstDetails hide` exposes native expandable details. The installing header shows
the localized extracting phase. Native Section/customFiles/customInstall hooks log
extraction, uninstall information, Start Menu and association/desktop creation.
`MUI_FINISHPAGE_NOAUTOCLOSE` retains the completed Installing page so logs can be
examined before Next opens Finish. Both final language logs were actually expanded.
Native list rows may horizontally clip long paths, as standard NSIS does; no credentials
or user tokens are logged.

Finish launch initially failed on this host through builder's `StdUtils.ExecShellAsUser`
Explorer-delegated Start Menu runner, even with an unmodified default-path shortcut.
The same link launched successfully through the ordinary Windows shell QA harness.
`customFinishPage` now uses native MUI's `MUI_FINISHPAGE_RUN` pointing directly to
`$INSTDIR\WaveCanvas.exe`. This strictly per-user, non-elevated installer needs no
elevation delegation. Both final language Finish launch tests passed with this fix.
The observed old failure is retained in the UI evidence; its broader OS cause is not
claimed to be proven.

## Non-C path QA

Final installer installed at `D:\Apps\WaveCanvas`: installed exe/asar, both controlled
runtime hashes, all 30 license resources, shortcut target, quoted association, unsigned
status and single GUID/version passed. Launch/shell/licenses UI and 300-frame export
passed. Same-version reinstall and uninstall also passed with unchanged business data.
Evidence: `non-c-final-installed.json`, `non-c-final-reinstall.json`,
`non-c-final-uninstall.json`, `non-c-shell.json`, `non-c-export.json`.

## Unicode path QA

Final installer installed at `D:\應用程式\WaveCanvas 測試`: direct finish launch,
installed identities, licenses, shell project open, packaged FFmpeg export and packaged
ffprobe validation passed. The final payload was removed successfully with userData,
real project and external media preserved. Evidence: `unicode-final-direct-runner.json`,
`unicode-final-uninstall.json`, `unicode-shell.json`, `unicode-export.json`.

## 300-frame export

The final installed payload at each of the default, D: ASCII and D: Unicode locations
opened the real `Untitled.waveproj` through the normal loader and exported five seconds.
All three passed seven checks, including 300 H.264 frames, 1920×1080, 60 FPS, AAC audio,
decoded assets and unchanged real-project file hashes/sizes/mtimes. ffprobe and frame
extraction use each installed resources/ffmpeg path. The production renderer/runner is
unchanged; no resolver override was used. Full 3612-frame export was not repeated.

## Uninstall/reinstall

Each path was removed and app binaries, Installed Apps entry, WaveCanvas association
and app shortcuts disappeared. Normal userData business files plus the real project/
media matched the pre-task SHA-256 snapshot throughout, including finish launch/close.
The final default-path app is restored; there is one unchanged GUID/version and the
verified app remains installed at its original per-user location. No data deletion
checkbox, cleanup of user projects or recursive manual installation-directory deletion
was introduced. NSIS temporary-uninstaller completion is polled before assertions.

An early QA harness incorrectly computed the real-project parent from a trailing
separator. The baseline assertion failed while operation preservation passed; direct
comparison showed the seven baseline business files unchanged. The harness root path
was corrected and subsequent full baseline checks passed. `preliminary-default-uninstall.json`
retains that test-harness failure rather than relabeling it PASS.

## GPL artifacts

Controlled FFmpeg/ffprobe were not rebuilt. All 30 installed license resources match
the source resources, including third-party notices, x264 license, FFmpeg source info
and complete-source co-delivery instructions. Open Source Licenses UI passes at all
three paths. GPL checklist remains 18/18 PASS. The source ZIP remains exactly
52,352,069 bytes with its original hash. Publication URL remains unresolved release
metadata; no fabricated GitHub URL or publication is included.

## Release hashes

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| WaveCanvas-Setup-1.0.0.exe | 133475923 | 0790f86e5e499ab6f43331d1d75d0429b4256615aa9945844cc93e33664862dd |
| WaveCanvas.exe | 245726720 | bf952b436575d37125340246d8fc70749278750c048022e200e8283d39ffa553 |
| ffmpeg.exe | 32895488 | 31d7c4ea1a71e50cef1132782779742f3f4aae53015e2c0765db3b303ea81d13 |
| ffprobe.exe | 32694272 | 95184847a8d81488180abc16178b52d12a93acb437f30d55a161b9dbfc8359d6 |
| WaveCanvas-1.0.0-GPL-Source.zip | 52352069 | e33292b8e4dc2a8218aaf4289434fb0c8d3aa2c7d816c96bad1731e9bbb9b255 |

The executable/asar packaging hash changes because package metadata and the bundled
README change. All 87 app/electron source files match the baseline; no runtime,
project format, preferences, application strings, font or export code changed.
`before.json`, `after.json`, `core-runtime-integrity.json` and the regenerated
release `RELEASE-HASHES.txt` preserve the mapping. Installer and app are NotSigned.

## release:check --public

Final public release check: PASS. technicalReleaseCandidate=true, artifactReady=true,
GPL source gate=PASS, publicReleaseReady=true, signed=false, published=false.
These flags describe technical/package/source readiness; no public release was performed.
Existing Node tests: 125/125 PASS. Package allowlist: 94 entries, 431.92 MiB.

## Installer size

Before: 133,533,842 bytes. After: 133,475,923 bytes. Reduction: 57,919 bytes.
Only English and Traditional Chinese are included rather than builder's previous
default language set. There is no excessive multilingual payload growth.

## Git

One new commit: `Polish installer UX and localization`, based on `db6a977`.
`09cd8e5` and `db6a977` are not amended. No push, signing, GitHub publication, updater
or future feature work is performed. Changes are limited to installer/configuration,
release documentation, QA tooling and bounded report evidence.

## Remaining limitations

- Ready summary shares the native Additional Tasks page; there is no extra custom
  summary page. File association and Start Menu creation are fixed tasks.
- The displayed MIT text is the repository license, not a newly established WaveCanvas
  EULA. The owner still controls any separate licensing-policy decision.
- The requested assumption that the app already is English-only is false in this
  frozen baseline: `app/index.html` contains Chinese home-page labels and existing
  project/export menus also contain Chinese. Both English and Traditional Chinese
  installer sessions launch the same unchanged mixed-language UI. No app i18n, locale
  setting or translation was added. **English-only application UI cannot be certified
  in this installer-only scope**; meeting that separate requirement would require
  owner authorization for application-string changes.
- Native NSIS locale matching was verified on this Traditional Chinese host and by
  explicit English selection; other Windows language hosts were not separately tested.
- Signing and publication are still false; the official publication URL is undecided.
