# Remediation Execution Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the drift → remediation loop: optimistic status update when execution starts, toast feedback on result, and rescan after success.

**Architecture:** The Execute button in the Inspector REMEDIATE section already calls `onRemediate(node, commands)`, which calls `window.riftview.runCli(commands)` in App.tsx. What's missing: (1) `patchNodeStatus` store action to set a node to 'pending' optimistically, (2) wiring this into `handleRemediate` with rescan + toast. No new components needed.

**Tech Stack:** TypeScript · Zustand 5 · Vitest + RTL · React 19

---

## File Map

| File | Change |
|---|---|
| `src/renderer/store/cloud.ts` | Add `patchNodeStatus(id, status)` action |
| `src/renderer/src/App.tsx` | Fix `handleRemediate` — optimistic update + toast + rescan |
| `tests/renderer/store/cloud.test.ts` | Add 2 tests for `patchNodeStatus` |
| `.env.local.example` | Enable EXECUTION_ENGINE + STATUS_LANGUAGE flags |

---

## Task 1: Add `patchNodeStatus` to cloud store

**Files:**
- Modify: `src/renderer/store/cloud.ts`
- Test: `tests/renderer/store/cloud.test.ts`

Background: The cloud store has no way to mutate a single node's status in place. We need this to show 'pending' shimmer on a node while remediation runs. Pattern: same as `setScanStatus` but targets one node in the `nodes` array.

- [ ] **Step 1: Write the failing test**

Add to `tests/renderer/store/cloud.test.ts`, inside the `describe('useCloudStore')` block after the existing tests:

```typescript
it('patchNodeStatus updates status of the matching node', () => {
  useCloudStore.setState({ nodes: [makeNode('i-001'), makeNode('i-002')] })
  useCloudStore.getState().patchNodeStatus('i-001', 'pending')
  const nodes = useCloudStore.getState().nodes
  expect(nodes.find((n) => n.id === 'i-001')?.status).toBe('pending')
  expect(nodes.find((n) => n.id === 'i-002')?.status).toBe('running')
})

it('patchNodeStatus is a no-op for unknown node id', () => {
  useCloudStore.setState({ nodes: [makeNode('i-001')] })
  useCloudStore.getState().patchNodeStatus('does-not-exist', 'stopped')
  expect(useCloudStore.getState().nodes[0].status).toBe('running')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/renderer/store/cloud.test.ts
```

Expected: FAIL — `patchNodeStatus is not a function`

- [ ] **Step 3: Add `patchNodeStatus` to the CloudState interface**

In `src/renderer/store/cloud.ts`, add to the `interface CloudState` block (after `setPreviousCounts`):

```typescript
patchNodeStatus: (id: string, status: NodeStatus) => void
```

- [ ] **Step 4: Implement `patchNodeStatus` in the store (both instances)**

`cloud.ts` has two store definitions: the live `useCloudStore` (around line 58) and the test-only `createCloudStore()` factory (around line 156). Both must get the action.

**In `useCloudStore` (around line 152):** add after `setPreviousCounts`:

```typescript
patchNodeStatus: (id, status) =>
  set((state) => ({
    nodes: state.nodes.map((n) => (n.id === id ? { ...n, status } : n)),
  })),
```

**In `createCloudStore()` factory (around line 237):** add after `setPreviousCounts`:

```typescript
patchNodeStatus: (id, status) =>
  set((state) => ({
    nodes: state.nodes.map((n) => (n.id === id ? { ...n, status } : n)),
  })),
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- tests/renderer/store/cloud.test.ts
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/store/cloud.ts tests/renderer/store/cloud.test.ts
git commit -m "feat(store): add patchNodeStatus action for optimistic status updates"
```

---

## Task 2: Wire `handleRemediate` — optimistic update + toast + rescan

**Files:**
- Modify: `src/renderer/src/App.tsx:189-191`

Background: `handleRemediate` currently just calls `window.riftview.runCli(commands)` and returns. It needs to: (1) set the node to 'pending' before running, (2) show a toast on success/error, (3) call `triggerScan()` on success so the canvas reflects the remediated state. Pattern: mirrors `CommandDrawer.handleRun()` which does `window.riftview.startScan()` after success, but we use `triggerScan()` (from `useScanner`) because it also saves previous counts for the delta badge.

Note: No separate test is written for this function — the Inspector.remediate.test.tsx tests the component (onRemediate is a mock prop there), and the store behavior is covered by Task 1. The integration is verified by running all tests and manual smoke test.

- [ ] **Step 1: Replace the `handleRemediate` implementation in `src/renderer/src/App.tsx`**

Find (around line 189):
```typescript
  async function handleRemediate(node: CloudNode, commands: string[][]): Promise<{ code: number }> {
    return window.riftview.runCli(commands)
  }
```

Replace with:
```typescript
  async function handleRemediate(node: CloudNode, commands: string[][]): Promise<{ code: number }> {
    useCloudStore.getState().patchNodeStatus(node.id, 'pending')
    const result = await window.riftview.runCli(commands)
    if (result.code === 0) {
      useUIStore.getState().showToast('Remediation complete')
      triggerScan()
    } else {
      useUIStore.getState().showToast('Remediation failed', 'error')
    }
    return result
  }
```

- [ ] **Step 2: Run typecheck to verify no type errors**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all 926+ tests PASS (no new failures — Inspector.remediate tests mock onRemediate so they're unaffected)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat(remediate): optimistic pending status + toast + rescan after execution"
```

---

## Task 3: Enable flags in .env.local.example

**Files:**
- Modify: `.env.local.example`

Background: The meeting decided STATUS_LANGUAGE is production-ready (pure visual, zero data risk) and should be default-on. EXECUTION_ENGINE gates the REMEDIATE section — now that the execution loop is complete, it should be enabled too. Updating `.env.local.example` communicates these as "ready" for local dev. Users who copy this file get them enabled. (To make them truly default-on in a production build, a separate CI env config change is needed — that's out of scope here.)

- [ ] **Step 1: Update `.env.local.example`**

Find:
```
VITE_FLAG_STATUS_LANGUAGE=false
```
Replace with:
```
VITE_FLAG_STATUS_LANGUAGE=true
```

Find:
```
VITE_FLAG_EXECUTION_ENGINE=false
```
Replace with:
```
VITE_FLAG_EXECUTION_ENGINE=true
```

Add a comment above each changed flag:
```
# ✅ Production-ready — enable by default
VITE_FLAG_STATUS_LANGUAGE=true
```
and:
```
# ✅ Execution loop complete — enable by default
VITE_FLAG_EXECUTION_ENGINE=true
```

Final file should look like:
```
# Copy this file to .env.local to enable in-progress features during development.
# .env.local is gitignored and never committed.
# All flags default to false (disabled) unless set to 'true'.

# Phase 1: Visual Command Board
VITE_FLAG_COMMAND_BOARD=false
# ✅ Production-ready — enable by default
VITE_FLAG_STATUS_LANGUAGE=true
VITE_FLAG_ACTION_RAIL=false

# Phase 2: Execution Engine
# ✅ Execution loop complete — enable by default
VITE_FLAG_EXECUTION_ENGINE=true

# Phase 3: Operational Intelligence
VITE_FLAG_OP_INTELLIGENCE=false
```

- [ ] **Step 2: Run tests to confirm no flag-related test regressions**

```bash
npm test
```

Expected: PASS (all flag tests use `vi.stubEnv` — they're unaffected by `.env.local.example`)

- [ ] **Step 3: Commit**

```bash
git add .env.local.example
git commit -m "chore(flags): enable STATUS_LANGUAGE and EXECUTION_ENGINE in .env.local.example"
```

---

## Verification

After all tasks complete:

```bash
npm run lint && npm run typecheck && npm test
```

All three must pass with 0 errors before considering this done.
