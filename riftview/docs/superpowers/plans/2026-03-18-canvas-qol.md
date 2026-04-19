# Canvas QoL — Panning, Persistent Positions & Saved Views Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix canvas panning, persist dragged node positions across re-scans, and add 4 named saveable layout slots to the toolbar.

**Architecture:** UIStore gains per-view position override maps and 4 named view slots; both canvas views apply overrides when building flowNodes and write back on drag-end; CloudCanvas toolbar gains 4 slot buttons and a SaveViewModal for naming. TopologyView skips persisting child nodes (`extent: 'parent'`).

**Tech Stack:** React 18, Zustand, @xyflow/react (React Flow v12), Vitest + @testing-library/react, jsdom

---

## Chunk 1: UIStore additions + GraphView

### Task 1: UIStore — add position and saved view state

**Files:**
- Modify: `src/renderer/store/ui.ts`
- Create: `src/renderer/store/__tests__/ui.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/renderer/store/__tests__/ui.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUIStore } from '../ui'

beforeEach(() => {
  useUIStore.setState({
    nodePositions:  { topology: {}, graph: {} },
    savedViews:     [null, null, null, null],
    activeViewSlot: null,
  })
})

describe('setNodePosition', () => {
  it('saves position to the correct view map', () => {
    useUIStore.getState().setNodePosition('graph', 'vpc-1', { x: 100, y: 200 })
    expect(useUIStore.getState().nodePositions.graph['vpc-1']).toEqual({ x: 100, y: 200 })
  })

  it('topology and graph maps are independent', () => {
    useUIStore.getState().setNodePosition('topology', 'vpc-1', { x: 10, y: 20 })
    expect(useUIStore.getState().nodePositions.graph['vpc-1']).toBeUndefined()
  })

  it('does not change activeViewSlot', () => {
    useUIStore.setState({ activeViewSlot: 2 })
    useUIStore.getState().setNodePosition('graph', 'vpc-1', { x: 0, y: 0 })
    expect(useUIStore.getState().activeViewSlot).toBe(2)
  })
})

describe('saveView', () => {
  it('snapshots current view positions into the slot with the given name', () => {
    useUIStore.setState({
      nodePositions: { topology: { 'vpc-1': { x: 50, y: 60 } }, graph: {} },
    })
    useUIStore.getState().saveView(1, 'Prod Layout', 'topology')
    const slot = useUIStore.getState().savedViews[1]
    expect(slot).not.toBeNull()
    expect(slot!.name).toBe('Prod Layout')
    expect(slot!.positions['vpc-1']).toEqual({ x: 50, y: 60 })
  })

  it('sets activeViewSlot to the saved slot', () => {
    useUIStore.getState().saveView(2, 'Dev', 'graph')
    expect(useUIStore.getState().activeViewSlot).toBe(2)
  })

  it('does not modify other slots', () => {
    useUIStore.getState().saveView(0, 'A', 'topology')
    useUIStore.getState().saveView(1, 'B', 'topology')
    expect(useUIStore.getState().savedViews[0]!.name).toBe('A')
    expect(useUIStore.getState().savedViews[1]!.name).toBe('B')
    expect(useUIStore.getState().savedViews[2]).toBeNull()
  })
})

describe('loadView', () => {
  it('copies slot positions into the correct view map', () => {
    useUIStore.setState({
      nodePositions: { topology: { 'vpc-1': { x: 50, y: 60 } }, graph: {} },
    })
    useUIStore.getState().saveView(0, 'Layout A', 'topology')
    useUIStore.setState({ nodePositions: { topology: {}, graph: {} } })
    const fitViewFn = vi.fn()
    useUIStore.getState().loadView(0, 'topology', fitViewFn)
    expect(useUIStore.getState().nodePositions.topology['vpc-1']).toEqual({ x: 50, y: 60 })
  })

  it('sets activeViewSlot', () => {
    useUIStore.getState().saveView(3, 'X', 'graph')
    useUIStore.getState().loadView(3, 'graph', vi.fn())
    expect(useUIStore.getState().activeViewSlot).toBe(3)
  })

  it('calls the fitView callback', () => {
    useUIStore.getState().saveView(0, 'A', 'topology')
    const fitViewFn = vi.fn()
    useUIStore.getState().loadView(0, 'topology', fitViewFn)
    expect(fitViewFn).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/store/__tests__/ui.test.ts`
Expected: FAIL — `setNodePosition is not a function`

- [ ] **Step 3: Update UIStore**

Replace `src/renderer/store/ui.ts` entirely:

```ts
import { create } from 'zustand'

type ViewKey = 'topology' | 'graph'

interface SavedView {
  name:      string
  positions: Record<string, { x: number; y: number }>
}

interface UIState {
  view:            ViewKey
  selectedNodeId:  string | null
  activeCreate:    { resource: string; view: ViewKey; dropPosition?: { x: number; y: number } } | null
  toast:           { message: string; type: 'success' | 'error' } | null
  nodePositions:   { topology: Record<string, { x: number; y: number }>; graph: Record<string, { x: number; y: number }> }
  savedViews:      Array<SavedView | null>
  activeViewSlot:  number | null

  setView:         (view: ViewKey) => void
  selectNode:      (id: string | null) => void
  setActiveCreate: (val: UIState['activeCreate']) => void
  showToast:       (message: string, type?: 'success' | 'error') => void
  clearToast:      () => void
  setNodePosition: (view: ViewKey, id: string, pos: { x: number; y: number }) => void
  saveView:        (slot: number, name: string, view: ViewKey) => void
  loadView:        (slot: number, view: ViewKey, fitViewFn: () => void) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  view:           'topology',
  selectedNodeId: null,
  activeCreate:   null,
  toast:          null,
  nodePositions:  { topology: {}, graph: {} },
  savedViews:     [null, null, null, null],
  activeViewSlot: null,

  setView:         (view) => set({ view }),
  selectNode:      (id)   => set({ selectedNodeId: id }),
  setActiveCreate: (val)  => set({ activeCreate: val }),
  showToast: (message, type = 'success') => {
    set({ toast: { message, type } })
    setTimeout(() => set({ toast: null }), 2500)
  },
  clearToast: () => set({ toast: null }),

  setNodePosition: (view, id, pos) =>
    set((s) => ({
      nodePositions: {
        ...s.nodePositions,
        [view]: { ...s.nodePositions[view], [id]: pos },
      },
    })),

  saveView: (slot, name, view) => {
    const positions = { ...get().nodePositions[view] }
    set((s) => {
      const savedViews = [...s.savedViews] as Array<SavedView | null>
      savedViews[slot] = { name, positions }
      return { savedViews, activeViewSlot: slot }
    })
  },

  loadView: (slot, view, fitViewFn) => {
    const saved = get().savedViews[slot]
    if (!saved) return
    set((s) => ({
      nodePositions:  { ...s.nodePositions, [view]: { ...saved.positions } },
      activeViewSlot: slot,
    }))
    fitViewFn()
  },
}))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/store/__tests__/ui.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Run full suite to check nothing broke**

Run: `npx vitest run`
Expected: All existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/store/ui.ts src/renderer/store/__tests__/ui.test.ts
git commit -m "feat: add nodePositions, savedViews, saveView/loadView to UIStore"
```

---

### Task 2: GraphView — panning config, position overrides, one-time fitView

**Files:**
- Modify: `src/renderer/components/canvas/GraphView.tsx`
- Create: `src/renderer/components/canvas/__tests__/GraphView.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/renderer/components/canvas/__tests__/GraphView.test.tsx`:

```tsx
import { render, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GraphView } from '../GraphView'
import { useCloudStore } from '../../../store/cloud'
import { useUIStore } from '../../../store/ui'

const mockFitView = vi.fn()

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>()
  return {
    ...actual,
    ReactFlow: (_props: unknown) => <div data-testid="react-flow" />,
    useReactFlow: () => ({
      fitView: mockFitView,
      screenToFlowPosition: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    }),
  }
})

const vpc = (id: string) => ({
  id, type: 'vpc' as const, label: id, status: 'running' as const,
  region: 'us-east-1', metadata: {},
})

beforeEach(() => {
  mockFitView.mockClear()
  useCloudStore.setState({ nodes: [], pendingNodes: [] })
  useUIStore.setState({
    nodePositions: { topology: {}, graph: {} },
    savedViews: [null, null, null, null],
    activeViewSlot: null,
    selectedNodeId: null,
  })
})

describe('GraphView — one-time fitView', () => {
  it('does not call fitView on initial render with no nodes', () => {
    render(<GraphView onNodeContextMenu={vi.fn()} />)
    expect(mockFitView).not.toHaveBeenCalled()
  })

  it('calls fitView when nodes first become non-empty', () => {
    render(<GraphView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [vpc('vpc-1')] }) })
    expect(mockFitView).toHaveBeenCalledOnce()
  })

  it('does NOT call fitView again on subsequent node updates', () => {
    render(<GraphView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [vpc('vpc-1')] }) })
    mockFitView.mockClear()
    act(() => { useCloudStore.setState({ nodes: [vpc('vpc-1'), vpc('vpc-2')] }) })
    expect(mockFitView).not.toHaveBeenCalled()
  })

  it('calls fitView again after node count drops to 0 then rises', () => {
    render(<GraphView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [vpc('vpc-1')] }) })
    act(() => { useCloudStore.setState({ nodes: [] }) })
    mockFitView.mockClear()
    act(() => { useCloudStore.setState({ nodes: [vpc('vpc-1')] }) })
    expect(mockFitView).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/components/canvas/__tests__/GraphView.test.tsx`
Expected: FAIL — fitView called unexpectedly (the `fitView` prop currently triggers it)

- [ ] **Step 3: Modify GraphView**

Edit `src/renderer/components/canvas/GraphView.tsx`:

**3a.** Change line 1 React import to include `useRef` and `useEffect`:
```ts
import { useMemo, useCallback, useRef, useEffect } from 'react'
```

**3b.** Change line 2 `@xyflow/react` import to include `type NodeChange`:
```ts
import { ReactFlow, Background, MiniMap, useReactFlow, type Node, type Edge, type NodeChange } from '@xyflow/react'
```

**3c.** In the `GraphView` function body, after line 148 (`const { screenToFlowPosition } = useReactFlow()`), replace with:
```ts
  const { screenToFlowPosition, fitView } = useReactFlow()
  const nodePositions   = useUIStore((s) => s.nodePositions)
  const setNodePosition = useUIStore((s) => s.setNodePosition)

  // One-time fitView when nodes first appear (or re-appear after dropping to 0)
  const hasFitted = useRef(false)
  useEffect(() => {
    if (cloudNodes.length === 0) {
      hasFitted.current = false
      return
    }
    if (!hasFitted.current) {
      hasFitted.current = true
      fitView({ duration: 300 })
    }
  }, [cloudNodes.length, fitView])
```

**3d.** After the existing `onDrop` callback, add:
```ts
  // Persist drag-end positions (all nodes in GraphView are free-floating, no extent guard needed)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type === 'position' && change.position && !change.dragging) {
        setNodePosition('graph', change.id, change.position)
      }
    }
  }, [setNodePosition])
```

**3e.** Add `const graphPositions = nodePositions.graph` before the `flowNodes` useMemo.

**3f.** In the `flowNodes` useMemo, replace the `position` line with:
```ts
        position: graphPositions[n.id] ?? { x: (i % 5) * 175 + 40, y: Math.floor(i / 5) * 110 + 60 },
```
Add `graphPositions` to the dependency array.

**3g.** In `<ReactFlow>`, remove the `fitView` prop and add these three props + `onNodesChange`:
```tsx
      onNodesChange={onNodesChange}
      panOnScroll
      minZoom={0.1}
      maxZoom={2}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/components/canvas/__tests__/GraphView.test.tsx`
Expected: PASS — all 4 tests green

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/canvas/GraphView.tsx src/renderer/components/canvas/__tests__/GraphView.test.tsx
git commit -m "feat: GraphView — panning config, position persistence, one-time fitView"
```

---

## Chunk 2: TopologyView + SaveViewModal + CloudCanvas toolbar

### Task 3: TopologyView — panning config, position overrides (top-level only), one-time fitView

**Files:**
- Modify: `src/renderer/components/canvas/TopologyView.tsx`
- Create: `src/renderer/components/canvas/__tests__/TopologyView.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/renderer/components/canvas/__tests__/TopologyView.test.tsx`:

```tsx
import { render, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TopologyView } from '../TopologyView'
import { useCloudStore } from '../../../store/cloud'
import { useUIStore } from '../../../store/ui'
import type { NodeChange } from '@xyflow/react'

const mockFitView = vi.fn()
let capturedOnNodesChange: ((changes: NodeChange[]) => void) | undefined

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>()
  return {
    ...actual,
    ReactFlow: ({ onNodesChange }: { onNodesChange?: (changes: NodeChange[]) => void }) => {
      capturedOnNodesChange = onNodesChange
      return <div data-testid="react-flow" />
    },
    useReactFlow: () => ({
      fitView: mockFitView,
      screenToFlowPosition: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    }),
  }
})

const baseVpc = (id: string) => ({
  id, type: 'vpc' as const, label: id, status: 'running' as const,
  region: 'us-east-1', metadata: {},
})

beforeEach(() => {
  mockFitView.mockClear()
  capturedOnNodesChange = undefined
  useCloudStore.setState({ nodes: [], pendingNodes: [] })
  useUIStore.setState({
    nodePositions:  { topology: {}, graph: {} },
    savedViews:     [null, null, null, null],
    activeViewSlot: null,
    selectedNodeId: null,
  })
})

describe('TopologyView — one-time fitView', () => {
  it('does not call fitView on initial render with no nodes', () => {
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    expect(mockFitView).not.toHaveBeenCalled()
  })

  it('calls fitView when nodes first become non-empty', () => {
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1')] }) })
    expect(mockFitView).toHaveBeenCalledOnce()
  })

  it('does NOT call fitView again on subsequent node updates', () => {
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1')] }) })
    mockFitView.mockClear()
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1'), baseVpc('vpc-2')] }) })
    expect(mockFitView).not.toHaveBeenCalled()
  })

  it('calls fitView again after node count drops to 0 then rises', () => {
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1')] }) })
    act(() => { useCloudStore.setState({ nodes: [] }) })
    mockFitView.mockClear()
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1')] }) })
    expect(mockFitView).toHaveBeenCalledOnce()
  })
})

describe('TopologyView — position overrides (extent guard)', () => {
  it('does NOT persist position for a node not present in flowNodes', () => {
    // No cloud nodes loaded → flowNodes is empty → any drag event is skipped
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    act(() => {
      capturedOnNodesChange?.([
        { type: 'position', id: 'subnet-phantom', position: { x: 5, y: 5 }, dragging: false },
      ])
    })
    expect(useUIStore.getState().nodePositions.topology['subnet-phantom']).toBeUndefined()
  })

  it('persists position for a top-level VPC node after drag-end', () => {
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1')] }) })
    act(() => {
      capturedOnNodesChange?.([
        { type: 'position', id: 'vpc-1', position: { x: 300, y: 400 }, dragging: false },
      ])
    })
    expect(useUIStore.getState().nodePositions.topology['vpc-1']).toEqual({ x: 300, y: 400 })
  })

  it('does NOT persist mid-drag positions (dragging: true)', () => {
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1')] }) })
    act(() => {
      capturedOnNodesChange?.([
        { type: 'position', id: 'vpc-1', position: { x: 300, y: 400 }, dragging: true },
      ])
    })
    expect(useUIStore.getState().nodePositions.topology['vpc-1']).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/components/canvas/__tests__/TopologyView.test.tsx`
Expected: FAIL

- [ ] **Step 3: Modify TopologyView**

Edit `src/renderer/components/canvas/TopologyView.tsx`:

**3a.** Change line 1 React import to include `useRef`, `useEffect`, and ensure `useCallback` is present:
```ts
import { useMemo, useCallback, useRef, useEffect } from 'react'
```

**3b.** Add `type NodeChange` to the `@xyflow/react` import (line 2):
```ts
import { ReactFlow, Background, MiniMap, useReactFlow, type Node, type Edge, type NodeChange } from '@xyflow/react'
```

**3c.** In the `TopologyView` function body, replace line 346 (`const { screenToFlowPosition } = useReactFlow()`) with:
```ts
  const { screenToFlowPosition, fitView } = useReactFlow()
  const nodePositions   = useUIStore((s) => s.nodePositions)
  const setNodePosition = useUIStore((s) => s.setNodePosition)
```

**3d.** After the `onDrop` callback (around line 359), add:
```ts
  // One-time fitView when nodes first appear (or re-appear after dropping to 0)
  const hasFitted = useRef(false)
  useEffect(() => {
    if (cloudNodes.length === 0) {
      hasFitted.current = false
      return
    }
    if (!hasFitted.current) {
      hasFitted.current = true
      fitView({ duration: 300 })
    }
  }, [cloudNodes.length, fitView])
```

**3e.** After the `hasFitted` effect, add the `onNodesChange` handler:
```ts
  // Persist drag-end positions for top-level nodes only.
  // Child nodes carry extent: 'parent' in flowNodes — look up by id to check before saving.
  // (cloudNodes has no extent field; flowNodes does.)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type === 'position' && change.position && !change.dragging) {
        const rfNode = flowNodes.find((n) => n.id === change.id)
        if (!rfNode || rfNode.extent === 'parent') continue
        setNodePosition('topology', change.id, change.position)
      }
    }
  }, [setNodePosition, flowNodes])
```

**3f.** Replace the `flowNodes` useMemo (lines 375–378) with a version that applies position overrides:
```ts
  const topologyPositions = nodePositions.topology

  const flowNodes: Node[] = useMemo(() => {
    const raw = buildFlowNodes(allNodes, selectedId, highlightedIds)
    return raw.map((n) => {
      if (n.extent === 'parent') return n  // never override child nodes
      const saved = topologyPositions[n.id]
      return saved ? { ...n, position: saved } : n
    })
  }, [allNodes, selectedId, highlightedIds, topologyPositions])
```

**3g.** In `<ReactFlow>` (line 390+), remove `fitView` prop and add:
```tsx
      onNodesChange={onNodesChange}
      panOnScroll
      minZoom={0.1}
      maxZoom={2}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/components/canvas/__tests__/TopologyView.test.tsx`
Expected: PASS — all 7 tests green

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/canvas/TopologyView.tsx src/renderer/components/canvas/__tests__/TopologyView.test.tsx
git commit -m "feat: TopologyView — panning config, position persistence (top-level only), one-time fitView"
```

---

### Task 4: SaveViewModal component

**Files:**
- Create: `src/renderer/components/canvas/SaveViewModal.tsx`
- Create: `src/renderer/components/canvas/__tests__/SaveViewModal.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/renderer/components/canvas/__tests__/SaveViewModal.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SaveViewModal } from '../SaveViewModal'

describe('SaveViewModal', () => {
  it('renders with empty name for a new slot', () => {
    render(<SaveViewModal slot={0} initialName="" onSave={vi.fn()} onCancel={vi.fn()} />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
  })

  it('renders pre-filled when slot already has a name', () => {
    render(<SaveViewModal slot={2} initialName="Prod Layout" onSave={vi.fn()} onCancel={vi.fn()} />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Prod Layout')
  })

  it('enforces maxLength of 24 on the input', () => {
    render(<SaveViewModal slot={0} initialName="" onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '24')
  })

  it('shows the 1-based slot number in the title', () => {
    render(<SaveViewModal slot={2} initialName="" onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/slot 3/i)).toBeInTheDocument()
  })

  it('calls onSave with the typed name when Save is clicked', () => {
    const onSave = vi.fn()
    render(<SaveViewModal slot={1} initialName="" onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My Layout' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith('My Layout')
  })

  it('calls onCancel and does not call onSave when Cancel is clicked', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<SaveViewModal slot={0} initialName="Existing" onSave={onSave} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('submits on Enter key', () => {
    const onSave = vi.fn()
    render(<SaveViewModal slot={0} initialName="" onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Quick Save' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('Quick Save')
  })

  it('calls onCancel on Escape key', () => {
    const onCancel = vi.fn()
    render(<SaveViewModal slot={0} initialName="" onSave={vi.fn()} onCancel={onCancel} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/components/canvas/__tests__/SaveViewModal.test.tsx`
Expected: FAIL — `SaveViewModal` does not exist

- [ ] **Step 3: Implement SaveViewModal**

Create `src/renderer/components/canvas/SaveViewModal.tsx`:

```tsx
import { useState } from 'react'

interface Props {
  slot:        number
  initialName: string
  onSave:      (name: string) => void
  onCancel:    () => void
}

export function SaveViewModal({ slot, initialName, onSave, onCancel }: Props) {
  const [name, setName] = useState(initialName)

  const btnBase: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize:   '11px',
    borderRadius: '4px',
    padding:    '4px 16px',
    cursor:     'pointer',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background:   'var(--cb-bg-elevated)',
          border:       '1px solid var(--cb-border-strong)',
          borderRadius: '6px',
          padding:      '20px 24px',
          minWidth:     '280px',
          fontFamily:   'monospace',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, color: 'var(--cb-text)', marginBottom: 12 }}>
          Save View — Slot {slot + 1}
        </div>
        <input
          type="text"
          value={name}
          maxLength={24}
          placeholder="View name"
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  onSave(name)
            if (e.key === 'Escape') onCancel()
          }}
          style={{
            width:        '100%',
            boxSizing:    'border-box',
            background:   'var(--cb-bg)',
            border:       '1px solid var(--cb-border-strong)',
            borderRadius: '3px',
            color:        'var(--cb-text)',
            fontFamily:   'monospace',
            fontSize:     '12px',
            padding:      '5px 8px',
            marginBottom: 14,
            outline:      'none',
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ ...btnBase, background: 'transparent', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(name)}
            style={{ ...btnBase, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-accent)', color: 'var(--cb-accent)' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/components/canvas/__tests__/SaveViewModal.test.tsx`
Expected: PASS — all 8 tests green

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/canvas/SaveViewModal.tsx src/renderer/components/canvas/__tests__/SaveViewModal.test.tsx
git commit -m "feat: add SaveViewModal component"
```

---

### Task 5: CloudCanvas toolbar — saved view slot buttons

**Files:**
- Modify: `src/renderer/components/canvas/CloudCanvas.tsx`

- [ ] **Step 1: Read current CloudCanvas to confirm state before editing**

Read `src/renderer/components/canvas/CloudCanvas.tsx` in full.

- [ ] **Step 2: Add `SaveViewModal` import**

Add to the imports at the top of `CloudCanvas.tsx`:
```ts
import { SaveViewModal } from './SaveViewModal'
```

- [ ] **Step 3: Add UIStore selectors and modal state to CanvasInner**

In `CanvasInner`, after the existing store selectors (around line 33), add:
```ts
  const savedViews     = useUIStore((s) => s.savedViews)
  const activeViewSlot = useUIStore((s) => s.activeViewSlot)
  const saveView       = useUIStore((s) => s.saveView)
  const loadView       = useUIStore((s) => s.loadView)
  const [modalSlot, setModalSlot] = useState<number | null>(null)
```

- [ ] **Step 4: Add slot-click handler and modal-save handler**

After the `handleContextMenu` function, add:
```ts
  function handleSlotClick(slot: number): void {
    const saved = savedViews[slot]
    if (saved === null) {
      setModalSlot(slot)                                          // empty → open modal to create
    } else if (slot === activeViewSlot) {
      setModalSlot(slot)                                          // active → open modal to rename
    } else {
      loadView(slot, view, () => fitView({ duration: 300 }))     // saved non-active → load
    }
  }

  function handleModalSave(name: string): void {
    if (modalSlot === null) return
    saveView(modalSlot, name, view)
    setModalSlot(null)
  }

  const activeViewName = activeViewSlot !== null
    ? (savedViews[activeViewSlot]?.name ?? null)
    : null
```

- [ ] **Step 5: Add slot buttons and name label to toolbar**

After the view toggle buttons (the `(['topology', 'graph'] as const).map(...)` block, around line 101), add:

```tsx
        <div className="w-px h-3.5 bg-gray-700" />

        {/* Saved view slots */}
        {([0, 1, 2, 3] as const).map((slot) => {
          const saved    = savedViews[slot]
          const isActive = slot === activeViewSlot
          return (
            <button
              key={slot}
              onClick={() => handleSlotClick(slot)}
              title={saved?.name ?? `Empty slot ${slot + 1}`}
              style={{
                ...btnBase,
                background: isActive ? 'var(--cb-bg-elevated)' : 'transparent',
                border: `1px solid ${saved ? (isActive ? 'var(--cb-accent)' : 'var(--cb-border-strong)') : 'var(--cb-border)'}`,
                color:  saved ? (isActive ? 'var(--cb-accent)' : 'var(--cb-text-secondary)') : '#444',
                minWidth: '20px',
              }}
            >
              {slot + 1}
            </button>
          )
        })}

        {activeViewName && (
          <span style={{ fontSize: 10, color: 'var(--cb-text-muted)', fontFamily: 'monospace',
                         whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activeViewName}
          </span>
        )}
```

- [ ] **Step 6: Render SaveViewModal at the bottom of CanvasInner's JSX**

Just before the closing `</div>` of `CanvasInner` (after `<CanvasToast />`), add:

```tsx
      {modalSlot !== null && (
        <SaveViewModal
          slot={modalSlot}
          initialName={savedViews[modalSlot]?.name ?? ''}
          onSave={handleModalSave}
          onCancel={() => setModalSlot(null)}
        />
      )}
```

- [ ] **Step 7: Run full suite and typecheck**

Run: `npx vitest run`
Expected: All tests pass

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/canvas/CloudCanvas.tsx
git commit -m "feat: add saved view slot buttons (1–4) and SaveViewModal to canvas toolbar"
```
