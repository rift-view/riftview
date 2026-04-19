# Phase 1: Visual Command Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver three flag-gated features — STATUS_LANGUAGE (richer node health visuals), ACTION_RAIL (inline hover actions), COMMAND_BOARD (swim-lane operational view) — that transform the canvas from a diagram tool into an operational command board.

**Architecture:** All three features are independently enabled via `flag('FLAG_NAME')` from `src/renderer/utils/flags.ts` reading `VITE_FLAG_*` env vars at call time. No flags = no behavior change. Tasks 1–2 are fully independent. Task 3 (UIStore + ViewKey) is a prerequisite for Task 4 (CommandView). All changes are renderer-only — no IPC, no main process, no new NodeTypes.

**Tech Stack:** React 19 · TypeScript · Zustand 5 · React Flow v12 (@xyflow/react) · Tailwind CSS 4 · Vitest + RTL

---

## Working Directory

All commands run from `riftview/` (the directory containing `package.json`).

## Critical Constraints

- `flag()` reads `import.meta.env` at call time — `vi.stubEnv` works in tests, no caching
- `nodePositions` in UIStore stays typed as `{ topology: ...; graph: ... }` — CommandView uses a separate `commandPositions` flat record
- `setNodePosition`, `saveView`, `loadView`, `applyTidyLayout` explicitly typed as `'topology' | 'graph'` — narrowing them prevents type errors when ViewKey widens
- Tier-label React Flow nodes use `draggable: false` on the node object (per-node field), NOT global `nodesDraggable` prop
- `CommandView` does NOT wire up `onDrop` — drag-to-create is not supported in the command view
- The Command tab appears only in `CloudCanvas.tsx`'s toolbar, not in the Sidebar view switcher

---

## Task 1: STATUS_LANGUAGE

**Files:**
- Modify: `src/renderer/src/assets/main.css` — add three keyframe animations
- Modify: `src/renderer/components/canvas/nodes/ResourceNode.tsx` — flag-gated visual enhancements

**Completion criteria:** `flag('STATUS_LANGUAGE') = false` → ResourceNode renders identically to today. `flag('STATUS_LANGUAGE') = true` → error nodes pulse, pending/creating shimmer, stopped dims, deleting fade-pulses, unknown labels italic.

---

- [ ] **Step 1: Add CSS keyframe animations to `src/renderer/src/assets/main.css`**

Open the file and append these three keyframes at the end, inside a `prefers-reduced-motion` media query wrapper:

```css
/* ── Phase 1: STATUS_LANGUAGE animations ─────────────────────────────────── */

@media (prefers-reduced-motion: no-preference) {
  @keyframes cb-pulse-error {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    50%       { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.35); }
  }

  @keyframes cb-shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(200%); }
  }

  @keyframes cb-fade-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }
}

/* ActionRail hover visibility */
.resource-node .action-rail {
  opacity: 0;
  transition: opacity 150ms;
}
.resource-node:hover .action-rail {
  opacity: 1;
}
```

---

- [ ] **Step 2: Add STATUS_LANGUAGE enhancements to `ResourceNode.tsx`**

`ResourceNode.tsx` is at `src/renderer/components/canvas/nodes/ResourceNode.tsx`.

**2a.** Add the import for `flag` at the top, after the existing imports:
```ts
import { flag } from '../../../utils/flags'
```

**2b.** Add the `resource-node` CSS class and STATUS_LANGUAGE to the outer `<div>`, and add the shimmer child `<div>`. Replace the existing `export function ResourceNode({ data, selected }: NodeProps)` function signature with:

```ts
export function ResourceNode({ data, selected, dragging }: NodeProps): React.JSX.Element {
```

**2c.** After the existing `isImported` and `meta` declarations (around line 141–142), add:

```ts
const statusLang = flag('STATUS_LANGUAGE')

// Compute additional inline styles for STATUS_LANGUAGE feature
const statusLangStyle: React.CSSProperties = statusLang ? (() => {
  switch (d.status) {
    case 'error':
      return { animation: 'cb-pulse-error 2s ease-in-out infinite' }
    case 'stopped':
      return { opacity: d.dimmed ? 0.25 : 0.5 }
    case 'deleting':
      return { animation: 'cb-fade-pulse 1.5s ease-in-out infinite' }
    default:
      return {}
  }
})() : {}
```

**2d.** On the outer `<div>` (the one with `data-selected={selected}`), add the `resource-node` class and merge `statusLangStyle` into the style:

```tsx
<div
  data-selected={selected}
  data-status={d.status}
  className={`resource-node relative rounded${d.status === 'creating' ? ' animate-pulse' : ''}`}
  style={{
    background:   'var(--cb-bg-panel)',
    border:       `${selected ? '2px' : '1px'} ${isImported ? 'dashed' : 'solid'} ${borderColor}`,
    borderLeft:   `3px ${isImported ? 'dashed' : 'solid'} ${stripeColor}`,
    boxShadow:    selected ? `0 0 10px ${borderColor}55` : 'none',
    fontFamily:   'monospace',
    minWidth:     130,
    padding:      '6px 10px 6px 8px',
    opacity:      d.dimmed ? 0.25 : d.locked ? 0.6 : 1,
    filter:       d.dimmed ? 'grayscale(60%)' : d.locked ? 'grayscale(30%)' : 'none',
    transition:   'opacity 0.2s, filter 0.2s',
    ...statusLangStyle,
  }}
>
```

Note: `statusLangStyle` overrides `opacity` only for `stopped` status — the spread `...statusLangStyle` at the end is intentional.

**2e.** Add the shimmer overlay `<div>` immediately after the opening `<div>` tag (before the Handles), so it stacks correctly:

```tsx
{/* STATUS_LANGUAGE shimmer — pending/creating loading sweep */}
{statusLang && (d.status === 'pending' || d.status === 'creating') && (
  <div
    style={{
      position:      'absolute',
      inset:         0,
      overflow:      'hidden',
      pointerEvents: 'none',
      borderRadius:  'inherit',
    }}
  >
    <div
      style={{
        position:   'absolute',
        top:        0,
        bottom:     0,
        width:      '40%',
        background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.18), transparent)',
        animation:  'cb-shimmer 1.8s ease-in-out infinite',
      }}
    />
  </div>
)}
```

**2f.** For the `unknown` status italic label: find the resource label `<div>` (the one rendering `{d.label}`) and add a conditional `fontStyle`:

```tsx
<div
  className="text-[11px] font-medium leading-tight"
  title={d.label}
  style={{
    color:         'var(--cb-text-primary)',
    maxWidth:      140,
    overflow:      'hidden',
    textOverflow:  'ellipsis',
    whiteSpace:    'nowrap',
    fontStyle:     statusLang && d.status === 'unknown' ? 'italic' : 'normal',
  }}
>
  {d.label}
</div>
```

---

- [ ] **Step 3: Run typecheck and tests**

```bash
npm run typecheck && npm test
```

Expected: zero typecheck errors, all 855 tests pass.

---

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/assets/main.css src/renderer/components/canvas/nodes/ResourceNode.tsx
git commit -m "feat(status-language): flag-gated node health animations (pulse-error, shimmer, fade-pulse)"
```

---

## Task 2: ACTION_RAIL

**Files:**
- Create: `src/renderer/components/canvas/nodes/ActionRail.tsx` — copy ARN + open console hover strip
- Modify: `src/renderer/components/canvas/nodes/ResourceNode.tsx` — mount ActionRail when flag on
- Create: `tests/renderer/components/canvas/nodes/ActionRail.test.tsx` — TDD unit tests

**Completion criteria:** Hovering a ResourceNode when `ACTION_RAIL=true` shows a rail with "Copy ARN" (always) and "↗" console link (when URL available). Both buttons work. No rail when flag=false.

---

- [ ] **Step 1: Write the failing ActionRail tests**

Create `tests/renderer/components/canvas/nodes/ActionRail.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActionRail } from '../../../../src/renderer/components/canvas/nodes/ActionRail'
import type { CloudNode } from '../../../../src/renderer/types/cloud'

// Mock buildConsoleUrl
vi.mock('../../../../src/renderer/utils/buildConsoleUrl', () => ({
  buildConsoleUrl: vi.fn(),
}))
// Mock useUIStore.getState().showToast
vi.mock('../../../../src/renderer/store/ui', () => ({
  useUIStore: { getState: () => ({ showToast: vi.fn() }) },
}))

import { buildConsoleUrl } from '../../../../src/renderer/utils/buildConsoleUrl'

const mockBuildConsoleUrl = vi.mocked(buildConsoleUrl)

const baseNode: CloudNode = {
  id:     'arn:aws:lambda:us-east-1:123:function:my-fn',
  type:   'lambda',
  label:  'my-fn',
  status: 'running',
  region: 'us-east-1',
  metadata: {},
}

describe('ActionRail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock clipboard — configurable: true required so beforeEach can redefine on each run
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders Copy ARN button always', () => {
    mockBuildConsoleUrl.mockReturnValue(null)
    render(<ActionRail node={baseNode} onToast={vi.fn()} />)
    expect(screen.getByTitle('Copy ARN')).toBeTruthy()
  })

  it('copy ARN button calls clipboard.writeText with node.id', async () => {
    mockBuildConsoleUrl.mockReturnValue(null)
    const onToast = vi.fn()
    render(<ActionRail node={baseNode} onToast={onToast} />)
    fireEvent.click(screen.getByTitle('Copy ARN'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(baseNode.id)
  })

  it('copy ARN button calls onToast with success', async () => {
    mockBuildConsoleUrl.mockReturnValue(null)
    const onToast = vi.fn()
    render(<ActionRail node={baseNode} onToast={onToast} />)
    fireEvent.click(screen.getByTitle('Copy ARN'))
    // wait for promise
    await vi.waitFor(() => expect(onToast).toHaveBeenCalledWith('ARN copied', 'success'))
  })

  it('shows Open Console button when buildConsoleUrl returns a URL', () => {
    mockBuildConsoleUrl.mockReturnValue('https://console.aws.amazon.com/lambda')
    render(<ActionRail node={baseNode} onToast={vi.fn()} />)
    expect(screen.getByTitle('Open in AWS Console')).toBeTruthy()
  })

  it('does not show Open Console button when buildConsoleUrl returns null', () => {
    mockBuildConsoleUrl.mockReturnValue(null)
    render(<ActionRail node={baseNode} onToast={vi.fn()} />)
    expect(screen.queryByTitle('Open in AWS Console')).toBeNull()
  })

  it('copy ARN click stops propagation', () => {
    mockBuildConsoleUrl.mockReturnValue(null)
    const parentHandler = vi.fn()
    const { container } = render(
      <div onClick={parentHandler}>
        <ActionRail node={baseNode} onToast={vi.fn()} />
      </div>
    )
    fireEvent.click(container.querySelector('[title="Copy ARN"]')!)
    expect(parentHandler).not.toHaveBeenCalled()
  })
})
```

---

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/renderer/components/canvas/nodes/ActionRail.test.tsx
```

Expected: FAIL — `Cannot find module '.../ActionRail'`

---

- [ ] **Step 3: Create `src/renderer/components/canvas/nodes/ActionRail.tsx`**

```tsx
import { buildConsoleUrl } from '../../../utils/buildConsoleUrl'
import type { CloudNode } from '../../../types/cloud'

interface ActionRailProps {
  node:    CloudNode
  onToast: (msg: string, type: 'success' | 'error') => void
}

const btnStyle: React.CSSProperties = {
  background:    'var(--cb-bg-elevated)',
  border:        '1px solid var(--cb-border)',
  borderRadius:  3,
  color:         'var(--cb-text-secondary)',
  cursor:        'pointer',
  fontFamily:    'monospace',
  fontSize:      9,
  padding:       '2px 5px',
  lineHeight:    1,
}

export function ActionRail({ node, onToast }: ActionRailProps): React.JSX.Element {
  const consoleUrl = buildConsoleUrl(node)

  function handleCopyArn(e: React.MouseEvent): void {
    e.stopPropagation()
    void navigator.clipboard.writeText(node.id).then(() => {
      onToast('ARN copied', 'success')
    })
  }

  function handleOpenConsole(e: React.MouseEvent): void {
    e.stopPropagation()
    if (consoleUrl) window.open(consoleUrl, '_blank', 'noopener')
  }

  return (
    <div
      className="action-rail"
      style={{
        position:   'absolute',
        top:        -28,
        right:      0,
        display:    'flex',
        gap:        4,
        pointerEvents: 'auto',
      }}
    >
      <button
        style={btnStyle}
        title="Copy ARN"
        onClick={handleCopyArn}
      >
        ⌘
      </button>
      {consoleUrl && (
        <button
          style={btnStyle}
          title="Open in AWS Console"
          onClick={handleOpenConsole}
        >
          ↗
        </button>
      )}
    </div>
  )
}
```

---

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/renderer/components/canvas/nodes/ActionRail.test.tsx
```

Expected: 5/5 tests pass.

---

- [ ] **Step 5: Integrate ActionRail into `ResourceNode.tsx`**

Add the ActionRail import to `ResourceNode.tsx`:
```ts
import { ActionRail } from './ActionRail'
import { flag } from '../../../utils/flags'  // already added in Task 1; skip if present
```

Inside the `ResourceNode` function, add `actionRail = flag('ACTION_RAIL')` after the `statusLang` declaration:
```ts
const actionRail = flag('ACTION_RAIL')
```

Add the ActionRail render inside the outer `<div>`, before the Handles (right after the shimmer div block):
```tsx
{/* ACTION_RAIL — hover action strip */}
{actionRail && !dragging && (
  <ActionRail
    node={{ id: '', type: d.nodeType, label: d.label, status: d.status, region: d.region ?? '', metadata: d.metadata ?? {} }}
    onToast={(msg, type) => { void import('../../../store/ui').then(m => m.useUIStore.getState().showToast(msg, type)) }}
  />
)}
```

Wait — the `node` prop for ActionRail needs the full `CloudNode` shape (needs `id`). But `ResourceNode` only receives `data` which contains `label`, `nodeType`, `status`, `region`, `metadata`. The node's `id` is on the React Flow `NodeProps.id` field, not in `data`.

**Correction:** Destructure `id` from `NodeProps`:

```ts
export function ResourceNode({ id, data, selected, dragging }: NodeProps): React.JSX.Element {
```

Then pass `id` to `ActionRail`:
```tsx
{actionRail && !dragging && (
  <ActionRail
    node={{
      id:       id,
      type:     d.nodeType,
      label:    d.label,
      status:   d.status,
      region:   d.region ?? '',
      metadata: d.metadata ?? {},
    }}
    onToast={(msg, type) => useUIStore.getState().showToast(msg, type)}
  />
)}
```

Note: `useUIStore.getState()` is called synchronously inside the callback, which is fine since it's called at event time, not at render time.

---

- [ ] **Step 6: Run typecheck and full suite**

```bash
npm run typecheck && npm test
```

Expected: zero typecheck errors, all tests pass (855 + 5 new = 860+).

---

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/canvas/nodes/ActionRail.tsx \
        src/renderer/components/canvas/nodes/ResourceNode.tsx \
        tests/renderer/components/canvas/nodes/ActionRail.test.tsx
git commit -m "feat(action-rail): flag-gated hover action strip on ResourceNode (copy ARN, open console)"
```

---

## Task 3: UIStore + ViewKey Extension

**Files:**
- Modify: `src/renderer/store/ui.ts` — add `'command'` to ViewKey; add `commandPositions` + `setCommandPosition`; narrow `setNodePosition`/`saveView`/`loadView` to `'topology' | 'graph'`
- Modify: `src/renderer/components/canvas/CanvasContextMenu.tsx` — hide Tidy Layout when `view === 'command'`

**Completion criteria:** TypeScript accepts `view === 'command'`. `commandPositions` exists in store with a setter. `setNodePosition` rejects `'command'` as a view argument. Tidy layout hidden in context menu when in command view.

---

- [ ] **Step 1: Update `ViewKey` in `src/renderer/store/ui.ts`**

Line 13: change:
```ts
type ViewKey = 'topology' | 'graph'
```
to:
```ts
type ViewKey = 'topology' | 'graph' | 'command'
```

---

- [ ] **Step 2: Add `commandPositions` to UIState interface**

In the `UIState` interface, after `nodePositions`:
```ts
commandPositions:   Record<string, { x: number; y: number }>
setCommandPosition: (nodeId: string, pos: { x: number; y: number }) => void
```

---

- [ ] **Step 3: Narrow `setNodePosition`, `saveView`, `loadView` in UIState interface**

These three methods currently use `ViewKey` for the view param. Change them to explicit `'topology' | 'graph'` to prevent accidental calls with `'command'`:

```ts
setNodePosition: (view: 'topology' | 'graph', id: string, pos: { x: number; y: number }) => void
saveView:        (slot: number, name: string, view: 'topology' | 'graph') => void
loadView:        (slot: number, view: 'topology' | 'graph', fitViewFn: () => void) => void
```

(`applyTidyLayout` is already `'topology' | 'graph'` — no change needed.)

---

- [ ] **Step 4: Add `commandPositions` initial state and `setCommandPosition` implementation**

In the store initial state (after `nodePositions: { topology: {}, graph: {} },`):
```ts
commandPositions: {},
```

In the store methods (after `setNodePosition: ...`):
```ts
setCommandPosition: (nodeId, pos) =>
  set((s) => ({ commandPositions: { ...s.commandPositions, [nodeId]: pos } })),
```

---

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: zero errors. If TypeScript complains about `nodePositions[view]` somewhere, it means the narrowing is working — find the callsite and ensure it uses `'topology' | 'graph'` explicitly.

---

- [ ] **Step 6: Guard Tidy Layout in `CanvasContextMenu.tsx`**

In `CanvasContextMenu.tsx`, the `handleTidy` function and the Tidy Layout menu item should be hidden when `view === 'command'`. Find the tidy layout menu item block:

```tsx
<div
  style={{ ...itemStyle, borderBottom: '1px solid var(--cb-border-strong)' }}
  onClick={handleTidy}
  onMouseEnter={hoverOn}
  onMouseLeave={hoverOff}
>
  ⊞ &nbsp;Tidy Layout
</div>
```

Wrap it in a conditional:
```tsx
{view !== 'command' && (
  <div
    style={{ ...itemStyle, borderBottom: '1px solid var(--cb-border-strong)' }}
    onClick={handleTidy}
    onMouseEnter={hoverOn}
    onMouseLeave={hoverOff}
  >
    ⊞ &nbsp;Tidy Layout
  </div>
)}
```

---

- [ ] **Step 7: Run typecheck and tests**

```bash
npm run typecheck && npm test
```

Expected: zero typecheck errors, all tests pass.

---

- [ ] **Step 8: Commit**

```bash
git add src/renderer/store/ui.ts src/renderer/components/canvas/CanvasContextMenu.tsx
git commit -m "feat(command-board): extend ViewKey with 'command'; add commandPositions to UIStore; guard tidy layout"
```

---

## Task 4: COMMAND_BOARD — CommandView

**Files:**
- Create: `src/renderer/components/canvas/CommandView.tsx` — swim-lane layout, TierLabelNode, integration edges
- Modify: `src/renderer/components/canvas/CloudCanvas.tsx` — Command tab button + render CommandView
- Create: `tests/renderer/components/canvas/CommandView.test.tsx` — TDD unit tests for buildCommandNodes

**Completion criteria:** `flag('COMMAND_BOARD') = false` → no Command tab visible. `flag('COMMAND_BOARD') = true` → Command tab appears, clicking it renders CommandView with tier swim lanes.

---

- [ ] **Step 1: Write failing CommandView tests**

Create `tests/renderer/components/canvas/CommandView.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildCommandNodes, NODE_TIER } from '../../../../src/renderer/components/canvas/CommandView'
import type { CloudNode } from '../../../../src/renderer/types/cloud'

function makeNode(type: CloudNode['type'], id = `id-${type}`): CloudNode {
  return { id, type, label: type, status: 'running', region: 'us-east-1', metadata: {} }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('NODE_TIER', () => {
  it('places lambda in tier 2', () => {
    expect(NODE_TIER['lambda']).toBe(2)
  })

  it('places rds in tier 3', () => {
    expect(NODE_TIER['rds']).toBe(3)
  })

  it('places sqs in tier 4', () => {
    expect(NODE_TIER['sqs']).toBe(4)
  })
})

describe('buildCommandNodes', () => {
  it('returns empty array for empty input', () => {
    expect(buildCommandNodes([])).toEqual([])
  })

  it('places lambda nodes as type "resource"', () => {
    const nodes = buildCommandNodes([makeNode('lambda')])
    const resourceNodes = nodes.filter(n => n.type === 'resource')
    expect(resourceNodes).toHaveLength(1)
  })

  it('includes a tier-label node for each occupied tier', () => {
    // lambda (tier 2) and rds (tier 3) → 2 tier labels
    const nodes = buildCommandNodes([makeNode('lambda'), makeNode('rds')])
    const tierLabels = nodes.filter(n => n.type === 'tier-label')
    expect(tierLabels).toHaveLength(2)
  })

  it('excludes vpc from output nodes', () => {
    const nodes = buildCommandNodes([makeNode('vpc')])
    const resourceNodes = nodes.filter(n => n.type === 'resource')
    expect(resourceNodes).toHaveLength(0)
  })

  it('excludes subnet from output nodes', () => {
    const nodes = buildCommandNodes([makeNode('subnet')])
    const resourceNodes = nodes.filter(n => n.type === 'resource')
    expect(resourceNodes).toHaveLength(0)
  })

  it('excludes security-group from output nodes', () => {
    const nodes = buildCommandNodes([makeNode('security-group')])
    const resourceNodes = nodes.filter(n => n.type === 'resource')
    expect(resourceNodes).toHaveLength(0)
  })

  it('excludes nat-gateway from output nodes', () => {
    const nodes = buildCommandNodes([makeNode('nat-gateway')])
    const resourceNodes = nodes.filter(n => n.type === 'resource')
    expect(resourceNodes).toHaveLength(0)
  })

  it('places unmapped type (unknown) in tier 6', () => {
    const nodes = buildCommandNodes([makeNode('unknown')])
    const tierLabels = nodes.filter(n => n.type === 'tier-label')
    // Tier 6 label should be present
    expect(tierLabels.some(n => (n.data as { name: string }).name === 'Other')).toBe(true)
  })

  it('tier-label nodes have draggable: false', () => {
    const nodes = buildCommandNodes([makeNode('lambda')])
    const tierLabel = nodes.find(n => n.type === 'tier-label')
    expect(tierLabel?.draggable).toBe(false)
  })

  it('resource nodes are positioned in a grid within their tier', () => {
    const n1 = makeNode('lambda', 'lam-1')
    const n2 = makeNode('ec2', 'ec2-1')
    const nodes = buildCommandNodes([n1, n2])
    const resourceNodes = nodes.filter(n => n.type === 'resource')
    // Both in tier 2 — they should have different x positions
    expect(resourceNodes[0].position.x).not.toBe(resourceNodes[1].position.x)
  })
})
```

---

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/renderer/components/canvas/CommandView.test.tsx
```

Expected: FAIL — `Cannot find module '.../CommandView'`

---

- [ ] **Step 3: Create `src/renderer/components/canvas/CommandView.tsx`**

```tsx
import { useMemo, useState, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  type Node,
  type Edge,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import { ResourceNode } from './nodes/ResourceNode'
import type { CloudNode, NodeType } from '../../types/cloud'

// ── Tier mapping ──────────────────────────────────────────────────────────────

export const NODE_TIER: Partial<Record<NodeType, number>> = {
  // Tier 0 — Internet / DNS
  'igw': 0, 'cloudfront': 0, 'acm': 0, 'r53-zone': 0,

  // Tier 1 — Edge / Gateway
  'alb': 1, 'apigw': 1, 'apigw-route': 1,

  // Tier 2 — Compute
  'lambda': 2, 'ec2': 2, 'ecs': 2, 'eks': 2,

  // Tier 3 — Data
  'rds': 3, 'dynamo': 3, 's3': 3, 'opensearch': 3, 'kinesis': 3, 'elasticache': 3, 'msk': 3,

  // Tier 4 — Messaging
  'sqs': 4, 'sns': 4, 'eventbridge-bus': 4, 'sfn': 4, 'ses': 4,

  // Tier 5 — Config / Identity
  'ssm-param': 5, 'secret': 5, 'cognito': 5, 'ecr-repo': 5,
}

const DEFAULT_TIER = 6

const EXCLUDED: Set<NodeType> = new Set(['vpc', 'subnet', 'security-group', 'nat-gateway'])

const TIER_NAMES = ['Internet', 'Edge', 'Compute', 'Data', 'Messaging', 'Config', 'Other'] as const

// ── Layout constants ──────────────────────────────────────────────────────────

const CMD_NODE_W  = 150
const CMD_NODE_H  = 66
const CMD_GAP_X   = 12
const CMD_COLS    = 8
const CMD_TIER_H  = CMD_NODE_H + 80   // node height + gap including label space
const LANE_TOP    = 60
const LANE_X      = 200               // left margin for tier labels

// ── buildCommandNodes — pure function ────────────────────────────────────────

export function buildCommandNodes(cloudNodes: CloudNode[]): Node[] {
  const serviceable = cloudNodes.filter((n) => !EXCLUDED.has(n.type as NodeType))

  // Group by tier
  const byTier = new Map<number, CloudNode[]>()
  for (const n of serviceable) {
    const tier = NODE_TIER[n.type as NodeType] ?? DEFAULT_TIER
    if (!byTier.has(tier)) byTier.set(tier, [])
    byTier.get(tier)!.push(n)
  }

  if (byTier.size === 0) return []

  const result: Node[] = []

  for (const [tier, nodes] of [...byTier.entries()].sort((a, b) => a[0] - b[0])) {
    const tierY = LANE_TOP + tier * CMD_TIER_H

    // Tier label node
    result.push({
      id:       `__tier_label_${tier}__`,
      type:     'tier-label',
      position: { x: 0, y: tierY },
      draggable: false,
      selectable: false,
      data:     { name: TIER_NAMES[tier] ?? `Tier ${tier}` },
    })

    // Resource nodes in a grid
    nodes.forEach((node, idx) => {
      const col = idx % CMD_COLS
      const row = Math.floor(idx / CMD_COLS)
      result.push({
        id:       node.id,
        type:     'resource',
        position: {
          x: LANE_X + col * (CMD_NODE_W + CMD_GAP_X),
          y: tierY + row * (CMD_NODE_H + 12),
        },
        data: {
          label:    node.label,
          nodeType: node.type,
          status:   node.status,
          region:   node.region,
          metadata: node.metadata,
        },
      })
    })
  }

  return result
}

// ── TierLabelNode ─────────────────────────────────────────────────────────────

function TierLabelNode({ data }: { data: { name: string } }): React.JSX.Element {
  return (
    <div
      style={{
        fontFamily:    'monospace',
        fontSize:      9,
        fontWeight:    700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color:         'var(--cb-text-muted)',
        padding:       '0 8px',
        width:         LANE_X - 8,
        textAlign:     'right',
        userSelect:    'none',
        pointerEvents: 'none',
      }}
    >
      {data.name}
    </div>
  )
}

const nodeTypes = {
  resource:    ResourceNode,
  'tier-label': TierLabelNode,
} as const

// ── Integration edges ─────────────────────────────────────────────────────────

function buildCommandEdges(cloudNodes: CloudNode[], showIntegrations: boolean): Edge[] {
  if (!showIntegrations) return []
  const edges: Edge[] = []
  for (const node of cloudNodes) {
    if (!node.integrations) continue
    for (const { targetId, edgeType } of node.integrations) {
      edges.push({
        id:        `cmd-${node.id}-${targetId}`,
        source:    node.id,
        target:    targetId,
        type:      'default',
        animated:  edgeType === 'trigger',
        style:     { stroke: edgeType === 'trigger' ? '#64b5f6' : '#555', strokeWidth: 1.2 },
      })
    }
  }
  return edges
}

// ── CommandView ───────────────────────────────────────────────────────────────

interface Props {
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}

export function CommandView({ onNodeContextMenu }: Props): React.JSX.Element {
  const nodes              = useCloudStore((s) => s.nodes)
  const showIntegrations   = useUIStore((s) => s.showIntegrations)
  const commandPositions   = useUIStore((s) => s.commandPositions)
  const setCommandPosition = useUIStore((s) => s.setCommandPosition)
  const selectedNodeId     = useUIStore((s) => s.selectedNodeId)
  const selectNode         = useUIStore((s) => s.selectNode)

  const [livePositions, setLivePositions] = useState<Record<string, XYPosition>>({})

  const baseNodes = useMemo(() => buildCommandNodes(nodes), [nodes])

  const flowNodes = useMemo(() => {
    return baseNodes.map((n) => {
      if (n.type === 'tier-label') return n
      const stored = commandPositions[n.id]
      const live   = livePositions[n.id]
      const pos    = live ?? stored ?? n.position
      return { ...n, position: pos, selected: n.id === selectedNodeId }
    })
  }, [baseNodes, commandPositions, livePositions, selectedNodeId])

  const flowEdges = useMemo(() => buildCommandEdges(nodes, showIntegrations), [nodes, showIntegrations])

  // Handle drag position changes only — selection is tracked via useUIStore.selectNode
  // (same pattern as TopologyView: store drives selected state, not applyNodeChanges)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const dragChanges = changes.filter(
      (c): c is NodeChange & { type: 'position'; position: XYPosition; dragging: boolean } =>
        c.type === 'position' && 'position' in c && c.position !== undefined
    )

    const dragging  = dragChanges.filter((c) => c.dragging)
    const dragEnded = dragChanges.filter((c) => !c.dragging)

    if (dragging.length > 0) {
      setLivePositions((prev) => {
        const next = { ...prev }
        for (const c of dragging) next[c.id] = c.position!
        return next
      })
    }

    if (dragEnded.length > 0) {
      for (const c of dragEnded) setCommandPosition(c.id, c.position!)
      setLivePositions((prev) => {
        const next = { ...prev }
        for (const c of dragEnded) delete next[c.id]
        return next
      })
    }
  }, [setCommandPosition])

  // Context strip counts
  const vpcCount    = nodes.filter((n) => n.type === 'vpc').length
  const subnetCount = nodes.filter((n) => n.type === 'subnet').length
  const sgCount     = nodes.filter((n) => n.type === 'security-group').length
  const region      = nodes[0]?.region ?? ''

  return (
    <div className="flex flex-col w-full h-full">
      {/* Context strip */}
      {(vpcCount > 0 || subnetCount > 0 || sgCount > 0) && (
        <div
          style={{
            padding:    '2px 12px',
            fontFamily: 'monospace',
            fontSize:   9,
            color:      'var(--cb-text-muted)',
            background: 'var(--cb-bg-panel)',
            borderBottom: '1px solid var(--cb-border)',
            flexShrink: 0,
          }}
        >
          {vpcCount > 0 && <span>{vpcCount} VPC{vpcCount !== 1 ? 's' : ''} · </span>}
          {subnetCount > 0 && <span>{subnetCount} subnet{subnetCount !== 1 ? 's' : ''} · </span>}
          {sgCount > 0 && <span>{sgCount} security group{sgCount !== 1 ? 's' : ''}</span>}
          {region && <span style={{ marginLeft: 12 }}>{region}</span>}
        </div>
      )}

      <div className="flex-1">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_e, node) => selectNode(node.id)}
          onPaneClick={() => selectNode(null)}
          onNodeContextMenu={(e, node) => {
            const cloudNode = nodes.find((n) => n.id === node.id)
            if (cloudNode) onNodeContextMenu(cloudNode, e.clientX, e.clientY)
          }}
          fitView
          minZoom={0.1}
          maxZoom={2}
        >
          <Background gap={20} color="var(--cb-border)" />
          <MiniMap
            style={{ background: 'var(--cb-minimap-bg)' }}
            nodeColor="var(--cb-border-strong)"
          />
        </ReactFlow>
      </div>
    </div>
  )
}
```

---

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/renderer/components/canvas/CommandView.test.tsx
```

Expected: all tests pass.

---

- [ ] **Step 5: Add Command tab to `CloudCanvas.tsx`**

`CloudCanvas.tsx` is at `src/renderer/components/canvas/CloudCanvas.tsx`.

**5a.** Add imports at the top:
```ts
import { CommandView } from './CommandView'
import { flag } from '../../utils/flags'
```

**5b.** In `CanvasInner`, after the existing `const setView` line, add:
```ts
const showCommandTab = flag('COMMAND_BOARD')
```

**5c.** Find the view button block (lines ~142-150):
```tsx
{(['topology', 'graph'] as const).map((v) => (
  <button
    key={v}
    onClick={() => setView(v)}
    style={{ ...btnBase, background: view === v ? 'var(--cb-bg-elevated)' : 'transparent', border: `1px solid ${view === v ? '#64b5f6' : 'var(--cb-border)'}`, color: view === v ? '#64b5f6' : '#666' }}
  >
    {v === 'topology' ? '⊞ Topology' : '◈ Graph'}
  </button>
))}
```

Replace with:
```tsx
{(['topology', 'graph'] as const).map((v) => (
  <button
    key={v}
    onClick={() => setView(v)}
    style={{ ...btnBase, background: view === v ? 'var(--cb-bg-elevated)' : 'transparent', border: `1px solid ${view === v ? '#64b5f6' : 'var(--cb-border)'}`, color: view === v ? '#64b5f6' : '#666' }}
  >
    {v === 'topology' ? '⊞ Topology' : '◈ Graph'}
  </button>
))}
{showCommandTab && (
  <button
    onClick={() => setView('command')}
    style={{ ...btnBase, background: view === 'command' ? 'var(--cb-bg-elevated)' : 'transparent', border: `1px solid ${view === 'command' ? '#a78bfa' : 'var(--cb-border)'}`, color: view === 'command' ? '#a78bfa' : '#666' }}
  >
    ⌘ Command
  </button>
)}
```

**5d.** Find the view render block (lines ~179-182):
```tsx
{view === 'topology'
  ? <TopologyView onNodeContextMenu={onNodeContextMenu} />
  : <GraphView onNodeContextMenu={onNodeContextMenu} />
}
```

Replace with:
```tsx
{view === 'topology'
  ? <TopologyView onNodeContextMenu={onNodeContextMenu} />
  : view === 'command'
    ? <CommandView onNodeContextMenu={onNodeContextMenu} />
    : <GraphView onNodeContextMenu={onNodeContextMenu} />
}
```

---

- [ ] **Step 6: Run typecheck and full test suite**

```bash
npm run typecheck && npm test
```

Expected: zero typecheck errors, all tests pass (860+ total).

---

- [ ] **Step 7: Smoke test the Command view manually (optional but recommended)**

```bash
npm run dev
```

Set `VITE_FLAG_COMMAND_BOARD=true` in `.env.local`, start the app, connect to AWS (or LocalStack), scan. Click "⌘ Command" in the toolbar — swim lanes should appear with tier labels on the left.

---

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/canvas/CommandView.tsx \
        src/renderer/components/canvas/CloudCanvas.tsx \
        tests/renderer/components/canvas/CommandView.test.tsx
git commit -m "feat(command-board): swim-lane Command view with tier layout, TierLabelNode, integration edges"
```

---

## Phase 1 Final Verification

Run after all 4 tasks are complete:

```bash
echo "=== Typecheck ==="
npm run typecheck
# Must exit 0

echo "=== Full test suite ==="
npm test
# Must pass all tests (860+ expected)

echo "=== No riftview remainders ==="
grep -r "window\.riftview" src tests --include="*.ts" --include="*.tsx" | wc -l
# Must be 0

echo "=== Feature flags default off ==="
npm test -- tests/renderer/utils/flags.test.ts
# Must pass (flags return false by default)

echo "=== Stories still work ==="
npm run stories -- --help 2>&1 | head -2
# Must show Ladle help
```

**Foreman sign-off required before Phase 1 is marked complete.**
