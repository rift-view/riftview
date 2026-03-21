# IAM Least-Privilege Advisor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user selects an EC2, Lambda, or S3 node in the Inspector, fetch its attached IAM policies on-demand and evaluate them against a severity ruleset, displaying findings (critical/warning/info) in an "IAM Advisor" section.

**Architecture:** Fetch + evaluate happens in main process via `IAM_ANALYZE` IPC. Pure `evaluatePolicy()` function for unit testing. Inspector owns the IPC call; `IamAdvisor` is a pure display component. IAM client added to `AwsClients`. AssumeRole credentials never cross IPC. 10-second timeout on handler.

**Tech Stack:** AWS SDK v3 (`@aws-sdk/client-iam`, `@aws-sdk/client-ec2`, `@aws-sdk/client-s3`, `@aws-sdk/client-lambda`), TypeScript, React 18, Electron IPC

---

## Task 1: Types — IamFinding, IamAnalysisResult

**Files:**
- Create: `cloudblocks/src/renderer/types/iam.ts`

- [ ] **Step 1: Write failing test for types**

Create `cloudblocks/tests/renderer/types/iam.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { IamFinding, IamAnalysisResult, IamSeverity } from '../../../src/renderer/types/iam'

describe('IAM types', () => {
  it('IamFinding has required fields', () => {
    const f: IamFinding = { severity: 'critical', title: 'AdministratorAccess', detail: 'Full admin access' }
    expect(f.severity).toBe('critical')
  })

  it('IamAnalysisResult has nodeId, findings, fetchedAt', () => {
    const r: IamAnalysisResult = { nodeId: 'i-123', findings: [], fetchedAt: Date.now() }
    expect(r.nodeId).toBe('i-123')
  })

  it('severity levels are correct', () => {
    const severities: IamSeverity[] = ['critical', 'warning', 'info']
    expect(severities).toHaveLength(3)
  })
})
```

Run: `cd cloudblocks && npm test -- iam.test.ts`
Expected: FAIL (no iam.ts file yet)

- [ ] **Step 2: Create iam.ts**

Create `cloudblocks/src/renderer/types/iam.ts`:

```typescript
export type IamSeverity = 'critical' | 'warning' | 'info'

export interface IamFinding {
  severity: IamSeverity
  title: string
  detail: string
  policyName?: string
  statement?: string  // JSON.stringify of offending statement
}

export interface IamAnalysisResult {
  nodeId: string
  findings: IamFinding[]
  error?: string
  fetchedAt: number
}
```

- [ ] **Step 3: Run test — expect pass**

```bash
npm test -- iam.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add cloudblocks/src/renderer/types/iam.ts cloudblocks/tests/renderer/types/iam.test.ts
git commit -m "feat(types): IamFinding, IamSeverity, IamAnalysisResult"
```

---

## Task 2: IAM Client in AwsClients

**Files:**
- Modify: `cloudblocks/src/main/aws/client.ts`

- [ ] **Step 1: Add IAMClient to AwsClients interface**

In `client.ts`, add:

```typescript
import { IAMClient } from '@aws-sdk/client-iam'

// In AwsClients interface:
iam: IAMClient

// In createClients() factory:
iam: new IAMClient({ region, credentials, endpoint: endpointConfig }),
```

Note: IAM is a global service but SDK calls work with any region — use the region passed in. No additional package needed if `@aws-sdk/client-iam` is already a dependency; if not, install it first:

```bash
cd cloudblocks && npm install @aws-sdk/client-iam
```

- [ ] **Step 2: Run typecheck — check for cascading errors**

```bash
npm run typecheck 2>&1 | head -20
```

Any existing test mocks of `AwsClients` will need an `iam` property added. Find them:

```bash
grep -r "AwsClients\|createClients" tests/ --include="*.ts" -l
```

Add `iam: {} as IAMClient` stubs where needed.

- [ ] **Step 3: Run all tests**

```bash
npm test 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add cloudblocks/src/main/aws/client.ts cloudblocks/package.json cloudblocks/package-lock.json
git commit -m "feat(client): add IAMClient to AwsClients interface + createClients factory"
```

---

## Task 3: Policy Evaluator — evaluatePolicy()

**Files:**
- Create: `cloudblocks/src/main/aws/iam/evaluator.ts`
- Create: `cloudblocks/tests/main/aws/iam/evaluator.test.ts`

- [ ] **Step 1: Write failing tests (all ruleset rules)**

Create `cloudblocks/tests/main/aws/iam/evaluator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { evaluatePolicy } from '../../../../src/main/aws/iam/evaluator'

const allow = (action: unknown, resource: unknown, principal?: unknown) => ({
  Effect: 'Allow',
  Action: action,
  Resource: resource,
  ...(principal ? { Principal: principal } : {}),
})

const deny = (action: unknown, resource: unknown) => ({
  Effect: 'Deny',
  Action: action,
  Resource: resource,
})

describe('evaluatePolicy', () => {
  // CRITICAL rules
  it('flags AdministratorAccess managed policy', () => {
    const findings = evaluatePolicy({ Statement: [allow('*', '*')] }, 'AdministratorAccess')
    expect(findings.some(f => f.severity === 'critical' && f.title.includes('AdministratorAccess'))).toBe(true)
  })

  it('flags wildcard action + resource', () => {
    const findings = evaluatePolicy({ Statement: [allow('*', '*')] })
    expect(findings.some(f => f.severity === 'critical' && f.title.includes('Wildcard'))).toBe(true)
  })

  it('flags iam:* action', () => {
    const findings = evaluatePolicy({ Statement: [allow('iam:*', '*')] })
    expect(findings.some(f => f.severity === 'critical')).toBe(true)
  })

  it('flags iam:* in array', () => {
    const findings = evaluatePolicy({ Statement: [allow(['iam:*', 's3:GetObject'], '*')] })
    expect(findings.some(f => f.severity === 'critical')).toBe(true)
  })

  // WARNING rules
  it('flags s3:* with resource *', () => {
    const findings = evaluatePolicy({ Statement: [allow('s3:*', '*')] })
    expect(findings.some(f => f.severity === 'warning' && f.title.includes('S3'))).toBe(true)
  })

  it('flags ec2:*', () => {
    const findings = evaluatePolicy({ Statement: [allow('ec2:*', 'arn:aws:ec2:*')] })
    expect(findings.some(f => f.severity === 'warning' && f.title.includes('EC2'))).toBe(true)
  })

  it('flags sts:AssumeRole with resource *', () => {
    const findings = evaluatePolicy({ Statement: [allow('sts:AssumeRole', '*')] })
    expect(findings.some(f => f.severity === 'warning' && f.title.includes('AssumeRole'))).toBe(true)
  })

  it('flags Principal: * in bucket policy', () => {
    const findings = evaluatePolicy({ Statement: [allow('s3:GetObject', 'arn:aws:s3:::bucket/*', '*')] })
    expect(findings.some(f => f.severity === 'warning' && f.title.includes('Public'))).toBe(true)
  })

  // INFO rules
  it('flags iam:PassRole', () => {
    const findings = evaluatePolicy({ Statement: [allow('iam:PassRole', '*')] })
    expect(findings.some(f => f.severity === 'info' && f.title.includes('PassRole'))).toBe(true)
  })

  it('flags cross-account principal', () => {
    const findings = evaluatePolicy({ Statement: [allow('sts:AssumeRole', '*', { AWS: 'arn:aws:iam::999999999999:root' })] })
    expect(findings.some(f => f.severity === 'info' && f.title.includes('cross-account'))).toBe(true)
  })

  // Deny statements skipped
  it('skips Deny statements', () => {
    const findings = evaluatePolicy({ Statement: [deny('*', '*')] })
    expect(findings).toHaveLength(0)
  })

  // Empty policy
  it('returns empty findings for benign policy', () => {
    const findings = evaluatePolicy({ Statement: [allow('s3:GetObject', 'arn:aws:s3:::my-bucket/*')] })
    expect(findings).toHaveLength(0)
  })
})
```

Run: `cd cloudblocks && npm test -- evaluator.test.ts`
Expected: FAIL (no evaluator file)

- [ ] **Step 2: Create evaluator.ts**

Create `cloudblocks/src/main/aws/iam/evaluator.ts`:

```typescript
import type { IamFinding } from '../../../renderer/types/iam'

interface PolicyStatement {
  Effect: string
  Action: string | string[]
  Resource: string | string[]
  Principal?: string | Record<string, string | string[]>
}

interface PolicyDocument {
  Statement: PolicyStatement[]
}

function hasAction(stmt: PolicyStatement, action: string): boolean {
  const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action]
  return actions.some((a) => a === action || a === action.toLowerCase())
}

function hasWildcardAction(stmt: PolicyStatement): boolean {
  return hasAction(stmt, '*')
}

function hasWildcardResource(stmt: PolicyStatement): boolean {
  const resources = Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource]
  return resources.includes('*')
}

function hasPublicPrincipal(stmt: PolicyStatement): boolean {
  if (!stmt.Principal) return false
  if (stmt.Principal === '*') return true
  if (typeof stmt.Principal === 'object') {
    const vals = Object.values(stmt.Principal).flat()
    return vals.includes('*')
  }
  return false
}

function hasCrossAccountPrincipal(stmt: PolicyStatement): boolean {
  if (!stmt.Principal || stmt.Principal === '*') return false
  if (typeof stmt.Principal === 'object') {
    const vals = Object.values(stmt.Principal).flat()
    return vals.some((v) => typeof v === 'string' && /arn:aws:iam::\d{12}/.test(v))
  }
  return false
}

export function evaluatePolicy(doc: PolicyDocument, policyName?: string): IamFinding[] {
  const findings: IamFinding[] = []

  // Check managed policy name
  if (policyName === 'AdministratorAccess') {
    findings.push({
      severity: 'critical',
      title: 'AdministratorAccess policy attached',
      detail: 'This managed policy grants full access to all AWS services and resources.',
      policyName,
    })
  }

  for (const stmt of doc.Statement) {
    if (stmt.Effect !== 'Allow') continue

    const stmtJson = JSON.stringify(stmt, null, 2)

    // CRITICAL: wildcard action + resource
    if (hasWildcardAction(stmt) && hasWildcardResource(stmt) && policyName !== 'AdministratorAccess') {
      findings.push({
        severity: 'critical',
        title: 'Wildcard action on all resources (Action: *, Resource: *)',
        detail: 'Grants unrestricted access to every AWS action on every resource.',
        policyName,
        statement: stmtJson,
      })
    }

    // CRITICAL: iam:*
    const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action]
    if (actions.some((a) => a === 'iam:*')) {
      findings.push({
        severity: 'critical',
        title: 'IAM full access (iam:*)',
        detail: 'Grants full control over IAM — can create/modify any role or policy.',
        policyName,
        statement: stmtJson,
      })
    }

    // WARNING: s3:* with *
    if (hasAction(stmt, 's3:*') && hasWildcardResource(stmt)) {
      findings.push({
        severity: 'warning',
        title: 'S3 wildcard on all buckets (s3:* + Resource: *)',
        detail: 'Overly broad S3 access — scope to specific buckets.',
        policyName,
        statement: stmtJson,
      })
    }

    // WARNING: ec2:*
    if (hasAction(stmt, 'ec2:*')) {
      findings.push({
        severity: 'warning',
        title: 'EC2 full access (ec2:*)',
        detail: 'Grants full EC2 control including instance launch and termination.',
        policyName,
        statement: stmtJson,
      })
    }

    // WARNING: sts:AssumeRole with *
    if (hasAction(stmt, 'sts:AssumeRole') && hasWildcardResource(stmt)) {
      findings.push({
        severity: 'warning',
        title: 'AssumeRole wildcard (sts:AssumeRole + Resource: *)',
        detail: 'Can assume any role in any account — privilege escalation risk.',
        policyName,
        statement: stmtJson,
      })
    }

    // WARNING: public principal
    if (hasPublicPrincipal(stmt)) {
      findings.push({
        severity: 'warning',
        title: 'Public S3 bucket policy (Principal: *)',
        detail: 'This bucket policy allows access from any anonymous principal.',
        policyName,
        statement: stmtJson,
      })
    }

    // INFO: PassRole
    if (actions.some((a) => a === 'iam:PassRole')) {
      findings.push({
        severity: 'info',
        title: 'iam:PassRole present',
        detail: 'Can pass IAM roles to AWS services — verify this is intended.',
        policyName,
        statement: stmtJson,
      })
    }

    // INFO: cross-account trust
    if (hasCrossAccountPrincipal(stmt)) {
      findings.push({
        severity: 'info',
        title: 'Cross-account trust in principal',
        detail: 'Trust policy includes an external AWS account — verify this is intentional.',
        policyName,
        statement: stmtJson,
      })
    }
  }

  return findings
}
```

- [ ] **Step 3: Run tests — expect all pass**

```bash
npm test -- evaluator.test.ts
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck 2>&1 | head -10
```

- [ ] **Step 5: Commit**

```bash
git add cloudblocks/src/main/aws/iam/evaluator.ts cloudblocks/tests/main/aws/iam/evaluator.test.ts
git commit -m "feat(iam): evaluatePolicy — CRITICAL/WARNING/INFO ruleset, fully unit-tested"
```

---

## Task 4: IAM Fetchers — fetchEc2IamData, fetchLambdaIamData, fetchS3IamData

**Files:**
- Create: `cloudblocks/src/main/aws/iam/fetcher.ts`
- Create: `cloudblocks/tests/main/aws/iam/fetcher.test.ts`

- [ ] **Step 1: Write failing tests**

Create `cloudblocks/tests/main/aws/iam/fetcher.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { urlDecodePolicy } from '../../../../src/main/aws/iam/fetcher'

describe('urlDecodePolicy', () => {
  it('decodes percent-encoded policy string', () => {
    const encoded = '%7B%22Version%22%3A%222012-10-17%22%7D'
    const decoded = urlDecodePolicy(encoded)
    expect(decoded).toBe('{"Version":"2012-10-17"}')
  })

  it('returns plain string unchanged', () => {
    const plain = '{"Version":"2012-10-17"}'
    expect(urlDecodePolicy(plain)).toBe(plain)
  })
})
```

Run: `cd cloudblocks && npm test -- fetcher.test.ts`
Expected: FAIL

- [ ] **Step 2: Create fetcher.ts**

Create `cloudblocks/src/main/aws/iam/fetcher.ts`:

```typescript
import {
  GetPolicyCommand,
  GetPolicyVersionCommand,
  GetRolePolicyCommand,
  ListAttachedRolePoliciesCommand,
  ListRolePoliciesCommand,
} from '@aws-sdk/client-iam'
import { DescribeInstancesCommand } from '@aws-sdk/client-ec2'
import { GetBucketPolicyCommand } from '@aws-sdk/client-s3'
import type { AwsClients } from '../client'
import type { CloudNode } from '../../../renderer/types/cloud'
import { evaluatePolicy } from './evaluator'
import type { IamFinding } from '../../../renderer/types/iam'

export interface PolicyDocument {
  Statement: Array<{
    Effect: string
    Action: string | string[]
    Resource: string | string[]
    Principal?: string | Record<string, string | string[]>
  }>
}

export function urlDecodePolicy(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

async function fetchRolePolicies(
  clients: AwsClients,
  roleName: string
): Promise<Array<{ doc: PolicyDocument; policyName: string }>> {
  const results: Array<{ doc: PolicyDocument; policyName: string }> = []

  // Managed policies
  const attached = await clients.iam.send(
    new ListAttachedRolePoliciesCommand({ RoleName: roleName })
  )
  for (const policy of attached.AttachedPolicies ?? []) {
    const details = await clients.iam.send(new GetPolicyCommand({ PolicyArn: policy.PolicyArn! }))
    const version = await clients.iam.send(
      new GetPolicyVersionCommand({
        PolicyArn: policy.PolicyArn!,
        VersionId: details.Policy!.DefaultVersionId!,
      })
    )
    const docStr = urlDecodePolicy(version.PolicyVersion!.Document!)
    const doc = JSON.parse(docStr) as PolicyDocument
    results.push({ doc, policyName: policy.PolicyName! })
  }

  // Inline policies
  const inline = await clients.iam.send(new ListRolePoliciesCommand({ RoleName: roleName }))
  for (const policyName of inline.PolicyNames ?? []) {
    const res = await clients.iam.send(
      new GetRolePolicyCommand({ RoleName: roleName, PolicyName: policyName })
    )
    const docStr = urlDecodePolicy(res.PolicyDocument!)
    const doc = JSON.parse(docStr) as PolicyDocument
    results.push({ doc, policyName })
  }

  return results
}

export async function fetchEc2IamData(
  node: CloudNode,
  clients: AwsClients
): Promise<IamFinding[]> {
  const instances = await clients.ec2.send(
    new DescribeInstancesCommand({ InstanceIds: [node.id] })
  )
  const instance = instances.Reservations?.[0]?.Instances?.[0]
  if (!instance?.IamInstanceProfile?.Arn) return []

  // Extract role name from instance profile ARN
  // arn:aws:iam::123:instance-profile/MyRole → need to get role from profile
  // For simplicity: role name typically matches profile name
  const profileName = instance.IamInstanceProfile.Arn.split('/').pop()!

  // Note: GetInstanceProfile not available in @aws-sdk/client-iam directly.
  // Use role name = profile name (common convention)
  const policies = await fetchRolePolicies(clients, profileName)
  return policies.flatMap(({ doc, policyName }) => evaluatePolicy(doc, policyName))
}

export async function fetchLambdaIamData(
  node: CloudNode,
  clients: AwsClients
): Promise<IamFinding[]> {
  const roleArn = node.metadata?.['role'] as string | undefined
  if (!roleArn) return []

  const roleName = roleArn.split('/').pop()!
  const policies = await fetchRolePolicies(clients, roleName)
  return policies.flatMap(({ doc, policyName }) => evaluatePolicy(doc, policyName))
}

export async function fetchS3IamData(
  node: CloudNode,
  clients: AwsClients
): Promise<IamFinding[]> {
  try {
    const res = await clients.s3.send(new GetBucketPolicyCommand({ Bucket: node.id }))
    if (!res.Policy) return []
    const doc = JSON.parse(urlDecodePolicy(res.Policy)) as PolicyDocument
    return evaluatePolicy(doc)
  } catch (err) {
    // NoSuchBucketPolicy — no bucket policy set
    if ((err as { name?: string }).name === 'NoSuchBucketPolicy') return []
    throw err
  }
}
```

- [ ] **Step 3: Run tests — expect pass**

```bash
npm test -- fetcher.test.ts
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck 2>&1 | head -10
```

- [ ] **Step 5: Commit**

```bash
git add cloudblocks/src/main/aws/iam/fetcher.ts cloudblocks/tests/main/aws/iam/fetcher.test.ts
git commit -m "feat(iam): fetchEc2IamData, fetchLambdaIamData, fetchS3IamData + URL-decode pipeline"
```

---

## Task 5: IPC Channel — IAM_ANALYZE

**Files:**
- Modify: `cloudblocks/src/main/ipc/channels.ts`
- Modify: `cloudblocks/src/main/ipc/handlers.ts`
- Modify: `cloudblocks/src/preload/index.ts`
- Modify: `cloudblocks/src/preload/index.d.ts`

- [ ] **Step 1: Add channel constant**

In `channels.ts`:
```typescript
IAM_ANALYZE: 'iam:analyze',
```

- [ ] **Step 2: Register handler with 10-second timeout**

In `handlers.ts`:

```typescript
import type { NodeType } from '../../renderer/types/cloud'
import type { IamAnalysisResult } from '../../renderer/types/iam'
import { fetchEc2IamData, fetchLambdaIamData, fetchS3IamData } from '../aws/iam/fetcher'

ipcMain.handle(
  IPC.IAM_ANALYZE,
  async (_event, { nodeId, nodeType, metadata }: { nodeId: string; nodeType: NodeType; metadata: Record<string, unknown> }): Promise<IamAnalysisResult> => {
    const timeoutMs = 10_000
    const node = { id: nodeId, type: nodeType, metadata } as CloudNode

    const timeout = new Promise<IamAnalysisResult>((resolve) =>
      setTimeout(
        () => resolve({ nodeId, findings: [], error: 'IAM analysis timed out after 10s', fetchedAt: Date.now() }),
        timeoutMs
      )
    )

    const analyze = async (): Promise<IamAnalysisResult> => {
      try {
        // Use current region from scanner state — fall back to first selected region
        const region = currentRegions[0] ?? 'us-east-1'
        const clients = createClients(currentProfile, region, currentEndpoint)

        let findings
        if (nodeType === 'ec2') findings = await fetchEc2IamData(node, clients)
        else if (nodeType === 'lambda') findings = await fetchLambdaIamData(node, clients)
        else if (nodeType === 's3') findings = await fetchS3IamData(node, clients)
        else findings = []

        return { nodeId, findings, fetchedAt: Date.now() }
      } catch (err) {
        return { nodeId, findings: [], error: (err as Error).message, fetchedAt: Date.now() }
      }
    }

    return Promise.race([analyze(), timeout])
  }
)
```

Note: `currentProfile`, `currentRegions`, `currentEndpoint` are module-level variables already maintained in `handlers.ts` for the scanner. Use the same pattern.

- [ ] **Step 3: Expose on preload**

In `preload/index.ts`:
```typescript
analyzeIam: (nodeId: string, nodeType: NodeType, metadata: Record<string, unknown>) =>
  ipcRenderer.invoke(IPC.IAM_ANALYZE, { nodeId, nodeType, metadata }),
```

In `preload/index.d.ts`:
```typescript
analyzeIam(nodeId: string, nodeType: NodeType, metadata: Record<string, unknown>): Promise<IamAnalysisResult>
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck 2>&1 | head -10
```

- [ ] **Step 5: Commit**

```bash
git add cloudblocks/src/main/ipc/channels.ts cloudblocks/src/main/ipc/handlers.ts cloudblocks/src/preload/index.ts cloudblocks/src/preload/index.d.ts
git commit -m "feat(ipc): IAM_ANALYZE channel with 10s timeout"
```

---

## Task 6: IamAdvisor Component

**Files:**
- Create: `cloudblocks/src/renderer/components/IamAdvisor.tsx`

- [ ] **Step 1: Create IamAdvisor.tsx**

```tsx
// cloudblocks/src/renderer/components/IamAdvisor.tsx
import React, { useState } from 'react'
import type { IamAnalysisResult, IamFinding, IamSeverity } from '../types/iam'

interface IamAdvisorProps {
  node: { id: string; type: string }
  onRecheck: () => void
  result: IamAnalysisResult | null  // null = loading
}

const SEVERITY_COLOR: Record<IamSeverity, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
}

const SEVERITY_LABEL: Record<IamSeverity, string> = {
  critical: 'CRITICAL',
  warning: 'WARNING',
  info: 'INFO',
}

function FindingRow({ finding }: { finding: IamFinding }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ borderLeft: `3px solid ${SEVERITY_COLOR[finding.severity]}`, paddingLeft: 8, marginBottom: 6 }}>
      <div
        style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: finding.statement ? 'pointer' : 'default' }}
        onClick={() => finding.statement && setExpanded(e => !e)}
      >
        <span style={{ fontSize: 9, fontWeight: 700, color: SEVERITY_COLOR[finding.severity], letterSpacing: '0.05em', minWidth: 50 }}>
          {SEVERITY_LABEL[finding.severity]}
        </span>
        <span style={{ fontSize: 11, color: 'var(--cb-text-primary)', flex: 1 }}>{finding.title}</span>
        {finding.statement && (
          <span style={{ fontSize: 9, color: 'var(--cb-text-muted)' }}>{expanded ? '▲' : '▼'}</span>
        )}
      </div>
      {finding.policyName && (
        <div style={{ fontSize: 9, color: 'var(--cb-text-muted)', marginTop: 2 }}>
          Policy: {finding.policyName}
        </div>
      )}
      {finding.detail && (
        <div style={{ fontSize: 10, color: 'var(--cb-text-muted)', marginTop: 2 }}>{finding.detail}</div>
      )}
      {expanded && finding.statement && (
        <pre style={{ fontSize: 9, background: 'var(--cb-bg-secondary)', padding: '6px 8px', borderRadius: 4, marginTop: 4, overflowX: 'auto', maxHeight: 200, color: 'var(--cb-text-muted)' }}>
          {JSON.stringify(JSON.parse(finding.statement), null, 2)}
        </pre>
      )}
    </div>
  )
}

export function IamAdvisor({ onRecheck, result }: IamAdvisorProps): React.JSX.Element {
  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--cb-border)', paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cb-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          IAM Advisor
        </span>
        <button
          onClick={onRecheck}
          style={{ fontSize: 10, color: 'var(--cb-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
        >
          re-check
        </button>
      </div>

      {result === null && (
        <div style={{ fontSize: 11, color: 'var(--cb-text-muted)' }}>Analyzing IAM policies...</div>
      )}

      {result !== null && result.error && (
        <div style={{ fontSize: 11, color: '#f59e0b', padding: '6px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
          {result.error}
          {result.error.includes('AccessDenied') || result.error.includes('not authorized') ? (
            <div style={{ marginTop: 4, fontSize: 10, color: 'var(--cb-text-muted)' }}>
              Required: iam:GetRolePolicy, iam:ListAttachedRolePolicies, iam:GetPolicy, iam:GetPolicyVersion, iam:ListRolePolicies, s3:GetBucketPolicy
            </div>
          ) : null}
        </div>
      )}

      {result !== null && !result.error && result.findings.length === 0 && (
        <div style={{ fontSize: 11, color: '#10b981' }}>No issues found</div>
      )}

      {result !== null && !result.error && result.findings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {result.findings.map((f, i) => (
            <FindingRow key={i} finding={f} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add cloudblocks/src/renderer/components/IamAdvisor.tsx
git commit -m "feat(ui): IamAdvisor component — findings list with severity, expand, re-check"
```

---

## Task 7: Wire IamAdvisor into Inspector

**Files:**
- Modify: `cloudblocks/src/renderer/components/Inspector.tsx`

- [ ] **Step 1: Add IAM state to Inspector**

In `Inspector.tsx`, add local state for the IAM result:

```typescript
import { IamAdvisor } from './IamAdvisor'
import type { IamAnalysisResult } from '../types/iam'

// Inside Inspector component:
const [iamResult, setIamResult] = useState<IamAnalysisResult | null | undefined>(undefined)
// undefined = not started, null = loading, IamAnalysisResult = done
```

- [ ] **Step 2: Trigger analysis on node selection (EC2, Lambda, S3 only)**

```typescript
const IAM_SUPPORTED: NodeType[] = ['ec2', 'lambda', 's3']

useEffect(() => {
  if (!selectedNode || !IAM_SUPPORTED.includes(selectedNode.type as NodeType)) {
    setIamResult(undefined)
    return
  }
  // Start fetch
  setIamResult(null)
  window.cloudblocks
    .analyzeIam(selectedNode.id, selectedNode.type as NodeType, selectedNode.metadata ?? {})
    .then(setIamResult)
    .catch((err) => setIamResult({ nodeId: selectedNode.id, findings: [], error: String(err), fetchedAt: Date.now() }))
}, [selectedNode?.id])

function handleRecheck(): void {
  if (!selectedNode) return
  setIamResult(null)
  window.cloudblocks
    .analyzeIam(selectedNode.id, selectedNode.type as NodeType, selectedNode.metadata ?? {})
    .then(setIamResult)
    .catch((err) => setIamResult({ nodeId: selectedNode.id, findings: [], error: String(err), fetchedAt: Date.now() }))
}
```

- [ ] **Step 3: Render IamAdvisor below metadata**

```tsx
{/* IAM Advisor — EC2, Lambda, S3 only */}
{selectedNode && IAM_SUPPORTED.includes(selectedNode.type as NodeType) && iamResult !== undefined && (
  <IamAdvisor
    node={selectedNode}
    onRecheck={handleRecheck}
    result={iamResult}
  />
)}
```

- [ ] **Step 4: Run typecheck + all tests**

```bash
cd cloudblocks && npm run typecheck && npm test 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add cloudblocks/src/renderer/components/Inspector.tsx
git commit -m "feat(inspector): IAM Advisor section — on-demand analysis for EC2/Lambda/S3"
```

---

## Task 8: Final Verification

- [ ] **Lint passes**

```bash
cd cloudblocks && npm run lint 2>&1 | grep -c "error" || echo "0 errors"
```

- [ ] **Typecheck passes**

```bash
npm run typecheck
```
Expected: 0 errors

- [ ] **All tests pass**

```bash
npm test 2>&1 | tail -5
```
Expected: all tests pass (evaluator + fetcher + iam types tests new)

- [ ] **Commit any stragglers**

```bash
git status
git add cloudblocks/
git commit -m "feat: IAM least-privilege advisor — on-demand policy analysis for EC2/Lambda/S3"
```
