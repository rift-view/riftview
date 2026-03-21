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
2. After every successful scan, if `importedNodes.length > 0`

Drift UI is hidden entirely when no imported nodes are present. `clearImportedNodes()` strips all drift state from live nodes and clears `importedNodes`.

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
  missing:   string[]  // IDs in imported only
}

export function compareDrift(
  liveNodes: CloudNode[],
  importedNodes: CloudNode[],
): DriftResult
```

**Matching strategy: strict ID equality only.** No heuristics. `liveNode.id === importedNode.id` = match.

Known ID conventions (from parser.ts):
- EC2, VPC, Subnet, SG, RDS, CloudFront, API GW → `attrs['id']` (AWS resource ID)
- Lambda → `attrs['function_name']` (same as live scanner)
- ALB → `attrs['arn']` (same as live scanner)
- S3 → `attrs['id']` (bucket name, same as live scanner)

Unrecognized tfstate types (`type: 'unknown'`) are excluded from comparison.

A separate `applyDrift()` utility applies results to the store:
- Matched live nodes: `driftStatus = 'matched'`, `tfMetadata = importedNode.metadata`
- Unmanaged live nodes: `driftStatus = 'unmanaged'`
- Missing imported nodes: `driftStatus = 'missing'` (stay in `importedNodes`, visually updated)
- Matched imported nodes: removed from `importedNodes` (absorbed into live node)

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
- When active: `flowNodes` filtered to nodes where `driftStatus === 'unmanaged' || driftStatus === 'missing'`
- State stored as `driftFilterActive` in `useUIStore`

---

## Inspector Panel

A `DRIFT STATUS` section renders below the node header, above metadata fields. Replaces the existing "Imported from Terraform — read-only" banner for imported nodes.

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
│ ✕ MISSING                           │
│ Declared in Terraform but not       │
│ found in live AWS.                  │
└─────────────────────────────────────┘
```
Read-only. Existing imported node behavior unchanged.

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
| `src/renderer/utils/compareDrift.ts` | New — pure `compareDrift()` + `applyDrift()` |
| `src/renderer/store/cloud.ts` | Call `applyDrift()` in `setImportedNodes()`; strip drift fields in `clearImportedNodes()`; call after scan if importedNodes present |
| `src/renderer/store/ui.ts` | Add `driftFilterActive`, `toggleDriftFilter` |
| `src/renderer/components/canvas/nodes/ResourceNode.tsx` | Drift stripe + corner badge |
| `src/renderer/components/canvas/CloudCanvas.tsx` | Drift filter toolbar button |
| `src/renderer/components/canvas/TopologyView.tsx` | Apply `driftFilterActive` to `flowNodes` |
| `src/renderer/components/canvas/GraphView.tsx` | Same |
| `src/renderer/components/Inspector.tsx` | Drift status section (three states) |
| `tests/renderer/utils/compareDrift.test.ts` | New — pure function unit tests |

---

## Testing

`compareDrift()` is a pure function — fully unit testable without mocks:
- Matched: ID in both arrays → appears in `matched`
- Unmanaged: ID in live only → appears in `unmanaged`
- Missing: ID in imported only → appears in `missing`
- Unknown type imported nodes excluded
- Empty arrays → all empty results
- Duplicate IDs handled gracefully

---

## Out of Scope

- Heuristic/fuzzy matching (name-based, tag-based) — deferred
- Multi-resource diff (e.g. SG rules comparison) — deferred
- Export drift report — deferred
- Multi-region drift — deferred
