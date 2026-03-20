# CLI Output Sanitization Policy

**Date:** 2026-03-19
**Status:** Policy — approved by Security Engineer, implementation required

---

## 1. What Currently Flows into `cliOutput`

`CliEngine.runOne()` streams every line of `stdout` and `stderr` from the `aws` CLI subprocess directly to the renderer via `IPC.CLI_OUTPUT`. The renderer stores each line in `useCliStore.cliOutput` (an array of `{ line: string; stream: 'stdout' | 'stderr' }`) and displays them in `CommandDrawer`.

There is currently no filtering, truncation, or sanitization between the subprocess output and the renderer store. Everything the CLI emits reaches the renderer verbatim.

---

## 2. Risk Surface

The following categories of sensitive data can appear in AWS CLI output under normal operation:

| Category | Example | Likelihood |
|---|---|---|
| Account IDs | ARNs containing `123456789012` | High — ARNs are everywhere |
| Resource names with PII | EC2 name tag `prod-john-doe-server` | Medium |
| Tag values | User-defined tags with email, cost center, env secrets | Medium |
| Error messages with config detail | `NoCredentialProviders: no valid providers in chain` with profile path | Medium |
| Pre-signed URLs | S3 presign commands include temporary credentials in query params | Low — not a current feature |
| Secret values | `secretsmanager get-secret-value` output | **Critical — current feature** |

The most critical risk is Secrets Manager. The `secret` NodeType is scanned (name + ARN only), but if a user were to run a manual CLI command via CommandDrawer that fetches secret values, those values would land in `cliOutput` verbatim.

---

## 3. Sanitization Policy

### What Must Be Kept

Users need to see CLI output to understand what happened. Wholesale suppression is not acceptable. The following must remain visible:

- Command success/failure status
- Resource IDs and ARNs created or modified
- Error messages (minus credential detail — see below)
- AWS service responses relevant to the operation

### What Must Be Filtered

**Non-negotiable — filtered in main process before IPC:**

1. **Lines containing raw AWS access keys** — Pattern: `AKIA[0-9A-Z]{16}` or `ASIA[0-9A-Z]{16}`. Replace the key value with `[REDACTED]`. These should never appear in normal CLI output, but if they do (e.g. misconfigured error output), they must not reach the renderer.

2. **Lines containing `AWS_SECRET_ACCESS_KEY` values** — If a line contains the string `AWS_SECRET_ACCESS_KEY` followed by a value, redact the value portion.

3. **Local mode dummy credentials echoed in output** — The values `test` injected as `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` in local mode are not sensitive, but filter them anyway for consistency.

### What Is Accepted Risk (documented, not filtered)

- **Account IDs in ARNs** — Visible in output, acceptable. Account ID is not a secret; it appears in every AWS console URL. Do not filter.
- **Resource names / tag values** — Visible in output, acceptable. Users can see what they named their own resources.
- **Error messages with profile paths** — Acceptable. The local filesystem path to `~/.aws/credentials` is not sensitive in a desktop app context.

---

## 4. Where Filtering Happens

Filtering is applied in **`CliEngine.runOne()`** in the main process, on each line before it is sent via `IPC.CLI_OUTPUT`. The renderer store (`useCliStore`) receives only pre-filtered lines and needs no changes.

This is the correct boundary: credentials never leave the main process, and sanitized output is what crosses IPC.

```ts
function sanitizeLine(line: string): string {
  // Redact AWS access key IDs
  return line.replace(/(AKIA|ASIA)[0-9A-Z]{16}/g, '[REDACTED_KEY]')
}
```

Apply `sanitizeLine` to each `stdout` and `stderr` line before calling `this.win.webContents.send(IPC.CLI_OUTPUT, ...)`.

---

## 5. Local Endpoint Credential Validation (Addendum)

`CliEngine` now validates that `this.endpoint` is a local address before injecting dummy credentials (`AWS_ACCESS_KEY_ID: 'test'`). The guard function `isLocalEndpoint()` accepts `localhost`, `127.0.0.1`, `0.0.0.0`, and `*.local` hostnames. Non-local endpoints receive a `console.warn` and real credentials from `process.env`. This prevents accidental use of dummy credentials against real AWS endpoints.

---

## 6. Implementation Checklist

- [ ] Add `sanitizeLine()` function in `engine.ts`
- [ ] Apply to every `stdout` and `stderr` line before `IPC.CLI_OUTPUT` send
- [ ] Add unit test: access key pattern is redacted, normal output is unchanged
- [ ] Document in CLAUDE.md Key Patterns: "CLI output is sanitized in main process before IPC"
