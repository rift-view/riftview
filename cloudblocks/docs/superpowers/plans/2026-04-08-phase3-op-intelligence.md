# Phase 3: OP_INTELLIGENCE — Heuristic Advisory System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a flag-gated ADVISORIES section to the Inspector that surfaces security and configuration issues detected passively from scan metadata, with no LLM, no new IPC channels, and no async logic in the heuristic layer.

**Architecture:** Three scan services augmented to capture derived boolean flags (`hasPublicSsh`, `publicAccessEnabled`, `multiAZ`); one pure function `analyzeNode(node: CloudNode): Advisory[]` in the renderer; one Inspector section flag-gated on `OP_INTELLIGENCE`. All analysis is synchronous and renderer-side — no new IPC.

**Tech Stack:** TypeScript, AWS SDK v3 (scan augmentation), React, Vitest + RTL (tests)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/main/aws/services/rds.ts` | Add `multiAZ: boolean` from existing `DescribeDBInstances` response |
| Modify | `src/main/aws/services/s3.ts` | Add `publicAccessEnabled: boolean` via `GetPublicAccessBlock` |
| Modify | `src/main/aws/services/ec2.ts` | Add `hasPublicSsh: boolean` via one-shot `DescribeSecurityGroups` on all instance SG IDs |
| Modify | `src/renderer/types/cloud.ts` | Add `AdvisoryRuleId`, `AdvisorySeverity`, `Advisory` types |
| Create | `src/renderer/utils/analyzeNode.ts` | Pure fn: `CloudNode → Advisory[]` |
| Create | `tests/renderer/utils/analyzeNode.test.ts` | Unit tests — one per rule, no mocks |
| Modify | `src/renderer/components/Inspector.tsx` | Add ADVISORIES section (flag-gated `OP_INTELLIGENCE`, after REMEDIATE) |
| Create | `tests/renderer/components/Inspector.advisories.test.tsx` | Integration: visibility, severity order, empty state |

---

## Task 1: Scan augmentation — RDS `multiAZ`

**Files:**
- Modify: `src/main/aws/services/rds.ts`
- Modify: `tests/main/aws/services/rds.test.ts`

### Background

`DescribeDBInstances` already returns `MultiAZ: boolean` on each `DBInstance`. It is currently not captured. This is a one-line addition to the metadata object.

---

- [ ] **Step 1: Add `multiAZ` to RDS scan metadata**

In `src/main/aws/services/rds.ts`, extend the `allInstances` destructured type and metadata:

Change the type annotation (line 12) to include `MultiAZ`:
```ts
const allInstances: {
  DBInstanceIdentifier?: string
  DBInstanceStatus?: string
  Engine?: string
  DBInstanceClass?: string
  Endpoint?: { Address?: string }
  DBSubnetGroup?: { VpcId?: string }
  MultiAZ?: boolean
}[] = []
```

Change the metadata line in the `.map()`:
```ts
metadata: { engine: db.Engine, instanceClass: db.DBInstanceClass, endpoint: db.Endpoint?.Address, multiAZ: db.MultiAZ ?? false },
```

- [ ] **Step 2: Update the RDS test**

In `tests/main/aws/services/rds.test.ts`, find the test that asserts the metadata shape and add `multiAZ` to the expected output. Look for where `metadata` is asserted and add:
```ts
expect(nodes[0].metadata.multiAZ).toBe(false) // or true — match the fixture
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npx vitest run tests/main/aws/services/rds.test.ts 2>&1 | tail -15
```

Expected: PASS

- [ ] **Step 4: Typecheck**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm run typecheck 2>&1 | tail -10
```

Expected: exit 0

- [ ] **Step 5: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
git add src/main/aws/services/rds.ts tests/main/aws/services/rds.test.ts
git commit -m "feat(phase3): add multiAZ to RDS scan metadata"
```

---

## Task 2: Scan augmentation — S3 `publicAccessEnabled`

**Files:**
- Modify: `src/main/aws/services/s3.ts`
- Modify: `tests/main/aws/services/s3.test.ts`

### Background

`GetPublicAccessBlockCommand` returns `PublicAccessBlockConfiguration` with four boolean fields: `BlockPublicAcls`, `BlockPublicPolicy`, `RestrictPublicBuckets`, `IgnorePublicAcls`. If **any** is `false`, or if the call throws (no public access block configured at all), the bucket is considered publicly accessible. Set `publicAccessEnabled: true` in that case.

The call is per-bucket and happens inside the existing `Promise.all` enrichment loop alongside `GetBucketNotificationConfiguration`.

---

- [ ] **Step 1: Add `GetPublicAccessBlockCommand` import**

In `src/main/aws/services/s3.ts`, add to the import:
```ts
import {
  S3Client,
  ListBucketsCommand,
  GetBucketNotificationConfigurationCommand,
  GetPublicAccessBlockCommand,
} from '@aws-sdk/client-s3'
```

- [ ] **Step 2: Add `publicAccessEnabled` to the S3 enrichment loop**

After the `notifRes` block (after `if (!notifRes) return baseNode`), add:

```ts
// Public access block
let publicAccessEnabled = false
const pabRes = await client
  .send(new GetPublicAccessBlockCommand({ Bucket: name }))
  .catch(() => null)

if (!pabRes) {
  // No block config at all — bucket is publicly accessible
  publicAccessEnabled = true
} else {
  const c = pabRes.PublicAccessBlockConfiguration ?? {}
  publicAccessEnabled = !(c.BlockPublicAcls && c.BlockPublicPolicy && c.RestrictPublicBuckets && c.IgnorePublicAcls)
}
```

Then update the `baseNode` definition to include this field:
```ts
const baseNode: CloudNode = {
  id: name,
  type: 's3',
  label: name,
  status: 'running',
  region,
  metadata: { creationDate: b.CreationDate, publicAccessEnabled },
}
```

Move the `publicAccessEnabled` computation before the `baseNode` definition — the logic above must run first.

Full rewritten `enriched` map body for the bucket:
```ts
const name = b.Name ?? 'unknown'

// Public access block
let publicAccessEnabled = false
const pabRes = await client
  .send(new GetPublicAccessBlockCommand({ Bucket: name }))
  .catch(() => null)
if (!pabRes) {
  publicAccessEnabled = true
} else {
  const c = pabRes.PublicAccessBlockConfiguration ?? {}
  publicAccessEnabled = !(c.BlockPublicAcls && c.BlockPublicPolicy && c.RestrictPublicBuckets && c.IgnorePublicAcls)
}

const baseNode: CloudNode = {
  id: name,
  type: 's3',
  label: name,
  status: 'running',
  region,
  metadata: { creationDate: b.CreationDate, publicAccessEnabled },
}

const notifRes = await client
  .send(new GetBucketNotificationConfigurationCommand({ Bucket: name }))
  .catch(() => null)

if (!notifRes) return baseNode
// ... rest of integrations unchanged
```

- [ ] **Step 3: Update S3 test**

In `tests/main/aws/services/s3.test.ts`, find the mock for `S3Client` and add a mock for `GetPublicAccessBlockCommand`. The mock should return a fully-blocked config for happy path:

```ts
// In the mock send handler, add a case for GetPublicAccessBlockCommand:
if (input instanceof GetPublicAccessBlockCommand) {
  return {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      RestrictPublicBuckets: true,
      IgnorePublicAcls: true,
    },
  }
}
```

Then assert `nodes[0].metadata.publicAccessEnabled === false`.

Add a second test case where the mock throws (simulating no public access block), and assert `publicAccessEnabled === true`.

- [ ] **Step 4: Run tests**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npx vitest run tests/main/aws/services/s3.test.ts 2>&1 | tail -15
```

Expected: PASS

- [ ] **Step 5: Typecheck**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm run typecheck 2>&1 | tail -10
```

Expected: exit 0

- [ ] **Step 6: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
git add src/main/aws/services/s3.ts tests/main/aws/services/s3.test.ts
git commit -m "feat(phase3): add publicAccessEnabled to S3 scan metadata"
```

---

## Task 3: Scan augmentation — EC2 `hasPublicSsh`

**Files:**
- Modify: `src/main/aws/services/ec2.ts`
- Modify: `tests/main/aws/services/ec2.test.ts`

### Background

After collecting all EC2 instances (paginated), gather all unique SG IDs across all instances in one set. Call `DescribeSecurityGroupsCommand` once with that full set. Build a `Map<sgId, IpPermission[]>`. For each instance, check if any attached SG has an inbound rule allowing port 22 from `0.0.0.0/0` (or protocol `-1` from `0.0.0.0/0`).

Add `IpPermission` to the import from `@aws-sdk/client-ec2`.

---

- [ ] **Step 1: Add `IpPermission` to import**

In `src/main/aws/services/ec2.ts`:
```ts
import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeSecurityGroupsCommand,
  DescribeKeyPairsCommand,
  type Instance,
  type IpPermission,
} from '@aws-sdk/client-ec2'
```

- [ ] **Step 2: Add SG enrichment to `describeInstances`**

After the paginated loop that collects `instances`, add this block before the `.map()`:

```ts
// Build SG → IpPermissions map (one call for all instance SGs)
const allSgIds = [
  ...new Set(
    instances.flatMap((i) =>
      (i.SecurityGroups ?? []).map((sg) => sg.GroupId ?? '').filter(Boolean)
    )
  ),
]
const sgRulesMap = new Map<string, IpPermission[]>()
if (allSgIds.length > 0) {
  const sgRes = await client
    .send(new DescribeSecurityGroupsCommand({ GroupIds: allSgIds }))
    .catch(() => null)
  for (const sg of sgRes?.SecurityGroups ?? []) {
    sgRulesMap.set(sg.GroupId ?? '', sg.IpPermissions ?? [])
  }
}
```

- [ ] **Step 3: Compute `hasPublicSsh` per instance**

In the `.map()` callback, before building the metadata object, add:

```ts
const sgIds = (i.SecurityGroups ?? []).map((sg) => sg.GroupId ?? '').filter(Boolean)
const hasPublicSsh = sgIds.some((sgId) => {
  const rules = sgRulesMap.get(sgId) ?? []
  return rules.some(
    (rule) =>
      (rule.IpProtocol === '-1' ||
        (rule.FromPort !== undefined &&
          rule.FromPort <= 22 &&
          (rule.ToPort ?? rule.FromPort) >= 22)) &&
      (rule.IpRanges ?? []).some((r) => r.CidrIp === '0.0.0.0/0')
  )
})
```

Add `hasPublicSsh` to the metadata:
```ts
metadata: {
  instanceType:     i.InstanceType,
  vpcId:            i.VpcId,
  subnetId:         i.SubnetId,
  publicIp:         i.PublicIpAddress,
  privateIp:        i.PrivateIpAddress,
  ami:              i.ImageId,
  securityGroupIds: (i.SecurityGroups ?? []).map(sg => sg.GroupId).filter(Boolean),
  hasPublicSsh,
},
```

- [ ] **Step 4: Update EC2 test**

In `tests/main/aws/services/ec2.test.ts`, add a mock response for `DescribeSecurityGroupsCommand`. For the default (safe) case, return empty `IpPermissions`. Add a test that provides a SG with port 22 open to `0.0.0.0/0` and asserts `hasPublicSsh === true`. Add a test with a restricted SG and assert `hasPublicSsh === false`.

- [ ] **Step 5: Run tests**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npx vitest run tests/main/aws/services/ec2.test.ts 2>&1 | tail -15
```

Expected: PASS

- [ ] **Step 6: Full suite smoke check**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm test 2>&1 | tail -5
```

Expected: all pass (895 + new tests)

- [ ] **Step 7: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
git add src/main/aws/services/ec2.ts tests/main/aws/services/ec2.test.ts
git commit -m "feat(phase3): add hasPublicSsh to EC2 scan metadata via SG rule check"
```

---

## Task 4: `Advisory` type definitions

**Files:**
- Modify: `src/renderer/types/cloud.ts`

### Background

Add three new exported types to `cloud.ts`. These go near the bottom of the file (after existing types). No existing code changes — addition only.

---

- [ ] **Step 1: Add types to `cloud.ts`**

Append to `src/renderer/types/cloud.ts`:

```ts
// ── Advisory system (Phase 3: OP_INTELLIGENCE) ────────────────────────────────

export type AdvisoryRuleId =
  | 'ec2-public-ssh'
  | 'lambda-no-timeout'
  | 'lambda-low-memory'
  | 's3-public-access'
  | 'rds-no-multiaz'

export type AdvisorySeverity = 'info' | 'warning' | 'critical'

export interface Advisory {
  ruleId: AdvisoryRuleId
  severity: AdvisorySeverity
  title: string
  detail: string
  nodeId: string
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm run typecheck 2>&1 | tail -10
```

Expected: exit 0

- [ ] **Step 3: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
git add src/renderer/types/cloud.ts
git commit -m "feat(phase3): add Advisory, AdvisoryRuleId, AdvisorySeverity types"
```

---

## Task 5: `analyzeNode` — pure function + tests (TDD)

**Files:**
- Create: `tests/renderer/utils/analyzeNode.test.ts`
- Create: `src/renderer/utils/analyzeNode.ts`

### Background

Pure function. Synchronous. Reads `node.type` and `node.metadata` only. Returns `Advisory[]`. No cross-node lookup. No async. One rule per node type group, except `lambda` which has two rules.

The severity ordering for display (critical → warning → info) is the caller's responsibility — `analyzeNode` does not sort.

---

- [ ] **Step 1: Write the failing tests**

Create `tests/renderer/utils/analyzeNode.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { analyzeNode } from '../../../src/renderer/utils/analyzeNode'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function node(overrides: Partial<CloudNode>): CloudNode {
  return {
    id: 'test-id',
    label: 'test',
    type: 'lambda',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides,
  } as CloudNode
}

describe('analyzeNode', () => {
  // ── lambda-no-timeout ──────────────────────────────────────────────────────
  it('lambda with no timeout → critical lambda-no-timeout', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: {} }))
    expect(r).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'lambda-no-timeout', severity: 'critical' }),
    ]))
  })

  it('lambda with timeout=0 → critical lambda-no-timeout', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 0 } }))
    expect(r.some((a) => a.ruleId === 'lambda-no-timeout')).toBe(true)
  })

  it('lambda with timeout=30 → no lambda-no-timeout', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30 } }))
    expect(r.find((a) => a.ruleId === 'lambda-no-timeout')).toBeUndefined()
  })

  // ── lambda-low-memory ──────────────────────────────────────────────────────
  it('lambda with memorySize=128 → warning lambda-low-memory', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30, memorySize: 128 } }))
    expect(r).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'lambda-low-memory', severity: 'warning' }),
    ]))
  })

  it('lambda with memorySize=512 → no lambda-low-memory', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30, memorySize: 512 } }))
    expect(r.find((a) => a.ruleId === 'lambda-low-memory')).toBeUndefined()
  })

  it('lambda with no memorySize → no lambda-low-memory', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30 } }))
    expect(r.find((a) => a.ruleId === 'lambda-low-memory')).toBeUndefined()
  })

  // ── ec2-public-ssh ────────────────────────────────────────────────────────
  it('ec2 with hasPublicSsh=true → critical ec2-public-ssh', () => {
    const r = analyzeNode(node({ type: 'ec2', metadata: { hasPublicSsh: true } }))
    expect(r).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'ec2-public-ssh', severity: 'critical' }),
    ]))
  })

  it('ec2 with hasPublicSsh=false → no ec2-public-ssh', () => {
    const r = analyzeNode(node({ type: 'ec2', metadata: { hasPublicSsh: false } }))
    expect(r.find((a) => a.ruleId === 'ec2-public-ssh')).toBeUndefined()
  })

  it('ec2 with no hasPublicSsh → no ec2-public-ssh', () => {
    const r = analyzeNode(node({ type: 'ec2', metadata: {} }))
    expect(r.find((a) => a.ruleId === 'ec2-public-ssh')).toBeUndefined()
  })

  // ── s3-public-access ───────────────────────────────────────────────────────
  it('s3 with publicAccessEnabled=true → critical s3-public-access', () => {
    const r = analyzeNode(node({ type: 's3', metadata: { publicAccessEnabled: true } }))
    expect(r).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 's3-public-access', severity: 'critical' }),
    ]))
  })

  it('s3 with publicAccessEnabled=false → no s3-public-access', () => {
    const r = analyzeNode(node({ type: 's3', metadata: { publicAccessEnabled: false } }))
    expect(r.find((a) => a.ruleId === 's3-public-access')).toBeUndefined()
  })

  it('s3 with no publicAccessEnabled → no s3-public-access', () => {
    const r = analyzeNode(node({ type: 's3', metadata: {} }))
    expect(r.find((a) => a.ruleId === 's3-public-access')).toBeUndefined()
  })

  // ── rds-no-multiaz ────────────────────────────────────────────────────────
  it('rds with multiAZ=false → warning rds-no-multiaz', () => {
    const r = analyzeNode(node({ type: 'rds', metadata: { multiAZ: false } }))
    expect(r).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'rds-no-multiaz', severity: 'warning' }),
    ]))
  })

  it('rds with no multiAZ → warning rds-no-multiaz', () => {
    const r = analyzeNode(node({ type: 'rds', metadata: {} }))
    expect(r.some((a) => a.ruleId === 'rds-no-multiaz')).toBe(true)
  })

  it('rds with multiAZ=true → no rds-no-multiaz', () => {
    const r = analyzeNode(node({ type: 'rds', metadata: { multiAZ: true } }))
    expect(r.find((a) => a.ruleId === 'rds-no-multiaz')).toBeUndefined()
  })

  // ── type isolation ────────────────────────────────────────────────────────
  it('vpc node → no advisories', () => {
    expect(analyzeNode(node({ type: 'vpc', metadata: {} }))).toHaveLength(0)
  })

  it('advisory has nodeId matching the node', () => {
    const r = analyzeNode(node({ id: 'my-lambda', type: 'lambda', metadata: {} }))
    expect(r[0].nodeId).toBe('my-lambda')
  })

  it('advisory has non-empty title and detail', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: {} }))
    expect(r[0].title.length).toBeGreaterThan(0)
    expect(r[0].detail.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npx vitest run tests/renderer/utils/analyzeNode.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `analyzeNode.ts`**

Create `src/renderer/utils/analyzeNode.ts`:

```ts
import type { Advisory, CloudNode } from '../types/cloud'

export function analyzeNode(node: CloudNode): Advisory[] {
  const advisories: Advisory[] = []

  if (node.type === 'lambda') {
    const timeout = node.metadata.timeout as number | undefined
    if (!timeout || timeout === 0) {
      advisories.push({
        ruleId: 'lambda-no-timeout',
        severity: 'critical',
        title: 'No timeout configured',
        detail:
          'This Lambda function has no timeout set and may run indefinitely, incurring unexpected costs. Set a timeout in the function configuration.',
        nodeId: node.id,
      })
    }

    const memorySize = node.metadata.memorySize as number | undefined
    if (memorySize === 128) {
      advisories.push({
        ruleId: 'lambda-low-memory',
        severity: 'warning',
        title: 'Memory at default (128 MB)',
        detail:
          'This function uses the default memory allocation and has likely never been tuned. Review execution duration and consider adjusting memory to optimise cost and latency.',
        nodeId: node.id,
      })
    }
  }

  if (node.type === 'ec2' && node.metadata.hasPublicSsh === true) {
    advisories.push({
      ruleId: 'ec2-public-ssh',
      severity: 'critical',
      title: 'Public SSH exposure (port 22 open to 0.0.0.0/0)',
      detail:
        'A security group on this instance allows inbound SSH from any IP. Restrict port 22 to known CIDR ranges or use AWS Systems Manager Session Manager instead.',
      nodeId: node.id,
    })
  }

  if (node.type === 's3' && node.metadata.publicAccessEnabled === true) {
    advisories.push({
      ruleId: 's3-public-access',
      severity: 'critical',
      title: 'Public access not fully blocked',
      detail:
        'This S3 bucket does not have all public access block settings enabled. Unless intentionally serving public content, enable all four public access block settings in the bucket configuration.',
      nodeId: node.id,
    })
  }

  if (node.type === 'rds' && !node.metadata.multiAZ) {
    advisories.push({
      ruleId: 'rds-no-multiaz',
      severity: 'warning',
      title: 'Single-AZ deployment',
      detail:
        'This RDS instance is not configured for Multi-AZ. A hardware failure or maintenance event may cause unplanned downtime. Enable Multi-AZ for production workloads.',
      nodeId: node.id,
    })
  }

  return advisories
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npx vitest run tests/renderer/utils/analyzeNode.test.ts 2>&1 | tail -10
```

Expected: all 15 tests PASS

- [ ] **Step 5: Typecheck**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm run typecheck 2>&1 | tail -10
```

Expected: exit 0

- [ ] **Step 6: Full test suite**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm test 2>&1 | tail -5
```

Expected: all pass

- [ ] **Step 7: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
git add src/renderer/utils/analyzeNode.ts tests/renderer/utils/analyzeNode.test.ts
git commit -m "feat(phase3): analyzeNode pure function + 5-rule advisory set"
```

---

## Task 6: Inspector ADVISORIES section + tests

**Files:**
- Modify: `src/renderer/components/Inspector.tsx`
- Create: `tests/renderer/components/Inspector.advisories.test.tsx`

### Background

**Insert point:** After the closing `})()}` of the REMEDIATE IIFE (line 315) and before `{/* node type header */}` (line 317).

**Behaviour:**
- Flag-gated on `flag('EXECUTION_ENGINE')` — wait, no. The meeting decided `OP_INTELLIGENCE` flag. Use `flag('OP_INTELLIGENCE')`.
- Renders for any node type that might produce advisories (lambda, ec2, s3, rds). Simplest guard: always render the section when the flag is on and a node is selected — `analyzeNode` returns `[]` for unsupported types.
- Severity order: critical → warning → info (sort before render).
- Collapsible: `useState(true)` for `expanded` — default open.
- Empty state copy: "No issues detected" (not "no advisories").
- Each advisory row: colored severity badge + title (bold) + detail (muted, smaller).

**Severity colors:**
- `critical` → `#ef4444` (red)
- `warning` → `#f59e0b` (amber)
- `info` → `#60a5fa` (blue)

**Import additions needed in Inspector.tsx:**
```ts
import { analyzeNode } from '../utils/analyzeNode'
import type { Advisory } from '../types/cloud'
```

(`flag` is already imported.)

---

- [ ] **Step 1: Write the failing tests**

Create `tests/renderer/components/Inspector.advisories.test.tsx`:

```tsx
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Inspector } from '../../../src/renderer/components/Inspector'
import { useUIStore } from '../../../src/renderer/store/ui'
import { useCloudStore } from '../../../src/renderer/store/cloud'
import type { CloudNode } from '../../../src/renderer/types/cloud'

const saveAnnotationsMock = vi.fn().mockResolvedValue(undefined)
const analyzeIamMock = vi.fn().mockResolvedValue({ nodeId: '', findings: [], fetchedAt: 0 })

Object.defineProperty(window, 'terminus', {
  value: { saveAnnotations: saveAnnotationsMock, analyzeIam: analyzeIamMock },
  writable: true,
})

vi.mock('../../../src/renderer/components/IamAdvisor', () => ({
  IamAdvisor: () => null,
}))

function baseNode(overrides: Partial<CloudNode> = {}): CloudNode {
  return {
    id: 'fn-arn',
    label: 'my-fn',
    type: 'lambda',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides,
  } as CloudNode
}

function setup(node: CloudNode) {
  useUIStore.setState({ selectedNodeId: node.id })
  useCloudStore.setState({ nodes: [node], importedNodes: [] })
  return render(
    <Inspector
      onDelete={vi.fn()}
      onEdit={vi.fn()}
      onQuickAction={vi.fn()}
    />
  )
}

describe('Inspector ADVISORIES section', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FLAG_OP_INTELLIGENCE', 'true')
    useUIStore.setState({ selectedNodeId: null, annotations: {}, selectedEdgeId: null, selectedEdgeInfo: null })
    useCloudStore.setState({ nodes: [], importedNodes: [] })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('hidden when OP_INTELLIGENCE flag is false', () => {
    vi.unstubAllEnvs()
    setup(baseNode({ metadata: {} }))
    expect(screen.queryByText('ADVISORIES')).toBeNull()
  })

  it('shows ADVISORIES section for lambda with no timeout', () => {
    setup(baseNode({ metadata: {} }))
    expect(screen.getByText('ADVISORIES')).toBeTruthy()
  })

  it('shows advisory title for lambda-no-timeout', () => {
    setup(baseNode({ metadata: {} }))
    expect(screen.getByText('No timeout configured')).toBeTruthy()
  })

  it('shows "No issues detected" for a lambda with timeout and non-default memory', () => {
    setup(baseNode({ metadata: { timeout: 30, memorySize: 512 } }))
    expect(screen.getByText('No issues detected')).toBeTruthy()
  })

  it('shows both critical and warning for lambda with timeout=0 and memory=128', () => {
    setup(baseNode({ metadata: { timeout: 0, memorySize: 128 } }))
    expect(screen.getByText('No timeout configured')).toBeTruthy()
    expect(screen.getByText('Memory at default (128 MB)')).toBeTruthy()
  })

  it('critical advisory appears before warning (severity order)', () => {
    setup(baseNode({ metadata: { timeout: 0, memorySize: 128 } }))
    const items = screen.getAllByRole('listitem')
    const titles = items.map((el) => el.textContent ?? '')
    const criticalIdx = titles.findIndex((t) => t.includes('No timeout'))
    const warningIdx  = titles.findIndex((t) => t.includes('Memory at default'))
    expect(criticalIdx).toBeLessThan(warningIdx)
  })

  it('collapse toggle hides advisory list', () => {
    setup(baseNode({ metadata: {} }))
    fireEvent.click(screen.getByText('ADVISORIES'))
    expect(screen.queryByText('No timeout configured')).toBeNull()
  })

  it('vpc node with flag on → shows "No issues detected"', () => {
    setup(baseNode({ type: 'vpc', metadata: {} }))
    expect(screen.getByText('No issues detected')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npx vitest run tests/renderer/components/Inspector.advisories.test.tsx 2>&1 | tail -15
```

Expected: FAIL — `ADVISORIES` not found

- [ ] **Step 3: Add imports to Inspector.tsx**

In `src/renderer/components/Inspector.tsx`, add after the existing `buildRemediateCommands` import line:
```ts
import { analyzeNode } from '../utils/analyzeNode'
import type { Advisory } from '../types/cloud'
```

- [ ] **Step 4: Add `OP_INTELLIGENCE` Advisory section JSX**

In `src/renderer/components/Inspector.tsx`, insert after the closing `})()}` of the REMEDIATE IIFE (after line 315, before `{/* node type header */}`):

```tsx
{/* ADVISORIES section — flag-gated OP_INTELLIGENCE */}
{flag('OP_INTELLIGENCE') && (() => {
  const rawAdvisories = analyzeNode(node as CloudNode)
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  const advisories: Advisory[] = [...rawAdvisories].sort(
    (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
  )
  const [expanded, setExpanded] = React.useState(true)
  const severityColor = (s: string): string =>
    s === 'critical' ? '#ef4444' : s === 'warning' ? '#f59e0b' : '#60a5fa'

  return (
    <div style={{
      padding: '8px 10px',
      borderRadius: 4,
      background: 'rgba(239,68,68,0.06)',
      border: '1px solid rgba(239,68,68,0.2)',
      fontSize: 10,
      marginBottom: 8,
    }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{ fontWeight: 700, color: '#ef4444', marginBottom: expanded ? 6 : 0, fontSize: 9, cursor: 'pointer', userSelect: 'none' }}
      >
        ADVISORIES {expanded ? '▾' : '▸'}
      </div>

      {expanded && (
        advisories.length === 0 ? (
          <div style={{ color: 'var(--cb-text-muted)', fontSize: 9, fontStyle: 'italic' }}>
            No issues detected
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {advisories.map((a) => (
              <li key={a.ruleId} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 8, fontWeight: 700, color: severityColor(a.severity),
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {a.severity}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--cb-text-primary)' }}>
                    {a.title}
                  </span>
                </div>
                <div style={{ fontSize: 8, color: 'var(--cb-text-secondary)', lineHeight: 1.5 }}>
                  {a.detail}
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
})()}
```

- [ ] **Step 5: Run the Inspector tests**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npx vitest run tests/renderer/components/Inspector.advisories.test.tsx 2>&1 | tail -15
```

Expected: all 8 tests PASS

- [ ] **Step 6: Typecheck**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm run typecheck 2>&1 | tail -10
```

Expected: exit 0

- [ ] **Step 7: Full test suite**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm test 2>&1 | tail -5
```

Expected: all pass (895 baseline + ~35 new = ~930 total)

- [ ] **Step 8: Verify flag=false test (smoke check)**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npx vitest run tests/renderer/components/Inspector.advisories.test.tsx --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|flag)"
```

Expected: `hidden when OP_INTELLIGENCE flag is false` listed as PASS

- [ ] **Step 9: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
git add src/renderer/components/Inspector.tsx tests/renderer/components/Inspector.advisories.test.tsx
git commit -m "feat(phase3): Inspector ADVISORIES section — flag-gated OP_INTELLIGENCE"
```

---

## Completion Verification

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm run typecheck && npm test
```

Expected outcome:
- typecheck exits 0
- All tests pass (~930 total)
- `flag('OP_INTELLIGENCE') = false` → Inspector unchanged (covered by test)
- `flag('OP_INTELLIGENCE') = true` + Lambda with no timeout → ADVISORIES shows "No timeout configured" (critical)
- `flag('OP_INTELLIGENCE') = true` + RDS with multiAZ=true → "No issues detected"
- `flag('OP_INTELLIGENCE') = true` + EC2 with hasPublicSsh=true → "Public SSH exposure" (critical)
