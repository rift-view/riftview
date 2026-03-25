# Multi-Region Scan Design

**Date:** 2026-03-25
**Status:** Approved for implementation

---

## Overview

Enable Cloudblocks to scan and display resources from multiple AWS regions simultaneously. The backend scanner already supports parallel multi-region scans; this spec covers the UI for selecting regions, the canvas treatment for multi-region nodes, and the settings knobs for customization.

---

## 1. Region Selection UI

**Region chips sub-bar** — a 26px bar between TitleBar and the canvas/sidebar layout.

- Displays active regions as dismissible chips: `us-east-1 ×`
- A `+ add` chip opens a small dropdown listing standard AWS regions (minus already-active ones)
- Removing all chips is prevented — at least one region must remain active
- Changing the active region set calls `setSelectedRegions(regions)` on the store, then `window.cloudblocks.startScan(regions)` (array argument — the preload signature is `startScan(selectedRegions?: string[])`). Nodes are not explicitly cleared; the next scan delta will converge the canvas to the new region set naturally
- The existing single-region `<select>` in TitleBar is **removed**; the chips sub-bar replaces it entirely
- Persisted to `useCloudStore.selectedRegions` (already exists in the store)

**Region list source:** Static array of ~20 common AWS regions hardcoded in the component. No API call needed.

---

## 2. Canvas — Region Indicators

**Visual treatment:** Each node gets a small colored **left-edge accent strip** (3px wide, full node height) inside `ResourceNode`. The strip color maps to the node's region via a deterministic color palette.

- 8 default region colors chosen to be distinguishable across all 5 themes
- Color palette assigned by **first-seen order**: a `regionColorAssignments: Record<string, string>` map is built incrementally as new regions appear in `selectedRegions`. Once a region is assigned a color it keeps it for the lifetime of the session, even if removed and re-added. This prevents color shifts when regions are removed
- Indicators **auto-hide when `selectedRegions.length === 1`** — derived in `flowNodes` memo, no extra state
- When ≥ 2 regions active, the sub-bar chips display a colored dot matching their node accent color

**Zone containers (Topology view):** When ≥ 2 regions are active, `TopologyView` wraps each region's VPCs in a labeled `RegionZone` container node — same visual pattern as `GlobalZoneNode`. One zone per active region. Graph view stays flat (no containers).

---

## 3. Settings

Two new fields added to the `Settings` interface:

```ts
interface Settings {
  // ...existing fields...
  showRegionIndicators: boolean           // default: true
  regionColors: Record<string, string>    // default: {} (uses palette defaults)
}
```

- `showRegionIndicators: false` hides all accent strips and zone containers regardless of region count
- `regionColors` allows overriding the default color for a specific region name (e.g. `{ 'us-east-1': '#ff0000' }`)
- Settings UI: a toggle for `showRegionIndicators` + one text input per active region for color override
- No color picker — hex string input only in this iteration

---

## 4. Data Flow

```
selectedRegions (useCloudStore)
  → startScan IPC → ResourceScanner.updateRegions()
  → parallel scan per region → ScanDelta with region-tagged nodes
  → useCloudStore.nodes (each node already has node.region)
  → flowNodes memo: `selectedRegions`, `showRegionIndicators`, `regionColors` must be in the dependency array; if selectedRegions.length >= 2 and showRegionIndicators → attach regionColor to node data
  → ResourceNode: render left-edge strip if node.data.regionColor is set
  → TopologyView: if selectedRegions.length >= 2 → wrap VPC groups in RegionZoneNode
```

`CloudNode.region` is already populated by the scanner. No changes needed to scan output.

---

## 5. New Components / Files

| File | Change |
|------|--------|
| `components/RegionBar.tsx` | New — chips sub-bar component |
| `components/canvas/nodes/RegionZoneNode.tsx` | New — zone container for Topology view |
| `renderer/src/App.tsx` | Add `<RegionBar />` between TitleBar and main layout |
| `components/TitleBar.tsx` | Remove single-region `<select>` |
| `components/canvas/nodes/ResourceNode.tsx` | Add left-edge accent strip when `regionColor` set |
| `components/canvas/TopologyView.tsx` | Add RegionZone wrapping when ≥ 2 regions; add `regionZone: RegionZoneNode` to `NODE_TYPES` |
| `renderer/types/cloud.ts` | Add `showRegionIndicators: boolean`, `regionColors: Record<string, string>` to `Settings` |
| `store/cloud.ts` | Update `defaultSettings` with `showRegionIndicators: true, regionColors: {}` |
| `main/ipc/handlers.ts` | Update `DEFAULT_SETTINGS` with same two new fields (required for typecheck) |
| `hooks/useScanner.ts` or `useIpc.ts` | Call `setSelectedRegions([region])` alongside `setRegion` on profile load |

---

## 6. Initialization

On app start, `selectedRegions` in the store initializes to match the profile's default region (same value that `PROFILE_SELECT` IPC passes to `restartScanner`). The `useScanner` hook already calls `setRegion` on profile load — it must also call `setSelectedRegions([region])` so the RegionBar chip reflects the actual active region. Without this, the bar would show `us-east-1` while the scanner runs against the profile's configured region.

---

## 7. Out of Scope

- Color picker UI (hex string input only)
- Cross-region resource relationships (e.g. VPC peering edges)
- Per-region scan enable/disable without removing the chip (remove = disable)
- Persisting region set across app restarts (store resets to profile default on launch)
