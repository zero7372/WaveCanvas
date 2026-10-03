# GPL corresponding-source delivery checklist

Unsigned internal RC. publicReleaseReady=false. No complete source archive generated.

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| Binary version and SHA256 identity | PASS | licenses/FFmpeg/BUILD_INFO.json and SHA256.txt; vendor unchanged |
| Exact FFmpeg upstream revision | PASS | 946fcce07b6dcd0331c8cc609192aeff5e1924f8; provider release references it |
| Complete matching FFmpeg source artifact delivery | BLOCKED | Fixed upstream URL recorded; no release attachment/hosting yet |
| GPL dependency exact sources | BLOCKED | x264, x265, xvid, vid.stab, rubberband source locks not complete |
| All static/transitive dependency source closure | BLOCKED | Provider versions are clues, not full source locks |
| Patches | BLOCKED | Unknown; cannot assert none |
| Build/install recipe and configuration | BLOCKED | Configuration and tool versions delivered; matching recipes absent |
| Dependency copyright and license texts | BLOCKED | Inventory delivered; complete exact-revision notices not acquired |
| Binary/source correspondence verification | BLOCKED | No complete materials or rebuild comparison |
| Free source access alongside installer (GPLv3 6(d)) | BLOCKED | Separate fixed source attachment planned; no public download endpoint |
| Physical media written offer | N/A | No physical distribution or written offer in this RC |
| Own license attribution / aggregation review | BLOCKED | Original MIT attribution retained; rights chain / distribution boundary review pending |

Mechanism: SOURCE_MANIFEST.json records exact binary identities, upstream revision and missing materials. Obtain provider matching source closure/recipes, assemble a separate source archive, hash it in RELEASE-HASHES.txt and host it free alongside installer at one fixed release entry. A generic upstream URL is not a substitute. Current RC remains internal until every required item passes.
