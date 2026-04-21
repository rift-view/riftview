# @riftview/cli

CI-first AWS scan, risks, drift, and diff for [RiftView](https://github.com/rift-view/riftview).

- Read-only AWS SDK usage — writes live in the desktop app.
- Stable JSON output (`schemaVersion: 1`) and deterministic exit codes (0/1/2/3/4) for CI gates.
- Single self-contained Node bundle — no Electron, no persistent state.

## Install

```bash
npm install -g @riftview/cli
riftview version
```

Requires Node 20+.

## Commands

```bash
riftview scan   --profile prod              # scan + summary + top risks
riftview risks  --profile prod --fail-on S2 # CI gate: fail on critical OR warning
riftview drift  --profile prod --state terraform.tfstate --fail-on-drift
riftview diff   scan-a.json scan-b.json     # structural diff of two snapshots
riftview version                            # semver + commit + build date
```

## Documentation

Full reference — flags, JSON output schema, exit codes table, GitHub Actions example:

**[github.com/rift-view/riftview/blob/main/docs/cli.md](https://github.com/rift-view/riftview/blob/main/docs/cli.md)**

## Exit codes

| Code | Cause |
|---|---|
| 0 | success |
| 1 | findings gate tripped (`--fail-on` / `--fail-on-drift`) |
| 2 | bad invocation or unreadable input |
| 3 | AWS credential failure |
| 4 | unexpected runtime error |

## License

See the [RiftView monorepo](https://github.com/rift-view/riftview) root for licensing and trademark notices.
