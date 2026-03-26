# Filter Composition Model — Design Spec

**Date:** 2026-03-26
**Status:** Proposed

---

## Problem

Cloudblocks currently has three independent visibility systems that affect how nodes appear on the canvas:

1. **Sidebar filter** (`useUIStore.sidebarFilter: NodeType | null`) — dims non-matching nodes to opacity 0.2
2. **Scan error badges** (`useCloudStore.scanErrors`) — shows ⚠ in sidebar and a dismissible `ScanErrorStrip` banner; does not affect canvas opacity
3. **Region zones** (`showRegionIndicators` + `RegionZoneNode`) — visual bounding boxes grouped by region; not an opacity filter

These systems are entirely independent. Adding a fourth filter type (e.g., "show only drifted nodes" or "highlight nodes with IAM issues") requires another independent opacity calculation, scattered across multiple canvas components. There is no single place to compose these rules.

---

## Solution: Composable Filter Model

Replace the single `sidebarFilter` field with a `NodeFilter` array. All canvas opacity logic reads from this one array.

### Core Type

```ts
type NodeFilter = {
  id: string;           // stable identifier for add/remove
  label: string;        // human-readable, shown in CommandDrawer filter chips
  test: (node: CloudNode) => boolean;
};
```

### UIStore Changes

Replace:
```ts
sidebarFilter: NodeType | null;
setSidebarFilter: (type: NodeType | null) => void;
```

With:
```ts
activeFilters: NodeFilter[];
addFilter: (filter: NodeFilter) => void;
removeFilter: (id: string) => void;
clearFilters: () => void;
```

`addFilter` replaces any existing filter with the same `id` (upsert semantics), so callers do not need to remove before re-adding.

---

## Composition Logic

- **Empty `activeFilters`** → all nodes render at full opacity (no filtering)
- **Non-empty `activeFilters`** → a node passes if it satisfies **any** active filter (OR composition)
  - Passing node: opacity `1`
  - Failing node: opacity `0.2`

```
passes = activeFilters.some(f => f.test(node))
opacity = passes ? 1 : 0.2
```

This OR model means filters are additive inclusions: each filter adds more visible nodes, rather than narrowing. A node only dims when it fails every active filter simultaneously.

---

## Migration of Existing Filters

### Sidebar type filter

**Before:** `setSidebarFilter(type)` / `setSidebarFilter(null)`

**After:**
```ts
// activate
addFilter({ id: 'sidebar-type', label: typeLabelFor(type), test: n => n.type === type })

// deactivate
removeFilter('sidebar-type')
```

The confirmation modal (already implemented for switching service types while a filter is active) is preserved. The modal triggers when `activeFilters` has an entry with `id: 'sidebar-type'` and the user clicks a different service type in the sidebar.

### Drift filter

```ts
addFilter({ id: 'drift', label: 'Drifted nodes', test: n => n.driftStatus !== undefined })
```

### Region filter

```ts
addFilter({ id: `region-${regionCode}`, label: `Region: ${regionCode}`, test: n => n.data.region === regionCode })
```

Multiple region filters can coexist with OR semantics, so selecting two regions shows nodes from either.

---

## What Stays Unchanged

| System | Change |
|--------|--------|
| Scan error badges (sidebar ⚠) | No change — not a canvas filter |
| `ScanErrorStrip` banner | No change — not a canvas filter |
| Region zone bounding boxes (`RegionZoneNode`) | No change — visual grouping, not an opacity filter |
| Single-node selection highlight | No change — independent of filter state |
| Confirmation modal on sidebar filter switch | Preserved — triggers when `sidebar-type` filter is active |

Scan error state does not affect canvas node opacity. It surfaces only through the sidebar badge and the dismissible strip banner.

---

## Files That Would Change in Implementation

| File | Change |
|------|--------|
| `src/renderer/store/ui.ts` | Replace `sidebarFilter`/`setSidebarFilter` with `activeFilters`, `addFilter`, `removeFilter`, `clearFilters` |
| `src/renderer/components/Sidebar.tsx` | Use `addFilter`/`removeFilter('sidebar-type')` instead of `setSidebarFilter`; read `activeFilters.some(f => f.id === 'sidebar-type')` to determine active state |
| `src/renderer/components/canvas/TopologyView.tsx` | `flowNodes` memo reads `activeFilters` instead of `sidebarFilter` to compute node opacity |
| `src/renderer/components/canvas/GraphView.tsx` | Same as `TopologyView.tsx` |
| `src/renderer/components/CommandDrawer.tsx` | Optionally render active filter chips (label + remove button) from `activeFilters` |
| `src/renderer/types/cloud.ts` | No change (NodeFilter is a new type; CloudNode is unchanged) |

---

## Non-Goals for This Design

- **AND composition** — not included. OR is sufficient for the planned filter set and avoids the UX problem of over-filtering to zero nodes.
- **Persisted filters** — `activeFilters` is in-memory session state only, not saved to disk. Saved views snapshot `nodePositions`, not filters.
- **Filter UI panel** — no dedicated filter management UI in this milestone. Filters are added programmatically by existing sidebar/toolbar interactions.
