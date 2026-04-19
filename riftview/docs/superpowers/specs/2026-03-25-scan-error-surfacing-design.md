# Scan Error Surfacing Design

**Date:** 2026-03-25
**Status:** Approved for implementation

---

## Overview

When a service scan fails (e.g. ECR permission denied), the user currently sees nothing in the sidebar. The service row shows `0` nodes, indistinguishable from a genuinely empty account. This spec adds per-service warning badges to the Sidebar and a settings toggle to control them.

The canvas strip (`ScanErrorStrip`) already exists and is unchanged.

---

## 1. Data Flow

No backend changes needed. The full pipeline is already in place:

```
provider.ts: errCatch() → ScanError[]
  → scanner.ts: SCAN_DELTA IPC (with scanErrors attached)
  → useIpc.ts: setScanErrors(delta.scanErrors ?? [])
  → useCloudStore.scanErrors: ScanError[]
  → Sidebar.tsx: reads scanErrors, maps to service rows
```

`ScanError` shape (already in `renderer/types/cloud.ts`):
```ts
interface ScanError {
  service: string   // e.g. 'ecr', 'ec2:instances', 'rds'
  region:  string
  message: string
}
```

Each scan fully replaces `scanErrors` in the store via `setScanErrors`. Services that recover automatically lose their badge on the next scan.

---

## 2. Sidebar Warning Badges

Each service row in `Sidebar.tsx` gets a small amber `⚠` icon when any `scanError.service` maps to that row's `NodeType`.

**Service → NodeType mapping** (defined in Sidebar, not imported):

| scanError.service prefix | NodeType rows affected |
|--------------------------|------------------------|
| `ec2:instances` | `ec2` |
| `ec2:vpcs` | `vpc` |
| `ec2:subnets` | `subnet` |
| `ec2:security-groups` | `security-group` |
| `igw` | `igw` |
| `nat` | `nat-gateway` |
| `rds` | `rds` |
| `s3` | `s3` |
| `lambda` | `lambda` |
| `alb` | `alb` |
| `acm` | `acm` |
| `cloudfront` | `cloudfront` |
| `apigw` | `apigw` (route errors surface through this row; `apigw-route` has no independent scan call and needs no badge) |
| `sqs` | `sqs` |
| `secrets` | `secret` |
| `ecr` | `ecr-repo` |
| `sns` | `sns` |
| `dynamo` | `dynamo` |
| `ssm` | `ssm-param` — **not a `SERVICES` row**; badge appears on the Parameters section header. **Special case:** the Parameters section is normally gated on `ssmGroups.length > 0`, so it won't render at all when the SSM scan failed (zero params returned). When an `ssm` scan error is present and `ssmGroups` is empty, the implementer must render a minimal Parameters header row outside the gate so the badge is visible. |
| `r53` | `r53-zone` |
| `sfn` | `sfn` |
| `eventbridge` | `eventbridge-bus` |

`unknown` NodeType has no scan call and is never in this table.

`apigw-route` IS a normal `SERVICES` row but has no independent `catch_()` key in `provider.ts` (route errors surface under `apigw`). The badge lookup for `apigw-route` will always return empty — no special guard needed. `unknown` has no scan call and is never in this table. All other 21 service-bearing NodeTypes are covered above.

**Visual:**
- `⚠` icon rendered inline after the service label, in amber (`#f59e0b` / `color: var(--cb-warning, #f59e0b)`)
- `title` attribute on the icon shows the full error: `[service] region — message` (one line per error if multiple)
- No extra layout changes — the icon fits inline with the existing label

**Visibility:** badges only render when `showScanErrorBadges` setting is `true` (default) and `scanErrors.length > 0`.

**Dismiss interaction:** When the user dismisses the canvas strip, `clearScanErrors()` is called, which sets `scanErrors = []` in the store, removing all badges. Both surfaces clear together. Badges reappear on the next scan if the errors persist.

---

## 3. Settings

One new boolean field:

```ts
interface Settings {
  // ...existing fields...
  showScanErrorBadges: boolean   // default: true
}
```

- `false` hides all sidebar `⚠` badges; the canvas strip is unaffected
- Settings UI: a toggle labeled "Show error badges in sidebar" in the existing Settings modal

---

## 4. Files Changed

| File | Change |
|------|--------|
| `renderer/types/cloud.ts` | Add `showScanErrorBadges: boolean` to `Settings` |
| `store/cloud.ts` | Add `showScanErrorBadges: true` to the module-level `DEFAULT_SETTINGS` const (the test factory at line ~144 references the same const, so one edit covers both) |
| `main/ipc/handlers.ts` | Add `showScanErrorBadges: true` to `DEFAULT_SETTINGS` |
| `components/Sidebar.tsx` | Read `scanErrors` + `settings.showScanErrorBadges`; render `⚠` on matching rows |
| `components/SettingsModal.tsx` | Add toggle for `showScanErrorBadges` |

---

## 5. Out of Scope

- Changing the canvas `ScanErrorStrip` layout or behavior
- Per-region badge differentiation in the sidebar (tooltip shows region if needed)
- Persistent error history across app restarts
- Grouping or deduplicating errors in the tooltip display
