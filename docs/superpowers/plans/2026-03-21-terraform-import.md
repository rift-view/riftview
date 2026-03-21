# Terraform State Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse a local `.tfstate` file in the main process, strip sensitive values, and render the resulting nodes on the canvas with dashed borders and TF badges — no AWS credentials required.

**Architecture:** Ingestion is pure main-process (fs + JSON parse + sanitize). Parser returns `CloudNode[]` with `status: 'imported'`. Nodes cross IPC into a separate `importedNodes` store slice that `applyDelta()` never touches. Canvas merges both slices at render time via a `flowNodes` memo. Visual distinction (dashed border, TF badge) is applied in `ResourceNode` when `status === 'imported'`.

**Tech Stack:** Electron `dialog.showOpenDialog`, Node.js `fs.readFile`, TypeScript, Zustand, React Flow v12, React 18

---

## Task 1: Add 'imported' NodeStatus + Type Groundwork

**Files:**
- Modify: `cloudblocks/src/renderer/types/cloud.ts`

- [ ] **Step 1: Write failing test for new NodeStatus**

Create `cloudblocks/tests/renderer/types/cloud.test.ts` (or add to existing):

```typescript
import { describe, it, expect } from 'vitest'
import type { NodeStatus } from '../../../src/renderer/types/cloud'

describe('NodeStatus includes imported', () => {
  it('imported is a valid NodeStatus', () => {
    const s: NodeStatus = 'imported'
    expect(s).toBe('imported')
  })
})
```

Run: `cd cloudblocks && npm test -- cloud.test.ts`
Expected: FAIL (type error — 'imported' not in union yet)

- [ ] **Step 2: Add 'imported' to NodeStatus union**

In `src/renderer/types/cloud.ts`, locate the `NodeStatus` union and add `'imported'`:

```typescript
export type NodeStatus = 'running' | 'stopped' | 'pending' | 'error' | 'unknown' | 'creating' | 'deleting' | 'imported'
```

- [ ] **Step 3: Run typecheck — no errors expected**

```bash
npm run typecheck 2>&1 | head -10
```

NodeStatus is not used in any `Record<NodeStatus,...>` exhaustive maps, so no cascading failures.

- [ ] **Step 4: Run test — expect pass**

```bash
npm test -- cloud.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add cloudblocks/src/renderer/types/cloud.ts cloudblocks/tests/renderer/types/cloud.test.ts
git commit -m "feat(types): add 'imported' to NodeStatus union"
```

---

## Task 2: Parser — parseTfState()

**Files:**
- Create: `cloudblocks/src/main/aws/tfstate/parser.ts`
- Create: `cloudblocks/tests/main/aws/tfstate/parser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `cloudblocks/tests/main/aws/tfstate/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseTfState } from '../../../../src/main/aws/tfstate/parser'

const minimal = (type: string, attrs: Record<string, unknown>) =>
  JSON.stringify({
    version: 4,
    resources: [{ type, name: 'main', instances: [{ attributes: attrs }] }],
  })

describe('parseTfState', () => {
  it('maps aws_instance to ec2 node', () => {
    const raw = minimal('aws_instance', { id: 'i-abc', instance_type: 't3.micro', subnet_id: 'sub-1', vpc_security_group_ids: [] })
    const nodes = parseTfState(raw)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('ec2')
    expect(nodes[0].status).toBe('imported')
  })

  it('maps aws_vpc to vpc node', () => {
    const raw = minimal('aws_vpc', { id: 'vpc-123', cidr_block: '10.0.0.0/16', tags: { Name: 'main-vpc' } })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('vpc')
  })

  it('maps aws_subnet to subnet node', () => {
    const raw = minimal('aws_subnet', { id: 'sub-1', vpc_id: 'vpc-123', cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('subnet')
  })

  it('maps aws_security_group to security-group node', () => {
    const raw = minimal('aws_security_group', { id: 'sg-1', vpc_id: 'vpc-123', name: 'web-sg', description: 'Web SG' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('security-group')
  })

  it('maps aws_s3_bucket to s3 node', () => {
    const raw = minimal('aws_s3_bucket', { id: 'my-bucket', region: 'us-east-1' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('s3')
  })

  it('maps aws_lambda_function to lambda node', () => {
    const raw = minimal('aws_lambda_function', { function_name: 'my-fn', runtime: 'nodejs20.x', memory_size: 128, timeout: 30 })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('lambda')
  })

  it('maps aws_db_instance to rds node', () => {
    const raw = minimal('aws_db_instance', { id: 'mydb', engine: 'postgres', instance_class: 'db.t3.micro', db_subnet_group_name: 'default' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('rds')
  })

  it('maps aws_lb to alb node', () => {
    const raw = minimal('aws_lb', { arn: 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/my-lb/1', name: 'my-lb', scheme: 'internet-facing', subnets: [] })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('alb')
  })

  it('maps aws_alb to alb node', () => {
    const raw = minimal('aws_alb', { arn: 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/my-lb/2', name: 'my-lb2', scheme: 'internal', subnets: [] })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('alb')
  })

  it('maps aws_api_gateway_v2_api to apigw node', () => {
    const raw = minimal('aws_api_gateway_v2_api', { id: 'abc123', name: 'my-api', protocol_type: 'HTTP' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('apigw')
  })

  it('maps aws_cloudfront_distribution to cloudfront node', () => {
    const raw = minimal('aws_cloudfront_distribution', { id: 'ABCDE', domain_name: 'd111111abcdef8.cloudfront.net' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('cloudfront')
  })

  it('maps unknown aws_* to unknown node with warning', () => {
    const raw = minimal('aws_route_table', { id: 'rt-1' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('unknown')
    expect(nodes[0].metadata?.unsupportedTfType).toBe('aws_route_table')
  })

  it('skips non-aws resources silently', () => {
    const raw = minimal('azurerm_resource_group', { id: '/subscriptions/123' })
    const nodes = parseTfState(raw)
    expect(nodes).toHaveLength(0)
  })

  it('strips sensitive keys from attributes', () => {
    const raw = minimal('aws_db_instance', { id: 'mydb', engine: 'postgres', instance_class: 'db.t3.micro', db_subnet_group_name: 'default', password: 'hunter2', secret_arn: 'arn:aws:...' })
    const nodes = parseTfState(raw)
    expect(nodes[0].metadata).not.toHaveProperty('password')
    expect(nodes[0].metadata).not.toHaveProperty('secret_arn')
  })

  it('handles resources with multiple instances', () => {
    const raw = JSON.stringify({
      version: 4,
      resources: [{ type: 'aws_s3_bucket', name: 'logs', instances: [
        { attributes: { id: 'bucket-1', region: 'us-east-1' } },
        { attributes: { id: 'bucket-2', region: 'us-west-2' } },
      ]}],
    })
    const nodes = parseTfState(raw)
    expect(nodes).toHaveLength(2)
  })
})
```

Run: `cd cloudblocks && npm test -- parser.test.ts`
Expected: FAIL (no parser file yet)

- [ ] **Step 2: Create the parser**

Create `cloudblocks/src/main/aws/tfstate/parser.ts`:

```typescript
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

interface TfStateResource {
  type: string
  name: string
  instances: Array<{ attributes: Record<string, unknown> }>
}

interface TfState {
  version: number
  resources: TfStateResource[]
}

const SENSITIVE_KEYS = ['password', 'secret', 'token', 'key_pair', 'private_key', 'sensitive_values']

function sanitizeAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attrs).filter(([k]) => !SENSITIVE_KEYS.some((s) => k.includes(s)))
  )
}

function mapResource(
  type: string,
  name: string,
  attrs: Record<string, unknown>
): CloudNode {
  const base = {
    status: 'imported' as NodeStatus,
    region: (attrs['region'] as string | undefined) ?? 'unknown',
    metadata: attrs,
  }

  switch (type) {
    case 'aws_instance':
      return { ...base, id: attrs['id'] as string, type: 'ec2', name: (attrs['id'] as string) ?? name }
    case 'aws_vpc':
      return { ...base, id: attrs['id'] as string, type: 'vpc', name: ((attrs['tags'] as Record<string, string> | undefined)?.['Name']) ?? (attrs['id'] as string) }
    case 'aws_subnet':
      return { ...base, id: attrs['id'] as string, type: 'subnet', name: attrs['id'] as string, parentId: attrs['vpc_id'] as string | undefined }
    case 'aws_security_group':
      return { ...base, id: attrs['id'] as string, type: 'security-group', name: (attrs['name'] as string) ?? name }
    case 'aws_s3_bucket':
      return { ...base, id: attrs['id'] as string, type: 's3', name: attrs['id'] as string }
    case 'aws_lambda_function':
      return { ...base, id: attrs['function_name'] as string, type: 'lambda', name: attrs['function_name'] as string }
    case 'aws_db_instance':
      return { ...base, id: attrs['id'] as string, type: 'rds', name: attrs['id'] as string }
    case 'aws_lb':
    case 'aws_alb':
      return { ...base, id: attrs['arn'] as string, type: 'alb', name: (attrs['name'] as string) ?? name }
    case 'aws_api_gateway_v2_api':
      return { ...base, id: attrs['id'] as string, type: 'apigw', name: (attrs['name'] as string) ?? name }
    case 'aws_cloudfront_distribution':
      return { ...base, id: attrs['id'] as string, type: 'cloudfront', name: (attrs['domain_name'] as string) ?? name }
    default:
      return {
        ...base,
        id: `tf-unknown-${type}-${name}`,
        type: 'unknown',
        name: `${type}.${name}`,
        metadata: { ...attrs, unsupportedTfType: type },
      }
  }
}

export function parseTfState(raw: string): CloudNode[] {
  const state: TfState = JSON.parse(raw)
  return state.resources
    .filter((r) => r.type.startsWith('aws_'))
    .flatMap((r) =>
      r.instances.map((instance) => mapResource(r.type, r.name, sanitizeAttributes(instance.attributes)))
    )
}
```

- [ ] **Step 3: Run tests — expect all pass**

```bash
npm test -- parser.test.ts
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck 2>&1 | head -10
```

- [ ] **Step 5: Commit**

```bash
git add cloudblocks/src/main/aws/tfstate/parser.ts cloudblocks/tests/main/aws/tfstate/parser.test.ts
git commit -m "feat(tfstate): parseTfState — 10-type mapping, sensitive-key sanitization"
```

---

## Task 3: IPC Channels — TFSTATE_IMPORT + TFSTATE_CLEAR

**Files:**
- Modify: `cloudblocks/src/main/ipc/channels.ts`
- Modify: `cloudblocks/src/main/ipc/handlers.ts`
- Modify: `cloudblocks/src/preload/index.ts`
- Modify: `cloudblocks/src/preload/index.d.ts`

- [ ] **Step 1: Add channel constants**

In `src/main/ipc/channels.ts`, add:
```typescript
TFSTATE_IMPORT: 'tfstate:import',
TFSTATE_CLEAR: 'tfstate:clear',
```

- [ ] **Step 2: Register handlers**

In `src/main/ipc/handlers.ts`, add:

```typescript
import { dialog } from 'electron'
import { readFile } from 'fs/promises'
import { parseTfState } from '../aws/tfstate/parser'

ipcMain.handle(IPC.TFSTATE_IMPORT, async (_event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Terraform State', extensions: ['tfstate', 'json'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return { nodes: [] }
  const raw = await readFile(filePaths[0], 'utf-8')
  const nodes = parseTfState(raw)
  return { nodes }
})

ipcMain.handle(IPC.TFSTATE_CLEAR, () => {
  // Signal only — renderer clears its own store
  return { ok: true }
})
```

- [ ] **Step 3: Expose on preload**

In `preload/index.ts`, add:
```typescript
importTfState: () => ipcRenderer.invoke(IPC.TFSTATE_IMPORT),
clearTfState: () => ipcRenderer.invoke(IPC.TFSTATE_CLEAR),
```

In `preload/index.d.ts`, add:
```typescript
importTfState(): Promise<{ nodes: CloudNode[] }>
clearTfState(): Promise<{ ok: boolean }>
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck 2>&1 | head -10
```

- [ ] **Step 5: Commit**

```bash
git add cloudblocks/src/main/ipc/channels.ts cloudblocks/src/main/ipc/handlers.ts cloudblocks/src/preload/index.ts cloudblocks/src/preload/index.d.ts
git commit -m "feat(ipc): TFSTATE_IMPORT + TFSTATE_CLEAR channels"
```

---

## Task 4: Store — importedNodes Slice

**Files:**
- Modify: `cloudblocks/src/renderer/store/cloud.ts`

- [ ] **Step 1: Add importedNodes state + actions**

In `cloud.ts`, add to the store interface and implementation:

```typescript
// State
importedNodes: CloudNode[]

// Actions
setImportedNodes: (nodes: CloudNode[]) => void
clearImportedNodes: () => void
```

Initial value: `importedNodes: []`

Implementation:
```typescript
setImportedNodes: (nodes) => set({ importedNodes: nodes }),
clearImportedNodes: () => set({ importedNodes: [] }),
```

- [ ] **Step 2: Verify applyDelta does NOT touch importedNodes**

Read the current `applyDelta` function in `cloud.ts`. Confirm it only updates `nodes` (the live-scan slice). If it ever touches all nodes, add a guard:

```typescript
// applyDelta must ONLY update 'nodes', never 'importedNodes'
// They are kept strictly separate
```

- [ ] **Step 3: Run typecheck + tests**

```bash
npm run typecheck && npm test 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add cloudblocks/src/renderer/store/cloud.ts
git commit -m "feat(store): importedNodes slice — isolated from applyDelta, separate from live scan"
```

---

## Task 5: Canvas Visual Treatment + flowNodes Merge

**Files:**
- Modify: `cloudblocks/src/renderer/components/canvas/nodes/ResourceNode.tsx`
- Modify: `cloudblocks/src/renderer/components/canvas/TopologyView.tsx`
- Modify: `cloudblocks/src/renderer/components/canvas/GraphView.tsx`

- [ ] **Step 1: Add imported visual treatment to ResourceNode**

In `ResourceNode.tsx`, locate the node container div and add:

```typescript
const isImported = data.node.status === 'imported'

// Apply to container style:
borderStyle: isImported ? 'dashed' : 'solid',
```

And add TF badge in top-right when imported:

```tsx
{isImported && (
  <div style={{
    position: 'absolute',
    top: -6,
    right: -6,
    background: '#7c3aed',
    color: '#fff',
    fontSize: 8,
    fontWeight: 700,
    padding: '1px 4px',
    borderRadius: 3,
    fontFamily: 'monospace',
    letterSpacing: '0.05em',
  }}>
    TF
  </div>
)}
```

- [ ] **Step 2: Merge importedNodes in TopologyView flowNodes memo**

In `TopologyView.tsx`, import `importedNodes` from store:

```typescript
const importedNodes = useCloudStore(s => s.importedNodes)
```

In the `flowNodes` useMemo, merge at the end:

```typescript
const flowNodes = useMemo(() => {
  // ... existing logic building nodes from cloudNodes ...
  // At the end, append imported nodes (same layout logic applies)
  const importedFlowNodes = importedNodes.map(n => ({
    id: n.id,
    type: 'resource',
    position: nodePositions[n.id] ?? { x: 0, y: 0 },
    data: { node: n },
    parentId: n.parentId,
    // imported nodes use same layout — parentId relationships drive hierarchy
  }))
  return [...existingFlowNodes, ...importedFlowNodes]
}, [/* existing deps */, importedNodes])
```

- [ ] **Step 3: Same merge in GraphView**

Apply the same `importedNodes` merge to `GraphView.tsx` `flowNodes` memo.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck 2>&1 | head -10
```

- [ ] **Step 5: Commit**

```bash
git add cloudblocks/src/renderer/components/canvas/nodes/ResourceNode.tsx cloudblocks/src/renderer/components/canvas/TopologyView.tsx cloudblocks/src/renderer/components/canvas/GraphView.tsx
git commit -m "feat(canvas): imported node visual treatment (dashed border, TF badge) + importedNodes merge in flowNodes"
```

---

## Task 6: Inspector + UI Entry Points

**Files:**
- Modify: `cloudblocks/src/renderer/components/Inspector.tsx`
- Modify: `cloudblocks/src/renderer/components/TitleBar.tsx`
- Modify: `cloudblocks/src/renderer/components/canvas/CloudCanvas.tsx`

- [ ] **Step 1: Inspector — hide actions for imported nodes + read-only banner**

In `Inspector.tsx`, after identifying the selected node, add:

```tsx
const isImported = selectedNode?.status === 'imported'

// Wrap all action buttons in:
{!isImported && (
  <> {/* Edit, Delete, quick actions */} </>
)}

// Add banner above actions:
{isImported && (
  <div style={{ padding: '6px 10px', borderRadius: 4, background: 'var(--cb-bg-secondary)', border: '1px solid var(--cb-border)', fontSize: 11, color: 'var(--cb-text-muted)', marginBottom: 8 }}>
    Imported from Terraform — read-only
  </div>
)}

// If type === 'unknown' and isImported:
{isImported && selectedNode.type === 'unknown' && (
  <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 8 }}>
    Unsupported Terraform resource type: {String(selectedNode.metadata?.unsupportedTfType ?? 'unknown')}
  </div>
)}
```

- [ ] **Step 2: TitleBar — "Import .tfstate" button**

In `TitleBar.tsx`, add a button in the toolbar:

```tsx
async function handleImportTfState(): Promise<void> {
  const { nodes } = await window.cloudblocks.importTfState()
  if (nodes.length > 0) {
    useCloudStore.getState().setImportedNodes(nodes)
    useUIStore.getState().showToast(`Imported ${nodes.length} resources from Terraform state`, 'success')
  }
}

// In JSX:
<button onClick={handleImportTfState} title="Import .tfstate file" style={toolbarBtn}>
  TF
</button>
```

- [ ] **Step 3: CloudCanvas — "Clear Import" button**

In `CloudCanvas.tsx`, add:

```typescript
const importedNodes = useCloudStore(s => s.importedNodes)

async function handleClearImport(): Promise<void> {
  await window.cloudblocks.clearTfState()
  useCloudStore.getState().clearImportedNodes()
}
```

```tsx
{importedNodes.length > 0 && (
  <button onClick={handleClearImport} style={{ position:'absolute', top:8, right:8, zIndex:10, ...toolbarBtn }}>
    Clear Import ({importedNodes.length})
  </button>
)}
```

- [ ] **Step 4: Run typecheck + all tests**

```bash
cd cloudblocks && npm run typecheck && npm test 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add cloudblocks/src/renderer/components/Inspector.tsx cloudblocks/src/renderer/components/TitleBar.tsx cloudblocks/src/renderer/components/canvas/CloudCanvas.tsx
git commit -m "feat(ui): tfstate import button in TitleBar, read-only banner in Inspector, clear button in CloudCanvas"
```

---

## Task 7: Final Verification

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
Expected: all tests pass (13+ new parser tests)

- [ ] **Commit any stragglers**

```bash
git status
# If any untracked changes remain:
git add cloudblocks/
git commit -m "feat: Terraform state import — parseTfState, importedNodes store slice, canvas visual treatment"
```
