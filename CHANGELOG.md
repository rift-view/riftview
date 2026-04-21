# Changelog

All notable changes to the RiftView project are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **`@riftview/cli` v0.1.0** — CI-first AWS scan, risks, drift, and diff CLI.
  - Commands: `scan`, `risks`, `drift`, `diff`, `version`.
  - Stable JSON output schema v1 on `--output json`; every output carries `schemaVersion: 1` and a command literal.
  - Deterministic exit codes: `0 OK`, `1 FINDINGS`, `2 USAGE`, `3 AUTH`, `4 RUNTIME`.
  - CI gating via `--fail-on S1|S2|S3` (risks) and `--fail-on-drift` (drift).
  - Snapshot format: `riftview scan --snapshot <path>` writes a reloadable `ScanOutput` consumed by `risks --snapshot` and `diff`.
  - Self-contained Node bundle with no Electron runtime deps.
  - Ships from `apps/cli/` workspace; analysis primitives reused from `packages/shared/`.
  - Docs: [`apps/cli/README.md`](./apps/cli/README.md).
