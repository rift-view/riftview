# Phase 2: Guided Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a flag-gated REMEDIATE section to the Inspector that generates and executes CLI commands to reconcile drift-detected resources back to their Terraform baseline.

**Architecture:** Two new files (`buildRemediateCommands.ts` + test), two modified files (`Inspector.tsx` + `App.tsx`), and one new test file for the Inspector section. The pure function is built and tested first; the UI wires in second. No new IPC channels.

**Tech Stack:** TypeScript, React, Vitest + RTL, existing `window.terminus.runCli(commands: string[][])` IPC

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/renderer/utils/buildRemediateCommands.ts` | Pure fn: `CloudNode → string[][]` |
| Create | `tests/renderer/utils/buildRemediateCommands.test.ts` | Unit tests — all cases, no mocks |
| Modify | `src/renderer/components/Inspector.tsx` | Add `onRemediate` prop + REMEDIATE section |
| Modify | `src/renderer/src/App.tsx` | Add `handleRemediate`, pass to `<Inspector>` |
| Create | `tests/renderer/components/Inspector.remediate.test.tsx` | Integration: visibility + execution states |

---

## Task 1: `buildRemediateCommands` — pure function + tests

**Files:**
- Create: `tests/renderer/utils/buildRemediateCommands.test.ts`
- Create: `src/renderer/utils/buildRemediateCommands.ts`

### Background

The function takes a `CloudNode` and returns `string[][]` — each inner array is one `aws` CLI invocation's argv (without the `aws` prefix, matching the existing `buildDeleteCommands` / `buildEditCommands` convention).

| driftStatus | Behaviour |
|---|---|
| `'unmanaged'` | Delegates to `buildDeleteCommands(node)` |
| `'matched'` | Diffs `node.metadata` vs `node.tfMetadata`; emits update commands for supported fields |
| `'missing'` / undefined | Returns `[]` |

Supported fields for `matched`:

| NodeType | Key | Command |
|---|---|---|
| `lambda` | `runtime` | `lambda update-function-configuration --function-name {node.id} --runtime {tfVal}` |
| `lambda` | `memorySize` | `lambda update-function-configuration --function-name {node.id} --memory-size {tfVal}` |
| `lambda` | `timeout` | `lambda update-function-configuration --function-name {node.id} --timeout {tfVal}` |
| `ec2` | `instanceType` | stop (if running) + `ec2 modify-instance-attribute --instance-id {node.id} --instance-type Value={tfVal}` + start (if running) |
| `rds` | `instanceClass` | `rds modify-db-instance --db-instance-identifier {node.id} --db-instance-class {tfVal} --apply-immediately` |

**Multiple Lambda diffs** are merged into one `update-function-configuration` command with all changed flags combined.

EC2 stop/start only emitted when `node.status === 'running'`.

Defensive guard: if `driftStatus === 'matched'` but `node.tfMetadata` is `undefined`, return `[]`.

---

- [ ] **Step 1: Write the failing tests**

Create `tests/renderer/utils/buildRemediateCommands.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildRemediateCommands } from '../../../src/renderer/utils/buildRemediateCommands'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function node(overrides: Partial<CloudNode>): CloudNode {
  return {
    id: 'test-id',
    label: 'test-label',
    type: 'lambda',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides,
  } as CloudNode
}

describe('buildRemediateCommands', () => {
  // ── unmanaged ──────────────────────────────────────────────────────────
  it('unmanaged lambda → delete command', () => {
    const result = buildRemediateCommands(node({ type: 'lambda', driftStatus: 'unmanaged' }))
    expect(result).toEqual([['lambda', 'delete-function', '--function-name', 'test-id']])
  })

  it('unmanaged eventbridge default bus → []', () => {
    const result = buildRemediateCommands(
      node({ type: 'eventbridge-bus', label: 'default', driftStatus: 'unmanaged' })
    )
    expect(result).toEqual([])
  })

  // ── missing / no status ────────────────────────────────────────────────
  it('missing node → []', () => {
    expect(buildRemediateCommands(node({ driftStatus: 'missing' }))).toEqual([])
  })

  it('no driftStatus → []', () => {
    expect(buildRemediateCommands(node({}))).toEqual([])
  })

  it('matched with no tfMetadata → []', () => {
    expect(buildRemediateCommands(node({ driftStatus: 'matched', tfMetadata: undefined }))).toEqual([])
  })

  // ── matched lambda ─────────────────────────────────────────────────────
  it('matched lambda runtime diff → update-function-configuration --runtime', () => {
    const result = buildRemediateCommands(
      node({
        driftStatus: 'matched',
        metadata: { runtime: 'python3.9' },
        tfMetadata: { runtime: 'python3.11' },
      })
    )
    expect(result).toEqual([
      ['lambda', 'update-function-configuration', '--function-name', 'test-id', '--runtime', 'python3.11'],
    ])
  })

  it('matched lambda memorySize + timeout diff → single merged command', () => {
    const result = buildRemediateCommands(
      node({
        driftStatus: 'matched',
        metadata: { memorySize: '128', timeout: '3' },
        tfMetadata: { memorySize: '512', timeout: '30' },
      })
    )
    expect(result).toHaveLength(1)
    const cmd = result[0]
    expect(cmd.slice(0, 2)).toEqual(['lambda', 'update-function-configuration'])
    expect(cmd).toContain('--memory-size')
    expect(cmd).toContain('512')
    expect(cmd).toContain('--timeout')
    expect(cmd).toContain('30')
  })

  it('matched lambda unsupported key only → []', () => {
    const result = buildRemediateCommands(
      node({
        driftStatus: 'matched',
        metadata: { tags: '{}' },
        tfMetadata: { tags: '{"env":"prod"}' },
      })
    )
    expect(result).toEqual([])
  })

  // ── matched ec2 ────────────────────────────────────────────────────────
  it('matched ec2 instanceType diff, status running → stop + modify + start', () => {
    const result = buildRemediateCommands(
      node({
        id: 'i-abc123',
        type: 'ec2',
        status: 'running',
        driftStatus: 'matched',
        metadata: { instanceType: 't3.small' },
        tfMetadata: { instanceType: 't3.medium' },
      })
    )
    expect(result).toEqual([
      ['ec2', 'stop-instances', '--instance-ids', 'i-abc123'],
      ['ec2', 'modify-instance-attribute', '--instance-id', 'i-abc123', '--instance-type', 'Value=t3.medium'],
      ['ec2', 'start-instances', '--instance-ids', 'i-abc123'],
    ])
  })

  it('matched ec2 instanceType diff, status stopped → modify only', () => {
    const result = buildRemediateCommands(
      node({
        id: 'i-abc123',
        type: 'ec2',
        status: 'stopped',
        driftStatus: 'matched',
        metadata: { instanceType: 't3.small' },
        tfMetadata: { instanceType: 't3.medium' },
      })
    )
    expect(result).toEqual([
      ['ec2', 'modify-instance-attribute', '--instance-id', 'i-abc123', '--instance-type', 'Value=t3.medium'],
    ])
  })

  // ── matched rds ────────────────────────────────────────────────────────
  it('matched rds instanceClass diff → modify-db-instance --apply-immediately', () => {
    const result = buildRemediateCommands(
      node({
        id: 'my-db',
        type: 'rds',
        driftStatus: 'matched',
        metadata: { instanceClass: 'db.t3.small' },
        tfMetadata: { instanceClass: 'db.t3.medium' },
      })
    )
    expect(result).toEqual([
      ['rds', 'modify-db-instance', '--db-instance-identifier', 'my-db', '--db-instance-class', 'db.t3.medium', '--apply-immediately'],
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npx vitest run tests/renderer/utils/buildRemediateCommands.test.ts 2>&1 | tail -20
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `buildRemediateCommands.ts`**

Create `src/renderer/utils/buildRemediateCommands.ts`:

```ts
import type { CloudNode } from '../types/cloud'
import { buildDeleteCommands } from './buildDeleteCommands'

export function buildRemediateCommands(node: CloudNode): string[][] {
  if (node.driftStatus === 'unmanaged') {
    return buildDeleteCommands(node)
  }

  if (node.driftStatus === 'matched') {
    if (!node.tfMetadata) return []
    return buildMatchedCommands(node)
  }

  return []
}

function buildMatchedCommands(node: CloudNode): string[][] {
  const live = node.metadata
  const tf   = node.tfMetadata as Record<string, unknown>

  function diffed(key: string): string | null {
    const liveVal = String(live[key] ?? '')
    const tfVal   = String(tf[key] ?? '')
    return liveVal !== tfVal && tf[key] !== undefined ? tfVal : null
  }

  if (node.type === 'lambda') {
    const runtimeVal  = diffed('runtime')
    const memoryVal   = diffed('memorySize')
    const timeoutVal  = diffed('timeout')

    if (!runtimeVal && !memoryVal && !timeoutVal) return []

    const cmd = ['lambda', 'update-function-configuration', '--function-name', node.id]
    if (runtimeVal)  cmd.push('--runtime',     runtimeVal)
    if (memoryVal)   cmd.push('--memory-size',  memoryVal)
    if (timeoutVal)  cmd.push('--timeout',      timeoutVal)
    return [cmd]
  }

  if (node.type === 'ec2') {
    const instanceTypeVal = diffed('instanceType')
    if (!instanceTypeVal) return []

    const modify = ['ec2', 'modify-instance-attribute', '--instance-id', node.id, '--instance-type', `Value=${instanceTypeVal}`]

    if (node.status === 'running') {
      return [
        ['ec2', 'stop-instances',  '--instance-ids', node.id],
        modify,
        ['ec2', 'start-instances', '--instance-ids', node.id],
      ]
    }
    return [modify]
  }

  if (node.type === 'rds') {
    const instanceClassVal = diffed('instanceClass')
    if (!instanceClassVal) return []
    return [['rds', 'modify-db-instance', '--db-instance-identifier', node.id, '--db-instance-class', instanceClassVal, '--apply-immediately']]
  }

  return []
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npx vitest run tests/renderer/utils/buildRemediateCommands.test.ts 2>&1 | tail -20
```

Expected: 11 tests PASS

- [ ] **Step 5: Typecheck**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm run typecheck 2>&1 | tail -20
```

Expected: exit 0

- [ ] **Step 6: Full test suite**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm test 2>&1 | tail -10
```

Expected: 874 + 11 = 885 passing

- [ ] **Step 7: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
git add src/renderer/utils/buildRemediateCommands.ts tests/renderer/utils/buildRemediateCommands.test.ts
git commit -m "feat(phase2): buildRemediateCommands pure function + tests"
```

---

## Task 2: Inspector REMEDIATE section + App.tsx wiring

**Files:**
- Modify: `src/renderer/components/Inspector.tsx` (add `onRemediate` prop + REMEDIATE section)
- Modify: `src/renderer/src/App.tsx` (add `handleRemediate`, pass to Inspector)
- Create: `tests/renderer/components/Inspector.remediate.test.tsx`

### Background

**Insert point in Inspector.tsx:** After the drift banners block (currently lines 194–212) and before `{/* node type header */}` (line 214). The REMEDIATE section is only rendered when `flag('EXECUTION_ENGINE')` is true AND `node.driftStatus` is `'unmanaged'` or `'matched'`.

**State machine (local useState):**
- `'idle'` — shows commands + Execute button
- `'running'` — "Executing…", button disabled
- `'done-ok'` — "✓ Done" (green)
- `'done-err:N'` — "✗ Failed (exit N)" (red)

State resets to `'idle'` whenever `selectedNodeId` changes — use a `useEffect` with `[selectedId]` dep.

**Execute button:** calls `onRemediate!(node, commands)` — the prop is optional; button is disabled (and REMEDIATE section still shown) when `onRemediate` is undefined.

**App.tsx:** `handleRemediate` is a plain async function — `return window.terminus.runCli(commands)` — passed to `<Inspector onRemediate={handleRemediate} />`.

**Command display:** Each `string[]` rendered as one `<div>`: `` `aws ${argv.join(' ')}` ``. Truncate at 200 chars with `…`; full command in `title` attribute.

---

- [ ] **Step 1: Write the failing Inspector tests**

Create `tests/renderer/components/Inspector.remediate.test.tsx`:

```tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Inspector } from '../../../src/renderer/components/Inspector'
import { useUIStore } from '../../../src/renderer/store/ui'
import { useCloudStore } from '../../../src/renderer/store/cloud'
import type { CloudNode } from '../../../src/renderer/types/cloud'

// ---- Mocks (same pattern as Inspector.test.tsx) ----------------------------

const saveAnnotationsMock = vi.fn().mockResolvedValue(undefined)
const analyzeIamMock      = vi.fn().mockResolvedValue({ nodeId: '', findings: [], fetchedAt: 0 })

Object.defineProperty(window, 'terminus', {
  value: { saveAnnotations: saveAnnotationsMock, analyzeIam: analyzeIamMock },
  writable: true,
})

vi.mock('../../../src/renderer/components/IamAdvisor', () => ({
  IamAdvisor: () => null,
}))

// ---------------------------------------------------------------------------

function baseNode(overrides: Partial<CloudNode> = {}): CloudNode {
  return {
    id: 'arn:aws:lambda:us-east-1:123:function:foo',
    label: 'foo',
    type: 'lambda',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides,
  } as CloudNode
}

type OnRemediate = (node: CloudNode, commands: string[][]) => Promise<{ code: number }>

function setup(node: CloudNode, onRemediate?: OnRemediate) {
  useUIStore.setState({ selectedNodeId: node.id })
  useCloudStore.setState({ nodes: [node], importedNodes: [] })
  return render(
    <Inspector
      onDelete={vi.fn()}
      onEdit={vi.fn()}
      onQuickAction={vi.fn()}
      onRemediate={onRemediate}
    />
  )
}

describe('Inspector REMEDIATE section', () => {
  beforeEach(() => {
    saveAnnotationsMock.mockClear()
    analyzeIamMock.mockClear()
    // Enable the EXECUTION_ENGINE flag for all tests except the flag=false test
    vi.stubEnv('VITE_FLAG_EXECUTION_ENGINE', 'true')
    useUIStore.setState({ selectedNodeId: null, annotations: {}, selectedEdgeId: null, selectedEdgeInfo: null })
    useCloudStore.setState({ nodes: [], importedNodes: [] })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('hidden when EXECUTION_ENGINE flag is false', () => {
    vi.unstubAllEnvs() // clear the beforeEach stub
    // flag defaults to false when env var is absent
    setup(baseNode({ driftStatus: 'unmanaged' }))
    expect(screen.queryByText('REMEDIATE')).toBeNull()
  })

  it('hidden when driftStatus is undefined', () => {
    setup(baseNode())
    expect(screen.queryByText('REMEDIATE')).toBeNull()
  })

  it('hidden when driftStatus is missing', () => {
    setup(baseNode({ driftStatus: 'missing' }))
    expect(screen.queryByText('REMEDIATE')).toBeNull()
  })

  it('shown for unmanaged node', () => {
    setup(baseNode({ driftStatus: 'unmanaged' }))
    expect(screen.getByText('REMEDIATE')).toBeTruthy()
  })

  it('shown for matched node with commands', () => {
    setup(baseNode({
      driftStatus: 'matched',
      metadata: { runtime: 'python3.9' },
      tfMetadata: { runtime: 'python3.11' },
    }))
    expect(screen.getByText('REMEDIATE')).toBeTruthy()
  })

  it('shows "Manual remediation required" when matched but no supported diff', () => {
    setup(baseNode({
      driftStatus: 'matched',
      metadata: { tags: '{}' },
      tfMetadata: { tags: '{"env":"prod"}' },
    }))
    expect(screen.getByText(/Manual remediation required/)).toBeTruthy()
  })

  it('Execute button calls onRemediate with node and commands', async () => {
    const onRemediate = vi.fn<OnRemediate>().mockResolvedValue({ code: 0 })
    setup(baseNode({ driftStatus: 'unmanaged' }), onRemediate)
    fireEvent.click(screen.getByText('Execute'))
    expect(onRemediate).toHaveBeenCalledOnce()
    const [calledNode, calledCmds] = onRemediate.mock.calls[0]
    expect(calledNode.id).toBe('arn:aws:lambda:us-east-1:123:function:foo')
    expect(calledCmds.length).toBeGreaterThan(0)
  })

  it('shows Executing… while running, then ✓ Done on success', async () => {
    let resolve!: (v: { code: number }) => void
    const onRemediate = vi.fn<OnRemediate>().mockReturnValue(new Promise((r) => { resolve = r }))
    setup(baseNode({ driftStatus: 'unmanaged' }), onRemediate)

    fireEvent.click(screen.getByText('Execute'))
    expect(screen.getByText('Executing…')).toBeTruthy()

    resolve({ code: 0 })
    await waitFor(() => expect(screen.getByText('✓ Done')).toBeTruthy())
  })

  it('Execute button disabled when onRemediate not provided', () => {
    setup(baseNode({ driftStatus: 'unmanaged' }))
    const btn = screen.getByText('Execute').closest('button')
    expect(btn).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npx vitest run tests/renderer/components/Inspector.remediate.test.tsx 2>&1 | tail -20
```

Expected: FAIL — `onRemediate` prop not found, REMEDIATE section not rendered

- [ ] **Step 3: Add `onRemediate` to InspectorProps and state**

In `src/renderer/components/Inspector.tsx`:

**3a. Add import for `flag` and `buildRemediateCommands` at the top of the file (after existing imports):**
```ts
import { flag } from '../utils/flags'
import { buildRemediateCommands } from '../utils/buildRemediateCommands'
```

**3b. Extend `InspectorProps` interface (replace the existing interface):**
```ts
interface InspectorProps {
  onDelete: (node: CloudNode) => void
  onEdit: (node: CloudNode) => void
  onQuickAction: (node: CloudNode, action: 'stop' | 'start' | 'reboot' | 'invalidate', meta?: { path?: string }) => void
  onAddRoute?: (apiId: string) => void
  onRemediate?: (node: CloudNode, commands: string[][]) => Promise<{ code: number }>
}
```

**3c. Update the destructured props in the `Inspector` function signature:**
```ts
export function Inspector({ onDelete, onEdit, onQuickAction, onAddRoute, onRemediate }: InspectorProps): React.JSX.Element {
```

**3d. Add remediate state after the existing `useState` declarations (near line 68, after `acmDeleteError`):**
```ts
type RemediateState = 'idle' | 'running' | `done-ok` | `done-err:${number}`
const [remediateState, setRemediateState] = useState<RemediateState>('idle')

// Reset remediate state when selected node changes
React.useEffect(() => {
  setRemediateState('idle')
}, [selectedId])
```

- [ ] **Step 4: Add REMEDIATE section JSX**

In `src/renderer/components/Inspector.tsx`, after the matched drift banner block (after the closing `)}` of the `node.driftStatus === 'matched'` block, around line 212) and before `{/* node type header */}`:

```tsx
{/* REMEDIATE section — flag-gated, unmanaged + matched only */}
{flag('EXECUTION_ENGINE') && (node.driftStatus === 'unmanaged' || node.driftStatus === 'matched') && (() => {
  const commands = buildRemediateCommands(node)
  const hasCommands = commands.length > 0

  async function handleRemediate(): Promise<void> {
    if (!onRemediate) return
    setRemediateState('running')
    try {
      const result = await onRemediate(node, commands)
      setRemediateState(result.code === 0 ? 'done-ok' : `done-err:${result.code}`)
    } catch {
      setRemediateState('done-err:1')
    }
  }

  return (
    <div style={{
      padding: '8px 10px',
      borderRadius: 4,
      background: 'rgba(167,139,250,0.07)',
      border: '1px solid rgba(167,139,250,0.3)',
      fontSize: 10,
      marginBottom: 8,
    }}>
      <div style={{ fontWeight: 700, color: '#a78bfa', marginBottom: 6, fontSize: 9 }}>REMEDIATE</div>

      {node.driftStatus === 'unmanaged' && (
        <div style={{ color: '#f59e0b', marginBottom: 6, fontSize: 9 }}>⚠ Unmanaged — not in baseline.</div>
      )}
      {node.driftStatus === 'matched' && hasCommands && (
        <div style={{ color: '#86efac', marginBottom: 6, fontSize: 9 }}>↺ Apply baseline values.</div>
      )}

      {hasCommands ? (
        <>
          <div style={{ marginBottom: 6 }}>
            {commands.map((argv, i) => {
              const full = 'aws ' + argv.join(' ')
              const display = full.length > 200 ? full.slice(0, 200) + '…' : full
              return (
                <div key={i} title={full} style={{
                  fontFamily: 'monospace', fontSize: 8,
                  color: 'var(--cb-text-secondary)',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 2, padding: '2px 5px', marginBottom: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {display}
                </div>
              )
            })}
          </div>

          <div style={{ color: '#f59e0b', fontSize: 8, marginBottom: 6 }}>
            ⚠ This will modify live AWS infrastructure.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => void handleRemediate()}
              disabled={remediateState === 'running' || !onRemediate}
              style={{
                background: remediateState === 'running' ? 'rgba(107,114,128,0.3)' : 'rgba(167,139,250,0.15)',
                border: '1px solid rgba(167,139,250,0.5)',
                borderRadius: 3, padding: '3px 10px',
                color: remediateState === 'running' ? '#6b7280' : '#a78bfa',
                fontFamily: 'monospace', fontSize: 9, cursor: remediateState === 'running' || !onRemediate ? 'not-allowed' : 'pointer',
              }}
            >
              {remediateState === 'running' ? 'Executing…' : 'Execute'}
            </button>
            {remediateState === 'done-ok' && (
              <span style={{ color: '#4ade80', fontSize: 9 }}>✓ Done</span>
            )}
            {typeof remediateState === 'string' && remediateState.startsWith('done-err') && (
              <span style={{ color: '#f87171', fontSize: 9 }}>
                ✗ Failed (exit {remediateState.split(':')[1]})
              </span>
            )}
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--cb-text-muted)', fontSize: 9, fontStyle: 'italic' }}>
          Manual remediation required — diff contains unsupported field types.
        </div>
      )}
    </div>
  )
})()}
```

- [ ] **Step 5: Wire `handleRemediate` in App.tsx**

In `src/renderer/src/App.tsx`:

**5a. Add `handleRemediate` function** (after `handleQuickAction`, around line 187):
```ts
async function handleRemediate(node: CloudNode, commands: string[][]): Promise<{ code: number }> {
  return window.terminus.runCli(commands)
}
```

**5b. Pass it to `<Inspector>`** (line 212 area — add `onRemediate={handleRemediate}`):
```tsx
<Inspector onDelete={handleDeleteRequest} onEdit={node => setEditTarget(node)} onQuickAction={handleQuickAction} onRemediate={handleRemediate} />
```

- [ ] **Step 6: Run the Inspector tests**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npx vitest run tests/renderer/components/Inspector.remediate.test.tsx 2>&1 | tail -20
```

Expected: all 8 tests PASS

- [ ] **Step 7: Typecheck**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm run typecheck 2>&1 | tail -20
```

Expected: exit 0

- [ ] **Step 8: Full test suite**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm test 2>&1 | tail -10
```

Expected: 885 + 9 = 894 passing (or close — counts match baseline + new tests)

- [ ] **Step 9: Verify flag=false test passes (smoke check)**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npx vitest run tests/renderer/components/Inspector.remediate.test.tsx --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|flag)"
```

Expected: `hidden when EXECUTION_ENGINE flag is false` test listed as PASS

- [ ] **Step 10: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
git add src/renderer/components/Inspector.tsx src/renderer/src/App.tsx tests/renderer/components/Inspector.remediate.test.tsx
git commit -m "feat(phase2): Inspector REMEDIATE section + App.tsx handleRemediate wiring"
```

---

## Completion Verification

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks
npm run typecheck && npm test
```

Expected outcome:
- typecheck exits 0
- All tests pass (874 baseline + ~20 new = ~894 total)
- `flag('EXECUTION_ENGINE') = false` → Inspector renders identically to today (covered by test)
- `flag('EXECUTION_ENGINE') = true` + unmanaged Lambda → REMEDIATE shows delete command
- `flag('EXECUTION_ENGINE') = true` + matched Lambda runtime diff → REMEDIATE shows update command
- Execute button calls `window.terminus.runCli` with correct argv arrays
