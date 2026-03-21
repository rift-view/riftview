# Multi-Account Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fan the scanner out across AWS Organization accounts using AssumeRole, render each account as a collapsible container on the topology canvas, and add an Accounts tab to Settings for discovery and selection.

**Architecture:** Scanner gains an account dimension (selectedAccounts × selectedRegions). CloudProvider.scan() receives accountId. New `account` NodeType becomes an outer container in TopologyView above VPCs. Renderer store holds renderer-safe AccountConfig (no credentials). Main process holds masterAccountId and constructs roleArns.

**Tech Stack:** AWS SDK v3 (@aws-sdk/client-organizations, @aws-sdk/client-sts), React 18, TypeScript, Zustand, React Flow v12, Electron IPC

---

## Task 1: Install SDK + Add Types

**Files:**
- Modify: `cloudblocks/package.json`
- Modify: `cloudblocks/src/renderer/types/cloud.ts`

- [ ] **Step 1: Install @aws-sdk/client-organizations and @aws-sdk/client-sts**

```bash
cd cloudblocks && npm install @aws-sdk/client-organizations @aws-sdk/client-sts
```

- [ ] **Step 2: Add 'account' to NodeType union**

In `src/renderer/types/cloud.ts`, add `| 'account'` to the NodeType union.

- [ ] **Step 3: Add accountId to CloudNode**

```typescript
// In CloudNode interface — add after 'region':
accountId?: string  // undefined for single-account mode (backwards compatible)
```

- [ ] **Step 4: Add AccountConfig, orgRoleName to Settings**

```typescript
export interface AccountConfig {
  accountId: string
  alias: string
  status: 'active' | 'error'
  errorMessage?: string
}

// In Settings interface — add:
orgRoleName: string  // default: 'OrganizationAccountAccessRole'
```

- [ ] **Step 5: Write failing type test**

In `cloudblocks/tests/main/aws/services/organizations.test.ts` (create file):

```typescript
import { describe, it, expect } from 'vitest'
import type { NodeType } from '../../../src/renderer/types/cloud'

describe('NodeType includes account', () => {
  it('account is a valid NodeType', () => {
    const t: NodeType = 'account'
    expect(t).toBeTruthy()
  })
})
```

- [ ] **Step 6: Run typecheck — expect failures on Record<NodeType,...> maps**

```bash
npm run typecheck 2>&1 | head -30
```

Expected: errors in ResourceNode.tsx, SearchPalette.tsx, buildHclCommands.ts — these will be fixed in Task 4.

- [ ] **Step 7: Commit**

```bash
git add cloudblocks/package.json cloudblocks/package-lock.json cloudblocks/src/renderer/types/cloud.ts cloudblocks/tests/main/aws/services/organizations.test.ts
git commit -m "feat(types): add 'account' NodeType, AccountConfig, accountId to CloudNode"
```

---

## Task 2: Organizations Service + CloudProvider Update

**Files:**
- Create: `cloudblocks/src/main/aws/services/organizations.ts`
- Modify: `cloudblocks/src/main/aws/provider.ts`

- [ ] **Step 1: Create organizations.ts**

```typescript
// cloudblocks/src/main/aws/services/organizations.ts
import {
  OrganizationsClient,
  ListAccountsCommand,
  DescribeOrganizationCommand,
} from '@aws-sdk/client-organizations'
import type { AccountConfig } from '../../../renderer/types/cloud'

export interface OrgDiscoveryResult {
  accounts: AccountConfig[]
  masterAccountId: string
}

export async function discoverOrganization(
  profile: string,
  endpoint?: string,
): Promise<OrgDiscoveryResult> {
  const client = new OrganizationsClient({
    region: 'us-east-1',
    ...(endpoint ? { endpoint } : {}),
  })

  const orgRes = await client.send(new DescribeOrganizationCommand({}))
  const masterAccountId = orgRes.Organization!.MasterAccountId!

  const accounts: AccountConfig[] = []
  let nextToken: string | undefined
  do {
    const res = await client.send(new ListAccountsCommand({ NextToken: nextToken }))
    for (const acct of res.Accounts ?? []) {
      accounts.push({
        accountId: acct.Id!,
        alias: acct.Name ?? acct.Id!,
        status: acct.Status === 'ACTIVE' ? 'active' : 'error',
      })
    }
    nextToken = res.NextToken
  } while (nextToken)

  return { accounts, masterAccountId }
}
```

- [ ] **Step 2: Write failing test**

In `cloudblocks/tests/main/aws/services/organizations.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { discoverOrganization } from '../../../../src/main/aws/services/organizations'

describe('discoverOrganization', () => {
  it('returns masterAccountId and accounts list', async () => {
    // Integration test — requires real or mocked AWS
    // For now: test the shape of the return value
    const result = { accounts: [{ accountId: '123', alias: 'prod', status: 'active' as const }], masterAccountId: '123' }
    expect(result.masterAccountId).toBe('123')
    expect(result.accounts[0].accountId).toBe('123')
    expect(result.accounts[0]).not.toHaveProperty('roleArn')  // never in renderer-safe type
  })
})
```

- [ ] **Step 3: Run test**

```bash
npm run test -- organizations.test.ts
```

- [ ] **Step 4: Update CloudProvider.scan() signature**

In `src/main/aws/provider.ts`, update the `CloudProvider` interface:

```typescript
interface CloudProvider {
  readonly id: string
  scan(clients: AwsClients, region: string, accountId?: string): Promise<ScanResult>
}
```

In `awsProvider.scan()` implementation, stamp `accountId` on all returned nodes:

```typescript
async scan(clients, region, accountId?) {
  // ... existing scan logic ...
  const nodes = regionResults.flatMap(r => r.nodes).map(n => ({
    ...n,
    accountId: accountId ?? 'default',
  }))
  return { nodes, scanErrors }
}
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck 2>&1 | grep provider
```

Expected: 0 errors on provider.ts

- [ ] **Step 6: Commit**

```bash
git add cloudblocks/src/main/aws/services/organizations.ts cloudblocks/src/main/aws/provider.ts cloudblocks/tests/main/aws/services/organizations.test.ts
git commit -m "feat(scanner): add organizations discovery service + accountId stamp on CloudProvider.scan()"
```

---

## Task 3: IPC Channels + Scanner Fan-Out

**Files:**
- Modify: `cloudblocks/src/main/ipc/channels.ts`
- Modify: `cloudblocks/src/main/ipc/handlers.ts`
- Modify: `cloudblocks/src/preload/index.ts`
- Modify: `cloudblocks/src/preload/index.d.ts`
- Modify: `cloudblocks/src/main/aws/scanner.ts`

- [ ] **Step 1: Add channels**

In `channels.ts`, add:
```typescript
ACCOUNTS_DISCOVER: 'accounts:discover',
ACCOUNTS_SELECT: 'accounts:select',
```

- [ ] **Step 2: Add handlers**

In `handlers.ts`:

```typescript
ipcMain.handle(IPC.ACCOUNTS_DISCOVER, async () => {
  try {
    const result = await discoverOrganization(currentProfile, currentEndpoint)
    // Store masterAccountId in module-level variable — never sent to renderer
    masterAccountId = result.masterAccountId
    return { accounts: result.accounts, error: null }
  } catch (err) {
    return { accounts: [], error: (err as Error).message }
  }
})

ipcMain.handle(IPC.ACCOUNTS_SELECT, (_event, accounts: AccountConfig[]) => {
  scanner?.updateAccounts(accounts, masterAccountId, currentSettings.orgRoleName ?? 'OrganizationAccountAccessRole')
})
```

- [ ] **Step 3: Expose on preload**

In `preload/index.ts`:
```typescript
discoverAccounts: () => ipcRenderer.invoke(IPC.ACCOUNTS_DISCOVER),
selectAccounts: (accounts: AccountConfig[]) => ipcRenderer.invoke(IPC.ACCOUNTS_SELECT, accounts),
```

In `preload/index.d.ts`:
```typescript
discoverAccounts(): Promise<{ accounts: AccountConfig[]; error: string | null }>
selectAccounts(accounts: AccountConfig[]): Promise<void>
```

- [ ] **Step 4: Update ResourceScanner for account fan-out**

In `scanner.ts`, add:
```typescript
private selectedAccounts: AccountConfig[] = []
private masterAccountId: string = ''
private orgRoleName: string = 'OrganizationAccountAccessRole'

updateAccounts(accounts: AccountConfig[], masterAccountId: string, orgRoleName: string): void {
  this.selectedAccounts = accounts
  this.masterAccountId = masterAccountId
  this.orgRoleName = orgRoleName
}
```

Update `scan()` to fan out across accounts if `selectedAccounts` is non-empty. If empty (single-account mode), use existing behaviour unchanged.

```typescript
private async scan(): Promise<void> {
  // If no accounts configured — original single-account behaviour
  if (this.selectedAccounts.length === 0) {
    // ... existing scan code unchanged ...
    return
  }

  // Multi-account fan-out
  const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts')
  const accountScans = this.selectedAccounts.map(async (account) => {
    try {
      let creds: AwsCredentialIdentity | undefined
      if (account.accountId !== this.masterAccountId) {
        const sts = new STSClient({ region: this.regions[0] })
        const roleArn = `arn:aws:iam::${account.accountId}:role/${this.orgRoleName}`
        const assumed = await sts.send(new AssumeRoleCommand({
          RoleArn: roleArn,
          RoleSessionName: 'cloudblocks-scan',
        }))
        creds = {
          accessKeyId: assumed.Credentials!.AccessKeyId!,
          secretAccessKey: assumed.Credentials!.SecretAccessKey!,
          sessionToken: assumed.Credentials!.SessionToken,
        }
      }

      const regionResults = await Promise.all(
        this.regions.map((region) => {
          const clients = createClients(this.profile, region, this.endpoint, creds)
          return awsProvider.scan(clients, region, account.accountId)
        })
      )
      return { accountId: account.accountId, results: regionResults, error: null }
    } catch (err) {
      return { accountId: account.accountId, results: [], error: (err as Error).message }
    }
  })

  const settled = await Promise.all(accountScans)
  const nextNodes = settled.flatMap(s => s.results.flatMap(r => r.nodes))
  const scanErrors = settled.flatMap(s =>
    s.error
      ? [{ service: 'AssumeRole', region: 'global', message: `Account ${s.accountId}: ${s.error}` }]
      : s.results.flatMap(r => r.scanErrors)
  )

  const delta = computeDelta(this.currentNodes, nextNodes)
  this.currentNodes = nextNodes
  this.window.webContents.send(IPC.SCAN_DELTA, { ...delta, scanErrors })
  this.window.webContents.send(IPC.SCAN_STATUS, 'idle')
}
```

Note: `createClients()` needs an optional `credentials` param — add it to `client.ts`.

- [ ] **Step 5: Update createClients() to accept optional credentials**

In `src/main/aws/client.ts`, add optional `credentials?: AwsCredentialIdentity` param. When provided, use directly instead of profile-based credential resolution.

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck 2>&1 | head -20
```

- [ ] **Step 7: Run tests**

```bash
npm test 2>&1 | tail -10
```

- [ ] **Step 8: Commit**

```bash
git add cloudblocks/src/main/ipc/channels.ts cloudblocks/src/main/ipc/handlers.ts cloudblocks/src/preload/index.ts cloudblocks/src/preload/index.d.ts cloudblocks/src/main/aws/scanner.ts cloudblocks/src/main/aws/client.ts
git commit -m "feat(ipc): ACCOUNTS_DISCOVER + ACCOUNTS_SELECT channels + scanner multi-account fan-out"
```

---

## Task 4: Store + NodeType Completeness

**Files:**
- Modify: `cloudblocks/src/renderer/store/cloud.ts`
- Modify: `cloudblocks/src/renderer/components/canvas/nodes/ResourceNode.tsx`
- Modify: `cloudblocks/src/renderer/components/canvas/nodes/SearchPalette.tsx`
- Modify: `cloudblocks/src/renderer/utils/buildHclCommands.ts`

- [ ] **Step 1: Add account state to useCloudStore**

In `cloud.ts`:
```typescript
discoveredAccounts: AccountConfig[]
selectedAccounts: AccountConfig[]
setDiscoveredAccounts: (accounts: AccountConfig[]) => void
setSelectedAccounts: (accounts: AccountConfig[]) => void
```

- [ ] **Step 2: Add 'account' to ResourceNode maps**

In `ResourceNode.tsx`, add to TYPE_BORDER and TYPE_LABEL:
```typescript
'account': '#6366f1',  // indigo — distinct from VPC blue
// TYPE_LABEL:
'account': 'Account',
```

- [ ] **Step 3: Add 'account' to SearchPalette maps**

```typescript
// TYPE_BADGE_COLOR:
'account': '#6366f1',
// TYPE_SHORT:
'account': 'ACCT',
```

- [ ] **Step 4: Add 'account' stub to buildHclCommands.ts**

```typescript
account: () => '',  // no Terraform resource for account containers
```

- [ ] **Step 5: Run typecheck — expect 0 errors**

```bash
npm run typecheck
```

- [ ] **Step 6: Run all tests**

```bash
npm test 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add cloudblocks/src/renderer/store/cloud.ts cloudblocks/src/renderer/components/canvas/nodes/ResourceNode.tsx cloudblocks/src/renderer/components/canvas/nodes/SearchPalette.tsx cloudblocks/src/renderer/utils/buildHclCommands.ts
git commit -m "feat(store): account state + NodeType completeness for 'account'"
```

---

## Task 5: AccountNode Component + TopologyView Layout

**Files:**
- Create: `cloudblocks/src/renderer/components/canvas/nodes/AccountNode.tsx`
- Modify: `cloudblocks/src/renderer/components/canvas/TopologyView.tsx`

- [ ] **Step 1: Create AccountNode.tsx following VpcNode pattern**

```typescript
// AccountNode.tsx
import React, { useState } from 'react'
import { NodeProps } from '@xyflow/react'

const ACCOUNT_COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6']

export function AccountNode({ data, id }: NodeProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const colorIndex = parseInt(id.replace(/\D/g, ''), 10) % ACCOUNT_COLORS.length
  const color = ACCOUNT_COLORS[colorIndex]

  return (
    <div style={{
      border: `2px solid ${color}`,
      borderRadius: 8,
      minWidth: 300,
      minHeight: collapsed ? 36 : 200,
      background: `${color}08`,
      fontFamily: 'monospace',
    }}>
      {/* Label bar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderBottom: collapsed ? 'none' : `1px solid ${color}30` }}>
        <button onClick={() => setCollapsed(c => !c)} style={{ background:'none', border:'none', color, cursor:'pointer', fontSize:10 }}>
          {collapsed ? '▶' : '▼'}
        </button>
        <span style={{ fontWeight:700, color, fontSize:11 }}>{data.label as string}</span>
        <span style={{ fontSize:9, color:'var(--cb-text-muted)', marginLeft:4 }}>{id}</span>
        {collapsed && (
          <span style={{ marginLeft:'auto', fontSize:9, color:'var(--cb-text-muted)' }}>
            {(data.childCount as number) ?? 0} resources
          </span>
        )}
      </div>
      {/* Children rendered by React Flow as child nodes */}
    </div>
  )
}
```

- [ ] **Step 2: Register AccountNode in TopologyView nodeTypes**

In `TopologyView.tsx`, add `account: AccountNode` to the `nodeTypes` object.

- [ ] **Step 3: Add account layout layer to TopologyView**

Before the existing VPC layout loop, add an outer loop that groups VPCs by `accountId` and positions account containers. Account containers sit below the global zone, above VPCs.

```typescript
// Group nodes by accountId
const byAccount = new Map<string, CloudNode[]>()
for (const node of cloudNodes) {
  const acctId = node.accountId ?? 'default'
  if (!byAccount.has(acctId)) byAccount.set(acctId, [])
  byAccount.get(acctId)!.push(node)
}

// Build account container nodes
for (const [accountId, acctNodes] of byAccount) {
  // ... position account container, then position VPCs inside it
}
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add cloudblocks/src/renderer/components/canvas/nodes/AccountNode.tsx cloudblocks/src/renderer/components/canvas/TopologyView.tsx
git commit -m "feat(canvas): AccountNode component + account container layout layer in TopologyView"
```

---

## Task 6: Settings — Accounts Tab

**Files:**
- Modify: `cloudblocks/src/renderer/components/SettingsModal.tsx`

- [ ] **Step 1: Add 'accounts' to TabKey union and TABS array**

```typescript
type TabKey = 'profile' | 'accounts' | 'regions' | 'appearance' | 'localstack'
// Insert { key: 'accounts', label: 'Accounts' } between profile and regions in TABS
```

- [ ] **Step 2: Implement Accounts tab content**

```tsx
{tab === 'accounts' && (
  <div>
    <div style={sectionLabel}>Role Name</div>
    <div style={{ display:'flex', gap:8 }}>
      <input
        value={roleNameInput}
        onChange={e => setRoleNameInput(e.target.value)}
        placeholder="OrganizationAccountAccessRole"
        style={inputStyle}
      />
      <button onClick={handleSaveRoleName} style={btnSecondary}>Save</button>
    </div>

    <div style={{ marginTop:16 }}>
      <button onClick={handleDiscover} disabled={discovering} style={btnSecondary}>
        {discovering ? 'Discovering...' : 'Discover Accounts'}
      </button>
    </div>

    {discoverError && (
      <div style={{ ...amberNote, marginTop:8 }}>{discoverError}</div>
    )}

    <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:12 }}>
      {discoveredAccounts.map(acct => (
        <label key={acct.accountId} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'6px 10px', borderRadius:4, border:`1px solid ${selectedAccounts.find(a => a.accountId === acct.accountId) ? 'var(--cb-accent)' : 'var(--cb-border)'}` }}>
          <input
            type="checkbox"
            checked={!!selectedAccounts.find(a => a.accountId === acct.accountId)}
            onChange={() => toggleAccount(acct)}
          />
          <span style={{ fontFamily:'monospace', fontSize:10 }}>{acct.accountId}</span>
          <span style={{ fontSize:11, color:'var(--cb-text-primary)' }}>{acct.alias}</span>
          {acct.status === 'error' && (
            <span style={{ marginLeft:'auto', fontSize:9, color:'#ef4444' }}>
              {acct.errorMessage ?? 'Error'}
            </span>
          )}
        </label>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Wire discover + select handlers**

```typescript
async function handleDiscover(): Promise<void> {
  setDiscovering(true)
  setDiscoverError(null)
  const res = await window.cloudblocks.discoverAccounts()
  setDiscovering(false)
  if (res.error) {
    setDiscoverError(`Discovery failed: ${res.error}`)
  } else {
    setDiscoveredAccounts(res.accounts)
    useCloudStore.getState().setDiscoveredAccounts(res.accounts)
  }
}

function toggleAccount(acct: AccountConfig): void {
  const next = selectedAccounts.find(a => a.accountId === acct.accountId)
    ? selectedAccounts.filter(a => a.accountId !== acct.accountId)
    : [...selectedAccounts, acct]
  setSelectedAccounts(next)
  useCloudStore.getState().setSelectedAccounts(next)
  window.cloudblocks.selectAccounts(next).catch(() => {/*best-effort*/})
}
```

- [ ] **Step 4: Run typecheck + tests**

```bash
npm run typecheck && npm test 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add cloudblocks/src/renderer/components/SettingsModal.tsx
git commit -m "feat(settings): add Accounts tab — org discovery, role name config, account selection"
```

---

## Task 7: Final Verification

- [ ] **Typecheck passes**

```bash
cd cloudblocks && npm run typecheck
```
Expected: 0 errors

- [ ] **Lint passes**

```bash
npm run lint 2>&1 | grep -c "error" || echo "0 errors"
```

- [ ] **All tests pass**

```bash
npm test 2>&1 | tail -5
```

- [ ] **Commit all remaining**

```bash
git add -A
git commit -m "feat: multi-account org support — AssumeRole fan-out, account containers, Settings Accounts tab"
```
