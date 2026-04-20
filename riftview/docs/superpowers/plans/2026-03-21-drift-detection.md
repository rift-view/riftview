# Drift Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compare live AWS scan results against imported Terraform state nodes to surface unmanaged, missing, and matched resources — with visual badges on canvas nodes and a diff panel in the Inspector.

**Architecture:** A pure `compareDrift()` function in `src/renderer/utils/compareDrift.ts` computes drift by strict ID matching between `nodes` and `importedNodes`. `applyDriftToState()` (same file) stamps `driftStatus` and `tfMetadata` onto nodes and is called inline inside existing Zustand `set()` callbacks for atomic updates. Canvas and Inspector read `driftStatus` directly from `CloudNode`.

**Tech Stack:** React 19, TypeScript, Zustand 5, React Flow v12, Vitest

---

## File Map

| File                                                    | Role                                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/renderer/types/cloud.ts`                           | Add `DriftStatus` type + `driftStatus?`, `tfMetadata?` to `CloudNode`                         |
| `src/renderer/utils/compareDrift.ts`                    | New — pure `compareDrift()` + `applyDriftToState()`                                           |
| `src/renderer/store/cloud.ts`                           | Wire drift into `setImportedNodes`, `applyDelta`, `clearImportedNodes` (both store + factory) |
| `src/renderer/store/ui.ts`                              | Add `driftFilterActive` + `toggleDriftFilter`                                                 |
| `src/renderer/components/canvas/nodes/ResourceNode.tsx` | Drift stripe colour + corner badge                                                            |
| `src/renderer/components/canvas/CloudCanvas.tsx`        | Drift filter toolbar button                                                                   |
| `src/renderer/components/canvas/TopologyView.tsx`       | Apply drift filter to leaf `flowNodes`                                                        |
| `src/renderer/components/canvas/GraphView.tsx`          | Same                                                                                          |
| `src/renderer/components/Inspector.tsx`                 | Drift status section — three states                                                           |
| `tests/renderer/utils/compareDrift.test.ts`             | New — unit tests for pure functions                                                           |

---

### Task 1: Types — DriftStatus + CloudNode fields

**Files:**

- Modify: `src/renderer/types/cloud.ts`

- [ ] **Step 1: Add `DriftStatus` and extend `CloudNode`**

Open `src/renderer/types/cloud.ts`. After the `NodeStatus` line (line 1), add:

```typescript
export type DriftStatus = 'unmanaged' | 'missing' | 'matched'
```

Then in the `CloudNode` interface (currently ends at line 44 with `integrations?`), add two optional fields:

```typescript
export interface CloudNode {
  id: string
  type: NodeType
  label: string
  status: NodeStatus
  region: string
  metadata: Record<string, unknown>
  parentId?: string
  integrations?: { targetId: string; edgeType: EdgeType }[]
  driftStatus?: DriftStatus
  tfMetadata?: Record<string, unknown>
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd /Users/julius/AI/riftview/riftview
npm run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/types/cloud.ts
git commit -m "feat(drift): add DriftStatus type and driftStatus/tfMetadata fields to CloudNode"
```

---

### Task 2: Pure functions — compareDrift + applyDriftToState

**Files:**

- Create: `src/renderer/utils/compareDrift.ts`
- Create: `tests/renderer/utils/compareDrift.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `tests/renderer/utils/compareDrift.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { compareDrift, applyDriftToState } from '../../../src/renderer/utils/compareDrift'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function node(id: string, type: CloudNode['type'] = 'ec2'): CloudNode {
  return {
    id,
    type,
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: { instance_type: 't3.micro' }
  }
}

function imported(id: string, type: CloudNode['type'] = 'ec2'): CloudNode {
  return {
    id,
    type,
    label: id,
    status: 'imported',
    region: 'us-east-1',
    metadata: { instance_type: 't3.micro' }
  }
}

describe('compareDrift', () => {
  it('returns empty results for empty inputs', () => {
    const result = compareDrift([], [])
    expect(result).toEqual({ matched: [], unmanaged: [], missing: [] })
  })

  it('matches nodes with same ID', () => {
    const result = compareDrift([node('i-123')], [imported('i-123')])
    expect(result.matched).toEqual(['i-123'])
    expect(result.unmanaged).toEqual([])
    expect(result.missing).toEqual([])
  })

  it('marks live-only node as unmanaged', () => {
    const result = compareDrift([node('i-123')], [])
    expect(result.unmanaged).toEqual(['i-123'])
    expect(result.matched).toEqual([])
    expect(result.missing).toEqual([])
  })

  it('marks imported-only node as missing', () => {
    const result = compareDrift([], [imported('i-123')])
    expect(result.missing).toEqual(['i-123'])
    expect(result.matched).toEqual([])
    expect(result.unmanaged).toEqual([])
  })

  it('handles mixed matched/unmanaged/missing in one call', () => {
    const live = [node('i-match'), node('i-unmanaged')]
    const imp = [imported('i-match'), imported('i-missing')]
    const result = compareDrift(live, imp)
    expect(result.matched).toEqual(['i-match'])
    expect(result.unmanaged).toEqual(['i-unmanaged'])
    expect(result.missing).toEqual(['i-missing'])
  })

  it('excludes type:unknown imported nodes from all buckets', () => {
    const result = compareDrift([node('i-123')], [imported('tf-unknown-aws_nat-1', 'unknown')])
    expect(result.missing).toEqual([])
    expect(result.unmanaged).toEqual(['i-123'])
  })
})

describe('applyDriftToState', () => {
  it('stamps driftStatus=matched and copies tfMetadata onto live node, removes from importedNodes', () => {
    const live = [node('i-123')]
    const imp = [{ ...imported('i-123'), metadata: { instance_type: 't3.large' } }]
    const result = applyDriftToState(live, imp)
    const liveNode = result.nodes.find((n) => n.id === 'i-123')!
    expect(liveNode.driftStatus).toBe('matched')
    expect(liveNode.tfMetadata).toEqual({ instance_type: 't3.large' })
    expect(result.importedNodes).toHaveLength(0)
  })

  it('stamps driftStatus=unmanaged on live-only nodes', () => {
    const result = applyDriftToState([node('i-123')], [])
    expect(result.nodes[0].driftStatus).toBe('unmanaged')
  })

  it('stamps driftStatus=missing on imported-only nodes, keeps them in importedNodes', () => {
    const result = applyDriftToState([], [imported('i-456')])
    expect(result.importedNodes[0].driftStatus).toBe('missing')
    expect(result.importedNodes).toHaveLength(1)
  })

  it('stamps unmanaged on all live nodes when importedNodes is empty', () => {
    // Note: cloud.ts guards against calling applyDriftToState when importedNodes.length === 0
    // but if called, all live nodes correctly become unmanaged
    const result = applyDriftToState([node('i-123')], [])
    expect(result.nodes[0].driftStatus).toBe('unmanaged')
  })

  it('excludes type:unknown imported nodes from matching', () => {
    const live = [node('i-123')]
    const imp = [imported('tf-unknown-nat-1', 'unknown')]
    const result = applyDriftToState(live, imp)
    const liveNode = result.nodes.find((n) => n.id === 'i-123')!
    expect(liveNode.driftStatus).toBe('unmanaged')
    // unknown imported node kept in importedNodes but marked missing? No — excluded entirely
    expect(result.importedNodes[0].driftStatus).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test tests/renderer/utils/compareDrift.test.ts 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module '.../compareDrift'"

- [ ] **Step 3: Implement the pure functions**

Create `src/renderer/utils/compareDrift.ts`:

```typescript
import type { CloudNode } from '../types/cloud'

export interface DriftResult {
  matched: string[]
  unmanaged: string[]
  missing: string[]
}

export function compareDrift(liveNodes: CloudNode[], importedNodes: CloudNode[]): DriftResult {
  const eligible = importedNodes.filter((n) => n.type !== 'unknown')
  const liveIds = new Set(liveNodes.map((n) => n.id))
  const impIds = new Set(eligible.map((n) => n.id))

  const matched = liveNodes.filter((n) => impIds.has(n.id)).map((n) => n.id)
  const unmanaged = liveNodes.filter((n) => !impIds.has(n.id)).map((n) => n.id)
  const missing = eligible.filter((n) => !liveIds.has(n.id)).map((n) => n.id)

  return { matched, unmanaged, missing }
}

export function applyDriftToState(
  liveNodes: CloudNode[],
  importedNodes: CloudNode[]
): { nodes: CloudNode[]; importedNodes: CloudNode[] } {
  const { matched, unmanaged, missing } = compareDrift(liveNodes, importedNodes)
  const matchedSet = new Set(matched)
  const unmanagedSet = new Set(unmanaged)
  const missingSet = new Set(missing)

  const importedMap = new Map(importedNodes.map((n) => [n.id, n]))

  const nodes = liveNodes.map((n) => {
    if (matchedSet.has(n.id)) {
      const imp = importedMap.get(n.id)!
      return { ...n, driftStatus: 'matched' as const, tfMetadata: imp.metadata }
    }
    if (unmanagedSet.has(n.id)) {
      return { ...n, driftStatus: 'unmanaged' as const }
    }
    return n
  })

  const newImportedNodes = importedNodes
    .map((n) => {
      if (n.type === 'unknown') return n // exclude from drift, leave unchanged
      if (missingSet.has(n.id)) return { ...n, driftStatus: 'missing' as const }
      return n
    })
    .filter((n) => !matchedSet.has(n.id)) // remove matched ones (absorbed into live)

  return { nodes, importedNodes: newImportedNodes }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test tests/renderer/utils/compareDrift.test.ts 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 5: Full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/utils/compareDrift.ts tests/renderer/utils/compareDrift.test.ts
git commit -m "feat(drift): add compareDrift and applyDriftToState pure functions with tests"
```

---

### Task 3: Store wiring — applyDriftToState in cloud.ts

**Files:**

- Modify: `src/renderer/store/cloud.ts`

This task modifies three actions in BOTH the main `useCloudStore` and the `createCloudStore()` test factory. They must stay in sync.

- [ ] **Step 1: Add the import**

At the top of `src/renderer/store/cloud.ts`, add:

```typescript
import { applyDriftToState } from '../utils/compareDrift'
```

- [ ] **Step 2: Update `setImportedNodes`**

Replace the current one-liner:

```typescript
setImportedNodes:  (nodes) => set({ importedNodes: nodes }),
```

With (in BOTH the main store and the factory):

```typescript
setImportedNodes: (nodes) =>
  set((state) => {
    if (nodes.length === 0) return { importedNodes: [] }
    const applied = applyDriftToState(state.nodes, nodes)
    return { nodes: applied.nodes, importedNodes: applied.importedNodes }
  }),
```

- [ ] **Step 3: Update `clearImportedNodes`**

Replace the current one-liner:

```typescript
clearImportedNodes: ()     => set({ importedNodes: [] }),
```

With (in BOTH the main store and the factory):

```typescript
clearImportedNodes: () =>
  set((state) => ({
    importedNodes: [],
    nodes: state.nodes.map(({ driftStatus: _, tfMetadata: __, ...rest }) => rest),
  })),
```

- [ ] **Step 4: Update `applyDelta`**

In `applyDelta`, the current return is:

```typescript
return { nodes: Array.from(nodeMap.values()), lastScannedAt: new Date() }
```

Replace with (in BOTH the main store and the factory):

```typescript
const newNodes = Array.from(nodeMap.values())
if (state.importedNodes.length > 0) {
  const applied = applyDriftToState(newNodes, state.importedNodes)
  return { nodes: applied.nodes, importedNodes: applied.importedNodes, lastScannedAt: new Date() }
}
return { nodes: newNodes, lastScannedAt: new Date() }
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 6: Full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/store/cloud.ts
git commit -m "feat(drift): wire applyDriftToState into setImportedNodes, applyDelta, clearImportedNodes"
```

---

### Task 4: UI store — driftFilterActive

**Files:**

- Modify: `src/renderer/store/ui.ts`

- [ ] **Step 1: Add to the `UIState` interface**

In `src/renderer/store/ui.ts`, add to the `UIState` interface (after `annotations`):

```typescript
driftFilterActive: boolean
toggleDriftFilter: () => void
```

- [ ] **Step 2: Add initial value and implementation**

In the `create<UIState>((set) => ({...}))` block, after the `annotations` initial value, add:

```typescript
driftFilterActive: false,
toggleDriftFilter: () => set((state) => ({ driftFilterActive: !state.driftFilterActive })),
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/store/ui.ts
git commit -m "feat(drift): add driftFilterActive and toggleDriftFilter to useUIStore"
```

---

### Task 5: ResourceNode — drift stripe + corner badge

**Files:**

- Modify: `src/renderer/components/canvas/nodes/ResourceNode.tsx`

The `ResourceNode` receives props via `data` as a `ResourceNodeData` object. The canvas views pass this data when building `flowNodes`.

- [ ] **Step 1: Add `driftStatus` to `ResourceNodeData`**

In `ResourceNode.tsx`, extend the `ResourceNodeData` interface (currently at line 72–82):

```typescript
interface ResourceNodeData {
  label: string
  nodeType: NodeType
  status: NodeStatus
  driftStatus?: import('../../../types/cloud').DriftStatus // add this
  vpcLabel?: string
  vpcColor?: string
  region?: string
  dimmed?: boolean
  locked?: boolean
  annotation?: string
}
```

- [ ] **Step 2: Update the stripe colour logic**

The current code at line 87 is:

```typescript
const stripeColor = statusStripeColor(d.status)
```

Replace with:

```typescript
function driftStripeColor(driftStatus: import('../../../types/cloud').DriftStatus): string {
  switch (driftStatus) {
    case 'unmanaged':
      return '#f59e0b'
    case 'missing':
      return '#ef4444'
    case 'matched':
      return '#22c55e'
  }
}

// Inside ResourceNode, replace the stripeColor line:
const stripeColor = d.driftStatus ? driftStripeColor(d.driftStatus) : statusStripeColor(d.status)
```

Place `driftStripeColor` as a standalone function above `ResourceNode`, alongside `statusStripeColor`.

- [ ] **Step 3: Add the drift corner badge**

The existing TF badge in `ResourceNode.tsx` looks like this:

```tsx
{
  isImported && (
    <div
      style={{
        position: 'absolute',
        top: -6,
        right: -6,
        background: '#7c3aed',
        color: '#fff',
        fontSize: 8,
        fontWeight: 700,
        padding: '1px 4px',
        borderRadius: 3
      }}
    >
      TF
    </div>
  )
}
```

Add the drift badge **after** the TF badge (TF badge shows for matched/missing imported nodes too — drift badge takes visual priority by stacking):

```tsx
{
  d.driftStatus && (
    <div
      title={
        d.driftStatus === 'unmanaged'
          ? 'Unmanaged — not in Terraform state'
          : d.driftStatus === 'missing'
            ? 'Missing — declared in Terraform but not in live AWS'
            : 'Matched — found in both live AWS and Terraform state'
      }
      style={{
        position: 'absolute',
        top: d.driftStatus === 'matched' ? -6 : -6,
        right: isImported ? 14 : -6, // offset right of TF badge for imported nodes
        background:
          d.driftStatus === 'unmanaged'
            ? '#f59e0b'
            : d.driftStatus === 'missing'
              ? '#ef4444'
              : '#22c55e',
        color: d.driftStatus === 'unmanaged' ? '#000' : '#fff',
        fontSize: 8,
        fontWeight: 700,
        padding: '1px 4px',
        borderRadius: 3,
        zIndex: 2
      }}
    >
      {d.driftStatus === 'unmanaged' ? '!' : d.driftStatus === 'missing' ? '✕' : '✓'}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 5: Full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/canvas/nodes/ResourceNode.tsx
git commit -m "feat(drift): add drift stripe colour and corner badge to ResourceNode"
```

---

### Task 6: Canvas views — drift filter in toolbar + flowNodes

**Files:**

- Modify: `src/renderer/components/canvas/CloudCanvas.tsx`
- Modify: `src/renderer/components/canvas/TopologyView.tsx`
- Modify: `src/renderer/components/canvas/GraphView.tsx`

#### CloudCanvas.tsx — toolbar button

- [ ] **Step 1: Add the drift filter button to the toolbar**

In `CloudCanvas.tsx`, read the new store values at the top of `CanvasInner`:

```typescript
const driftFilterActive = useUIStore((s) => s.driftFilterActive)
const toggleDriftFilter = useUIStore((s) => s.toggleDriftFilter)
```

Add the button between the Grid toggle and the Export dropdown (after the Grid button block):

```tsx
{
  importedNodes.length > 0 && (
    <button
      onClick={toggleDriftFilter}
      title={driftFilterActive ? 'Show all nodes' : 'Show only unmanaged and missing nodes'}
      style={{
        ...btnBase,
        background: driftFilterActive ? 'var(--cb-bg-elevated)' : 'transparent',
        border: `1px solid ${driftFilterActive ? '#ef4444' : 'var(--cb-border)'}`,
        color: driftFilterActive ? '#ef4444' : '#666'
      }}
    >
      ⊘ Drift only
    </button>
  )
}
```

#### TopologyView.tsx — driftStatus in data + filter

- [ ] **Step 2: Read drift filter state in TopologyView**

In `TopologyView.tsx`, add to the store subscriptions near the top of the component:

```typescript
const driftFilterActive = useUIStore((s) => s.driftFilterActive)
```

(`importedNodes` is already subscribed — do not add it again.)

- [ ] **Step 3: Pass `driftStatus` through `buildFlowNodes` for leaf resource nodes**

`buildFlowNodes` (starting at line 66 of `TopologyView.tsx`) builds `data` objects for resource nodes. Add `driftStatus: n.driftStatus` at **four** specific call sites (skip container nodes at lines 164, 178, 245 — those are VPC/subnet/apigw):

**Line 109** (global zone resource nodes):

```typescript
data: { label: n.label, nodeType: n.type, status: n.status, driftStatus: n.driftStatus, dimmed: highlightedIds !== null && !highlightedIds.has(n.id) },
```

**Line 195** (subnet children):

```typescript
data: { label: r.label, nodeType: r.type, status: r.status, driftStatus: r.driftStatus, dimmed: highlightedIds !== null && !highlightedIds.has(r.id) },
```

**Line 216** (direct-VPC children):

```typescript
data: { label: r.label, nodeType: r.type, status: r.status, driftStatus: r.driftStatus, dimmed: highlightedIds !== null && !highlightedIds.has(r.id) },
```

**Line 282** (root resource nodes):

```typescript
data: { label: r.label, nodeType: r.type, status: r.status, driftStatus: r.driftStatus, region: r.region, dimmed: highlightedIds !== null && !highlightedIds.has(r.id) },
```

- [ ] **Step 4: Pass `driftStatus` in `importedFlowNodes` (TopologyView line 509)**

In the `importedFlowNodes` mapping (inside the `flowNodes` useMemo, around line 509):

```typescript
data: { label: n.label, nodeType: n.type, status: n.status, driftStatus: n.driftStatus },
```

- [ ] **Step 5: Apply drift filter and update memo deps (TopologyView)**

Inside the `flowNodes` useMemo, replace the final `return` (currently line 518):

```typescript
return [...mapped, ...importedFlowNodes]
```

With:

```typescript
const all = [...mapped, ...importedFlowNodes]
if (!driftFilterActive) return all
const CONTAINER_TYPES = new Set(['vpc', 'subnet', 'apigw'])
return all.filter((fn) => {
  const d = fn.data as { nodeType?: string; driftStatus?: string }
  if (CONTAINER_TYPES.has(d.nodeType ?? '')) return true
  return d.driftStatus === 'unmanaged' || d.driftStatus === 'missing'
})
```

Also add `driftFilterActive` to the `useMemo` dependency array (currently line 519):

```typescript
}, [allNodes, selectedId, highlightedIds, topologyPositions, livePositions, lockedNodes, collapsedSubnets, toggleSubnet, annotations, importedNodes, driftFilterActive])
```

#### GraphView.tsx — driftStatus in data + filter

- [ ] **Step 6: Pass `driftStatus` in GraphView's main node mapping (line 303–322)**

Read drift filter state:

```typescript
const driftFilterActive = useUIStore((s) => s.driftFilterActive)
```

In the `mapped` array inside the `flowNodes` useMemo (around line 303), add to the `data` object:

```typescript
driftStatus: n.driftStatus,
```

Place it after `status: n.status,` (line 306).

- [ ] **Step 7: Pass `driftStatus` in GraphView's `importedFlowNodes` (line 335)**

```typescript
data: { label: n.label, nodeType: n.type, status: n.status, region: n.region, driftStatus: n.driftStatus },
```

- [ ] **Step 8: Apply drift filter and update memo deps (GraphView)**

Replace the final `return` (line 339):

```typescript
return [...mapped, ...importedFlowNodes]
```

With:

```typescript
const all = [...mapped, ...importedFlowNodes]
if (!driftFilterActive) return all
const CONTAINER_TYPES = new Set(['vpc', 'subnet', 'apigw'])
return all.filter((fn) => {
  const d = fn.data as { nodeType?: string; driftStatus?: string }
  if (CONTAINER_TYPES.has(d.nodeType ?? '')) return true
  return d.driftStatus === 'unmanaged' || d.driftStatus === 'missing'
})
```

Add `driftFilterActive` to the `flowNodes` dep array (line 341):

```typescript
;[
  allNodes,
  selectedId,
  byId,
  vpcColorMap,
  highlightedIds,
  graphPositions,
  livePositions,
  lockedNodes,
  annotations,
  importedNodes,
  driftFilterActive
]
```

- [ ] **Step 9: Typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 10: Full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: all tests PASS.

- [ ] **Step 11: Commit**

```bash
git add src/renderer/components/canvas/CloudCanvas.tsx \
        src/renderer/components/canvas/TopologyView.tsx \
        src/renderer/components/canvas/GraphView.tsx
git commit -m "feat(drift): add drift filter toolbar button and driftStatus through flowNodes"
```

---

### Task 7: Inspector — drift status section

**Files:**

- Modify: `src/renderer/components/Inspector.tsx`

- [ ] **Step 1: Add the drift status section**

In `Inspector.tsx`, the existing imported banner is at lines 149–153:

```tsx
{
  isImported && (
    <div
      style={{
        padding: '6px 10px',
        borderRadius: 4,
        background: 'var(--cb-bg-secondary)',
        border: '1px solid var(--cb-border)',
        fontSize: 11,
        color: 'var(--cb-text-muted)',
        marginBottom: 8
      }}
    >
      Imported from Terraform — read-only
    </div>
  )
}
```

Replace this block with a drift-aware section. The new block handles all three drift states and falls back to the old banner for imported nodes that have no `driftStatus` yet (e.g. before drift has run):

```tsx
{
  node.driftStatus === 'unmanaged' && (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 4,
        background: 'rgba(245,158,11,0.1)',
        border: '1px solid rgba(245,158,11,0.4)',
        fontSize: 11,
        marginBottom: 8
      }}
    >
      <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 3 }}>! UNMANAGED</div>
      <div style={{ color: '#d97706', lineHeight: 1.5 }}>
        Not tracked in Terraform. Consider adding to your tfstate.
      </div>
    </div>
  )
}

{
  node.driftStatus === 'missing' && (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 4,
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.4)',
        fontSize: 11,
        marginBottom: 8
      }}
    >
      <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>
        ✕ MISSING — read-only
      </div>
      <div style={{ color: '#dc2626', lineHeight: 1.5 }}>
        Declared in Terraform but not found in live AWS.
      </div>
    </div>
  )
}

{
  node.driftStatus === 'matched' && (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 4,
        background: 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.3)',
        fontSize: 11,
        marginBottom: 8
      }}
    >
      <DriftDiffTable metadata={node.metadata} tfMetadata={node.tfMetadata ?? {}} />
    </div>
  )
}

{
  !node.driftStatus && isImported && (
    <div
      style={{
        padding: '6px 10px',
        borderRadius: 4,
        background: 'var(--cb-bg-secondary)',
        border: '1px solid var(--cb-border)',
        fontSize: 11,
        color: 'var(--cb-text-muted)',
        marginBottom: 8
      }}
    >
      Imported from Terraform — read-only
    </div>
  )
}
```

- [ ] **Step 2: Add the `DriftDiffTable` component**

Add this small component at the top of `Inspector.tsx` (above the `Inspector` function, below the imports):

```tsx
function DriftDiffTable({
  metadata,
  tfMetadata
}: {
  metadata: Record<string, unknown>
  tfMetadata: Record<string, unknown>
}): React.JSX.Element {
  const allKeys = Array.from(new Set([...Object.keys(metadata), ...Object.keys(tfMetadata)]))
  const diffs = allKeys.filter(
    (k) =>
      String(metadata[k] ?? '') !== String(tfMetadata[k] ?? '') &&
      (metadata[k] !== undefined || tfMetadata[k] !== undefined)
  )

  return (
    <>
      <div style={{ fontWeight: 700, color: '#22c55e', marginBottom: diffs.length > 0 ? 6 : 0 }}>
        ✓ MATCHED
        {diffs.length > 0 ? ` — ${diffs.length} difference${diffs.length === 1 ? '' : 's'}` : ''}
      </div>
      {diffs.length === 0 ? (
        <div style={{ color: '#4ade80', fontSize: 10 }}>No differences detected</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1,
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 3,
            overflow: 'hidden',
            fontSize: 9
          }}
        >
          <div
            style={{
              padding: '3px 6px',
              color: '#6b7280',
              fontWeight: 700,
              fontSize: 8,
              background: 'rgba(0,0,0,0.2)'
            }}
          >
            LIVE
          </div>
          <div
            style={{
              padding: '3px 6px',
              color: '#7c3aed',
              fontWeight: 700,
              fontSize: 8,
              background: 'rgba(0,0,0,0.2)'
            }}
          >
            TERRAFORM
          </div>
          {diffs.map((k) => (
            <>
              <div
                key={`live-${k}`}
                style={{
                  padding: '3px 6px',
                  background: 'rgba(0,0,0,0.15)',
                  borderTop: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ color: '#6b7280', fontSize: 7, marginBottom: 1 }}>{k}</div>
                <div style={{ color: '#fca5a5' }}>{String(metadata[k] ?? '—')}</div>
              </div>
              <div
                key={`tf-${k}`}
                style={{
                  padding: '3px 6px',
                  background: 'rgba(0,0,0,0.15)',
                  borderTop: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ color: '#6b7280', fontSize: 7, marginBottom: 1 }}>{k}</div>
                <div style={{ color: '#86efac' }}>{String(tfMetadata[k] ?? '—')}</div>
              </div>
            </>
          ))}
        </div>
      )}
    </>
  )
}
```

Note: `<>` fragments with keys inside arrays will need React 19 or explicit key handling. If the linter complains, wrap each pair in a `<div key={k}>` wrapper instead.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: no errors. If there is a lint error about key inside fragment, wrap the `<>...</>` in `<div key={k} style={{ display: 'contents' }}>` or a `React.Fragment key={k}`:

```tsx
{diffs.map((k) => (
  <React.Fragment key={k}>
    <div style={...}>...</div>
    <div style={...}>...</div>
  </React.Fragment>
))}
```

- [ ] **Step 4: Full test suite + lint**

```bash
npm run lint 2>&1 | grep " error " | head -10
npm test 2>&1 | tail -5
```

Expected: 0 errors, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Inspector.tsx
git commit -m "feat(drift): add drift status section to Inspector (unmanaged/missing/matched with diff table)"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full lint check**

```bash
npm run lint 2>&1 | grep " error " | head -20
```

Expected: 0 errors.

- [ ] **Step 2: Full typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Full test suite**

```bash
npm test 2>&1 | tail -8
```

Expected: all tests PASS (should be 330+ tests now with the new compareDrift tests).

- [ ] **Step 4: Push**

```bash
git push
```
