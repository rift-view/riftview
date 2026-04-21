# RiftView

**The incident diagnostic layer AWS doesn't have.**

The AWS console is organized by service silo. When something breaks, you open 4 tabs to answer one question: *what else is connected to this?* RiftView answers it in 10 seconds.

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

See [`docs/cli.md`](./docs/cli.md) for the full reference: command flags, JSON output schema, exit codes, and a GitHub Actions example.

## Repository layout

This is an npm workspaces monorepo. Three workspaces:

- `apps/desktop` — the Electron app (private, not published)
- `apps/cli` — `@riftview/cli` (published to npm)
- `packages/shared` — platform-agnostic analysis, graph, drift, and scan primitives reused by both apps

Root `package.json` hoists devDeps; `npm install` at the root sets up all three.

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Typecheck
npm run typecheck

# Lint
npm run lint
```

## Build

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

## Legal

RiftView is not affiliated with, endorsed by, or sponsored by Amazon Web
Services, Inc. AWS, Amazon EC2, and all related marks are trademarks of
Amazon.com, Inc. or its affiliates.

See [NOTICE.md](./NOTICE.md) for third-party license acknowledgments.
