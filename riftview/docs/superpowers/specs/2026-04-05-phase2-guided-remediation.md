# Phase 2: Guided Remediation — Design Spec

**Date:** 2026-04-05
**Author:** Foreman (autonomous, user delegated)
**Status:** Draft for review

---

## Goal

Close the drift loop. When a node has drifted from its baseline, surface the exact CLI commands that would reconcile it — and let the user run them with one click, right from the Inspector.

This is the second half of the loop: **read → diff → write**.

---

## Scope

| Drift Status | Phase 2 Action |
|---|---|
| `unmanaged` | Offer to delete the resource from live AWS |
| `matched` (with diffs) | Offer to apply baseline values for supported fields |
| `missing` | No action — read-only. Out of scope (Phase 3+) |

- One-at-a-time only. Single node per execution.
- Flag-gated: `EXECUTION_ENGINE`. Off by default.
- No new IPC channels. Reuses `window.terminus.runCli(commands: string[][])`.
- No dependency-order graphs. Single-node operations only.

---

## Feature: `EXECUTION_ENGINE`

Flag added in Phase 0: `flag('EXECUTION_ENGINE')` reads `VITE_FLAG_EXECUTION_ENGINE` at call time.

When false (default): Inspector renders identically to today. No Remediate section visible.

When true: Inspector shows a **REMEDIATE** section on applicable nodes.

---

## New File: `buildRemediateCommands.ts`

```
src/renderer/utils/buildRemediateCommands.ts
```

Pure function. No side effects. Fully testable without mocks.

```ts
export function buildRemediateCommands(node: CloudNode): string[][]
```

### Logic

**Case 1: `driftStatus === 'unmanaged'`**

Delegates directly to `buildDeleteCommands(node)`. The resource exists in live AWS but is not in the baseline — the remediation is removal.

Returns `[]` for node types that `buildDeleteCommands` does not support (the existing `default: return []` case).

**Case 2: `driftStatus === 'matched'`**

If `node.tfMetadata` is `undefined`, returns `[]` immediately (defensive guard — `applyDriftToState` always populates it for matched nodes, but the type is optional).

Computes diff between `node.metadata` and `node.tfMetadata` (same comparison as `DriftDiffTable`). For each diffed key, emits the CLI command(s) to restore the baseline value. Supported fields per node type:

| NodeType | Metadata Key | CLI Command |
|---|---|---|
| `lambda` | `runtime` | `lambda update-function-configuration --function-name {node.id} --runtime {tfVal}` |
| `lambda` | `memorySize` | `lambda update-function-configuration --function-name {node.id} --memory-size {tfVal}` |
| `lambda` | `timeout` | `lambda update-function-configuration --function-name {node.id} --timeout {tfVal}` |
| `ec2` | `instanceType` | `ec2 stop-instances --instance-ids {node.id}` + `ec2 modify-instance-attribute --instance-id {node.id} --instance-type Value={tfVal}` + `ec2 start-instances --instance-ids {node.id}` (only stop/start if `node.status === 'running'`) |
| `rds` | `instanceClass` | `rds modify-db-instance --db-instance-identifier {node.id} --db-instance-class {tfVal} --apply-immediately` |

**Multiple Lambda diffs** are merged into a single `update-function-configuration` call (one command, all changed flags combined).

If the diff contains only unsupported keys → returns `[]`.

**Case 3: `driftStatus === 'missing'` or no driftStatus**

Returns `[]`.

### Examples

```ts
// Unmanaged Lambda → delete it
buildRemediateCommands({ id: 'arn:...:function:foo', type: 'lambda', driftStatus: 'unmanaged', ... })
// → [['lambda', 'delete-function', '--function-name', 'arn:...:function:foo']]

// Matched Lambda with runtime drift → update it
buildRemediateCommands({ ..., driftStatus: 'matched', metadata: { runtime: 'python3.9' }, tfMetadata: { runtime: 'python3.11' } })
// → [['lambda', 'update-function-configuration', '--function-name', 'arn:...', '--runtime', 'python3.11']]

// Matched Lambda with unsupported diff key only
buildRemediateCommands({ ..., driftStatus: 'matched', metadata: { tags: '{...}' }, tfMetadata: { tags: '{...other}' } })
// → []
```

---

## Inspector UI: REMEDIATE Section

Rendered in `Inspector.tsx` when:
1. `flag('EXECUTION_ENGINE')` is true
2. `node.driftStatus === 'unmanaged'` OR `node.driftStatus === 'matched'`
3. `buildRemediateCommands(node)` is computed at render time

### Layout (appended after the existing drift banner, before the node type header)

```
────────────────────────────────
REMEDIATE

  [if unmanaged]:
  ⚠ Unmanaged — not in baseline.

  [if matched with commands]:
  ↺ Apply baseline values.

  Commands:
    aws ec2 terminate-instances --instance-ids i-abc123
    aws lambda update-function-configuration ...

  ⚠ This will modify live AWS infrastructure.

  [ Execute ]

  [if commands empty for matched]:
  Manual remediation required — diff contains
  unsupported field types.
────────────────────────────────
```

### States

| State | Description |
|---|---|
| `idle` | Shows command preview + Execute button |
| `running` | "Executing…" spinner, Execute button disabled |
| `done-ok` | "✓ Done" (green), re-enables Execute |
| `done-err` | "✗ Failed (exit N)" (red), re-enables Execute |

State is local `useState` in Inspector. Resets when `selectedNodeId` changes.

### Command display

Each `string[]` in the commands array is rendered as one monospace line: `aws {argv.join(' ')}`. Lines are truncated at 200 chars with ellipsis. Full command visible on hover via `title` attribute.

### Execution

Execute button calls `onRemediate(node, commands)` prop — Inspector does not call IPC directly.

`App.tsx` handles `onRemediate` by calling `window.terminus.runCli(commands)`. Output streams to CommandDrawer via existing `onCliOutput`/`onCliDone` listeners. Inspector's local state transitions to `running` on click, `done-ok` or `done-err` on completion.

The completion signal comes from a `Promise` — `window.terminus.runCli` already returns `Promise<{ code: number }>`. Inspector awaits this directly via the `onRemediate` callback returning a Promise:

```ts
// Inspector.tsx
async function handleRemediate(): Promise<void> {
  setRemediateState('running')
  try {
    const result = await onRemediate!(node, commands)
    setRemediateState(result.code === 0 ? 'done-ok' : `done-err:${result.code}`)
  } catch {
    setRemediateState('done-err:1')
  }
}
```

### Inspector prop change

```ts
// Before:
interface InspectorProps {
  onDelete: (node: CloudNode) => void
  onEdit: (node: CloudNode) => void
  onQuickAction: (node: CloudNode, action: 'stop' | 'start' | 'reboot' | 'invalidate', meta?: ...) => void
  onAddRoute?: (apiId: string) => void
}

// After:
interface InspectorProps {
  onDelete: (node: CloudNode) => void
  onEdit: (node: CloudNode) => void
  onQuickAction: (node: CloudNode, action: 'stop' | 'start' | 'reboot' | 'invalidate', meta?: ...) => void
  onAddRoute?: (apiId: string) => void
  onRemediate?: (node: CloudNode, commands: string[][]) => Promise<{ code: number }>
}
```

`onRemediate` is optional — if not provided (e.g., in tests), the Execute button is disabled.

### App.tsx handler

```ts
async function handleRemediate(node: CloudNode, commands: string[][]): Promise<{ code: number }> {
  return window.terminus.runCli(commands)
}
```

Passed to `<Inspector ... onRemediate={handleRemediate} />`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/renderer/utils/buildRemediateCommands.ts` | Pure fn: `CloudNode → string[][]` for unmanaged + matched nodes |
| Modify | `src/renderer/components/Inspector.tsx` | Add `onRemediate` prop; add REMEDIATE section (flag-gated) |
| Modify | `src/renderer/src/App.tsx` | Add `handleRemediate` + pass to `<Inspector>` |
| Create | `tests/renderer/utils/buildRemediateCommands.test.ts` | Unit tests for all cases |
| Create | `tests/renderer/components/Inspector.remediate.test.tsx` | Integration: REMEDIATE section visibility + execution |

---

## Testing Strategy

### `buildRemediateCommands.test.ts` — pure function, no mocks needed

- `unmanaged` Lambda → returns delete command
- `unmanaged` EventBridge `default` bus → returns `[]` (can't delete default)
- `matched` Lambda, `runtime` differs → returns `update-function-configuration` with `--runtime`
- `matched` Lambda, `memorySize` + `timeout` differ → returns single merged command with both flags
- `matched` Lambda, only unsupported key differs → returns `[]`
- `matched` EC2 `instanceType` differs, status `running` → returns stop + modify + start (3 commands)
- `matched` EC2 `instanceType` differs, status `stopped` → returns modify only (1 command)
- `matched` RDS `instanceClass` differs → returns modify command with `--apply-immediately`
- `missing` node → returns `[]`
- node with no `driftStatus` → returns `[]`
- `matched` node with `tfMetadata === undefined` → returns `[]` (defensive guard)

### `Inspector.remediate.test.tsx`

- REMEDIATE section hidden when `flag('EXECUTION_ENGINE')` is false
- REMEDIATE section hidden when `driftStatus` is undefined
- REMEDIATE section shown when `flag('EXECUTION_ENGINE')` true + `driftStatus === 'unmanaged'`
- REMEDIATE section shows "Manual remediation required" when commands is `[]` for matched node
- Execute button calls `onRemediate` with correct node + commands
- Execute button shows "Executing…" while running, "✓ Done" on success

---

## What This Is NOT

- Not bulk remediation (no multi-node selection)
- Not dependency ordering (no VPC teardown sequences)
- Not `missing` node recreation
- Not unsupported field types (tags, SG rules, etc.)
- Not a new IPC channel
- Not a main process change

---

## Completion Criteria

- `npm run typecheck` exits 0
- `npm test` all tests pass (874 baseline + new tests)
- `flag('EXECUTION_ENGINE') = false` → Inspector renders identically to today
- `flag('EXECUTION_ENGINE') = true` + unmanaged node selected → REMEDIATE section shows delete commands
- `flag('EXECUTION_ENGINE') = true` + matched Lambda with runtime diff → REMEDIATE section shows update command
- Execute button calls `window.terminus.runCli` with the correct argv arrays
