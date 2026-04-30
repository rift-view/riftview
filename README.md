# RiftView

**The incident diagnostic layer AWS doesn't have.**

The AWS console is organized by service silo. When something breaks, you open 4 tabs to answer one question: _what else is connected to this?_ RiftView answers it in 10 seconds.

## What it does

- **Blast radius** — single-click any resource to see what breaks if it fails. Everything unrelated dims. No tabs, no guessing.
- **Live cross-service graph** — scans your entire AWS account in one pass, across every service, and holds it as a connected graph. Always current.
- **Top risks** — immediately after scan, shows your 3 highest-severity chain-of-failure risks. Not 40 warnings — the 3 things that matter.
- **Drift detection** — compares live infrastructure against your Terraform state. Shows exactly what drifted and generates the fix commands.
- **Guided remediation** — execute AWS CLI fix commands from inside the app. No copy-pasting.

## Why not just use the AWS console?

The console is a service browser. It cannot show you cross-service relationships. It cannot tell you what breaks if an SQS queue goes down. It cannot compare your live infra to your IaC. RiftView does all three — and the graph is always live, so you can trust the answers.

## Quick start

1. Install: download the latest release
2. Open RiftView and select your AWS profile
3. Hit Scan — your infrastructure appears as a connected graph in seconds
4. Click any node to see blast radius. Check the Top Risks panel for chain-of-failure advisories.

## Requirements

- AWS credentials configured (`~/.aws/credentials` or environment variables)
- Required IAM permissions: see the onboarding screen for the full list
- macOS 13+ (Windows support planned)

## Stack

Electron 32 · React 19 · TypeScript · React Flow v12 · AWS SDK v3 · Tailwind CSS 4

## CLI

RiftView ships with a companion command-line tool, **`@riftview/cli`**, for running scans and drift checks from CI without the desktop app.

```bash
npm install -g @riftview/cli
riftview scan --profile prod
riftview drift --state terraform.tfstate --fail-on-drift
```

See [`apps/cli/README.md`](./apps/cli/README.md) for the full reference: command flags, JSON output schema, exit codes, and a GitHub Actions example.

## Repository layout

This is a pnpm workspaces monorepo. Workspaces:

- `apps/desktop` — the Electron app (private, not published)
- `apps/cli` — `@riftview/cli` (published to npm)
- `packages/shared` — platform-agnostic analysis, graph, drift, and scan primitives reused by both apps
- `packages/cloud-scan` — AWS SDK plugin registry and client factory

The package manager is pinned via the `packageManager` field in
`package.json`. Install pnpm via [the official guide](https://pnpm.io/installation)
or Corepack (`corepack enable`) — `pnpm install` at the root sets up
every workspace.

## Development

### Apple Silicon prereq

RiftView's snapshot store uses `better-sqlite3`, a native module. On Apple Silicon Macs, Node must be `arm64` or the Electron runtime will fail to load the native binary. If you installed Node via Intel Homebrew (`/usr/local/bin/node`), either switch to `/opt/homebrew` Node, use nvm, or run `npx @electron/rebuild` after `pnpm install` to rebuild native modules against Electron's arch.

```bash
# Install dependencies (pnpm — see packageManager field in package.json)
pnpm install

# One-time: install the pre-commit hook (prettier + eslint on staged files)
pnpm exec lefthook install

# Start dev server
pnpm run dev

# Run tests
pnpm test

# Typecheck
pnpm run typecheck

# Lint
pnpm run lint
```

For the LocalStack-backed CLI integration tests, see
[`apps/cli/tests/integration/README.md`](./apps/cli/tests/integration/README.md).

## Build

```bash
# macOS
pnpm run build:mac

# Windows
pnpm run build:win

# Linux
pnpm run build:linux
```

## Legal

RiftView is not affiliated with, endorsed by, or sponsored by Amazon Web
Services, Inc. AWS, Amazon EC2, and all related marks are trademarks of
Amazon.com, Inc. or its affiliates.

See [NOTICE.md](./NOTICE.md) for third-party license acknowledgments.

## Repository structure

### Top-level

- `apps/` — pnpm workspaces root containing the desktop app and CLI.
- `apps/desktop/` — Electron app (main process, renderer, preload).
- `apps/cli/` — node CLI (`riftview scan`, `risks`, `diff`, etc.).
- `packages/` — shared workspaces.
- `packages/shared/` — typed `NodeType`/`Edge` shape, `@riftview/shared/snapshot` canonical core, cloud types.
- `packages/cloud-scan/` — AWS SDK-backed scan orchestrator.
- `scripts/` — one-off maintenance scripts (e.g. `wait-localstack.sh`).
- `.github/workflows/` — CI (`ci.yml`) and release (`winget.yml`).
- Tooling config at the repo root: `eslint.config.mjs`, `lefthook.yml`, `tsconfig.base.json`, `tsconfig.json`, `vitest.config.ts`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `renovate.json`.

### Desktop app subtree (most load-bearing)

- `apps/desktop/src/main/` — main process: IPC handlers, history SQLite store, AWS scanner, `isDemoMode()`, capability gating.
- `apps/desktop/src/main/history/` — versioned snapshot store (SQLite).
- `apps/desktop/src/main/ipc/` — IPC channel registry + handlers.
- `apps/desktop/src/main/aws/` — AWS scanner entry point used by the main process.
- `apps/desktop/src/main/capability.ts` — Tier-1 protected; SecOps-reviewed.
- `apps/desktop/src/preload/` — preload bridge exposing main-process APIs to the renderer.
- `apps/desktop/src/renderer/` — React app (Canvas, Timeline strip, Inspector, modals).
- `apps/desktop/tests/` — Playwright e2e (`e2e/`), IPC unit tests (`ipc/`), main-process tests (`main/`), renderer tests (`renderer/`).

### CLI + shared packages

- `apps/cli/cli/` — CLI command implementations; `apps/cli/cli/snapshot.ts` defines the JSON snapshot format.
- `apps/cli/tests/integration/` — LocalStack-backed integration suite, including `fixtures/seed.tf`.
- `packages/shared/src/snapshot/` — canonical snapshot core used by both desktop and CLI.
- `packages/shared/src/types/cloud.ts` — `NodeType` literal union + integration edge types. Source of truth for what's scannable.

### Build / dev commands

From the repo root (verbatim from `package.json` scripts):

- `pnpm install` — workspace install (uses the version pinned in `packageManager`).
- `pnpm run dev` — Electron dev with hot reload (delegates to `@riftview/desktop`).
- `pnpm run lint` — eslint across workspaces.
- `pnpm run typecheck` — tsc `--noEmit` across workspaces.
- `pnpm test` — vitest unit suites.
- `pnpm run test:watch` / `pnpm run test:ui` — vitest watch mode and UI.
- `pnpm run test:integration` — CLI ↔ LocalStack integration suite.
- `pnpm run test:e2e` — Playwright e2e (excludes `@release` specs).
- `pnpm run test:e2e:release` / `pnpm run test:e2e:release:mac` — release-gated Playwright specs.
- `pnpm run build` — build all workspaces.
- `pnpm run build:cli` — CLI bundle only.
- `pnpm run cli` — run the CLI from source via tsx.
- `pnpm run start` / `pnpm run stories` — Electron production start, Ladle stories.
- `pnpm run localstack:up` / `pnpm run localstack:down` — bring LocalStack + Terraform fixtures up/down for integration work.
- `pnpm run format` — prettier write.

For platform binaries, the desktop workspace exposes `pnpm run build:mac`, `pnpm run build:win`, and `pnpm run build:linux` (see the `Build` section above).

### CI

`.github/workflows/ci.yml` runs two jobs on every PR and push to `main`:

- **`fast`** — install + lockfile-change guard (PR-only) + lint + typecheck + test + CLI build + bundle smoke + phantom-dep guard (`pnpm pack` + isolated install).
- **`e2e`** — IPC contract walker + CLI ↔ LocalStack integration + Electron E2E smoke under xvfb (docker-compose brings up LocalStack).

The `release` job is skipped except on release tags (`refs/tags/v*`), where it builds, signs, and publishes the desktop binaries for macOS and Linux.

### Related repos

Planning notes, operational automation, and internal tooling live in a separate private repo.
