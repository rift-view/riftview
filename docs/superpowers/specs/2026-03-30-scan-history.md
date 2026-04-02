# Scan History — Design Spec

**Date:** 2026-03-30
**Status:** Draft
**Pillar:** Observability / Audit

---

## 1. Goal

Cloudblocks currently shows only the live state of AWS infrastructure — each scan overwrites the previous result with no record of what changed. Users cannot answer questions like:

- "What resources were added or removed in the last 24 hours?"
- "Which EC2 instance disappeared after the deploy yesterday?"
- "Did the RDS cluster exist at 9 AM this morning?"

Scan History captures a snapshot of `CloudNode[]` at the end of every successful scan and persists it locally. Users can browse past snapshots and diff any two of them to see exactly which nodes were added, removed, or changed. This is the primary audit and drift-debugging primitive before cloud-sync is ever introduced.

---

## 2. Scope (v1)

**In scope:**

- Automatic snapshot capture after every successful scan (both manual and auto-interval)
- Persist up to the last **50 snapshots** per profile+region combination, then drop the oldest (LRU cap)
- List snapshots in a History modal accessible from the TitleBar
- Load any snapshot into a read-only canvas overlay ("time-travel mode") — renders historical nodes without replacing live state
- Diff any two snapshots: compute added / removed / changed nodes and display a summary table
- Delete individual snapshots or clear all for a profile+region

**Not in scope (v1):** see Section 8.

---

## 3. Data Model

New file: `src/renderer/types/history.ts`

### `ScanSnapshot`

The full snapshot persisted to disk. The `nodes` array is the expensive payload and is never included in list responses.

```typescript
import type { CloudNode, ScanError } from './cloud'

export interface ScanSnapshot {
  id: string                           // UUID — stable identifier for IPC calls
  timestamp: string                    // ISO 8601 — Date.toISOString() at capture time
  profile: string                      // AwsProfile.name at scan time
  region: string                       // primary region (useCloudStore.region)
  selectedRegions: string[]            // full multi-region list active during scan
  nodeCount: number                    // total node count (redundant but fast for list display)
  nodeCountByType: Record<string, number>  // e.g. { ec2: 4, s3: 2 }
  nodes: CloudNode[]                   // full node list
  scanErrors: ScanError[]              // errors that accompanied this scan (partial scans allowed)
  endpoint?: string                    // set when captured against a local emulator (LocalStack)
}
```

### `SnapshotMeta`

Returned by `HISTORY_LIST` — never includes `nodes` so the list stays fast.

```typescript
export interface SnapshotMeta {
  id: string
  timestamp: string
  profile: string
  region: string
  selectedRegions: string[]
  nodeCount: number
  nodeCountByType: Record<string, number>
  scanErrors: ScanError[]
  endpoint?: string
}
```

### `SnapshotDiff`

Computed on-demand in main process; returned to renderer as a single value.

```typescript
export type ChangeKind = 'added' | 'removed' | 'changed'

export interface NodeDiffEntry {
  kind: ChangeKind
  node: CloudNode          // "after" for added/changed, "before" for removed
  nodeBefore?: CloudNode   // only set when kind === 'changed'
}

export interface SnapshotDiff {
  baseId: string           // the older snapshot
  compareId: string        // the newer snapshot
  added: CloudNode[]
  removed: CloudNode[]
  changed: NodeDiffEntry[]
  unchanged: number        // count only — not the full node list
}
```

---

## 4. Storage

**Format:** flat JSON files in Electron's `userData` directory, one file per profile+region key.

**Rationale:** The project already uses this pattern for `settings.json`, `annotations.json`, and `custom-edges.json`. `electron-store` is not a current dependency; adding it for one additional structured file is not justified. A flat JSON array keeps reads and writes simple, avoids a new dependency, and is human-readable for debugging.

**File path pattern:**

```
{userData}/scan-history/{profile}__{regionKey}.json
```

Where `regionKey` is `selectedRegions.sort().join('+')` — deterministic, human-readable, valid on macOS and Windows.

Examples:

```
scan-history/default__us-east-1.json
scan-history/default__us-east-1+us-west-2.json
scan-history/prod__eu-west-1.json
```

**File structure:**

```json
[
  { "id": "uuid-1", "timestamp": "2026-03-30T10:00:00.000Z", "nodeCount": 42, "nodeCountByType": { "ec2": 4, "s3": 2 }, "nodes": [...], "scanErrors": [], "profile": "default", "region": "us-east-1", "selectedRegions": ["us-east-1"] },
  { "id": "uuid-2", ... }
]
```

Array is stored **newest-first**. On write: prepend the new snapshot object, then `slice(0, 50)` to enforce the cap.

**Storage cap:** 50 snapshots per profile+region key. Worst case: 50 snapshots × 200 nodes × ~2 KB per node (serialised) = ~20 MB per file. Acceptable for local desktop storage; users who want to trim can delete via the History modal.

**Main process only:** all file I/O stays in main. The renderer never reads or writes these files directly.

---

## 5. IPC

### New channel constants — `src/main/ipc/channels.ts`

```typescript
HISTORY_LIST:   'history:list',    // invoke(profile, region) → SnapshotMeta[]
HISTORY_LOAD:   'history:load',    // invoke(id) → ScanSnapshot | null
HISTORY_DELETE: 'history:delete',  // invoke(id) → { ok: boolean }
HISTORY_CLEAR:  'history:clear',   // invoke(profile, region) → { ok: boolean }
HISTORY_DIFF:   'history:diff',    // invoke(baseId, compareId) → SnapshotDiff
```

### Handler signatures — `src/main/ipc/handlers.ts`

```typescript
// List metadata for all snapshots matching the profile+region key.
// Returns newest-first. Never includes the `nodes` payload.
ipcMain.handle(IPC.HISTORY_LIST,
  (_e, profile: string, region: string): SnapshotMeta[] => { ... }
)

// Load the full snapshot including CloudNode[]. Used when entering time-travel mode.
ipcMain.handle(IPC.HISTORY_LOAD,
  (_e, id: string): ScanSnapshot | null => { ... }
)

// Delete a single snapshot by id.
ipcMain.handle(IPC.HISTORY_DELETE,
  (_e, id: string): { ok: boolean } => { ... }
)

// Delete all snapshots for a given profile+region key.
ipcMain.handle(IPC.HISTORY_CLEAR,
  (_e, profile: string, region: string): { ok: boolean } => { ... }
)

// Compute a diff between two snapshots. Both are loaded from disk inside this handler.
// baseId should be the older snapshot; compareId should be the newer one.
ipcMain.handle(IPC.HISTORY_DIFF,
  async (_e, baseId: string, compareId: string): Promise<SnapshotDiff> => { ... }
)
```

### Snapshot capture hook

Snapshot capture is **not** renderer-initiated. It happens automatically in the main process after a complete scan cycle. The sequence:

```
ResourceScanner completes a full scan cycle
  → final merged node list is assembled (same list sent to renderer via SCAN_DELTA)
  → before emitting SCAN_STATUS 'idle', call saveSnapshot(snapshot) (fire-and-forget, errors logged only)
  → SCAN_STATUS 'idle' is sent to renderer as normal
```

`saveSnapshot` is a helper in `src/main/history/store.ts` (new file). It accepts the final node list plus the active profile, region, and endpoint, constructs a `ScanSnapshot`, and writes it to the appropriate JSON file.

`ResourceScanner` must be modified to accept a `onSnapshotReady` callback (or the handler wires it via a direct import of the helper). The cleanest approach: `ResourceScanner.start()` accepts an optional `snapshotCallback: (nodes: CloudNode[]) => void` that is called before the `idle` status push.

### `src/preload/index.d.ts` additions

```typescript
listScanHistory(profile: string, region: string): Promise<import('../renderer/types/history').SnapshotMeta[]>
loadSnapshot(id: string): Promise<import('../renderer/types/history').ScanSnapshot | null>
deleteSnapshot(id: string): Promise<{ ok: boolean }>
clearHistory(profile: string, region: string): Promise<{ ok: boolean }>
diffSnapshots(baseId: string, compareId: string): Promise<import('../renderer/types/history').SnapshotDiff>
```

---

## 6. UI

### Entry point

A **History** button is added to TitleBar, inserted between the scan group and the Import/Export group:

```
[⟳ Scan]  [42s ago]  |  [⏱ History]  |  [↑ Import ▾]  [↓ Export ▾]  ...
```

Clicking **History** opens `ScanHistoryModal`.

### `ScanHistoryModal`

A two-panel modal (700 × 480 px), styled consistent with existing modals (monospace, `var(--cb-bg-elevated)`, etc.).

**Left panel — snapshot list (~240 px wide):**

- Header: "Scan History — {profile} / {region}"
- Each row shows: relative timestamp ("42m ago"), absolute timestamp on hover, node count, top-3 type badges (e.g. `ec2 ×4`), and a trash icon to delete that row
- Clicking a row selects it (single selection) and shows detail in the right panel
- Checkboxes allow selecting exactly two rows; when two are checked the right panel switches to diff view automatically
- "Clear all" button at the bottom — requires a confirmation step (consistent with the existing `deleteConfirmStyle` pattern)

**Right panel — detail / diff view:**

Default (one snapshot selected): shows the snapshot's `nodeCountByType` as a breakdown table and lists any `scanErrors` from that scan.

Diff mode (two snapshots checked): calls `diffSnapshots(baseId, compareId)` and renders:

- Added: N (green badge) — scrollable list of `label (type)`
- Removed: N (red badge) — same format
- Changed: N (yellow badge) — `label: {status before} → {status after}` for each entry
- Unchanged: N (muted count, no list)

A **"View on Canvas"** button loads the selected single snapshot into time-travel mode and closes the modal.

### Time-travel mode

When a snapshot is loaded for canvas viewing:

- `useUIStore` gains a `historySnapshot: ScanSnapshot | null` field (new, initialized to `null`)
- When `historySnapshot` is set, `CloudCanvas` renders `historySnapshot.nodes` in place of `useCloudStore.nodes` — same layout pipeline, same node components
- A fixed banner appears at the top of the canvas:

  ```
  Viewing snapshot from {timestamp}  [Exit time-travel]
  ```

- Exiting clears `historySnapshot` and returns to live state
- All write actions (Create, Edit, Delete buttons and drag-to-create) are disabled while `historySnapshot !== null`; `CommandDrawer` is also suppressed

### Renderer state — `useHistoryStore`

New Zustand store: `src/renderer/store/history.ts`

```typescript
import type { SnapshotMeta, SnapshotDiff, ScanSnapshot } from '../types/history'

interface HistoryState {
  snapshots:      SnapshotMeta[]       // populated when modal opens
  selectedIds:    string[]             // 1 or 2 entries
  diff:           SnapshotDiff | null
  diffLoading:    boolean

  loadSnapshots:  (profile: string, region: string) => Promise<void>
  selectSnapshot: (id: string) => void   // toggles in selectedIds (max 2)
  computeDiff:    () => Promise<void>    // calls diffSnapshots(selectedIds[0], selectedIds[1])
  deleteSnapshot: (id: string) => Promise<void>
  clearHistory:   (profile: string, region: string) => Promise<void>
  reset:          () => void             // called on modal close
}
```

This store is populated on modal open and reset on close. It does not persist across sessions.

---

## 7. Diff Logic

Computed in main process to keep array work off the renderer thread. Implemented in `src/main/history/diff.ts`:

```typescript
function computeDiff(base: ScanSnapshot, compare: ScanSnapshot): SnapshotDiff {
  const baseMap = new Map(base.nodes.map(n => [n.id, n]))
  const cmpMap  = new Map(compare.nodes.map(n => [n.id, n]))

  const added:   CloudNode[]     = []
  const removed: CloudNode[]     = []
  const changed: NodeDiffEntry[] = []
  let   unchanged = 0

  for (const [id, node] of cmpMap) {
    if (!baseMap.has(id)) added.push(node)
  }

  for (const [id, node] of baseMap) {
    if (!cmpMap.has(id)) {
      removed.push(node)
    } else {
      const after = cmpMap.get(id)!
      if (isNodeChanged(node, after)) {
        changed.push({ kind: 'changed', node: after, nodeBefore: node })
      } else {
        unchanged++
      }
    }
  }

  return { baseId: base.id, compareId: compare.id, added, removed, changed, unchanged }
}
```

**`isNodeChanged` definition:** returns `true` if any of the following differ between base and compare:

- `status`
- `label`
- `region`
- `parentId`
- `JSON.stringify(metadata)` (deep equality via serialisation — acceptable for v1 given typical node counts)

Metadata stringify is intentionally simple. A field-level diff showing exactly which metadata keys changed is out of scope for v1.

---

## 8. Out of Scope (v1)

- **Cloud sync** — snapshots are local only; no upload to S3, DynamoDB, or any remote store
- **Search within history** — no full-text search across historical node metadata
- **Per-field metadata diff** — diff shows changed nodes but not which specific metadata fields changed
- **Snapshot annotations** — no ability to label a snapshot ("pre-deploy", "after incident")
- **Automatic snapshot on write** — snapshots are taken after scans only, not after CLI create/delete/edit operations
- **Snapshot export** — no ability to export a historical snapshot as JSON or Terraform; the existing Export flow covers live state only
- **Cross-profile or cross-region diffs** — both snapshots in a diff must share the same profile+region key
- **Snapshot retention policy settings** — the 50-snapshot cap is hardcoded; no UI to adjust it
- **Auto-open history on drift** — the existing `notifyDrift` OS notification does not link to scan history in v1
- **Per-node history in Inspector** — the Inspector panel shows live-state metadata only; per-node history is not surfaced in v1

---

## Open Questions

| Question | Proposed answer |
|---|---|
| Where exactly is `saveSnapshot` called? | Inside `ResourceScanner`, after the final delta flush, before the `SCAN_STATUS 'idle'` push. Requires passing the final merged node list to the helper. |
| Should snapshots be compressed? | No for v1 — 20 MB worst case is acceptable; `JSON.stringify` is sufficient. |
| What if the history file is corrupted? | Handler catches parse errors, returns an empty array, and logs the error. The file is left in place (not silently deleted). |
| Multi-region key format | `selectedRegions.sort().join('+')` — deterministic, human-readable, safe on macOS and Windows file systems. |
| What if `selectedRegions` is empty? | Fall back to `[region]` (the single primary region) before computing the key. |
