# Scan Health Indicators + Dependency-Aware Scan Ordering

**Date:** 2026-03-19
**Status:** Spec — ready for implementation

---

## Problem

All service scans in `awsProvider.scan()` use `.catch(() => [])`. A failed scan is indistinguishable from an empty result set. The user has no way to know whether SQS has zero queues or whether the SQS scan threw an error. Additionally, scans run in parallel with no dependency ordering — VPC nodes may arrive after subnet nodes, causing canvas flash and incomplete topology renders.

---

## 1. Per-Service Scan Health

### Data Shape

Add a `ScanHealth` type to `src/renderer/types/cloud.ts`:

```ts
export type ScanServiceStatus = 'ok' | 'error' | 'timeout'

export interface ScanServiceHealth {
  status:  ScanServiceStatus
  message?: string   // error message if status === 'error' or 'timeout'
  count:   number    // number of resources returned
}

export type ScanHealth = Partial<Record<NodeType, ScanServiceHealth>>
```

### Store Change

Add `scanHealth: ScanHealth` to `useCloudStore`. Set it alongside `nodes` at the end of each scan. Clear it on profile switch.

### Provider Change (`provider.ts`)

Replace `.catch(() => [])` per service with a wrapper that captures success/failure:

```ts
async function scanSafe<T>(fn: () => Promise<T[]>, type: NodeType): Promise<{ type: NodeType; nodes: T[]; health: ScanServiceHealth }> {
  try {
    const nodes = await fn()
    return { type, nodes, health: { status: 'ok', count: nodes.length } }
  } catch (err) {
    return { type, nodes: [], health: { status: 'error', count: 0, message: String(err) } }
  }
}
```

Run all scans through `scanSafe`, collect results, then dispatch both the merged node list and the health map to the store in a single update.

### UI

In `Sidebar.tsx`, each service row badge currently shows a count. When `scanHealth[type]` exists:
- `status: 'ok'` — no change; show count badge as today
- `status: 'error'` — replace count badge with a red `!` badge; add `title` tooltip with the error message
- `status: 'timeout'` — replace with an amber `?` badge

This requires no new components — just conditional badge rendering in the existing service row map.

---

## 2. Dependency-Aware Scan Ordering

### Why It Matters

React Flow renders nodes as they arrive. If subnet nodes are stored before VPC nodes, the VPC container doesn't exist yet and subnets render floating. The next scan cycle fixes it, but the flash is visible and confusing.

### Proposed Ordering

Run scans in three sequential waves instead of one flat `Promise.all`:

**Wave 1 — Foundation** (no dependencies):
- VPC, IGW, Route53 zones, S3, ECR, SQS, SNS, DynamoDB, Secrets, SFN, EventBridge

**Wave 2 — Depends on Wave 1**:
- Subnet (needs VPC), Security Group (needs VPC), NAT Gateway (needs subnet/VPC), ACM

**Wave 3 — Depends on Wave 2**:
- EC2 (needs subnet + SG), RDS (needs subnet + SG), ALB (needs subnet + SG), Lambda (needs SG optional), API Gateway + Routes, CloudFront (needs ACM optional), SSM Parameters

### Implementation

In `provider.ts`, replace the single `Promise.all` with three sequential `Promise.all` calls, one per wave. Each wave uses `scanSafe`. Health results accumulate across waves and are dispatched once after Wave 3.

Store receives a single update after all three waves complete — no intermediate partial renders.

### Timeout Per Wave

Each wave has an independent 45-second wall-clock timeout. If a wave times out, its services are marked `status: 'timeout'` in `ScanHealth` and the next wave proceeds with whatever data is available.

---

## Implementation Checklist

- [ ] Add `ScanHealth`, `ScanServiceHealth`, `ScanServiceStatus` to `types/cloud.ts`
- [ ] Add `scanHealth: ScanHealth` to `useCloudStore` with `setScanHealth` action
- [ ] Add `scanSafe` wrapper in `provider.ts`
- [ ] Restructure `awsProvider.scan()` into three ordered waves
- [ ] Update `Sidebar.tsx` badge rendering to consume `scanHealth`
- [ ] Clear `scanHealth` on profile switch
- [ ] Add tests: `scanSafe` captures error, health map is populated, wave ordering doesn't regress node counts
