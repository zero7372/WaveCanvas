# Static regression fixtures

`integration-tone.wav`: synthetic PCM16 mono, 8000 Hz, 30 seconds, 220 Hz sine with amplitude8192. Generated deterministically during maintenance cleanup to replace the Project/Electron helpers' hidden dependency on disposable timing-review.wav. It contains no user media. Tests exercise on-disk import, seek, Save/Open/Collect/backup and reference persistence, not the historical waveform's byte identity.

`electron-primary.lrc` / `electron-secondary.srt`: existing bilingual import fixtures.

`baselines/`: historical protected hashes and geometry/schema/HTML/Timing snapshots required by regression tests. Preserve these tracked inputs; `dev/tests/artifacts` is exclusively generated output.
