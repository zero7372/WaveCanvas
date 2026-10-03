# Patch provenance

| Scope | Status | Evidence |
|---|---|---|
| WaveCanvas FFmpeg binary modifications | PASS | Vendor and RC binary SHA-256 identity freshly verified in evidence/binary-verification.json; no WaveCanvas binary patch applied in this task |
| Acquired upstream archive modifications | PASS | Original upstream archive hashes in SOURCE-MANIFEST.json; package reads their original file contents without patching |
| Gyan FFmpeg patches | BLOCKED | Provider release points to upstream commit, but supplies no patch set or no-patch attestation in the inspected materials |
| Gyan dependency patches / generated configuration changes | BLOCKED | Version strings and upstream archives do not establish pristine provider source state |

No WaveCanvas source patches are applied to the acquired upstream snapshots. This does **not** mean “no Gyan patches”. Unknown patch state is intentionally retained. Do not replace it with an empty list until evidence supports that claim.
