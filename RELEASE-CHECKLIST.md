# WaveCanvas release checklist

WaveCanvas 1.0.0 unsigned release artifacts. Source and installer are co-delivered.

| Area | Status | Evidence |
|---|---|---|
| Build | PASS | release:check hashes/runtime allowlist |
| Licensing | PASS | RELEASE_GPL_SOURCE_CHECKLIST.md and complete controlled source ZIP |
| Installer | PASS | INSTALLER-UX-LOCALIZATION-V1-REPORT.md and wizard/path sanity evidence |
| Selectable install directory | PASS | Native destination page and custom-path QA |
| Non-C drive | PASS | D: ASCII installation/association/export/uninstall |
| Unicode install path | PASS | D: Chinese/spaces installation/association/export/uninstall |
| English installer | PASS | Native wizard page verification |
| Traditional Chinese installer | PASS | Native wizard page verification |
| License page | PASS | Existing MIT repository license; explicit acceptance |
| Details view | PASS | Native progress and expandable details |
| File Association | PASS | Quoted .waveproj shell association |
| Preferences / Options | PASS | Full regression evidence |
| Fonts | PASS | Full regression evidence |
| QA | PASS | Full regression, 3612 frames; browser existing baseline 589 PASS / 10 FAIL |
| Signing | N/A | Explicit unsigned release; no certificate configured |
| Distribution artifacts | PASS | Complete source ZIP beside matching installer; RELEASE-HASHES.txt |
| Publication | N/A | Not performed; official URL to be decided when publishing |

technicalReleaseCandidate=true
signed=false
artifactReady=true
publicReleaseReady=true
published=false
