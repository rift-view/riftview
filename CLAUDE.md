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
   SQLite directly, so this binary must be Node-loadable.
2. **Packaging phase (before `electron-builder --dir`)** — run
   `pnpm run rebuild` (= `electron-builder install-app-deps`, which uses
   `@electron/rebuild`) to swap in the **Electron-ABI** prebuild matching the
   Electron major declared in `apps/desktop/package.json`. `electron-builder`
   then packages the Electron-compatible `.node` into the `.app`.

The `apps/desktop` build scripts (`build:unpack`, `build:mac`, `build:linux`,
`build:win`) chain `pnpm run rebuild` between `electron-vite build` and
`electron-builder`, and the CI release job runs the same step before
`electron-builder --dir`. `apps/desktop/electron-builder.yml` keeps
`npmRebuild: false` because electron-builder's built-in `npm rebuild` would
target the installing Node's ABI, not Electron's — the explicit `install-app-deps`
step is what produces the right binary.

Side-effect for local dev: after running `build:unpack`, the in-tree
`node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/better_sqlite3.node`
is now Electron-ABI. Re-running `pnpm test` in that state fails with a
`NODE_MODULE_VERSION` mismatch. Restore with
`pnpm rebuild better-sqlite3` (no env overrides) before running unit tests
again, or just `pnpm install`.

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
