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

- Source is rooted at the repo root (monorepo via pnpm workspaces).
- Workspaces: `apps/desktop`, `apps/cli`, `packages/shared`,
  `packages/cloud-scan`.
- All commands (`pnpm run lint`, `pnpm run typecheck`, `pnpm test`,
  `pnpm run build:cli`, `pnpm run dev`) run from the repo root.
- Package manager is pinned via the `packageManager` field in the
  root `package.json` to a specific pnpm version with a sha512
  integrity hash. Do NOT install with npm/yarn — the lockfile is
  pnpm-shaped and the install scripts allowlist (`pnpm.onlyBuiltDependencies`)
  is pnpm-specific.
- CI: `.github/workflows/ci.yml`. Must pass: lint, typecheck, test,
  CLI build + smoke, phantom-dep guard, and the lockfile-change
  guard (only enforces on PRs).

## Supply chain (pnpm + Renovate)

Background: PR #52 prompted the supply-chain audit (Linear Document
"RIFT-70 supply-chain audit") and the migration direction was locked
in the 2026-04-22 decision record (Linear Document "Decision record
2026-04-22: PR #52 pnpm migration direction").

Three rules a contributor needs to internalize:

1. **Do not regenerate `pnpm-lock.yaml` locally.** The lockfile
   only changes inside the Renovate (or Dependabot) bot's CI runner.
   The `Lockfile change guard` step in the `fast` CI job enforces
   this: PRs that modify `pnpm-lock.yaml` from a non-bot commit fail
   unless they carry the `lockfile-override-approved` label (which
   is the audit-trail-friendly escape hatch — bumping a single dep
   in an emergency, fixing a hash collision, etc.). Use the label
   sparingly; the default is for Renovate to own the lockfile.
2. **Builds are gated.** `pnpm.onlyBuiltDependencies` in the root
   `package.json` is the explicit allow-list of packages that may
   run install scripts. Any new transitive dep that wants to run
   scripts is silently skipped (with a `pnpm approve-builds` notice)
   until added here. This is the supply-chain firewall — review the
   added package, then add it.
3. **Renovate groups are deliberate.** `renovate.json` groups
   related ecosystems (`@aws-sdk/*`, `@smithy/*`, `@typescript-eslint/*`,
   `@tailwindcss/*`, `@vitest/*`, `github-actions`) so each Monday
   morning produces a small, reviewable set of PRs rather than 30
   individual ones. Lockfile maintenance runs the first of each
   month. Don't ungroup unless you have a reason.

## Desktop packaging pipeline (pnpm deploy + electron-builder)

The desktop binary is built via a deploy-then-package flow rather than
running `electron-builder` directly against the workspace. Reason:
electron-builder's `app-builder` collects the dep tree by reading
`pnpm-lock.yaml` and, under pnpm's isolated layout, silently drops
3-level-deep transitive packages (concretely `ms`, reached via `debug` →
`builder-util-runtime` → `electron-updater`). The packaged `.app` then
contains a half-resolved `node_modules` tree, the main process hangs at
the first eager `require('electron-updater')` call, and Playwright sees
"firstWindow timeout" with no logs. `pnpm deploy` produces a flat,
self-contained tree at `apps/desktop/deploy/` that electron-builder
packs correctly.

Build pipeline (chained inside `apps/desktop` `build:unpack`,
`build:mac`, `build:linux`, `build:win`):

1. `electron-vite build` — bundles the main, preload, and renderer
   into `apps/desktop/out/`.
2. `pnpm --filter @riftview/desktop --prod deploy ./deploy` — copies
   the workspace's `package.json`, `out/`, `build/`, and (importantly)
   a flat `node_modules` with ALL transitive deps into
   `apps/desktop/deploy/`. Requires `inject-workspace-packages=true`
   in the root `.npmrc` so `@riftview/cloud-scan` and `@riftview/shared`
   are bundled into the deploy as real packages instead of symlinks.
3. `cd deploy && electron-builder install-app-deps` — replaces
   `deploy/node_modules/better-sqlite3/build/Release/better_sqlite3.node`
   with the Electron-ABI prebuild. The repo's main `node_modules/`
   stays Node-ABI, so unit tests still load the binary.
4. `cd deploy && electron-builder --dir` (or `--mac`, `--linux`,
   `--win`) — produces the artifact. `electron-builder.yml` sets
   `directories.output: ../dist`, so the artifact lands at
   `apps/desktop/dist/<platform>-<arch>/` — the path the @release
   Playwright fixtures expect.

`apps/desktop/electron-builder.yml` keeps `npmRebuild: false` because
electron-builder's built-in `npm rebuild` would target the installing
Node's ABI, not Electron's — the explicit `install-app-deps` step is
what produces the right binary.

Side-effect (good news): unlike the npm-era flow, running `build:unpack`
no longer rewrites the in-tree `better-sqlite3.node`. The Electron-ABI
binary lives only in `apps/desktop/deploy/node_modules/`, which is
.gitignored and recreated each build. Running `pnpm test` immediately
after `build:unpack` works without restoration.

## Native modules (better-sqlite3)

The desktop app uses `better-sqlite3` for the snapshot history DB. Native
modules are sensitive to Node.js ABI (`NODE_MODULE_VERSION`), which differs
between the system Node used by `pnpm install` and the Node bundled inside
Electron. A single `.node` binary can only satisfy one ABI — so the project
keeps two regimes separated by pipeline phase:

1. **Install phase (`pnpm install --frozen-lockfile`)** — `better-sqlite3`'s
   postinstall (gated by `pnpm.onlyBuiltDependencies`) downloads the
   **Node-ABI** prebuild that matches the installing Node's
   `NODE_MODULE_VERSION`. The `fast` CI job runs `vitest` unit tests against
   SQLite directly, so this binary must be Node-loadable. The deploy step
   leaves this binary alone.
2. **Packaging phase (`pnpm run rebuild`, run AFTER `pnpm run deploy`)** —
   `electron-builder install-app-deps` (the script body of `pnpm run rebuild`)
   swaps in the **Electron-ABI** prebuild matching the Electron major
   declared in `apps/desktop/package.json`, but ONLY inside
   `apps/desktop/deploy/node_modules/`. `electron-builder --dir` then
   packages that Electron-compatible `.node` into the `.app`.

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
