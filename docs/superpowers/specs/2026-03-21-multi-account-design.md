# Multi-Account Support — Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Pillar:** Post-1.0 #1

---

## Goal

Allow Cloudblocks to scan and visualize AWS resources across multiple accounts in an AWS Organization simultaneously. Each account appears as a collapsible container on the topology canvas, nested above VPCs in the existing hierarchy.

---

## Decisions

| Question | Decision |
|----------|----------|
| Canvas layout | Account containers (Option A) — collapsible, color-coded |
| Account discovery | `organizations:ListAccounts` via management account |
| Account selection | Selective (default: management account only) |
| Role name | Configurable, default `OrganizationAccountAccessRole` |
| Cross-account edges | Out of scope (deferred) |
| Scan failure isolation | Per-account, red indicator in Settings |

---

## Architecture

The scanner gains an account dimension. It fans out across `selectedAccounts × selectedRegions` — each combination produces its own `AwsClients` instance from a short-lived AssumeRole session. Every resulting `CloudNode` carries an `accountId` field. The management account uses current credentials directly (no AssumeRole).

The account itself becomes a new node type (`account`) — a parent container sitting above VPCs in the topology hierarchy.

---

## Data Model Changes

### `CloudNode` extension
```typescript
// Add to existing CloudNode interface
accountId: string  // account ID of owning account, e.g. '123456789012'
```

### New types
```typescript
// Renderer-safe — no credentials, no role ARN (constructed in main process)
interface AccountConfig {
  accountId: string
  alias: string       // human-readable name from Organizations
  status: 'active' | 'error'
  errorMessage?: string
}

// Main-process only — never sent to renderer
interface AccountScanConfig {
  accountId: string
  alias: string
  roleArn: string     // arn:aws:iam::{accountId}:role/{orgRoleName}
}
```

### `Settings` extension
```typescript
// Add to existing Settings interface
orgRoleName: string  // default: 'OrganizationAccountAccessRole'
```

---

## New IPC Channels

All 4 files must be updated: `channels.ts` → `handlers.ts` → `preload/index.ts` → `preload/index.d.ts`

| Channel | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `ACCOUNTS_DISCOVER` | renderer→main | `void` | Call `organizations:ListAccounts`, return `AccountConfig[]` |
| `ACCOUNTS_SELECT` | renderer→main | `AccountConfig[]` | Update scanner's account list, trigger re-scan |

### `window.cloudblocks` additions
```typescript
discoverAccounts(): Promise<AccountConfig[]>
selectAccounts(accounts: AccountConfig[]): Promise<void>
```

---

## Store Changes (`useCloudStore`)

```typescript
// New state
discoveredAccounts: AccountConfig[]
selectedAccounts: AccountConfig[]

// New actions
setDiscoveredAccounts(accounts: AccountConfig[]): void
setSelectedAccounts(accounts: AccountConfig[]): void  // persists + triggers ACCOUNTS_SELECT
```

Node reset on account change follows same pattern as profile/region change: `setProfile()` resets nodes + increments `scanGeneration`.

---

## Scanner Changes (`ResourceScanner`)

```typescript
// New constructor param
selectedAccounts: AccountConfig[]

// New method
updateAccounts(accounts: AccountConfig[]): void

// Updated scan loop (pseudocode)
private async scan(): Promise<void> {
  const accountScans = this.selectedAccounts.map(async (account) => {
    try {
      // masterAccountId stored in scanner constructor from ACCOUNTS_DISCOVER result
      const creds = account.accountId === this.masterAccountId
        ? currentCredentials          // no AssumeRole for management account
        : await assumeRole(account.roleArn)  // roleArn = `arn:aws:iam::${account.accountId}:role/${this.orgRoleName}`

      const regionResults = await Promise.all(
        this.regions.map((region) => {
          const clients = createClients(creds, region, this.endpoint)
          return awsProvider.scan(clients, region, account.accountId)
        })
      )
      return { accountId: account.accountId, results: regionResults, error: null }
    } catch (err) {
      return { accountId: account.accountId, results: [], error: err.message }
    }
  })

  const settled = await Promise.all(accountScans)
  // flatten nodes, collect errors, compute delta, send IPC
}
```

AssumeRole sessions are ephemeral — created per scan, never stored.

---

## New AWS Service: `src/main/aws/services/organizations.ts`

```typescript
import {
  OrganizationsClient,
  ListAccountsCommand,
  DescribeOrganizationCommand
} from '@aws-sdk/client-organizations'

export interface OrgDiscoveryResult {
  accounts: AccountConfig[]       // renderer-safe (no roleArn)
  masterAccountId: string         // from DescribeOrganization — used by scanner to skip AssumeRole
}

export async function discoverOrganization(
  profile: string,
  endpoint?: string
): Promise<OrgDiscoveryResult> {
  // Organizations is a global service — always us-east-1
  const client = new OrganizationsClient({ region: 'us-east-1', ... })

  // DescribeOrganization returns MasterAccountId — must be called first
  const org = await client.send(new DescribeOrganizationCommand({}))
  const masterAccountId = org.Organization!.MasterAccountId!

  // Paginate ListAccounts
  const accounts: AccountConfig[] = []
  // ... pagination loop ...
  return { accounts, masterAccountId }
}
```

`ACCOUNTS_DISCOVER` IPC handler returns `OrgDiscoveryResult`. Handler stores `masterAccountId` in main process (not sent to renderer store). Scanner constructor receives `masterAccountId` to skip AssumeRole for the management account.

New SDK package: `@aws-sdk/client-organizations`

---

## New Node Type: `account`

Add `'account'` to the `NodeType` union in `src/renderer/types/cloud.ts`.

### `AccountNode` component (`src/renderer/components/canvas/nodes/AccountNode.tsx`)

- Outer container with color-coded border (cycles 6-color palette)
- Label bar: account alias (bold accent) + account ID (muted small text) + collapse toggle
- Collapsed state: label bar only + resource count badge
- Follows `VpcNode` pattern exactly — one level up in the hierarchy

### Topology layout order (updated)
1. Global zone (ACM, CloudFront, R53)
2. **Account containers** ← new
3. VPCs inside each account
4. Subnets inside VPCs
5. Resources inside subnets

---

## Settings — Accounts Tab

New tab in `SettingsModal` between "Profile" and "Regions":

```
ACCOUNTS

Role name: [OrganizationAccountAccessRole    ] [Save]

[Discover Accounts]

  [x] 123456789012  production       active
  [x] 234567890123  staging          active
  [ ] 345678901234  dev-sandbox
  [!] 456789012345  security-audit   AssumeRole failed — role not found
```

- "Discover" button calls `discoverAccounts()` IPC
- Checkboxes call `selectAccounts()` IPC on change
- Failed accounts show inline error (not toast)
- Role name field saves to `Settings.orgRoleName`

---

## Security Constraints

- AssumeRole temp credentials (`accessKeyId`, `secretAccessKey`, `sessionToken`) never cross IPC boundary
- `discoveredAccounts` in renderer store: `accountId`, `alias`, `status`, `errorMessage` only — no roleArn, no credentials
- Role ARN constructed exclusively in main process: `arn:aws:iam::${accountId}:role/${orgRoleName}`
- `masterAccountId` stored in main process only (returned by `DescribeOrganization`, not sent to renderer)
- Discovery failure: explicit error IPC response, not silent empty list
- Write operations to member accounts: deferred. When implemented, `CliEngine` will need a `tempCredentials?: { accessKeyId, secretAccessKey, sessionToken }` constructor param to inject assumed-role session tokens.

---

## NodeType Completeness

Adding `'account'` requires updates to all `Record<NodeType, ...>` maps (typecheck-enforced via `satisfies`):
- `src/renderer/types/cloud.ts` — union
- `src/renderer/components/canvas/nodes/ResourceNode.tsx` — TYPE_BORDER, TYPE_LABEL (uses `satisfies Record<NodeType, string>`)
- `src/renderer/components/canvas/nodes/SearchPalette.tsx` — TYPE_BADGE_COLOR, TYPE_SHORT (uses `satisfies Record<NodeType, string>`)
- `src/renderer/utils/buildHclCommands.ts` — TerraformGeneratorMap (exhaustive, typecheck-enforced — add stub returning '')

Note: `buildDeleteCommands.ts` uses a `switch` with `default: return []` — it is NOT exhaustiveness-enforced by TypeScript. No update required for typecheck; update is optional for code clarity.

---

## Out of Scope

- Cross-account edges (VPC peering, Transit Gateway)
- Account-level CRUD (creating/deleting accounts via the app)
- AWS SSO / Identity Center credential flows
- SCPs or account-level policy visualization
- Write operations to member accounts (deferred — CLI credential injection design needed)

---

## Files Touched Summary

| File | Action |
|------|--------|
| `package.json` | Add `@aws-sdk/client-organizations` |
| `src/renderer/types/cloud.ts` | Add `'account'` to NodeType, `accountId` to CloudNode, `AccountConfig`, `orgRoleName` to Settings |
| `src/main/ipc/channels.ts` | Add ACCOUNTS_DISCOVER, ACCOUNTS_SELECT |
| `src/main/ipc/handlers.ts` | Register both handlers |
| `src/preload/index.ts` | Expose discoverAccounts, selectAccounts |
| `src/preload/index.d.ts` | Type declarations |
| `src/main/aws/services/organizations.ts` | Create — listAccounts() |
| `src/main/aws/provider.ts` | Update `CloudProvider.scan()` signature to accept `accountId` — stamps on all returned nodes |
| `src/main/aws/scanner.ts` | Add account fan-out, AssumeRole, updateAccounts(), masterAccountId constructor param |
| `src/renderer/store/cloud.ts` | Add discoveredAccounts, selectedAccounts, setters |
| `src/renderer/components/canvas/nodes/AccountNode.tsx` | Create |
| `src/renderer/components/canvas/TopologyView.tsx` | Add account container layout layer |
| `src/renderer/components/SettingsModal.tsx` | Add Accounts tab |
| `src/renderer/components/canvas/nodes/ResourceNode.tsx` | Add 'account' entries |
| `src/renderer/components/canvas/nodes/SearchPalette.tsx` | Add 'account' entries |
| `src/renderer/utils/buildHclCommands.ts` | Add 'account' stub |
| `src/renderer/utils/buildDeleteCommands.ts` | Add 'account' → [] |
| `tests/` | Unit tests for listAccounts, scanner fan-out, AccountNode |
