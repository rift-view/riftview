# CLI integration tests

LocalStack-backed integration suite for the RiftView CLI.

## Running locally

One-time:

```bash
docker --version            # Docker Desktop running
terraform version | head -1 # terraform 1.9+
```

Each session:

```bash
npm run build:cli
npm run localstack:up     # brings up LocalStack + applies seed.tf
npm run test:integration  # runs cli-integration project
npm run localstack:down   # tears down
```

## What's here

- `fixtures/seed.tf` — Terraform that populates LocalStack with one
  resource per scannable + LocalStack-supported NodeType.
- `fixtures/drifted.tfstate` — tfstate with one resource absent from
  seed.tf; drives `riftview drift --fail-on-drift`.
- `fixtures/snapshots/snap-a.json` + `snap-b.json` — paired CLI
  snapshots with a known delta for `riftview diff`.
- `helpers/run-cli.ts` — execFileSync helper that runs the built
  bundle at `apps/cli/out/index.js` with LocalStack env injected.
- `*.integration.test.ts` — one per command (`scan`, `risks`,
  `drift`, `diff`).

## CI

The `e2e` job in `.github/workflows/ci.yml` runs this suite against the
same `.localstack/compose.yml` used for local dev — one source of truth,
no drift between environments.
