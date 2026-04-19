# Multi-Region Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-region scanning with a chip-based RegionBar below the TitleBar and color-coded region indicators on canvas nodes.

**Architecture:** The scanner and store already support multiple regions end-to-end (`ResourceScanner` fans out, `selectedRegions: string[]` exists in `useCloudStore`). This plan is almost entirely UI: a new `RegionBar` chips component, a `regionColors` utility for stable color assignment, a left-edge accent strip on `ResourceNode`, a `RegionZoneNode` container in `TopologyView`, and two new Settings fields.

**Tech Stack:** React 19, Zustand 5, React Flow v12 (@xyflow/react), TypeScript, Electron 32, Tailwind CSS 4, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/renderer/types/cloud.ts` | Modify | Add `showRegionIndicators: boolean`, `regionColors: Record<string, string>` to `Settings` |
| `src/main/ipc/handlers.ts` | Modify | Add same two fields to `DEFAULT_SETTINGS` |
| `src/renderer/store/cloud.ts` | Modify | Add same two fields to both `defaultSettings` objects (lines ~57 and ~147) |
| `src/renderer/utils/regionColors.ts` | **Create** | 8-color palette + stable first-seen assignment map + `getRegionColor()` |
| `src/renderer/components/RegionBar.tsx` | **Create** | Chips sub-bar: shows active regions, add/remove, triggers rescan |
| `src/renderer/src/App.tsx` | Modify | Insert `<RegionBar />` between `<TitleBar />` and the main flex row |
| `src/renderer/components/TitleBar.tsx` | Modify | Remove region `<select>` and its handler |
| `src/renderer/components/canvas/nodes/ResourceNode.tsx` | Modify | Render left-edge accent strip when `node.data.regionColor` is set |
| `src/renderer/components/canvas/nodes/RegionZoneNode.tsx` | **Create** | Zone container node for Topology view (mirrors GlobalZoneNode) |
| `src/renderer/components/canvas/TopologyView.tsx` | Modify | Add `regionZone: RegionZoneNode` to `NODE_TYPES`; add region zone wrapping to `buildFlowNodes`; add `selectedRegions`, `showRegionIndicators`, `regionColors` to memo deps |
| `src/renderer/components/SettingsModal.tsx` | Modify | Add `showRegionIndicators` toggle + per-region hex color inputs to Regions tab |
| `src/renderer/hooks/useScanner.ts` | Modify | Call `setSelectedRegions([region])` alongside `setRegion` on profile-load delta |

---

## Task 1: Extend Settings type and defaults

**Files:**
- Modify: `src/renderer/types/cloud.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/renderer/store/cloud.ts`

- [ ] **Step 1: Add fields to `Settings` interface in `cloud.ts`**

In `src/renderer/types/cloud.ts`, extend `Settings`:

```ts
export interface Settings {
  deleteConfirmStyle: 'type-to-confirm' | 'command-drawer'
  scanInterval: 15 | 30 | 60 | 'manual'
  theme: Theme
  showRegionIndicators: boolean
  regionColors: Record<string, string>
}
```

- [ ] **Step 2: Update `DEFAULT_SETTINGS` in `handlers.ts`**

In `src/main/ipc/handlers.ts`, find `const DEFAULT_SETTINGS` and add:

```ts
const DEFAULT_SETTINGS = {
  deleteConfirmStyle: 'type-to-confirm' as const,
  scanInterval: 30 as const,
  theme: 'dark' as const,
  showRegionIndicators: true,
  regionColors: {} as Record<string, string>,
}
```

- [ ] **Step 3: Update both `defaultSettings` objects in `store/cloud.ts`**

There are two `defaultSettings` objects in `store/cloud.ts` (one around line 57, one around line 147 in the test factory). Add to both:

```ts
showRegionIndicators: true,
regionColors: {},
```

- [ ] **Step 4: Run typecheck**

```bash
cd cloudblocks && npm run typecheck
```

Expected: no errors. If `Settings` is spread anywhere without the new fields, add them.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/types/cloud.ts src/main/ipc/handlers.ts src/renderer/store/cloud.ts
git commit -m "feat(multi-region): add showRegionIndicators and regionColors to Settings"
```

---

## Task 2: Region color utility

**Files:**
- Create: `src/renderer/utils/regionColors.ts`

- [ ] **Step 1: Create the utility**

```ts
// Palette — 8 colors distinguishable across all 5 app themes
const PALETTE = [
  '#4a9eff', // blue
  '#f0a050', // orange
  '#50c87a', // green
  '#c084fc', // purple
  '#f87171', // red
  '#34d399', // teal
  '#fbbf24', // amber
  '#a78bfa', // violet
]

// Stable first-seen assignment: once a region gets a color it keeps it
// for the lifetime of the module (i.e., the app session).
const assignments = new Map<string, string>()
let nextIndex = 0

export function getRegionColor(region: string, override?: string): string {
  if (override) return override
  if (!assignments.has(region)) {
    assignments.set(region, PALETTE[nextIndex % PALETTE.length])
    nextIndex++
  }
  return assignments.get(region)!
}

/**
 * Build a { region → color } map for the given active regions,
 * applying per-region overrides from settings.
 */
export function buildRegionColorMap(
  regions: string[],
  overrides: Record<string, string> = {},
): Record<string, string> {
  return Object.fromEntries(
    regions.map((r) => [r, getRegionColor(r, overrides[r])])
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd cloudblocks && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/utils/regionColors.ts
git commit -m "feat(multi-region): add regionColors utility with stable first-seen palette"
```

---

## Task 3: RegionBar component

**Files:**
- Create: `src/renderer/components/RegionBar.tsx`

The bar shows when `selectedRegions.length >= 1` always (not just multi-region) so it's always the region control surface. It only shows color dots on chips when ≥ 2 regions are active.

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react'
import { useCloudStore } from '../store/cloud'
import { buildRegionColorMap } from '../utils/regionColors'

const ALL_REGIONS = [
  'us-east-1','us-east-2','us-west-1','us-west-2',
  'eu-west-1','eu-west-2','eu-central-1',
  'ap-southeast-1','ap-southeast-2','ap-northeast-1',
  'ap-south-1','sa-east-1','ca-central-1',
]

export function RegionBar(): React.JSX.Element {
  const selectedRegions    = useCloudStore((s) => s.selectedRegions)
  const setSelectedRegions = useCloudStore((s) => s.setSelectedRegions)
  const regionColors       = useCloudStore((s) => s.settings.regionColors)
  const [addOpen, setAddOpen] = useState(false)

  const colorMap = buildRegionColorMap(selectedRegions, regionColors)
  const showColors = selectedRegions.length >= 2

  function removeRegion(r: string): void {
    if (selectedRegions.length <= 1) return
    const next = selectedRegions.filter((x) => x !== r)
    setSelectedRegions(next)
    window.cloudblocks.startScan(next)
  }

  function addRegion(r: string): void {
    const next = [...selectedRegions, r]
    setSelectedRegions(next)
    window.cloudblocks.startScan(next)
    setAddOpen(false)
  }

  const available = ALL_REGIONS.filter((r) => !selectedRegions.includes(r))

  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            6,
        padding:        '0 12px',
        height:         26,
        flexShrink:     0,
        background:     'var(--cb-bg-elevated)',
        borderBottom:   '1px solid var(--cb-border)',
        fontFamily:     'monospace',
      }}
    >
      <span style={{ fontSize: 8, color: 'var(--cb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 2 }}>
        Regions
      </span>

      {selectedRegions.map((r) => (
        <span
          key={r}
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          4,
            background:   'var(--cb-bg-panel)',
            border:       `1px solid ${showColors ? colorMap[r] : 'var(--cb-border)'}`,
            borderRadius: 10,
            padding:      '1px 7px',
            fontSize:     9,
            color:        'var(--cb-text-primary)',
          }}
        >
          {showColors && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: colorMap[r], flexShrink: 0 }} />
          )}
          {r}
          {selectedRegions.length > 1 && (
            <button
              onClick={() => removeRegion(r)}
              style={{
                background: 'none', border: 'none', padding: 0, marginLeft: 2,
                color: 'var(--cb-text-muted)', cursor: 'pointer', fontSize: 9, lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </span>
      ))}

      {available.length > 0 && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setAddOpen((o) => !o)}
            style={{
              background:   'none',
              border:       '1px dashed var(--cb-border)',
              borderRadius: 10,
              padding:      '1px 7px',
              fontSize:     9,
              color:        'var(--cb-text-muted)',
              cursor:       'pointer',
              fontFamily:   'monospace',
            }}
          >
            + add
          </button>
          {addOpen && (
            <div
              style={{
                position:   'absolute',
                top:        '100%',
                left:       0,
                zIndex:     200,
                marginTop:  4,
                background: 'var(--cb-bg-panel)',
                border:     '1px solid var(--cb-border)',
                borderRadius: 4,
                minWidth:   140,
                boxShadow:  '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {available.map((r) => (
                <button
                  key={r}
                  onClick={() => addRegion(r)}
                  style={{
                    display:     'block',
                    width:       '100%',
                    textAlign:   'left',
                    background:  'none',
                    border:      'none',
                    padding:     '5px 10px',
                    fontSize:    10,
                    color:       'var(--cb-text-secondary)',
                    cursor:      'pointer',
                    fontFamily:  'monospace',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cb-bg-elevated)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Close dropdown on outside click**

Add a `useEffect` inside `RegionBar` that listens for `mousedown` on `document` and calls `setAddOpen(false)` when the click is outside the dropdown. Use a `useRef` on the container div.

```tsx
const containerRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (!addOpen) return
  function handleOutside(e: MouseEvent): void {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setAddOpen(false)
    }
  }
  document.addEventListener('mousedown', handleOutside)
  return () => document.removeEventListener('mousedown', handleOutside)
}, [addOpen])
```

Wrap the `<div style={{ position: 'relative' }}>` around the add button in a `<div ref={containerRef}>`.

- [ ] **Step 3: Run typecheck**

```bash
cd cloudblocks && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/RegionBar.tsx
git commit -m "feat(multi-region): add RegionBar chip component"
```

---

## Task 4: Wire RegionBar into App; remove region select from TitleBar

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/components/TitleBar.tsx`

- [ ] **Step 1: Insert RegionBar in App.tsx**

In `App.tsx`, import `RegionBar` and insert it between `<TitleBar />` and the error banner / main flex row:

```tsx
import { RegionBar } from '../components/RegionBar'

// Inside return, replace:
//   <TitleBar />
//   {errorMessage && ...}
//   <div className="flex flex-1 ...">
// with:
      <TitleBar />
      <RegionBar />
      {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setError(null)} />}
      <div className="flex flex-1 overflow-hidden">
```

- [ ] **Step 2: Remove region select from TitleBar.tsx**

In `TitleBar.tsx`:
1. Remove the `{/* Region selector */}` `<select>` block (lines ~143–152)
2. Remove `const region = useCloudStore((s) => s.region)` — no longer needed in TitleBar
3. Remove `const setRegion = useCloudStore((s) => s.setRegion)` — no longer needed in TitleBar
4. Remove `handleRegionChange` function
5. Remove `REGIONS` constant at top of file (now lives in `RegionBar`)

Keep `setRegion` import in `useScanner` — it's still used there.

- [ ] **Step 3: Run typecheck and tests**

```bash
cd cloudblocks && npm run typecheck && npm test
```

Expected: all pass. If any test references the region select in TitleBar, update it.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/components/TitleBar.tsx
git commit -m "feat(multi-region): wire RegionBar; remove region select from TitleBar"
```

---

## Task 5: Region accent strip on ResourceNode

**Files:**
- Modify: `src/renderer/components/canvas/nodes/ResourceNode.tsx`

The node data already carries arbitrary fields. We add `regionColor?: string` to `ResourceNodeData` and render a 3px left strip when set.

- [ ] **Step 1: Add `regionColor` to `ResourceNodeData`**

Find the `interface ResourceNodeData` (or `type ResourceNodeData`) in `ResourceNode.tsx` and add:

```ts
interface ResourceNodeData {
  // ... existing fields ...
  regionColor?: string
}
```

- [ ] **Step 2: Render the accent strip**

In the node's return JSX, the outer wrapper div already has a `position: relative` or can be given one. Add the strip as an absolutely-positioned child:

```tsx
{node.data.regionColor && (
  <div
    style={{
      position:     'absolute',
      left:         0,
      top:          0,
      bottom:       0,
      width:        3,
      borderRadius: '4px 0 0 4px',
      background:   node.data.regionColor,
      pointerEvents: 'none',
    }}
  />
)}
```

Place it as the first child inside the node container so it sits behind the content.

- [ ] **Step 3: Ensure the outer container has `position: relative` and `overflow: hidden`**

The strip needs to be clipped. The node wrapper likely already has these — verify and add if missing.

- [ ] **Step 4: Run typecheck**

```bash
cd cloudblocks && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/canvas/nodes/ResourceNode.tsx
git commit -m "feat(multi-region): add region accent strip to ResourceNode"
```

---

## Task 6: RegionZoneNode + TopologyView zone wrapping

**Files:**
- Create: `src/renderer/components/canvas/nodes/RegionZoneNode.tsx`
- Modify: `src/renderer/components/canvas/TopologyView.tsx`

- [ ] **Step 1: Create RegionZoneNode**

Mirror `GlobalZoneNode.tsx` but with a region label and accent color:

```tsx
import type { NodeProps } from '@xyflow/react'

interface RegionZoneData {
  label: string
  color?: string
}

export function RegionZoneNode({ data }: NodeProps): React.JSX.Element {
  const d = data as RegionZoneData
  return (
    <div
      style={{
        background:    'rgba(255,255,255,0.015)',
        border:        `1px dashed ${d.color ?? 'var(--cb-border)'}`,
        borderRadius:  8,
        minWidth:      200,
        minHeight:     80,
        fontFamily:    'monospace',
        overflow:      'hidden',
        pointerEvents: 'none',
      }}
    >
      <div style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {d.color && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 9, color: d.color ?? 'var(--cb-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {d.label}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `regionZone` to `NODE_TYPES` in TopologyView**

```ts
import { RegionZoneNode } from './nodes/RegionZoneNode'

const NODE_TYPES = {
  resource:   ResourceNode,
  vpc:        VpcNode,
  subnet:     SubnetNode,
  globalZone: GlobalZoneNode,
  regionZone: RegionZoneNode,   // ← add this
}
```

- [ ] **Step 3: Pass `selectedRegions`, `showRegionIndicators`, `regionColors` into `buildFlowNodes`**

Change the signature of `buildFlowNodes`:

```ts
function buildFlowNodes(
  cloudNodes: CloudNode[],
  selectedId: string | null,
  highlightedIds: Set<string> | null,
  collapsedSubnets: Set<string>,
  selectedRegions: string[],
  showRegionIndicators: boolean,
  regionColorMap: Record<string, string>,
): Node[]
```

- [ ] **Step 4: Inside `buildFlowNodes`, assign `regionColor` to each resource node's data**

In the section that builds resource nodes, add:

```ts
const regionColor = showRegionIndicators && selectedRegions.length >= 2
  ? (regionColorMap[node.region] ?? undefined)
  : undefined

// In the node object:
data: { ...existingData, regionColor }
```

- [ ] **Step 5: Inside `buildFlowNodes`, inject `regionZone` container nodes when ≥ 2 regions**

After computing VPC layout but before returning the node array, add region zone containers:

```ts
if (showRegionIndicators && selectedRegions.length >= 2) {
  for (const region of selectedRegions) {
    const regionNodes = cloudNodes.filter((n) => n.region === region)
    if (regionNodes.length === 0) continue
    // Compute bounding box of all VPCs + global nodes in this region
    // Use a generous padding (e.g. 40px) around the computed bbox
    // Add a node of type 'regionZone' with zIndex: -2, position behind VPCs
    allNodes.push({
      id:       `region-zone-${region}`,
      type:     'regionZone',
      position: { x: bbox.x - 40, y: bbox.y - 40 },
      style:    { width: bbox.width + 80, height: bbox.height + 80 },
      data:     { label: region, color: regionColorMap[region] },
      selectable: false,
      draggable:  false,
      zIndex:    -2,
    })
  }
}
```

For the bounding box: iterate the already-computed VPC node positions for nodes in that region and find min/max x/y. Use the same layout constants (`RES_H`, `VPC_PAD`, etc.) that `buildFlowNodes` already knows.

- [ ] **Step 6: Update the `flowNodes` memo call to pass new args and add deps**

Find the `useMemo` that calls `buildFlowNodes` (around line 462) and:
1. Pass `selectedRegions`, `showRegionIndicators`, `regionColorMap` (computed inline from store)
2. Add them to the dependency array

```ts
const selectedRegions     = useCloudStore((s) => s.selectedRegions)
const showRegionIndicators = useCloudStore((s) => s.settings.showRegionIndicators)
const regionColorsSetting  = useCloudStore((s) => s.settings.regionColors)
const regionColorMap       = useMemo(
  () => buildRegionColorMap(selectedRegions, regionColorsSetting),
  [selectedRegions, regionColorsSetting]
)
```

Add `selectedRegions`, `showRegionIndicators`, `regionColorMap` to the main `flowNodes` memo dependency array.

- [ ] **Step 7: Run typecheck and tests**

```bash
cd cloudblocks && npm run typecheck && npm test
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/canvas/nodes/RegionZoneNode.tsx src/renderer/components/canvas/TopologyView.tsx
git commit -m "feat(multi-region): RegionZoneNode + zone wrapping in TopologyView + region accent data"
```

---

## Task 7: Settings UI for region indicators

**Files:**
- Modify: `src/renderer/components/SettingsModal.tsx`

The existing Regions tab already shows checkboxes per region. We append region indicator controls below the existing list.

- [ ] **Step 1: Add indicator toggle below the regions list**

In `SettingsModal.tsx`, find the Regions tab block (around line 316). After the existing region checkboxes and note, add:

```tsx
<div style={{ marginTop: 16, borderTop: '1px solid var(--cb-border)', paddingTop: 12 }}>
  <div style={sectionLabel}>Region Indicators</div>
  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
    <input
      type="checkbox"
      checked={settings.showRegionIndicators}
      onChange={(e) => handleSettingChange('showRegionIndicators', e.target.checked)}
      style={{ accentColor: 'var(--cb-accent)', cursor: 'pointer' }}
    />
    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--cb-text-secondary)' }}>
      Show region color indicators on nodes (when ≥ 2 regions active)
    </span>
  </label>

  {settings.showRegionIndicators && selectedRegions.length >= 2 && (
    <div>
      <div style={{ fontSize: 9, color: 'var(--cb-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        Custom colors (hex, leave blank for default)
      </div>
      {selectedRegions.map((r) => (
        <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--cb-text-secondary)', minWidth: 120 }}>{r}</span>
          <input
            type="text"
            placeholder={getRegionColor(r)}
            value={settings.regionColors[r] ?? ''}
            onChange={(e) => {
              const val = e.target.value.trim()
              const next = { ...settings.regionColors }
              if (val) next[r] = val; else delete next[r]
              handleSettingChange('regionColors', next)
            }}
            style={{
              width: 90, fontFamily: 'monospace', fontSize: 10,
              background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)',
              borderRadius: 3, padding: '2px 6px', color: 'var(--cb-text-primary)',
            }}
          />
          {(settings.regionColors[r] || getRegionColor(r)) && (
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              background: settings.regionColors[r] || getRegionColor(r),
              border: '1px solid var(--cb-border)',
              flexShrink: 0,
            }} />
          )}
        </label>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 2: Import `getRegionColor` at top of SettingsModal**

```ts
import { getRegionColor } from '../utils/regionColors'
```

- [ ] **Step 3: Run typecheck and tests**

```bash
cd cloudblocks && npm run typecheck && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/SettingsModal.tsx
git commit -m "feat(multi-region): add region indicator settings to SettingsModal Regions tab"
```

---

## Task 8: Sync selectedRegions on profile load

**Files:**
- Modify: `src/renderer/hooks/useScanner.ts`

The scanner receives a profile-change delta and calls `setRegion`. It must also call `setSelectedRegions([region])` so the RegionBar reflects the correct initial region when switching profiles.

- [ ] **Step 1: Read the current `useScanner` implementation**

Read `src/renderer/hooks/useScanner.ts` fully to understand where `setRegion` is called on profile load.

- [ ] **Step 2: Add `setSelectedRegions` call alongside `setRegion`**

Find the `setRegion(first.region)` call (around line 23) and add:

```ts
const setSelectedRegions = useCloudStore((s) => s.setSelectedRegions)

// In the delta handler where setRegion is called:
setRegion(first.region)
setSelectedRegions([first.region])   // reset to single region on profile change
```

- [ ] **Step 3: Run typecheck and tests**

```bash
cd cloudblocks && npm run typecheck && npm test
```

Expected: all 347 tests pass.

- [ ] **Step 4: Final check — run full CI suite**

```bash
cd cloudblocks && npm run lint && npm run typecheck && npm test
```

Expected: all three pass clean.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/useScanner.ts
git commit -m "feat(multi-region): sync selectedRegions to profile default on profile change"
```

---

## Done

All tasks complete when `npm run lint && npm run typecheck && npm test` all pass clean and the RegionBar is visible below the TitleBar with working add/remove and color indicators appearing when ≥ 2 regions are active.
