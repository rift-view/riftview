# Snapshot Export — Cost Delta Preview Model

**Linear:** [RIFT-21](https://linear.app/riftview/issue/RIFT-21)
**Status:** Draft spec, unblocked (consumer paths RIFT-20 and Sub-issue C
block on this landing)
**Related:** RIFT-5 (shape-vs-data drift separation — source of truth
for the `shape` / `data` split used here), RIFT-20 (apply-path
consumer), Snapshot Export Sub-issue C (UX consumer)

---

## 1. Purpose

Snapshot Export makes a concrete promise to pilot operators: restoring
a snapshot causes **minimal price incursions**, and the operator sees
the delta **before** they click apply. That promise only holds if the
cost preview is correct enough that a CloudOps lead at 3 a.m. will
trust it.

This spec defines the model that produces that preview: where the
numbers come from, how we separate the cost of restoring empty
infrastructure from the cost of restoring its contents, how we handle
regional pricing variance, and what shape the consumer (the UX
surface) receives.

It does **not** cover rendering (Sub-issue C) or apply-side enforcement
(RIFT-20). Both of those treat the output here as an opaque input.

---

## 2. Non-goals

- UI rendering, copy, or interaction design.
- Apply-path gating, IPC wiring, or plan-mutation logic.
- Non-AWS pricing (GCP/Azure). The interface below is designed to
  accommodate other providers in future, but no other provider is
  modelled in this revision.
- Historical spend analytics. This is restore-time preview, not
  cost-management.

---

## 3. Core insight: shape-cost vs data-cost

The product promise only makes sense if we split two things that AWS
itself bills separately:

| | shape.recurringMonthly | shape.oneTimeRestore | data.oneTimeRestore |
|---|---|---|---|
| **What it covers** | Steady-state price of the resource sitting idle after restore | One-time AWS charge to bring the shape into existence | One-time charge to load state (snapshot, objects, backup) into the shape |
| **Example (RDS)** | Instance-hours for `db.t3.medium` in region | $0 for an empty `aws_db_instance` | Snapshot restore I/O + storage for the backing snapshot ARN |
| **Example (S3)** | Storage-class $/GB-month for existing objects | $0 for an empty bucket | PUT requests + (optional) Glacier retrieval if hydrating from backup |
| **Example (NAT)** | Hourly NAT charge + data-processing | $0 (allocation is free, hourly meter starts immediately) | $0 (NAT has no "data" concept) |

Every resource in the per-resource table (§6) carries all three
fields, even if two of them are `{ kind: 'unknown', reason: 'n/a' }`.
The split is load-bearing: without it, "restoring an empty RDS
instance" and "restoring that same instance from a 400 GB snapshot
ARN" collapse into one number and the operator cannot tell which is
which.

This split is the same split RIFT-5 established for drift
(`shape`-drift vs `data`-drift). Cost preview inherits the vocabulary
so a single resource can be reasoned about consistently across drift
view and cost preview.

---

## 4. Data source layers

Pricing data is resolved through three layers, in priority order. The
resolver records which layer supplied the number in the `source` field
of the output (§5) so downstream consumers can surface confidence.

### 4.1 User override (highest priority)

Operators can pin a price for a specific `(nodeType, region, field)`
tuple. Used when:

- The operator has a negotiated EDP (Enterprise Discount Program) rate
  that differs from public pricing.
- The operator wants to stress-test a worst-case number.
- A line item is genuinely unknown and the operator wants to supply an
  estimate rather than see `unknown`.

Overrides are scoped to the current workspace and never persisted to
the repo. Output: `source: 'user-override'`, `confidence: 'user-asserted'`.

### 4.2 AWS Price List API (primary canonical source)

The [AWS Price List Query
API](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/price-changes.html)
is the authoritative source. Every meter we care about (EC2 instance
hours, RDS instance hours, NAT hourly, NAT data-processing, S3 storage
classes, Lambda GB-seconds, etc.) is queried by `(service, region,
productFamily, attributes)` and the result is cached locally.

- **Cache key:** `(service, region, productFamily, sku-attributes)`.
- **Cache location:** per-workspace sqlite file alongside the scan
  cache (not committed, per `.gitignore` workspace rules).
- **Staleness bound:** 7 days. After 7 days, an entry is treated as
  `stale` and the resolver either refreshes it (if online) or emits
  `confidence: 'stale'` alongside the cached value. AWS price changes
  are rare but not non-existent; 7 days keeps the pilot safe from a
  mid-quarter change without hammering the Price List API on every
  scan.
- **First run:** if the cache is cold and Price List API is
  unreachable, we fall through to the static table (§4.3). We never
  block the scan on pricing.

Output: `source: 'price-list-api'`, `confidence: 'fresh' | 'stale'`.

### 4.3 Derived static per-region table (fallback)

A static JSON table, derived from a periodic snapshot of the Price
List API (checked in at `packages/shared/src/pricing/static-table.json`
or similar — path TBD at implementation time), keyed by
`(nodeType, region, field)`. Used when:

- The API is unreachable **and** the local cache is cold.
- We are running offline in a demo or pilot sandbox.
- The operator has explicitly opted out of live API calls.

The static table is **derived**, not canonical — it is regenerated
from the Price List API on a schedule (monthly at a minimum) and PRs
that refresh it note the generation date. This is the key fix for the
CloudOps war story: a naive static table that hard-codes NAT at
$0.045/hr is wrong by ~75% in `af-south-1`, where the rate is
~$0.079/hr. The static table **must** be regional and **must** be
regenerated, not hand-edited.

Output: `source: 'static-table'`, `confidence: 'derived'`.

### 4.4 Unknown (terminal)

If all three layers fail — user has no override, API is unreachable
or returned no match, static table has no entry for the region — the
resolver returns `{ kind: 'unknown', reason }` for that field rather
than defaulting to zero or emitting NaN. Silent zeros are the worst
possible failure mode here because they encode as "free" in the UX.

---

## 5. Output shape (consumed by UX — Sub-issue C)

The resolver emits a single discriminated tagged union per field.
This is the **only** shape consumers may rely on; pre-rendered strings
and raw numbers are deliberately **not** part of the contract.

```ts
// packages/shared/src/types/pricing.ts (target location)

export type Currency = 'USD'

export type CostEstimate =
  | {
      kind: 'precise'
      value: number            // amount in currency units (e.g. dollars)
      currency: Currency
      source: CostSource
      confidence: CostConfidence
      surfaces: CostSurfaces
    }
  | {
      kind: 'range'
      low: number
      high: number
      currency: Currency
      source: CostSource
      confidence: CostConfidence
      surfaces: CostSurfaces
    }
  | {
      kind: 'unknown'
      reason: string           // human-readable; never blank
      surfaces: CostSurfaces
    }

export type CostSource =
  | 'user-override'
  | 'price-list-api'
  | 'static-table'

export type CostConfidence =
  | 'user-asserted'  // operator pinned this value
  | 'fresh'          // Price List API, within staleness bound
  | 'stale'          // Price List API, past staleness bound
  | 'derived'        // static table snapshot

// Hint to the renderer: does this estimate belong on the headline
// line (single prominent number per resource) or only in the
// drill-down (full shape + data breakdown)?
export interface CostSurfaces {
  headline: boolean
  drillDown: boolean
}

export interface ResourceCostPreview {
  nodeId: string
  nodeType: NodeType
  region: string
  shape: {
    recurringMonthly: CostEstimate
    oneTimeRestore: CostEstimate
  }
  data: {
    oneTimeRestore: CostEstimate
  }
}

export interface SnapshotCostPreview {
  resources: ResourceCostPreview[]
  // Aggregates are computed the same way as individual fields:
  // if any contributing field is 'unknown', the aggregate is 'range'
  // (low = sum of known minimums, high = sum of known maximums) with
  // a reason naming the unknown contributors.
  totals: {
    recurringMonthly: CostEstimate
    oneTimeRestore: CostEstimate
  }
}
```

Two rules the renderer can depend on:

1. **Every `CostEstimate` has `surfaces`**, including `unknown`. The
   renderer never has to infer placement.
2. **`unknown.reason` is always non-empty.** "Unknown" without a
   reason is a resolver bug.

---

## 6. Per-resource cost table

Every `NodeType` literal from `packages/shared/src/types/cloud.ts` is
enumerated below. Resources with no meaningful restore cost (pure
config/virtual resources — VPCs, security groups, route-table-like
constructs) are listed explicitly and justified; they are not
silently omitted.

| NodeType | shape.recurringMonthly | shape.oneTimeRestore | data.oneTimeRestore | Notes |
|---|---|---|---|---|
| `ec2` | Instance-hours × 730 per region + EBS $/GB-month | `$0` | EBS snapshot restore I/O if launched from snapshot | AMI itself is free; snapshot-backed AMI triggers `data` |
| `vpc` | `$0` | `$0` | `$0` | Pure config resource; no meter |
| `subnet` | `$0` | `$0` | `$0` | Pure config; IPv4 address charge attaches to the ENI/NAT, not the subnet |
| `rds` | Instance-hours × 730 + allocated storage $/GB-month + backup storage over free tier | `$0` for empty instance | **Snapshot restore**: I/O replay + temporary storage during restore; significant for large snapshots | The RIFT-21 exemplar. Split is mandatory. |
| `s3` | Storage-class $/GB-month for hydrated objects | `$0` for empty bucket | PUT request count × per-1k rate + (if Glacier) retrieval $/GB | Lifecycle rules and replication covered under `data` if they're part of the restore |
| `lambda` | GB-seconds × invocations (provisioned concurrency is recurring; on-demand is not) | `$0` | Code package upload: negligible; layered package fetch: negligible | Flag as `precise` with `value: 0` for `data` only when provisioned concurrency is off |
| `alb` | LCU-hours × 730 + hourly fixed | `$0` | `$0` | ALB has no restorable data |
| `security-group` | `$0` | `$0` | `$0` | Pure config |
| `igw` | `$0` | `$0` | `$0` | Internet gateway itself is free; data-transfer meters attach to the EC2/NAT it fronts |
| `acm` | `$0` for public certs | `$0` | `$0` | Private CA (PCA) is not modelled here; if seen, emit `unknown` with reason `'ACM PCA not modelled'` |
| `cloudfront` | Data-transfer out + request count | `$0` | `$0` | Origin fetch cost is billed to the origin resource, not CloudFront |
| `apigw` | Request count × per-million rate | `$0` | `$0` | REST vs HTTP API rates differ; resolver keys on `metadata.apiType` |
| `apigw-route` | `$0` (inherits parent) | `$0` | `$0` | Routes are config under the parent API; no separate meter |
| `sqs` | Request count × per-million rate | `$0` | `$0` | FIFO rate differs from Standard; resolver keys on `metadata.fifo` |
| `secret` | $/secret/month × count + API calls | `$0` | `$0` | Secret value itself has no restore data cost; rotation Lambda is billed under `lambda` |
| `ecr-repo` | Storage $/GB-month | `$0` for empty repo | Image push transfer: negligible intra-region, billed for cross-region | Most pilots are intra-region; default `precise` with `value: 0` for data |
| `sns` | Request count × per-million rate + delivery (SMS/email) | `$0` | `$0` | SMS delivery varies wildly by country; emit `range` for topics with SMS subscriptions |
| `dynamo` | On-demand: request count. Provisioned: RCU/WCU-hours. Plus storage $/GB-month | `$0` for empty table | **PITR / on-demand backup restore**: $/GB restored | Restore from backup is significant for large tables |
| `ssm-param` | Standard: `$0`. Advanced: $/parameter/month | `$0` | `$0` | No restore data cost |
| `nat-gateway` | **Hourly × 730 + data-processing $/GB** | `$0` (hourly meter starts at create) | `$0` | The CloudOps exemplar. Hourly rate varies by region (~$0.045/hr us-east-1 vs ~$0.079/hr af-south-1). Resolver **must** be region-aware. |
| `r53-zone` | $/hosted-zone/month + query count over free tier | `$0` | `$0` | Record changes are free; DNS query cost is recurring, not restore |
| `sfn` | State transitions × per-1k rate (Standard) or request-seconds (Express) | `$0` | `$0` | Resolver keys on `metadata.workflowType` |
| `eventbridge-bus` | Custom/partner event count × per-million | `$0` | `$0` | Default bus is free; custom bus is billed |
| `ses` | Emails sent + inbound + attachments | `$0` | `$0` | Free-tier only applies when sent from EC2; resolver is conservative and prices as if non-EC2 |
| `cognito` | MAU × tiered rate | `$0` | `$0` | Advanced security feature pricing emits `range` when not confirmed |
| `kinesis` | Shard-hours + PUT payload units | `$0` | `$0` | Retention beyond 24h is extra and billed under recurring |
| `ecs` | Fargate: vCPU-hours + GB-hours. EC2 launch type: `$0` at the cluster level (billed under `ec2`) | `$0` | `$0` | Resolver keys on `metadata.launchType` |
| `elasticache` | Node-hours × 730 | `$0` for empty node | **Snapshot restore**: I/O replay cost for Redis/Valkey backup | Mirrors the RDS pattern |
| `eks` | Control-plane hourly × 730 + node groups (billed under `ec2`) | `$0` | `$0` | Fargate profiles billed as Fargate; resolver delegates to `ecs` row when applicable |
| `opensearch` | Instance-hours × 730 + storage $/GB-month | `$0` for empty domain | **Snapshot restore**: I/O replay for S3-backed snapshot | Mirrors the RDS pattern |
| `msk` | Broker-hours × 730 + storage $/GB-month | `$0` | `$0` | MSK Serverless emits `range` (throughput-dependent) |
| `unknown` | `unknown` | `unknown` | `unknown` | Sentinel — if we don't know the type, we can't price it |

---

## 7. Regional variance handling

The CloudOps war story (NAT in us-east-1 vs af-south-1) is the
canonical test. The resolver handles regional variance with an
explicit fallback order, and **never** emits NaN.

For a lookup `(nodeType, region, field)`:

1. **Exact regional hit** in the current source layer (user override,
   API cache, or static table). Return as `precise`.
2. **Sibling region in the same partition.** If the region is missing
   but a geographic sibling exists (e.g. `af-south-1` missing but
   `eu-south-1` present), return the sibling's value as `range` with
   `low = sibling × 0.8`, `high = sibling × 1.3`, and
   `confidence` downgraded one step (`fresh` → `stale`, etc.). The
   reason string names the sibling explicitly: `"derived from
   eu-south-1; af-south-1 not in cache"`.
3. **Partition anchor.** If no sibling is available, fall back to the
   partition anchor (`us-east-1` for `aws`, `us-gov-west-1` for
   `aws-us-gov`, `cn-north-1` for `aws-cn`). Emit as `range` with
   `low = anchor × 0.8`, `high = anchor × 2.0` (the af-south-1 case
   shows real-world variance can exceed 75%; 2x high bound is
   deliberately wide).
4. **Give up.** Emit `{ kind: 'unknown', reason: "no pricing for
   region=<region> in any layer" }`. Never return zero. Never return
   NaN.

The `×0.8 / ×2.0` multipliers in step 3 are conservative bounds, not
a claim that we know the real price. They exist so the UX can show
the operator "this could be up to 2x the us-east-1 price" rather than
a confident wrong number.

---

## 8. Pilot scenarios

These are the three scenarios a pilot operator sees end-to-end. Each
shows the full `ResourceCostPreview` object the resolver emits, as it
would land in the Sub-issue C rendering path. The shape is the one
defined in §5; it is not redefined here.

### 8.1 NAT gateway restore in `af-south-1`

Operator is restoring a Terraform-managed NAT gateway in Cape Town.
The static table has no `af-south-1` entry; the Price List API is
reachable and returns a fresh price.

Published rate used: **~$0.079/hr** per
[https://aws.amazon.com/vpc/pricing/](https://aws.amazon.com/vpc/pricing/)
(within ±5% at time of writing). Monthly recurring at 730 hours:
~$57.67 + data-processing.

```ts
{
  nodeId: 'nat-0a1b2c3d4',
  nodeType: 'nat-gateway',
  region: 'af-south-1',
  shape: {
    recurringMonthly: {
      kind: 'range',
      low: 57.00,    // hourly only, no data-processing yet
      high: 120.00,  // with modest data-processing headroom
      currency: 'USD',
      source: 'price-list-api',
      confidence: 'fresh',
      surfaces: { headline: true, drillDown: true }
    },
    oneTimeRestore: {
      kind: 'precise',
      value: 0,
      currency: 'USD',
      source: 'price-list-api',
      confidence: 'fresh',
      surfaces: { headline: false, drillDown: true }
    },
  },
  data: {
    oneTimeRestore: {
      kind: 'precise',
      value: 0,
      currency: 'USD',
      source: 'price-list-api',
      confidence: 'fresh',
      surfaces: { headline: false, drillDown: true }
    }
  }
}
```

Operator-visible headline: the recurring range. Drill-down shows both
oneTime fields are zero. Crucially, the resolver did **not** pick the
$0.045/hr us-east-1 rate — that would have been wrong by ~75%.

### 8.2 RDS restore from snapshot ARN in `us-east-1`

Operator is restoring a `db.t3.medium` RDS instance from a 400 GB
snapshot ARN. Price List API is reachable and fresh.

Published rates used: **~$0.068/hr** for `db.t3.medium` + **$0.115/GB-month**
for gp2 storage per
[https://aws.amazon.com/rds/pricing/](https://aws.amazon.com/rds/pricing/)
(within ±5%). Monthly recurring: ~$49.64 instance + $46.00 storage =
~$95.64.

```ts
{
  nodeId: 'rds-prod-orders-replica',
  nodeType: 'rds',
  region: 'us-east-1',
  shape: {
    recurringMonthly: {
      kind: 'precise',
      value: 95.64,
      currency: 'USD',
      source: 'price-list-api',
      confidence: 'fresh',
      surfaces: { headline: true, drillDown: true }
    },
    oneTimeRestore: {
      kind: 'precise',
      value: 0,
      currency: 'USD',
      source: 'price-list-api',
      confidence: 'fresh',
      surfaces: { headline: false, drillDown: true }
    },
  },
  data: {
    oneTimeRestore: {
      kind: 'range',
      low: 5.00,
      high: 30.00,
      currency: 'USD',
      source: 'price-list-api',
      confidence: 'fresh',
      surfaces: { headline: true, drillDown: true }
    }
  }
}
```

The headline carries two numbers: $95.64/mo recurring **and** a
$5–$30 one-time data-restore cost. This is the shape-vs-data split
doing its job — the operator sees that restoring an empty instance is
~$96/mo forever and that hydrating from the 400 GB snapshot is an
additional one-time charge of up to $30. Without the split, those
collapse and the operator cannot reason about either.

### 8.3 S3 bucket restore in `eu-west-1` (large bucket, offline cache)

Operator is restoring an S3 bucket with ~2 TB of Standard-tier
objects. Price List API is unreachable (offline pilot); static table
has `eu-west-1` covered.

Published rate used: **~$0.023/GB-month** Standard tier per
[https://aws.amazon.com/s3/pricing/](https://aws.amazon.com/s3/pricing/)
(within ±5%). 2 TB = 2048 GB × $0.023 = ~$47.10/mo recurring.

```ts
{
  nodeId: 's3-corp-archives',
  nodeType: 's3',
  region: 'eu-west-1',
  shape: {
    recurringMonthly: {
      kind: 'precise',
      value: 47.10,
      currency: 'USD',
      source: 'static-table',
      confidence: 'derived',
      surfaces: { headline: true, drillDown: true }
    },
    oneTimeRestore: {
      kind: 'precise',
      value: 0,
      currency: 'USD',
      source: 'static-table',
      confidence: 'derived',
      surfaces: { headline: false, drillDown: true }
    },
  },
  data: {
    oneTimeRestore: {
      kind: 'range',
      low: 10.00,   // PUT requests only, no Glacier retrieval
      high: 80.00,  // includes worst-case cross-region replication or retrieval
      currency: 'USD',
      source: 'static-table',
      confidence: 'derived',
      surfaces: { headline: true, drillDown: true }
    }
  }
}
```

Operator sees `confidence: 'derived'` on every field — the UX will
flag that this is static-table data, not a live quote. The headline
still carries both recurring and one-time numbers, so the promise
holds even offline.

---

## 9. Consumers

- **RIFT-20 (apply-path wiring)** consumes `SnapshotCostPreview` as
  part of the plan envelope. It does not re-derive numbers. It may
  **gate** on confidence — e.g. refuse to proceed if any field in the
  plan is `unknown` and the operator has not explicitly acknowledged
  — but gating policy is out of scope here.

- **Sub-issue C (UX consumer)** consumes `SnapshotCostPreview` and
  renders. The `surfaces` hint tells it where each field belongs;
  the `kind` discriminator tells it whether to render a single
  number, a range, or an unknown-with-reason badge. No field arrives
  as a pre-formatted string.

- **RIFT-5 (shape-vs-data drift)** is the source of truth for the
  `shape` / `data` vocabulary this spec inherits. If RIFT-5 extends
  the split (e.g. adds a third axis), this spec and its output shape
  follow.

---

## 10. Open questions

Deliberately left open for implementation:

1. **Where does `packages/shared/src/pricing/` live exactly** — new
   subpackage vs. folder under `shared`? Lean toward folder; revisit
   if the static table grows past ~1 MB.
2. **User override persistence** — in-memory for the pilot, but do
   we want a per-workspace pinned-overrides file so operators don't
   re-enter rates every session? Defer to pilot feedback.
3. **Cross-region data-transfer meters** — currently modelled as
   `range` for the resources that commonly cross regions (S3
   replication, ECR image pulls). If a pilot needs tighter numbers,
   the resolver will need to read the plan's cross-region graph,
   not just the per-resource metadata. Out of scope for v1.
