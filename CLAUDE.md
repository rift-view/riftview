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

- `~/riftview-docs/superpowers/plans/` — implementation plans per phase
- `~/riftview-docs/superpowers/specs/` — design specs per phase
- `~/riftview-docs/team/` — role playbooks / agent personas
- `~/riftview-docs/outreach/` — positioning, pricing, cold-email drafts
- `~/riftview-docs/roadmap.md` — milestone sequencing

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
