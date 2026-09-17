# Release rehearsals

The Release workflow runs on packaging-related pull requests and can be started
manually with `workflow_dispatch`. These runs build unsigned macOS and Linux
installers and upload them as workflow artifacts. They do not receive signing
credentials or publish a GitHub release.

Tag pushes must match the desktop version exactly (`vX.Y.Z`); prerelease channels
are not configured. The gate requires a successful `ci.yml` push run on `main`
at the exact tagged commit. Both platforms install with the pinned pnpm version
and build through `build:unpack`: typecheck/build, deploy
production dependencies, rebuild native modules for Electron, then package with
publication disabled. Linux runs the LocalStack-backed release tests; macOS runs
the demo release tests. Both include a packaged SQLite write/reopen probe.

Installers are then produced from the same deployment tree, without rebuilding
source. Tag builds sign/notarize and verify the macOS app. The packaged app tests
run again after installer creation. Each platform uploads only its distributable
files and update metadata after its checks pass.

Only a tag push can reach the separate publication job, which waits for the full
platform matrix. It creates a draft, uploads all validated assets, and publishes
the draft. Existing releases are never overwritten automatically. If upload or
publication fails, inspect the draft and assets before deciding how to recover;
rerunning against the existing draft intentionally fails at creation.

Manual and PR rehearsals do not prove signing/notarization or updater installation.
The macOS signature gate and final-app tests run on signed tag builds. Installer
installation and an end-to-end update from the previous release remain separate
acceptance checks; do not infer them from a successful unpacked-app test.

Tracked by RIFT-133 in the SRE Reliability & Safety Stabilization project.
