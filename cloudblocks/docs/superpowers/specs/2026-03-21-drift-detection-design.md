# Drift Detection Design

## Goal

Compare live AWS scan results against imported Terraform state nodes to surface:
- **Unmanaged** resources: exist in live AWS but not in Terraform state
- **Missing** resources: declared in Terraform state but not found in live AWS
- **Matched** resources: present in both, with attribute-level diff in the Inspector

---

## Trigger

Drift comparison runs automatically in two cases:
1. When `setImportedNodes()` is called (after TF import)
2. After every successful scan — inside `applyDelta()`, if `importedNodes.length > 0`

In both cases, the drift logic runs **inside** the existing `set()` call (not as a separate store action) to guarantee atomic state updates. See Store Actions below.

Drift UI is hidden entirely when `importedNodes` is empty. `clearImportedNodes()` resets all drift state atomically.

---

## Data Model

Two new optional fields on `CloudNode` in `src/renderer/types/cloud.ts`:

```typescript
export type DriftStatus = 'unmanaged' | 'missing' | 'matched'

export interface CloudNode {
  // ... existing fields unchanged ...
  driftStatus?: DriftStatus
  tfMetadata?: Record<string, unknown>  // absorbed from matched imported node
}
```

`NodeStatus` is unchanged. Drift is a separate dimension from resource lifecycle status.

One new UI flag in `useUIStore`:
```typescript
driftFilterActive: boolean
toggleDriftFilter: () => void
```

---

## Comparison Logic

Pure function in `src/renderer/utils/compareDrift.ts`:

```typescript
export interface DriftResult {
  matched:   string[]  // IDs in both live and imported
  unmanaged: string[]  // IDs in live only
  missing:   string[]  // IDs in imported only (excluding type: 'unknown')
}

export function compareDrift(
  liveNodes: CloudNode[],
  importedNodes: CloudNode[],
): DriftResult
```

**Matching strategy: strict ID equality only.** No heuristics. `liveNode.id === importedNode.id` = match.

**`type: 'unknown'` nodes are excluded inside `compareDrift()`** — filtered from `importedNodes` before matching. They never contribute to `matched`, `unmanaged`, or `missing` buckets.

Known ID conventions (from `parser.ts` — only these 10 types are mapped; all others emit `type: 'unknown'`):
- EC2, VPC, Subnet, SG, RDS, CloudFront, API GW → `attrs['id']` (AWS resource ID)
- Lambda → `attrs['function_name']` (same as live scanner)
- ALB → `attrs['arn']` (same as live scanner)
- S3 → `attrs['id']` (bucket name, same as live scanner)

**Known limitation:** The codebase has 24 `NodeType` values. `parser.ts` maps 10 Terraform resource types; 13 non-`unknown` types (igw, acm, apigw-route, sqs, secret, ecr-repo, sns, dynamo, ssm-param, nat-gateway, r53-zone, sfn, eventbridge-bus) have no parser mapping. Terraform-managed resources of these types will emit `type: 'unknown'` from the parser and be excluded from comparison — meaning they will incorrectly appear as `unmanaged` in live AWS even when Terraform-managed. This is a known false-positive source. Expanding `parser.ts` is deferred to a future sprint.

---

## Store Actions

**`applyDrift()` is an internal helper function** (`src/renderer/utils/compareDrift.ts`), not a standalone store action. It is called **inside** the `set()` callbacks of `setImportedNodes()` and `applyDelta()` to keep state changes atomic (one React re-render per trigger):

```typescript
// Helper — pure, no set() calls:
export function applyDriftToState(
  liveNodes: CloudNode[],
  importedNodes: CloudNode[],
): { nodes: CloudNode[]; importedNodes: CloudNode[] }
// For each matched ID:
//   - copy importedNode.metadata into liveNode.tfMetadata
//   - set liveNode.driftStatus = 'matched'
//   - remove importedNode from importedNodes
// For each unmanaged ID: set liveNode.driftStatus = 'unmanaged'
// For each missing ID: set importedNode.driftStatus = 'missing'
// Returns new nodes[] and new importedNodes[]
```

**`setImportedNodes(nodes)`** — sets `importedNodes`, then immediately calls `applyDriftToState()` on the new arrays and returns both in a single `set({ nodes: ..., importedNodes: ... })`.

**`applyDelta(delta)`** — after computing the new `nodes` array from the delta, checks if `importedNodes.length > 0`. If so, calls `applyDriftToState()` and includes the result in the same `set()` call. If not, skips drift entirely.

**`clearImportedNodes()`** — single atomic `set()` call:
1. Sets `importedNodes: []`
2. Strips `driftStatus` and `tfMetadata` from every live node:
   ```typescript
   nodes: state.nodes.map(({ driftStatus: _, tfMetadata: __, ...rest }) => rest)
   ```

The `createCloudStore()` test factory in `cloud.ts` must be updated identically to the main store for all three of the above actions.

---

## Canvas Visual Treatment

Changes in `src/renderer/components/canvas/nodes/ResourceNode.tsx`:

### Left stripe
Drift stripe takes precedence over status stripe when `driftStatus` is set:
- `unmanaged` → `#f59e0b` (amber)
- `missing` → `#ef4444` (red)
- `matched` → `#22c55e` (green)

### Corner badge
Same pattern and size as the existing TF badge (top-right, absolute positioned):
- `unmanaged` → amber `!` badge
- `missing` → red `✕` badge
- `matched` → green `✓` badge

Missing nodes retain their dashed border (already set via `status === 'imported'`).

### Drift filter toolbar button
New toggle in `CloudCanvas.tsx` between Grid and Export:

```
▦ Grid  |  ⊘ Drift only  |  ↓ Export ▾
```

- Hidden when `importedNodes.length === 0`
- When active: `flowNodes` is filtered to nodes where `driftStatus === 'unmanaged' || driftStatus === 'missing'`
- `flowNodes` in both `TopologyView` and `GraphView` already merges `nodes` and `importedNodes` into one array. The filter applies to this merged set — `missing` nodes (in `importedNodes`) are correctly included since they have `driftStatus === 'missing'`
- **Container nodes (`vpc`, `subnet`, `apigw`) are always included** regardless of drift status — React Flow requires parent nodes to be present for child layout. Only resource leaf nodes are filtered.
- State stored as `driftFilterActive` in `useUIStore`

---

## Inspector Panel

A `DRIFT STATUS` section renders below the node header, above metadata fields.

**For nodes with `driftStatus` set**, the new drift section replaces any existing drift-related banners:
- For `missing` nodes (`status === 'imported'`, `driftStatus === 'missing'`): the new red drift banner replaces the existing "Imported from Terraform — read-only" banner. The read-only constraint is communicated within the new banner.
- For `matched` and `unmanaged` nodes: live nodes (`status !== 'imported'`), so no overlap with the old banner.

### Unmanaged
```
┌─ amber banner ──────────────────────┐
│ ! UNMANAGED                         │
│ Not tracked in Terraform.           │
│ Consider adding to your tfstate.    │
└─────────────────────────────────────┘
```
Action buttons (Edit, Delete, Quick Actions) remain available — it's a live node.

### Missing
```
┌─ red banner ────────────────────────┐
│ ✕ MISSING — read-only               │
│ Declared in Terraform but not       │
│ found in live AWS.                  │
└─────────────────────────────────────┘
```
Read-only. Replaces the old "Imported from Terraform — read-only" banner.

### Matched
```
┌─ green header ──────────────────────┐
│ ✓ MATCHED — N differences           │
│ LIVE            │ TERRAFORM         │
│ t3.medium       │ t3.micro          │  ← differing attrs only
│ production      │ staging           │
└─────────────────────────────────────┘
```
Two-column diff table: only attributes where `metadata[key] !== tfMetadata[key]`. Live values shown in red, Terraform declared values in green. If all attributes match: "No differences detected." Action buttons remain available.

---

## Files Touched

| File | Change |
|------|--------|
| `src/renderer/types/cloud.ts` | Add `DriftStatus`, `driftStatus?`, `tfMetadata?` to `CloudNode` |
| `src/renderer/utils/compareDrift.ts` | New — `compareDrift()` and `applyDriftToState()` pure functions |
| `src/renderer/store/cloud.ts` | Wire `applyDriftToState()` into `setImportedNodes()`, `applyDelta()`, `clearImportedNodes()`; update `createCloudStore()` factory identically |
| `src/renderer/store/ui.ts` | Add `driftFilterActive`, `toggleDriftFilter` |
| `src/renderer/components/canvas/nodes/ResourceNode.tsx` | Drift stripe + corner badge |
| `src/renderer/components/canvas/CloudCanvas.tsx` | Drift filter toolbar button |
| `src/renderer/components/canvas/TopologyView.tsx` | Apply `driftFilterActive` to merged `flowNodes` (leaf nodes only; vpc/subnet/apigw always included) |
| `src/renderer/components/canvas/GraphView.tsx` | Same |
| `src/renderer/components/Inspector.tsx` | Drift status section (three states); `missing` drift banner replaces old `isImported` banner |
| `tests/renderer/utils/compareDrift.test.ts` | New — pure function unit tests |

---

## Testing

`compareDrift()` is a pure function — fully unit testable without mocks:
- Matched: ID in both arrays → appears in `matched`
- Unmanaged: ID in live only → appears in `unmanaged`
- Missing: ID in imported only → appears in `missing`
- `type: 'unknown'` imported nodes excluded before matching
- Empty arrays → all empty results

---

## Out of Scope

- Heuristic/fuzzy matching (name-based, tag-based) — deferred
- Expanding `parser.ts` to cover all 24 `NodeType`s — deferred
- Multi-resource diff (e.g. SG rules comparison) — deferred
- Export drift report — deferred
- Multi-region drift — deferred
