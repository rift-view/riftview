# Canvas QoL — Panning, Persistent Positions & Saved Views

## Goal

Fix unreliable canvas panning, make node positions persist across re-scans, and allow saving up to 4 named layout views.

## Problem

1. `fitView` prop on both ReactFlow instances re-fits the viewport on every render, fighting manual panning.
2. No `panOnScroll` — trackpad two-finger scroll zooms instead of panning.
3. Node positions are fully recomputed every render — manual drags are discarded immediately.
4. No way to save and restore different node arrangements.

## Architecture

### Panning fixes (TopologyView + GraphView)

- Remove `fitView` prop from both `<ReactFlow>` instances.
- Add `panOnScroll={true}` for natural trackpad two-finger panning.
- Add `minZoom={0.1}` and `maxZoom={2}` to prevent getting lost at extreme zoom levels.
- Each view adds a `useEffect` with a `useRef` boolean guard (`hasFitted`) that fires `fitView()` once when `cloudNodes.length` first becomes non-zero. Subsequent renders and re-scans do not move the camera. If the node count drops back to 0 (profile switch, empty account) and rises again, `fitView()` fires again — this is intentional and correct (the user is looking at a new account/context). The reset of `hasFitted.current` to `false` must happen inside the same `useEffect` (when count is 0), not during render — setting it inline during render would violate React's rules of hooks.

### Position persistence (UIStore)

Position overrides are scoped per-view so that dragging in Topology does not affect Graph layout and vice versa.

Add to `useUIStore`:
- `nodePositions: { topology: Record<string, { x: number; y: number }>; graph: Record<string, { x: number; y: number }> }` — per-view override maps, both start empty.
- `setNodePosition(view: 'topology' | 'graph', id: string, pos: { x: number; y: number })` — saves a position for the given view.

Both views:
- Wire `onNodesChange` — extract `type === 'position'` events, call `setNodePosition` with the correct view key.
- Position overrides apply to **top-level nodes only** (nodes without `extent: 'parent'`). Child nodes inside subnet/VPC containers in TopologyView carry `extent: 'parent'` and their positions are layout-managed; applying overrides to them risks silent clamping when the parent resizes after a re-scan. To check the guard, look up the node by `id` in the current `flowNodes` array (via `useNodes()` hook or a local ref) — `cloudNodes` has no `extent` field. Skip persisting any node where `extent === 'parent'`.
- When building `flowNodes`, check the per-view `nodePositions[n.id]` first; fall back to computed position if no override exists. Do not apply overrides to child nodes (same `extent: 'parent'` guard).

Positions are stored in memory only (reset on app restart). Stale entries for deleted nodes stay in the map — harmless.

### Saved views (UIStore + toolbar)

A "view slot" holds a name and a snapshot of the current view's node positions. Max 4 slots. Slots are independent of the active canvas view (topology vs graph) — saved positions are always taken from whichever canvas view is currently active.

Add to `useUIStore`:
- `savedViews: Array<{ name: string; positions: Record<string, { x: number; y: number }> } | null>` — array of 4 entries, `null` means slot is empty.
- `activeViewSlot: number | null` — which slot (0–3) is currently loaded, or null.
- `saveView(slot: number, name: string, view: 'topology' | 'graph')` — snapshots `nodePositions[view]` into the slot with the given name; sets `activeViewSlot` to this slot.
- `loadView(slot: number, view: 'topology' | 'graph', fitView: () => void)` — copies the slot's positions into `nodePositions[view]`; sets `activeViewSlot`; calls `fitView()` so the camera fits the restored layout.

Cross-view loading note: a slot saved in Topology mode stores topology coordinates. Loading it while in Graph view will apply those coordinates to the graph canvas. The positions may look slightly off in graph layout but are not destructive — the user can re-drag and re-save. This is accepted behavior; no warning or prevention is needed.

`activeViewSlot` is only cleared when a different slot is loaded or `saveView` is called for a different slot. Manually panning/zooming or pressing the Fit button does not clear `activeViewSlot` — the slot stays highlighted as "current base layout." Switching between Topology and Graph canvas views (via `setView`) also does not clear `activeViewSlot`; the slot button remains highlighted even though the loaded positions apply to the previous view's coordinate space. This is accepted — a minor cosmetic inconsistency not worth the added complexity of view-scoped slot tracking.

**Toolbar UI (in CloudCanvas):**

- Four numbered buttons labeled 1, 2, 3, 4 in the toolbar. Empty slots are muted; saved slots are accent-colored.
- **Clicking an empty slot** opens the Save modal directly (pre-filled with an empty name) — this is the only way to create a new saved view.
- **Clicking a saved (non-active) slot** calls `loadView`, restores positions + camera, and shows the slot's name as a label next to the buttons.
- **Clicking the active slot** (already loaded) opens the Save modal to rename/re-snapshot.
- The modal has a single text input (pre-filled with the current slot name if already saved, empty for new slots, max 24 characters) and Save / Cancel buttons.

**New component:** `SaveViewModal` — simple controlled modal with an input and two action buttons, matches existing retro dark aesthetic.

## Components Modified

- `src/renderer/store/ui.ts` — add `nodePositions`, `setNodePosition`, `savedViews`, `activeViewSlot`, `saveView`, `loadView`
- `src/renderer/components/canvas/TopologyView.tsx` — panning config, position overrides (top-level nodes only), one-time fitView on first load
- `src/renderer/components/canvas/GraphView.tsx` — same as TopologyView
- `src/renderer/components/canvas/CloudCanvas.tsx` — saved view buttons + active view name label in toolbar; passes `fitView` callback to `loadView`
- `src/renderer/components/canvas/SaveViewModal.tsx` — new modal component

## Testing

New test file `src/renderer/store/__tests__/ui.test.ts`:
- `setNodePosition` saves correct id/coords to the correct per-view map.
- `saveView` snapshots current positions into the correct slot with the given name.
- `loadView` copies slot positions into the correct per-view map, updates `activeViewSlot`, and invokes the `fitView` callback.
- `activeViewSlot` does not change when `setNodePosition` is called (panning/dragging).

New test file `src/renderer/components/canvas/__tests__/GraphView.test.tsx`:
- `fitView` is called once when `cloudNodes.length` transitions from 0 → N.
- `fitView` is NOT called again on subsequent node updates.
- `fitView` IS called again if count drops back to 0 and then becomes non-zero (0 → N → 0 → N).

New test file `src/renderer/components/canvas/__tests__/TopologyView.test.tsx`:
- Same fitView timing tests as GraphView (including the 0 → N → 0 → N re-fire case).
- Position overrides are NOT applied to child nodes with `extent: 'parent'`.

New test file `src/renderer/components/canvas/__tests__/SaveViewModal.test.tsx`:
- Renders with pre-filled name (max 24 chars) when slot already has a name.
- Calls `saveView` with correct slot and typed name on confirm.
- Calls nothing on cancel.
