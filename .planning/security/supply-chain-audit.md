# Supply-chain audit — PR #52 cloud-scan extraction

Authored: 2026-04-28. Scope: RIFT-70 §"Supply-chain audit of new resolver
deps" expanded coverage (a)/(b)/(c). Read-only enumeration; no dep
changes, lockfile edits, or installs were performed against the repo
tree. Subtree `npm audit` runs were performed in isolated `/tmp`
projects.

Trigger: PR #52 (`feat: extract packages/cloud-scan for CI phantom-dep
fix`, merged 2026-04-22 as `1f20f01`) added two ESLint resolver deps to
the root devDependencies and relocated the entire `@aws-sdk/client-*`
runtime surface into a new `packages/cloud-scan` workspace. RIFT-70
folds in the resolver-dep audit that was previously denied as a
separate ticket and expands coverage to runtime deps, Renovate App
permissions, and bot-account secrets.

Flag rules (RIFT-70):

- single-maintainer (1 npm account on the package)
- > 12-month gap since last release (cutoff: 2025-04-28)

## Summary

| Finding                                                                                                                                                                                     | Severity                                                  | Section |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------- |
| `unrs-resolver` — Rust-backed native binary, single-maintainer (jounqin), pulled in transitively by `eslint-import-resolver-typescript`                                                     | High (compromise = native code execution at lint time)    | (a)     |
| `@rtsao/scc` — single-maintainer, last release 2022-04-06 (~4y gap), inactive                                                                                                               | Medium                                                    | (a)     |
| ljharb polyfill set (`array-includes`, `array.prototype.*`, `object.*`, `string.prototype.trimend`, `is-core-module`, `hasown`) — single-account bus-factor, 6 of 8 with >12mo gap          | Medium (structural ecosystem risk, well-known maintainer) | (a)     |
| `is-bun-module` — single-maintainer, last release 2025-03-23 (just over 12mo)                                                                                                               | Low                                                       | (a)     |
| `doctrine` — last release 2023-06-22 (~2.8y gap), 4 maintainers but effectively unmaintained                                                                                                | Low                                                       | (a)     |
| Pre-existing `fast-xml-parser` GHSA-gh4j-gqv2-49f6 (moderate, CVSS 6.1) reachable through every `@aws-sdk/client-*` via `@aws-sdk/xml-builder@3.972.18 → fast-xml-parser@5.5.8`             | Moderate (not introduced by PR #52, fix available)        | (a)     |
| Renovate App `Workflows: Read & Write` permission exceeds the planned `renovate.json` scope (no workflow-file updates intended in initial config)                                           | Medium (excess privilege)                                 | (b)     |
| Renovate App `Administration: Read` returns branch-protection rules including required-check names — sensitive in light of the RIFT-69 ruleset migration                                    | Low (read-only, but informational leak)                   | (b)     |
| If self-hosted Renovate runner is chosen instead of the Mend-hosted GitHub App, a `RENOVATE_TOKEN` PAT must be provisioned and stored as a GitHub Actions secret on a dedicated bot account | Medium (PAT lifecycle, blast radius)                      | (c)     |

Net result: no critical findings. PR can merge with the discipline
layer (RIFT-69 + RIFT-70) intact provided the Renovate config is
deployed via the Mend-hosted GitHub App (no PAT) and the
`Workflows: Write` excess is accepted-with-rationale or the install is
scoped via a custom GitHub App with `Workflows: None`.

---

## (a) Runtime / dev deps added or newly surfaced in PR #52

### Net-new direct deps (root `package.json` devDependencies)

Source: `git diff 1f20f01^..1f20f01 -- package.json`.

| Package                             | Pinned  | Latest | Maintainers                                   | time.modified | Flag |
| ----------------------------------- | ------- | ------ | --------------------------------------------- | ------------- | ---- |
| `eslint-import-resolver-typescript` | ^4.4.4  | 4.4.4  | 3 (`jounqin`, `alexgorbatchev`, `bradzacher`) | 2025-06-25    | none |
| `eslint-plugin-import`              | ^2.32.0 | 2.32.0 | 3 (`benmosher`, `ljharb`, `jfmengels`)        | 2025-06-20    | none |

Both directs pass the RIFT-70 thresholds (≥2 maintainers, <12mo gap).

### Net-new direct deps (cloud-scan `package.json`)

`packages/cloud-scan/package.json` was created in PR #52 with 28
`@aws-sdk/client-*` deps + `@riftview/shared`. Of those 28, **27 were
relocated** from `apps/desktop/package.json` (verified by diffing
`1f20f01^:apps/desktop/package.json` against `1f20f01:apps/desktop/package.json`).
None were net-new to the repo. Per the RIFT-70 expanded coverage
clause (a), the two with newly-surfaced **call sites** still warrant
audit:

| Package                      | Pinned (cloud-scan) | Latest   | Maintainers                   | time.modified | New call site                                                                                                                                                |
| ---------------------------- | ------------------- | -------- | ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@aws-sdk/client-sts`        | ^3.1029.0           | 3.1038.0 | 2 (`amzn-oss`, `aws-sdk-bot`) | 2026-04-27    | `packages/cloud-scan/src/aws/credentials.ts` (new file, `validateAwsCredentials` wrapper around `STSClient` + `GetCallerIdentityCommand`)                    |
| `@aws-sdk/client-cloudwatch` | ^3.1030.0           | 3.1038.0 | 2 (`amzn-oss`, `aws-sdk-bot`) | 2026-04-27    | `packages/cloud-scan/src/aws/services/cloudwatch.ts` (new `fetchMetricsForProfile` exported wrapper, +32 LOC; the underlying `fetchMetrics` is pre-existing) |

Both publishers are official Amazon npm accounts. Daily-cadence
release cycle (last-modified within hours). No flag.

### First-level transitive — resolver tree

Source: `npm view <pkg>@<version> dependencies` for the two new direct
devDeps. 25 first-level transitives total.

`eslint-import-resolver-typescript@4.4.4` direct deps:

| Package                 | Latest | Maintainers           | time.modified | Flag (single-maint / >12mo)     |
| ----------------------- | ------ | --------------------- | ------------- | ------------------------------- |
| `debug`                 | 4.4.3  | 2                     | 2025-09-13    | —                               |
| `eslint-import-context` | 0.2.0  | 1 (`jounqin`)         | 2025-08-19    | single-maint                    |
| `get-tsconfig`          | 4.14.0 | 1 (`privatenumber`)   | 2026-04-15    | single-maint                    |
| `is-bun-module`         | 2.0.0  | 1 (`sunset_techuila`) | 2025-03-23    | single-maint, >12mo             |
| `stable-hash-x`         | 0.2.0  | 1 (`jounqin`)         | 2025-06-25    | single-maint                    |
| `tinyglobby`            | 0.2.16 | 1                     | 2026-04-07    | single-maint                    |
| `unrs-resolver`         | 1.11.1 | 1 (`jounqin`)         | 2025-07-09    | single-maint, **native binary** |

`eslint-plugin-import@2.32.0` direct deps:

| Package                         | Latest       | Maintainers  | time.modified | Flag (single-maint / >12mo) |
| ------------------------------- | ------------ | ------------ | ------------- | --------------------------- |
| `@rtsao/scc`                    | 1.1.0        | 1 (`rtsao`)  | 2022-04-06    | single-maint, **>4y gap**   |
| `array-includes`                | 3.1.9        | 1 (`ljharb`) | 2025-06-02    | single-maint                |
| `array.prototype.findlastindex` | 1.2.6        | 1 (`ljharb`) | 2025-03-14    | single-maint, >12mo         |
| `array.prototype.flat`          | 1.3.3        | 1 (`ljharb`) | 2024-12-15    | single-maint, >12mo         |
| `array.prototype.flatmap`       | 1.3.3        | 1 (`ljharb`) | 2024-12-16    | single-maint, >12mo         |
| `debug@^3.2.7`                  | (3.x branch) | 2            | —             | —                           |
| `doctrine`                      | 3.0.0        | 4            | 2023-06-22    | **>2.8y gap**               |
| `eslint-import-resolver-node`   | 0.3.10       | 3            | 2026-04-02    | —                           |
| `eslint-module-utils`           | 2.12.1       | 3            | 2025-06-20    | —                           |
| `hasown`                        | 2.0.3        | 2            | 2026-04-17    | —                           |
| `is-core-module`                | 2.16.1       | 1 (`ljharb`) | 2024-12-21    | single-maint, >12mo         |
| `is-glob`                       | 4.0.3        | 3            | 2023-06-22    | >2.8y gap                   |
| `minimatch`                     | 10.2.5       | 1 (`isaacs`) | 2026-03-30    | single-maint                |
| `object.fromentries`            | 2.0.8        | 1 (`ljharb`) | 2024-03-18    | single-maint, **>2y gap**   |
| `object.groupby`                | 1.0.3        | 1 (`ljharb`) | 2024-03-18    | single-maint, **>2y gap**   |
| `object.values`                 | 1.2.1        | 1 (`ljharb`) | 2024-12-19    | single-maint, >12mo         |
| `semver`                        | 7.7.4        | 6            | 2026-04-22    | —                           |
| `string.prototype.trimend`      | 1.0.9        | 2            | 2024-12-11    | >12mo                       |
| `tsconfig-paths`                | 4.2.0        | 14           | 2025-10-14    | —                           |

### First-level transitive — AWS SDK tree

`@aws-sdk/client-sts@3.1029.0` and `@aws-sdk/client-cloudwatch@3.1030.0`
direct deps total 39 packages (`tslib`, 18× `@smithy/*`, 20×
`@aws-sdk/*`). Treated as a single audit unit:

- All `@aws-sdk/*` and `@smithy/*` packages are published by the same
  two-account pair as the direct (`amzn-oss`, `aws-sdk-bot`) on a
  daily-to-weekly cadence. No single-maintainer or stale-release flags.
- `tslib` (Microsoft, multi-maintainer, current).
- `@aws-crypto/sha256-{js,browser}@5.2.0` pinned exact-version
  (no `^`) by every `@aws-sdk/client-*` — same Amazon publisher, but
  the exact-pin pattern means a Renovate update will touch every SDK
  package's `dependencies` block, not just one. Worth keeping under
  the planned `@aws-sdk/*` Renovate group rather than splitting.

### npm audit subtree

Run 1 — isolated install of just the new resolver deps
(`/tmp/audit-snapshot/`, `npm install --package-lock-only
eslint-import-resolver-typescript@4.4.4 eslint-plugin-import@2.32.0`):

```
vulnerabilities: 0 (info: 0, low: 0, moderate: 0, high: 0, critical: 0)
dependencies: 240 total (139 prod + 25 optional + 77 peer)
```

Clean.

Run 2 — isolated install of the newly-surfaced AWS SDK clients
(`/tmp/audit-aws/`, `@aws-sdk/client-sts@3.1029.0
@aws-sdk/client-cloudwatch@3.1030.0`):

```
vulnerabilities: 0
dependencies: 88 total
```

Clean.

Run 3 — full repo lockfile (`npm audit --omit=dev` against the current
`package-lock.json` at HEAD = `8e0b1dc`):

```
vulnerabilities: 2 moderate
  fast-xml-parser <5.7.0  via  @aws-sdk/xml-builder@3.972.18
  @aws-sdk/xml-builder 3.894.0 - 3.972.18  via  fast-xml-parser
  GHSA-gh4j-gqv2-49f6  CVSS 6.1  CWE-91 (XML/CDATA injection in XMLBuilder)
  fixAvailable: true
dependencies: 1397 total (291 prod + 1094 dev + 240 optional + 22 peer)
```

Reachability: `riftview-monorepo → @riftview/cloud-scan →
@aws-sdk/client-acm@3.1034.0 → @aws-sdk/core@3.974.3 →
@aws-sdk/xml-builder@3.972.18 → fast-xml-parser@5.5.8`. Every
`@aws-sdk/client-*` package transitively pulls the same vulnerable
`xml-builder`, so the finding is repo-wide, not specific to PR #52.
The fix exists upstream: `fast-xml-parser@5.7.2` (released
2026-04-24) is published; bumping `@aws-sdk/core` to a release that
depends on `@aws-sdk/xml-builder >= 3.972.19` clears it. Out of scope
for this audit per dispatch ("no dep upgrades, removals, replacements"),
but the first Renovate weekly batch on the `@aws-sdk/*` group is
expected to clear it automatically.

### Flagged dep risk + recommended action

| Dep                                                                                                                                                                                                                                                         | Flag                                                  | One-line risk                                                                                                                                                                                                                                                                 | Recommended action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unrs-resolver` (transitive of `eslint-import-resolver-typescript`)                                                                                                                                                                                         | single-maint, native binary                           | Compromise of `jounqin`'s npm account → arbitrary native code execution at lint time on every contributor laptop and CI runner that runs `pnpm run lint`. The Rust-backed `.node` binary fetched at install time is the highest-impact single point in the new resolver tree. | Treat lint as an untrusted execution boundary in CI: ensure the `fast` job has no AWS, registry, or signing credentials in scope (verify `.github/workflows/ci.yml` env block). Pin `unrs-resolver` to an exact version via `pnpm.overrides` if the resolver project ever publishes a hash-pinned release; otherwise rely on the lockfile-discipline guard from RIFT-70. Subscribe to `import-js/eslint-import-resolver-typescript` GH releases. Re-evaluate at the Renovate `eslint-import-resolver-typescript` major bump. |
| `@rtsao/scc` (transitive of `eslint-plugin-import`)                                                                                                                                                                                                         | single-maint, >4y gap                                 | Strongly-connected-components helper, single-purpose, frozen for 4 years. Account compromise risk grows the longer the package is unattended.                                                                                                                                 | Accept; replacement would mean replacing `eslint-plugin-import` itself. Track the package in a Renovate watch-only rule (no auto-PR) so any new release is human-reviewed.                                                                                                                                                                                                                                                                                                                                                   |
| ljharb polyfill set: `array-includes`, `array.prototype.findlastindex`, `array.prototype.flat`, `array.prototype.flatmap`, `is-core-module`, `object.fromentries`, `object.groupby`, `object.values`, `string.prototype.trimend`, `hasown` (10 transitives) | single-account, ≥6 with >12mo gap                     | Bus-factor concentrated in a single npm account (`ljharb`). Account-compromise blast radius is large but the maintainer is widely known and reputation-bonded; risk is structural to the polyfill ecosystem, not specific to PR #52.                                          | Accept; mitigate via lockfile discipline (RIFT-70 CI guard) so any silent shift in any of these 10 fails CI. Configure Renovate to batch all `array.prototype.*`, `object.*`, `string.prototype.*` updates with `dependencyDashboardApproval: true` for human gate before merge.                                                                                                                                                                                                                                             |
| `is-bun-module`                                                                                                                                                                                                                                             | single-maint, just-over-12mo gap                      | Low-traffic single-maintainer pkg. New-account risk if compromised, but small surface (a 30-line bun detector).                                                                                                                                                               | Accept; same lockfile-discipline mitigation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `doctrine`                                                                                                                                                                                                                                                  | 4 maintainers but effectively unmaintained (2.8y gap) | Legacy ESLint AST helper, frozen but not deprecated. Multi-maintainer makes single-account compromise harder.                                                                                                                                                                 | Accept; track for deprecation notice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `fast-xml-parser` GHSA-gh4j-gqv2-49f6                                                                                                                                                                                                                       | moderate vuln in repo lockfile, pre-existing          | XML comment / CDATA injection in `XMLBuilder`. Reachable via every `@aws-sdk/client-*`, but RiftView is read-side: it consumes XML from AWS, does not author it. CVSS 6.1 user-interaction-required vector does not apply to our usage pattern.                               | Out of scope (pre-existing, not PR-#52-introduced). Will be cleared by the first post-RIFT-70 Renovate weekly batch on the `@aws-sdk/*` group. If it is not cleared inside two Renovate cycles, escalate to a manual `@aws-sdk/core` bump.                                                                                                                                                                                                                                                                                   |

---

## (b) Renovate GitHub App permissions vs planned scope

Source: <https://docs.renovatebot.com/security-and-permissions/> as of
this audit (Mend-hosted Renovate App, the deployment model RIFT-70's
CI-guard `renovate[bot]` allowlist entry implies).

### Full permission set requested by the App at install

Repository-scope:

| Permission        | Access       | App rationale (per Mend docs)                                                             |
| ----------------- | ------------ | ----------------------------------------------------------------------------------------- |
| Metadata          | Read         | Mandatory for any GitHub App.                                                             |
| Code (Contents)   | Read & Write | Read repo, create branches for update PRs.                                                |
| Pull Requests     | Read & Write | Open / update / close dependency PRs.                                                     |
| Issues            | Read & Write | Create the Dependency Dashboard issue and Config Warning issues.                          |
| Checks            | Read & Write | Read PR check status; write status reports the bot owns.                                  |
| Commit statuses   | Read & Write | Same as Checks for status-check API.                                                      |
| Workflows         | Read & Write | Update `.github/workflows/*.yml` files when an action's `uses:` ref needs a version bump. |
| Administration    | Read         | Read branch-protection rules, assign teams to PRs.                                        |
| Dependabot alerts | Read         | Open vulnerability fix PRs from GH advisory data.                                         |

User-scope (per-user OAuth, not the App install):

- Email — Read (only when a user logs into the Mend dashboard).

Webhook events: not enumerated in the public permissions doc;
typical Renovate App installs subscribe to `push`, `pull_request`,
`check_run`, `status`, `issue_comment` (PR command parsing via
e.g. `@renovate-bot rebase`).

### Planned `renovate.json` scope (RIFT-70)

| RIFT-70 requirement                                                                                                                | Permission required                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Batch dependency updates into weekly PRs (`@aws-sdk/*`, `@smithy/*`, `@typescript-eslint/*`, `@tailwindcss/*`, `@vitest/*` groups) | Code: R/W; Pull Requests: R/W                                                                                                                     |
| Lockfile maintenance, monthly                                                                                                      | Code: R/W; Pull Requests: R/W; (also requires the bot to run `pnpm install` in the bot's CI runner — App permission alone is not enough; see (c)) |
| Pin minor drift visible                                                                                                            | Pull Requests: R/W                                                                                                                                |
| Lockfile only regenerates inside the bot's CI                                                                                      | (Out-of-band; enforced by the CI guard, not by App permissions)                                                                                   |
| Dependency Dashboard                                                                                                               | Issues: R/W                                                                                                                                       |

### Excess permission flags

| App permission                  | Required by planned config?                                                                                                                                                                                                                                                                               | Action                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Metadata: Read`                | Yes (mandatory)                                                                                                                                                                                                                                                                                           | accept                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Code: Read & Write`            | Yes                                                                                                                                                                                                                                                                                                       | accept                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Pull Requests: Read & Write`   | Yes                                                                                                                                                                                                                                                                                                       | accept                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Issues: Read & Write`          | Yes (Dependency Dashboard)                                                                                                                                                                                                                                                                                | accept                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Checks: Read & Write`          | Yes (status-check reporting)                                                                                                                                                                                                                                                                              | accept                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Commit statuses: Read & Write` | Yes                                                                                                                                                                                                                                                                                                       | accept                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Workflows: Read & Write`       | **No** in initial config — RIFT-70 §"Renovate (or Dependabot) config" does not list `actions/*` or workflow YAML in its package groups. The first Renovate run will however want to update the `actions/checkout` / `actions/setup-node` `uses:` lines in `.github/workflows/ci.yml` if they fall behind. | **Flag, decide explicitly:** either (i) accept `Workflows: Write` and add a `github-actions` package group to `renovate.json` so the workflow updates are visible+grouped, or (ii) move to a self-managed GitHub App with `Workflows: None` and add `excludePackageNames: ["actions/*"]` to the config. Recommendation: (i) — the discipline win (workflow drift visible in PR diff) outweighs the marginal blast radius. |
| `Administration: Read`          | Partial — Renovate reads branch protection to know which checks must pass; planned config does not require it but the App always asks.                                                                                                                                                                    | Accept with note: the same `Administration: Read` exposes the lockfile-guard-removal change in `.github/rulesets/protect-main.json` (RIFT-69 retires `lockfile-guard` from ruleset 15373828) to anyone with App-install visibility. Read-only, but informational.                                                                                                                                                         |
| `Dependabot alerts: Read`       | No — RIFT-70 routes vuln fixes via Renovate's package groups, not the GH advisory pipeline. Cosmetic excess.                                                                                                                                                                                              | Accept; no write capability so no risk.                                                                                                                                                                                                                                                                                                                                                                                   |
| User Email: Read (per-user)     | No (no Mend dashboard usage planned)                                                                                                                                                                                                                                                                      | Decline at OAuth time on a per-user basis.                                                                                                                                                                                                                                                                                                                                                                                |

### Cross-check against RIFT-69 ruleset migration

RIFT-69 retires the `lockfile-guard` required check from ruleset
15373828 ("Protect Main") via `gh api -X PUT
/repos/rift-view/riftview/rulesets/15373828 --input
.github/rulesets/protect-main.json`. The Renovate App's
`Administration: Read` permission can observe both the pre- and
post-migration ruleset state. Verify the committed
`.github/rulesets/protect-main.json` does not include any internal
required-check names that should remain confidential before the
ruleset PUT lands.

---

## (c) Bot-account secrets inventory

The migration's secrets surface depends on which Renovate deployment
model RIFT-70 ships. Both are inventoried; final choice is a RIFT-70
in-scope decision.

### Option A — Mend-hosted Renovate GitHub App (recommended)

Default of RIFT-70's `renovate[bot]` allowlist. Mend operates the
runner infrastructure; auth flows through the App installation.

| Secret name                 | Required?        | Storage location                                                                      | Notes                                                                                                                        |
| --------------------------- | ---------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `RENOVATE_TOKEN`            | **Not required** | n/a                                                                                   | Mend-hosted runner uses the GitHub App's installation token; no PAT lives in the repo.                                       |
| `GITHUB_TOKEN`              | **Not required** | n/a                                                                                   | Same.                                                                                                                        |
| `RENOVATE_GITHUB_COM_TOKEN` | Optional         | GitHub Actions repository secret (`Settings → Secrets → Actions → Repository secret`) | Only needed if `renovate.json` references private GitHub.com-hosted dependencies (we don't — all deps are public npm). Skip. |

### Option B — Self-hosted Renovate runner (GitHub Actions)

Used if SecOps later prefers running Renovate inside our own CI for
sandboxing reasons. RIFT-70 does not require this path; documenting
for completeness.

| Secret name                    | Required?                              | Storage location                                                                                        | Notes                                                                                                                                                                                                                                           |
| ------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RENOVATE_TOKEN`               | Required                               | GitHub Actions **organization** secret, scoped to `rift-view/riftview` (preferred) or repository secret | PAT on a dedicated bot account — never a personal account. Required scopes: `repo` (read+write), `workflow` only if the `Workflows: Write` analog from (b) is desired. Document the bot account name in `~/riftview-docs/team/` (private repo). |
| `RENOVATE_PR_HOURLY_LIMIT` env | No (it's a config value, not a secret) | `.github/workflows/renovate.yml` env block                                                              | Documented for completeness.                                                                                                                                                                                                                    |
| `GITHUB_TOKEN`                 | No                                     | (the workflow's automatic token, scoped per-job)                                                        | Used implicitly by the action; no secret to provision.                                                                                                                                                                                          |

### Option C — Dependabot (RIFT-70 alternative-of-record)

| Secret name        | Required?                                 | Storage location                                                                            | Notes                                       |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `DEPENDABOT_TOKEN` | Only if private registries are referenced | Dependabot secret (`Settings → Secrets → Dependabot`) — separate scope from Actions secrets | We do not consume private registries. Skip. |

### Bot-account hygiene (applies to Option B if chosen)

- Use a dedicated GitHub bot account, not a human contributor's PAT.
- Token expiry: 90 days max, with calendar reminder for rotation.
- 2FA via WebAuthn / hardware key, not TOTP.
- Bot account membership: only `rift-view/riftview`, not the org-wide
  `rift-view/*`.
- Audit log review: monthly check of the bot's `gh api
/orgs/rift-view/audit-log?actor=<bot>` activity.

---

## Out of scope for this audit (per dispatch)

- Dependency upgrades, removals, or replacements (including the
  fast-xml-parser fix).
- Touching `package-lock.json` or any `package.json`.
- Authoring `renovate.json` (RIFT-70 in-scope work).
- Authoring the CI lockfile-guard step (RIFT-70 in-scope work).
- Authoring the `packageManager` corepack hash (RIFT-70 in-scope work).

## Recommended actions before RIFT-69 + RIFT-70 PR merges

1. **Decide Workflows permission policy** — pick (i) accept
   `Workflows: Write` and add `github-actions` package group to
   `renovate.json`, or (ii) deploy via a custom GitHub App with
   `Workflows: None`. Document in `renovate.json` header comment.
2. **Confirm `.github/rulesets/protect-main.json` is review-safe** —
   no leaked internal check names — before RIFT-69's `gh api -X PUT`
   lands the file content in the public repo diff.
3. **Confirm Mend-hosted (Option A) vs self-hosted (Option B)** — and
   if Option B, provision the bot account and `RENOVATE_TOKEN`
   organization secret before the migration PR opens.
4. **Set Renovate `dependencyDashboardApproval: true` for the ljharb
   polyfill group** — gates auto-merge behind a human eye on
   single-account-bus-factor deps.
5. **Track `unrs-resolver` upstream** — subscribe to
   `unrs/unrs-resolver` GH releases for fast response if the native
   binary publishing pipeline ever changes hands.

## SecOps sign-off

Pending. Tag this PR's review with `@security` and resolve before
RIFT-69 + RIFT-70 merge per RIFT-70 verification clause.
