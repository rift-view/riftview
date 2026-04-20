# `@riftview/cli`

CI-first AWS scan, risks, drift, and diff for RiftView. Single self-contained Node bundle — no Electron, no persistent state.

- **Read-only:** every subcommand uses the AWS SDK in read mode. Write operations live in the desktop app.
- **Stable JSON:** every command emits `schemaVersion: 1` on `--output json`. Any breaking change bumps the version.
- **Deterministic exit codes:** CI pipelines can gate on 0/1/2/3/4 without parsing output.

## Install

```bash
npm install -g @riftview/cli
riftview version
```

Requires Node 20+.

## Quick start

```bash
# Scan your account, print a human-readable summary
riftview scan --profile prod

# Capture a snapshot for later comparison
riftview scan --profile prod --snapshot scan-$(date +%F).json

# List risks from the most recent scan (fresh in-process) and fail CI on warnings or worse
riftview risks --profile prod --fail-on S2

# Compare live infrastructure against your Terraform state
riftview drift --profile prod --state terraform.tfstate --fail-on-drift

# Diff two snapshots to see what changed between runs
riftview diff scan-2026-04-19.json scan-2026-04-20.json
```

## Commands

### `scan`

Run a full AWS account scan. Prints a resource summary + top 3 risks; optionally writes a snapshot file that `risks` and `diff` can read later.

```
riftview scan [options]

Options:
  --profile <name>    AWS profile (default: "default")
  --region <list>     comma-separated region list (default: profile default region from ~/.aws/config)
  --snapshot <path>   write full ScanOutput JSON to <path>
  --endpoint <url>    AWS endpoint override (e.g. http://localhost:4566 for LocalStack)
```

**JSON shape** — see `apps/cli/cli/output/schema.ts#ScanOutput`.

```jsonc
{
  "schemaVersion": 1,
  "command": "scan",
  "profile": "prod",
  "regions": ["us-east-1"],
  "timestamp": "2026-04-20T12:00:00.000Z",
  "durationMs": 4213,
  "nodes": [ /* CloudNode[] */ ],
  "edges": [ /* source/target/edgeType triples, flattened from node.integrations */ ],
  "scanErrors": [ /* per-service partial failures */ ],
  "topRisks": [ /* max 3 severity-sorted advisories */ ]
}
```

### `risks`

Run `analyzeNode` + `analyzeGraph` over a fresh scan or a saved snapshot. Emits severity-sorted findings with stable composite IDs. Primary CI gate via `--fail-on`.

```
riftview risks [options]

Options:
  --profile <name>       AWS profile (default: "default")
  --region <list>        comma-separated region list
  --endpoint <url>       AWS endpoint override
  --snapshot <path>      read nodes from a scan snapshot instead of hitting AWS
  --fail-on <severity>   S1 = critical only, S2 = critical OR warning, S3 = any finding
```

**Severity mapping**: `S1 = critical`, `S2 = warning`, `S3 = info`. `--fail-on S2` trips on any critical **or** warning.

**Finding ID**: every advisory carries `id: "${ruleId}:${nodeId}"` — safe to use as a stable key for CI dedupe.

**JSON shape** — see `apps/cli/cli/output/schema.ts#RisksOutput`.

### `drift`

Compare live AWS state against a Terraform tfstate file. Surfaces `matched`, `unmanaged` (live, not in TF), and `missing` (in TF, not live).

```
riftview drift [options]

Options:
  --state <path>     path to terraform.tfstate (required)
  --profile <name>   AWS profile (default: "default")
  --region <list>    comma-separated region list
  --endpoint <url>   AWS endpoint override
  --fail-on-drift    exit 1 if any unmanaged or missing resources are found
```

**JSON shape** — see `apps/cli/cli/output/schema.ts#DriftOutput`.

### `diff`

Structurally diff two `ScanOutput` snapshots. Reports added/removed resources plus field-level changes for nodes that persisted with different metadata.

```
riftview diff <a> <b> [options]
```

**JSON shape** — see `apps/cli/cli/output/schema.ts#DiffOutput`.

`diff` always exits 0 — CI pipelines compose gating by piping JSON through `jq`.

### `version`

```
riftview version [options]
```

Outputs build metadata: semver, git commit, build date, Node version. Same payload for both `riftview version` and `riftview --version` (the flag returns the semver only; the subcommand returns the full structured record).

## Global options

| Flag | Effect |
|---|---|
| `--output <pretty \| json>` | default `pretty`; machine readers pass `json` |
| `-v, --version` | semver only, then exit 0 |
| `-h, --help` | show help for root or subcommand |

`NO_COLOR=1` and non-TTY stdout suppress ANSI codes in pretty output.

## Exit codes

| Code | Constant | Cause | Example |
|---|---|---|---|
| 0 | `OK` | successful run | `scan` completed; `risks` without `--fail-on`; `diff` regardless of content |
| 1 | `FINDINGS` | gate tripped | `risks --fail-on S2` and any critical/warning present; `drift --fail-on-drift` and drift found |
| 2 | `USAGE` | bad invocation or unreadable input | unknown subcommand, missing `--state`, unreadable snapshot, mismatched `schemaVersion` |
| 3 | `AUTH` | AWS credential failure | expired SSO, invalid access key, `AccessDenied` |
| 4 | `RUNTIME` | unexpected error | anything not covered above |

CI pipelines can `set -e` and branch on `$?` directly — the contract is enforced by `apps/cli/tests/exit-codes.test.ts`.

## JSON schema reference

All output interfaces live in one file — treat it as the machine-readable contract:

- `apps/cli/cli/output/schema.ts`

Every output inherits `schemaVersion: 1` and a command-literal `command: "scan" | "risks" | ...`. The schema is pinned by `apps/cli/tests/output/schema.test.ts` — any field add/remove/rename or type widening fails CI.

## RiftView in CI

GitHub Actions example: drift-check on every PR against a committed `terraform.tfstate`.

```yaml
name: Infra drift

on:
  pull_request:
    branches: [main]

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
          aws-region: us-east-1

      - run: npm install -g @riftview/cli

      - run: |
          riftview drift \
            --state terraform.tfstate \
            --fail-on-drift \
            --output json > drift.json

      - if: always()
        run: cat drift.json | jq '.counts'
```

For a risks gate on a pre-captured snapshot:

```yaml
      - run: riftview scan --snapshot scan.json
      - run: riftview risks --snapshot scan.json --fail-on S2
```

## Source

`@riftview/cli` lives inside the [rift-view/riftview](https://github.com/rift-view/riftview) monorepo at `apps/cli`. Shared analysis, graph, drift, and scan primitives live at `packages/shared`.
