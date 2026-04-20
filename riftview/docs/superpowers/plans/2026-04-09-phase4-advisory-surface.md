# Phase 4 — Advisory Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OP_INTELLIGENCE feel like a real security scanner: advisory badges visible on canvas nodes, 5 new advisory rules backed by new scan metadata, and a direct "Fix" button for advisories that have a known CLI remediation.

**Architecture:** Four independent layers — (1) ResourceNode badge uses existing `analyzeNode` with data it already receives; (2) scan metadata additions are pure main-process additions, no renderer changes; (3) advisory rules expand `analyzeNode.ts` and `AdvisoryRuleId` type; (4) advisory remediation is a new pure utility + Inspector UI wire-up. Each task is self-contained and committable.

**Tech Stack:** TypeScript · React 19 · Zustand · Electron main process · AWS SDK v3 · Vitest + RTL

---

## File Map

| File                                                     | Change                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| `src/renderer/components/canvas/nodes/ResourceNode.tsx`  | Add advisory badge                                           |
| `src/renderer/types/cloud.ts`                            | Add 5 new `AdvisoryRuleId` entries                           |
| `src/renderer/utils/analyzeNode.ts`                      | Add 5 new advisory rules                                     |
| `src/renderer/utils/buildAdvisoryRemediations.ts`        | **New** — advisory → CLI command mapping                     |
| `src/renderer/components/Inspector.tsx`                  | Add "Fix" button to ADVISORIES section                       |
| `src/main/aws/services/sqs.ts`                           | Add `hasDlq` metadata field                                  |
| `src/main/aws/services/rds.ts`                           | Add `deletionProtection`, `backupRetentionPeriod`            |
| `src/main/aws/services/s3.ts`                            | Add `versioningEnabled`                                      |
| `src/main/aws/services/lambda.ts`                        | Add `hasDlq` from existing `GetFunctionConfigurationCommand` |
| `tests/renderer/utils/analyzeNode.test.ts`               | Add tests for new rules                                      |
| `tests/renderer/utils/buildAdvisoryRemediations.test.ts` | **New** test file                                            |
| `tests/main/aws/services/sqs.test.ts`                    | Update for new `hasDlq` field                                |
| `tests/main/aws/services/rds.test.ts`                    | Update for new fields                                        |

---

## Task 1: Advisory badge on ResourceNode

**Files:**

- Modify: `src/renderer/components/canvas/nodes/ResourceNode.tsx`
- Test: `tests/renderer/components/canvas/nodes/ActionRail.test.tsx` (look at this for the testing pattern; write a new `ResourceNode.advisories.test.tsx`)

**Background:** ResourceNode already receives `metadata`, `nodeType`, `status`, `region` in its data. `analyzeNode` needs a full-ish `CloudNode` but only uses `type`, `metadata` (and a few top-level fields). Build a minimal CloudNode from `ResourceNodeData` and call `analyzeNode` — no parent component changes needed. Badge appears top-right, stacks to the left of the existing drift badge if present.

- [ ] **Step 1: Write failing tests**

Create `tests/renderer/components/canvas/nodes/ResourceNode.advisories.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ResourceNode } from '../../../../../src/renderer/components/canvas/nodes/ResourceNode'
import { useUIStore } from '../../../../../src/renderer/store/ui'
import type { NodeProps } from '@xyflow/react'

vi.mock('../../../../../src/renderer/components/canvas/nodes/ActionRail', () => ({
  ActionRail: () => null,
}))

function makeProps(nodeType = 'ec2', metadata: Record<string, unknown> = {}): NodeProps {
  return {
    id: 'test-node',
    type: 'resource',
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    data: {
      label: 'test',
      nodeType,
      status: 'running',
      region: 'us-east-1',
      metadata,
    },
  } as unknown as NodeProps
}

describe('ResourceNode advisory badge', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FLAG_OP_INTELLIGENCE', 'true')
    vi.stubEnv('VITE_FLAG_ACTION_RAIL', 'false')
    useUIStore.setState({ pluginNodeTypes: {} } as Parameters<typeof useUIStore.setState>[0])
  })

  afterEach(() => { vi.unstubAllEnvs() })

  it('shows critical badge when ec2 has public SSH', () => {
    render(<ResourceNode {...makeProps('ec2', { hasPublicSsh: true })} />)
    // Badge title contains "critical"
    const badge = document.querySelector('[title*="critical"]')
    expect(badge).not.toBeNull()
  })

  it('shows no badge when no advisories', () => {
    render(<ResourceNode {...makeProps('ec2', {})} />)
    expect(document.querySelector('[title*="critical"]')).toBeNull()
    expect(document.querySelector('[title*="warning"]')).toBeNull()
  })

  it('hidden when OP_INTELLIGENCE flag is off', () => {
    vi.stubEnv('VITE_FLAG_OP_INTELLIGENCE', 'false')
    render(<ResourceNode {...makeProps('ec2', { hasPublicSsh: true })} />)
    expect(document.querySelector('[title*="critical"]')).toBeNull()
  })
})
```

Run: `npm test -- tests/renderer/components/canvas/nodes/ResourceNode.advisories.test.tsx`
Expected: FAIL (no badge rendered yet)

- [ ] **Step 2: Add advisory badge to ResourceNode**

In `src/renderer/components/canvas/nodes/ResourceNode.tsx`:

After the existing flag reads (`const actionRail = flag('ACTION_RAIL')`), add:

```typescript
const opIntelligence = flag('OP_INTELLIGENCE')

const advisoryBadge =
  opIntelligence && d.metadata
    ? (() => {
        const advisories = analyzeNode({
          id,
          type: d.nodeType,
          label: d.label,
          status: d.status,
          region: d.region ?? '',
          metadata: d.metadata
        })
        const critical = advisories.filter((a) => a.severity === 'critical').length
        const warning = advisories.filter((a) => a.severity === 'warning').length
        if (critical === 0 && warning === 0) return null
        return { critical, warning }
      })()
    : null
```

Add the import at the top of the file:

```typescript
import { analyzeNode } from '../../../utils/analyzeNode'
```

In the JSX, after the existing drift badge block (around line 373), add:

The advisory badge must stack with existing top-right badges (TF badge at `right: -6`, drift badge at `right: isImported ? 14 : -6`). The advisory badge stacks further left using the same pattern:

```typescript
{/* Advisory badge — shows OP_INTELLIGENCE findings count */}
{advisoryBadge && (() => {
  const parts: string[] = []
  if (advisoryBadge.critical > 0) parts.push(`${advisoryBadge.critical} critical`)
  if (advisoryBadge.warning > 0)  parts.push(`${advisoryBadge.warning} warning`)
  const badgeTitle = parts.join(', ')
  const rightOffset = (isImported && d.driftStatus) ? 54 : (isImported || d.driftStatus) ? 34 : 14
  return (
  <div
    title={badgeTitle}
    style={{
      position:     'absolute',
      top:          -6,
      right:        rightOffset,
      background:   advisoryBadge.critical > 0 ? '#ef4444' : '#f59e0b',
      color:        advisoryBadge.critical > 0 ? '#fff' : '#000',
      fontSize:     8,
      fontWeight:   700,
      padding:      '1px 4px',
      borderRadius: 3,
      zIndex:       3,
      lineHeight:   1.4,
      pointerEvents: 'none',
    }}
  >
    {advisoryBadge.critical > 0 ? `⚠ ${advisoryBadge.critical}` : `! ${advisoryBadge.warning}`}
  </div>
  )
})()}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- tests/renderer/components/canvas/nodes/ResourceNode.advisories.test.tsx
```

Expected: PASS

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all 928+ tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/canvas/nodes/ResourceNode.tsx tests/renderer/components/canvas/nodes/ResourceNode.advisories.test.tsx
git commit -m "feat(canvas): advisory badge on ResourceNode — critical/warning count from OP_INTELLIGENCE"
```

---

## Task 2: Expand scan metadata (main process)

**Files:**

- Modify: `src/main/aws/services/sqs.ts`
- Modify: `src/main/aws/services/rds.ts`
- Modify: `src/main/aws/services/s3.ts`
- Modify: `src/main/aws/services/lambda.ts`
- Tests: corresponding test files in `tests/main/aws/services/`

**Background:** Four services need new metadata fields so advisory rules can fire on them. All additions follow the existing pattern — read the relevant field from the SDK response, add it to `metadata: { ... }`. Read each service file before editing to understand the exact structure.

**SQS — add `hasDlq: boolean`**

The `GetQueueAttributesCommand` call in `sqs.ts` already fetches `QueueArn`, `ApproximateNumberOfMessages`, etc. Add `RedrivePolicy` to `AttributeNames`. If the attribute is present and non-empty, `hasDlq = true`.

- [ ] **Step 1: SQS — update `AttributeNames` and add `hasDlq` to metadata**

In `src/main/aws/services/sqs.ts`, change:

```typescript
AttributeNames: ['QueueArn', 'ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
```

to:

```typescript
AttributeNames: [
  'QueueArn',
  'ApproximateNumberOfMessages',
  'ApproximateNumberOfMessagesNotVisible',
  'RedrivePolicy'
]
```

In the enriched node metadata, add:

```typescript
const hasDlq = !!attrRes.Attributes?.['RedrivePolicy']
```

And include in `metadata`:

```typescript
metadata: {
  ...(msgs != null ? { messages: Number(msgs) } : {}),
  ...(inFlight != null ? { inFlight: Number(inFlight) } : {}),
  hasDlq,
},
```

**RDS — add `deletionProtection` and `backupRetentionPeriod`**

`DescribeDBInstancesCommand` returns `DeletionProtection: boolean` and `BackupRetentionPeriod: number`. Both already available — just extract them.

- [ ] **Step 2: RDS — add fields to metadata**

In `src/main/aws/services/rds.ts`, there are two changes:

**2a. Widen the inline type annotation on `allInstances` (line 13).** The file uses a manually typed inline type — NOT the SDK type — so you must add the new fields explicitly.

Find:

```typescript
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

Replace with:

```typescript
const allInstances: {
  DBInstanceIdentifier?: string
  DBInstanceStatus?: string
  Engine?: string
  DBInstanceClass?: string
  Endpoint?: { Address?: string }
  DBSubnetGroup?: { VpcId?: string }
  MultiAZ?: boolean
  DeletionProtection?: boolean
  BackupRetentionPeriod?: number
}[] = []
```

**2b. Update the `metadata` field in the `.map()` call (line 26).**

Find:

```typescript
      metadata: { engine: db.Engine, instanceClass: db.DBInstanceClass, endpoint: db.Endpoint?.Address, multiAZ: db.MultiAZ ?? false },
```

Replace with:

```typescript
      metadata: { engine: db.Engine, instanceClass: db.DBInstanceClass, endpoint: db.Endpoint?.Address, multiAZ: db.MultiAZ ?? false, deletionProtection: db.DeletionProtection ?? false, backupRetentionPeriod: db.BackupRetentionPeriod ?? 0 },
```

**S3 — add `versioningEnabled: boolean`**

Add a `GetBucketVersioningCommand` call in the per-bucket enrichment in `s3.ts`. Pattern: same as the existing `GetPublicAccessBlockCommand` call.

- [ ] **Step 3: S3 — add versioning check**

At the top of `src/main/aws/services/s3.ts`, add to the import:

```typescript
import {
  S3Client,
  ListBucketsCommand,
  GetBucketNotificationConfigurationCommand,
  GetPublicAccessBlockCommand,
  GetBucketVersioningCommand
} from '@aws-sdk/client-s3'
```

In the per-bucket enrichment (after the public access block check), add:

```typescript
// Versioning status
let versioningEnabled = false
const versioningRes = await client
  .send(new GetBucketVersioningCommand({ Bucket: name }))
  .catch(() => null)
if (versioningRes?.Status === 'Enabled') {
  versioningEnabled = true
}
```

Update `baseNode` metadata:

```typescript
metadata: { creationDate: b.CreationDate, publicAccessEnabled, versioningEnabled },
```

**Lambda — add `hasDlq: boolean`**

`GetFunctionConfigurationCommand` is already called (line ~93). The response includes `DeadLetterConfig.TargetArn`. Extract it.

- [ ] **Step 4: Lambda — add hasDlq from existing config call**

In `src/main/aws/services/lambda.ts`, in the block where `configRes` is used (around line 93–112), add:

```typescript
const hasDlq = !!configRes.DeadLetterConfig?.TargetArn
```

Update the metadata line:

```typescript
metadata: { runtime: fn.Runtime, handler: fn.Handler, timeout, memorySize, hasDlq },
```

- [ ] **Step 5: Run tests (existing service tests)**

```bash
npm test -- tests/main/aws/services/
```

Expected: existing tests still pass. The new fields should be present — if the test mocks don't include them, the fields will be `undefined` or `false`, which is fine for backward compatibility.

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add src/main/aws/services/sqs.ts src/main/aws/services/rds.ts src/main/aws/services/s3.ts src/main/aws/services/lambda.ts
git commit -m "feat(scan): add hasDlq, deletionProtection, backupRetentionPeriod, versioningEnabled to scan metadata"
```

---

## Task 3: Expand advisory rules

**Files:**

- Modify: `src/renderer/types/cloud.ts` (add 5 `AdvisoryRuleId` entries)
- Modify: `src/renderer/utils/analyzeNode.ts` (add 5 rules)
- Modify: `tests/renderer/utils/analyzeNode.test.ts` (add tests)

**Background:** 5 new rules. Each follows the same structure as existing rules — check metadata field, push advisory if condition met. All new `AdvisoryRuleId` values must be added to the type union first.

- [ ] **Step 1: Read existing analyzeNode.test.ts** to understand test patterns

- [ ] **Step 2: Write failing tests for all 5 new rules**

Add to `tests/renderer/utils/analyzeNode.test.ts` (after existing tests, inside the existing `describe('analyzeNode')` block before the closing `}`):

Note: the test file uses a helper called `node()` (not `makeNode`). Use that pattern exactly.

```typescript
// ── sqs-no-dlq ────────────────────────────────────────────────────────────
it('sqs with hasDlq=false → warning sqs-no-dlq', () => {
  const r = analyzeNode(node({ type: 'sqs', metadata: { hasDlq: false } }))
  expect(r.some((a) => a.ruleId === 'sqs-no-dlq')).toBe(true)
})
it('sqs with hasDlq=true → no sqs-no-dlq', () => {
  const r = analyzeNode(node({ type: 'sqs', metadata: { hasDlq: true } }))
  expect(r.find((a) => a.ruleId === 'sqs-no-dlq')).toBeUndefined()
})

// ── rds-no-deletion-protection ────────────────────────────────────────────
it('rds with deletionProtection=false → warning rds-no-deletion-protection', () => {
  const r = analyzeNode(
    node({ type: 'rds', metadata: { multiAZ: true, deletionProtection: false } })
  )
  expect(r.some((a) => a.ruleId === 'rds-no-deletion-protection')).toBe(true)
})
it('rds with deletionProtection=true → no rds-no-deletion-protection', () => {
  const r = analyzeNode(
    node({ type: 'rds', metadata: { multiAZ: true, deletionProtection: true } })
  )
  expect(r.find((a) => a.ruleId === 'rds-no-deletion-protection')).toBeUndefined()
})

// ── rds-no-backup ─────────────────────────────────────────────────────────
it('rds with backupRetentionPeriod=0 → critical rds-no-backup', () => {
  const r = analyzeNode(
    node({
      type: 'rds',
      metadata: { multiAZ: true, deletionProtection: true, backupRetentionPeriod: 0 }
    })
  )
  expect(r.some((a) => a.ruleId === 'rds-no-backup')).toBe(true)
})
it('rds with backupRetentionPeriod=7 → no rds-no-backup', () => {
  const r = analyzeNode(
    node({
      type: 'rds',
      metadata: { multiAZ: true, deletionProtection: true, backupRetentionPeriod: 7 }
    })
  )
  expect(r.find((a) => a.ruleId === 'rds-no-backup')).toBeUndefined()
})

// ── s3-no-versioning ──────────────────────────────────────────────────────
it('s3 with versioningEnabled=false → warning s3-no-versioning', () => {
  const r = analyzeNode(
    node({ type: 's3', metadata: { publicAccessEnabled: false, versioningEnabled: false } })
  )
  expect(r.some((a) => a.ruleId === 's3-no-versioning')).toBe(true)
})
it('s3 with versioningEnabled=true → no s3-no-versioning', () => {
  const r = analyzeNode(
    node({ type: 's3', metadata: { publicAccessEnabled: false, versioningEnabled: true } })
  )
  expect(r.find((a) => a.ruleId === 's3-no-versioning')).toBeUndefined()
})

// ── lambda-no-dlq ─────────────────────────────────────────────────────────
it('lambda with hasDlq=false → warning lambda-no-dlq', () => {
  const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30, hasDlq: false } }))
  expect(r.some((a) => a.ruleId === 'lambda-no-dlq')).toBe(true)
})
it('lambda with hasDlq=true → no lambda-no-dlq', () => {
  const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30, hasDlq: true } }))
  expect(r.find((a) => a.ruleId === 'lambda-no-dlq')).toBeUndefined()
})
```

Run: `npm test -- tests/renderer/utils/analyzeNode.test.ts`
Expected: FAIL (new ruleIds don't exist yet)

- [ ] **Step 3: Add new `AdvisoryRuleId` entries to `cloud.ts`**

In `src/renderer/types/cloud.ts`, expand `AdvisoryRuleId`:

```typescript
export type AdvisoryRuleId =
  | 'ec2-public-ssh'
  | 'lambda-no-timeout'
  | 'lambda-low-memory'
  | 'lambda-no-dlq'
  | 's3-public-access'
  | 's3-no-versioning'
  | 'rds-no-multiaz'
  | 'rds-no-deletion-protection'
  | 'rds-no-backup'
  | 'sqs-no-dlq'
```

- [ ] **Step 4: Add 5 new rules to `analyzeNode.ts`**

Add at the end of `analyzeNode.ts`, before the `return advisories` line:

```typescript
if (node.type === 'sqs' && node.metadata.hasDlq === false) {
  advisories.push({
    ruleId: 'sqs-no-dlq',
    severity: 'warning',
    title: 'No dead-letter queue configured',
    detail:
      'Messages that fail processing will be discarded. Configure a DLQ to retain failed messages for inspection and replay.',
    nodeId: node.id
  })
}

if (node.type === 'rds') {
  if (node.metadata.deletionProtection === false) {
    advisories.push({
      ruleId: 'rds-no-deletion-protection',
      severity: 'warning',
      title: 'Deletion protection disabled',
      detail:
        'This RDS instance can be deleted with a single API call. Enable deletion protection to prevent accidental or unauthorised deletion.',
      nodeId: node.id
    })
  }
  if (
    typeof node.metadata.backupRetentionPeriod === 'number' &&
    node.metadata.backupRetentionPeriod === 0
  ) {
    advisories.push({
      ruleId: 'rds-no-backup',
      severity: 'critical',
      title: 'Automated backups disabled',
      detail:
        'Backup retention period is 0 days — automated backups are disabled. Set a retention period of at least 7 days to enable point-in-time recovery.',
      nodeId: node.id
    })
  }
}

if (node.type === 's3' && node.metadata.versioningEnabled === false) {
  advisories.push({
    ruleId: 's3-no-versioning',
    severity: 'warning',
    title: 'Versioning not enabled',
    detail:
      'Objects deleted or overwritten cannot be recovered. Enable versioning to protect against accidental deletion and enable point-in-time recovery.',
    nodeId: node.id
  })
}

if (node.type === 'lambda' && node.metadata.hasDlq === false) {
  advisories.push({
    ruleId: 'lambda-no-dlq',
    severity: 'warning',
    title: 'No dead-letter queue or destination configured',
    detail:
      'Failed asynchronous invocations are silently discarded. Configure a dead-letter queue or an on-failure destination to capture errors.',
    nodeId: node.id
  })
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/renderer/utils/analyzeNode.test.ts
```

Expected: all tests PASS

- [ ] **Step 6: Run full suite + typecheck**

```bash
npm run typecheck && npm test
```

Expected: 0 errors, all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/types/cloud.ts src/renderer/utils/analyzeNode.ts tests/renderer/utils/analyzeNode.test.ts
git commit -m "feat(advisories): add 5 new rules — sqs-no-dlq, rds-no-deletion-protection, rds-no-backup, s3-no-versioning, lambda-no-dlq"
```

---

## Task 4: Advisory-to-remediation bridge

**Files:**

- Create: `src/renderer/utils/buildAdvisoryRemediations.ts`
- Modify: `src/renderer/components/Inspector.tsx` (ADVISORIES section only)
- Create: `tests/renderer/utils/buildAdvisoryRemediations.test.ts`

**Background:** For advisory rules where there is a deterministic CLI fix, expose that fix directly from the ADVISORIES section in Inspector — a "Fix" button that calls `onRemediate` with the generated commands. This eliminates the need for drift to trigger remediation for security issues.

Three rules have clear CLI fixes:

- `s3-public-access` → `aws s3api put-public-access-block --bucket {name} --public-access-block-configuration BlockPublicAcls=true,BlockPublicPolicy=true,IgnorePublicAcls=true,RestrictPublicBuckets=true`
- `rds-no-deletion-protection` → `aws rds modify-db-instance --db-instance-identifier {id} --deletion-protection --apply-immediately`
- `rds-no-backup` → `aws rds modify-db-instance --db-instance-identifier {id} --backup-retention-period 7 --apply-immediately`

The utility returns `string[][] | null` — `null` means no automated fix available for this rule.

- [ ] **Step 1: Write failing tests**

Create `tests/renderer/utils/buildAdvisoryRemediations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildAdvisoryRemediation } from '../../../src/renderer/utils/buildAdvisoryRemediations'
import type { Advisory } from '../../../src/renderer/types/cloud'

function makeAdvisory(ruleId: Advisory['ruleId']): Advisory {
  return { ruleId, severity: 'warning', title: '', detail: '', nodeId: 'node-1' }
}

describe('buildAdvisoryRemediation', () => {
  it('returns s3 public access block command', () => {
    const cmds = buildAdvisoryRemediation(makeAdvisory('s3-public-access'), 'my-bucket')
    expect(cmds).not.toBeNull()
    expect(cmds![0]).toContain('put-public-access-block')
    expect(cmds![0]).toContain('my-bucket')
  })

  it('returns rds deletion-protection command', () => {
    const cmds = buildAdvisoryRemediation(makeAdvisory('rds-no-deletion-protection'), 'my-db')
    expect(cmds).not.toBeNull()
    expect(cmds![0]).toContain('modify-db-instance')
    expect(cmds![0]).toContain('my-db')
    expect(cmds![0]).toContain('--deletion-protection')
  })

  it('returns rds backup retention command', () => {
    const cmds = buildAdvisoryRemediation(makeAdvisory('rds-no-backup'), 'my-db')
    expect(cmds).not.toBeNull()
    expect(cmds![0]).toContain('--backup-retention-period')
    expect(cmds![0]).toContain('7')
  })

  it('returns null for rules without automated fix', () => {
    expect(buildAdvisoryRemediation(makeAdvisory('ec2-public-ssh'), 'i-123')).toBeNull()
    expect(buildAdvisoryRemediation(makeAdvisory('lambda-low-memory'), 'fn-arn')).toBeNull()
    expect(buildAdvisoryRemediation(makeAdvisory('sqs-no-dlq'), 'queue-arn')).toBeNull()
  })
})
```

Run: `npm test -- tests/renderer/utils/buildAdvisoryRemediations.test.ts`
Expected: FAIL (file doesn't exist)

- [ ] **Step 2: Create `buildAdvisoryRemediations.ts`**

Create `src/renderer/utils/buildAdvisoryRemediations.ts`:

```typescript
import type { Advisory } from '../types/cloud'

/**
 * Returns CLI argv arrays for a deterministic fix for the given advisory,
 * or null if no automated remediation is available for this rule.
 *
 * nodeId is the resource identifier (bucket name, DB identifier, etc.)
 */
export function buildAdvisoryRemediation(advisory: Advisory, nodeId: string): string[][] | null {
  switch (advisory.ruleId) {
    case 's3-public-access':
      return [
        [
          's3api',
          'put-public-access-block',
          '--bucket',
          nodeId,
          '--public-access-block-configuration',
          'BlockPublicAcls=true,BlockPublicPolicy=true,IgnorePublicAcls=true,RestrictPublicBuckets=true'
        ]
      ]

    case 'rds-no-deletion-protection':
      return [
        [
          'rds',
          'modify-db-instance',
          '--db-instance-identifier',
          nodeId,
          '--deletion-protection',
          '--apply-immediately'
        ]
      ]

    case 'rds-no-backup':
      return [
        [
          'rds',
          'modify-db-instance',
          '--db-instance-identifier',
          nodeId,
          '--backup-retention-period',
          '7',
          '--apply-immediately'
        ]
      ]

    default:
      return null
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- tests/renderer/utils/buildAdvisoryRemediations.test.ts
```

Expected: all tests PASS

- [ ] **Step 4: Add "Fix" button to Inspector ADVISORIES section**

In `src/renderer/components/Inspector.tsx`:

**4a.** Add import at the top (after existing imports):

```typescript
import { buildAdvisoryRemediation } from '../utils/buildAdvisoryRemediations'
```

**4b.** In the ADVISORIES IIFE, find this exact block (the `<ul>` + `advisories.map` that renders advisory rows):

```typescript
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
```

Replace it with this (drops the `<ul>/<li>`, converts to `<div>` rows, adds Fix button):

```typescript
                    <div>
                      {advisories.map((a) => {
                        const fixCmds = buildAdvisoryRemediation(a, node.id)
                        return (
                          <div key={a.ruleId} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                              <div style={{ flex: 1 }}>
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
                              </div>
                              {fixCmds && onRemediate && (
                                <button
                                  onClick={() => void onRemediate(node as CloudNode, fixCmds)}
                                  style={{
                                    background:   'rgba(239,68,68,0.1)',
                                    border:       '1px solid rgba(239,68,68,0.4)',
                                    borderRadius: 3,
                                    color:        '#ef4444',
                                    cursor:       'pointer',
                                    fontFamily:   'monospace',
                                    fontSize:     8,
                                    padding:      '2px 6px',
                                    flexShrink:   0,
                                    whiteSpace:   'nowrap',
                                  }}
                                  title={`Fix: aws ${fixCmds[0].join(' ')}`}
                                >
                                  Fix
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
```

- [ ] **Step 5: Run typecheck + full test suite**

```bash
npm run typecheck && npm test
```

Expected: 0 errors, all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/utils/buildAdvisoryRemediations.ts tests/renderer/utils/buildAdvisoryRemediations.test.ts src/renderer/components/Inspector.tsx
git commit -m "feat(advisories): advisory-to-remediation bridge — Fix button on actionable advisories"
```

---

## Final verification

```bash
npm run lint && npm run typecheck && npm test
```

All three must pass cleanly. Target test count: ~950+ (adding ~22 new tests across 3 new/modified test files).
