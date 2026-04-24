---

# CLAUDE.md

## Project: RiftView

Visual desktop app for AWS infrastructure management — an incident
diagnostic layer that shows the blast radius of any AWS resource.

## Working instructions

This repo is the public, OSS tree. The authoritative Claude briefing
— architecture rules, repo layout, milestone status, planning notes,
agent personas, and style guidance — lives in the private docs repo:

    ~/riftview-docs/CLAUDE.md

Before doing any non-trivial work in this repo, **read that file
first**. It is on the same filesystem; no checkout or auth is needed.

Cross-references you should know about:

- **Linear** — specs and implementation plans live as Linear Documents
  attached to their project. Tracking issues link to them. Do not look
  for specs or plans on disk.
- `~/riftview-docs/team/` — role playbooks / agent personas
- `~/riftview-docs/outreach/` — positioning, pricing, cold-email drafts
- `~/riftview-docs/roadmap.md` — milestone sequencing
- `~/riftview-docs/superpowers/{specs,plans}/` — historical archive
  (pre-2026-04-22). Read-only reference; do not add files.

Do **not** commit references or paths to `~/riftview-docs/` in source
files that ship to end users. This CLAUDE.md is the only place in the
public repo that points to it.

## Quick pointers

- Source is rooted at the repo root (monorepo via npm workspaces).
- Three workspaces: `apps/desktop`, `apps/cli`, `packages/shared`.
- All commands (`npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build:cli`, `npm run dev`) run from the repo root.
- CI: `.github/workflows/ci.yml`. Must pass: lint, typecheck, test,
  CLI build + smoke.

## Native modules (better-sqlite3)

The desktop app uses `better-sqlite3` for the snapshot history DB. Native
modules are sensitive to Node.js ABI (`NODE_MODULE_VERSION`), which differs
between the system Node used by `npm ci` and the Node bundled inside Electron.
A single `.node` binary can only satisfy one ABI — so the project keeps two
regimes separated by pipeline phase:

1. **Install phase (`npm ci`)** — `better-sqlite3`'s postinstall downloads
   the **Node-ABI** prebuild that matches the installing Node's
   `NODE_MODULE_VERSION`. The `fast` CI job runs `vitest` unit tests against
   SQLite directly, so this binary must be Node-loadable.
2. **Packaging phase (before `electron-builder --dir`)** — run
   `npm run rebuild` (= `electron-builder install-app-deps`, which uses
   `@electron/rebuild`) to swap in the **Electron-ABI** prebuild matching the
   Electron major declared in `apps/desktop/package.json`. `electron-builder`
   then packages the Electron-compatible `.node` into the `.app`.

The `apps/desktop` build scripts (`build:unpack`, `build:mac`, `build:linux`,
`build:win`) chain `npm run rebuild` between `electron-vite build` and
`electron-builder`, and the CI release job runs the same step before
`electron-builder --dir`. `apps/desktop/electron-builder.yml` keeps
`npmRebuild: false` because electron-builder's built-in `npm rebuild` would
target the installing Node's ABI, not Electron's — the explicit `install-app-deps`
step is what produces the right binary.

Side-effect for local dev: after running `build:unpack`, the in-tree
`node_modules/better-sqlite3/build/Release/better_sqlite3.node` is now
Electron-ABI. Re-running `npm test` in that state fails with a
`NODE_MODULE_VERSION` mismatch. Restore with
`npm rebuild better-sqlite3` (no env overrides) before running unit tests
again, or just `npm ci`.

When bumping the `electron` devDependency, verify `better-sqlite3` ships a
matching `electron-v<ABI>` prebuild for every packaged platform
(`darwin×{arm64,x64}`, `linux×{arm64,x64}`, `win32×{arm64,x64}`) on its
GitHub Releases — the prebuild catalog covers a limited window of Electron
versions. If a target ABI is missing, bump `better-sqlite3` at the same
time or `electron-builder install-app-deps` will fall back to compiling from
source (which can break on newer V8 API surfaces).

Symptom when broken: the built binary boots and scans normally, but
`[history] failed to init snapshot store` appears in main-process logs and
`writeSnapshotSafe` / `listVersionsSafe` silently no-op (the store is
best-effort by design). The snapshot history is empty and the
Topbar Export → Snapshot action reports "No snapshots yet — run a scan
first" even after a successful scan.

## Adding a new AWS service (scan)

When extending the scanner to cover a new AWS service:

1. Add/extend the scan helper and wire it into `awsPlugin.scan()` under
   `apps/desktop/src/main/plugin/`.
2. Add the new `NodeType` literal to `packages/shared/src/types/cloud.ts`.
3. Extend any `Record<NodeType, ...>` map in the renderer so the
   exhaustive-check typecheck still passes.
4. Add a minimal resource to
   `apps/cli/tests/integration/fixtures/seed.tf` so the LocalStack
   integration suite exercises the new scan path. If LocalStack
   Community-Archive does not support the service, note the gap in the
   file's header comment instead of silently skipping.
