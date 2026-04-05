# Phase 1: Visual Command Board — Design Spec

**Date:** 2026-04-05
**Author:** Foreman (autonomous, user delegated)
**Status:** Approved for implementation

---

## Goal

Make the canvas an operational command board — not a diagram. Three flag-gated features deliver this:

1. **STATUS_LANGUAGE** — richer visual encoding of live health on ResourceNode
2. **ACTION_RAIL** — inline hover actions on every node (Copy ARN, Open Console)
3. **COMMAND_BOARD** — new "Command" view: tier-based swim lanes showing request path

All three are independently toggleable via `flag('FLAG_NAME')` in `.env.local`. All default to `false` (off in production). The app is fully functional without any flag enabled.

---

## Feature 1: STATUS_LANGUAGE

### What it does

Upgrades ResourceNode's status communication from a single colored stripe to a richer visual language:

| Status | Current | Enhanced |
|--------|---------|---------|
| `running` | green left stripe | unchanged (already clear) |
| `error` | red left stripe | red stripe + pulsing red glow ring |
| `pending` / `creating` | amber left stripe | amber stripe + shimmer sweep animation |
| `stopped` | gray left stripe | gray stripe + 0.5 opacity |
| `deleting` | red left stripe | red stripe + fade-pulse animation |
| `unknown` | dark gray stripe | dark gray stripe + italic label |
| drift (any status) | amber dashed ring | unchanged spec — already handled by driftStripeColor |

### Implementation

**CSS animations** added to `src/renderer/src/assets/main.css`:
```css
@keyframes cb-pulse-error {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  50%       { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.35); }
}
@keyframes cb-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
@keyframes cb-fade-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
```

**ResourceNode.tsx** — conditional inline styles added to the outer wrapper when `flag('STATUS_LANGUAGE')` is true:
- `error`: `animation: 'cb-pulse-error 2s ease-in-out infinite'`
- `pending`/`creating`: shimmer overlay pseudo-element (rendered as a child `<div>` since React can't target pseudo-elements)
- `stopped`: `opacity: 0.5`
- `deleting`: `animation: 'cb-fade-pulse 1.5s ease-in-out infinite'`
- `unknown`: italic className on the label text

**Shimmer overlay** — a child `<div>` with `position: absolute`, `inset: 0`, `overflow: hidden`, `pointer-events: none`, containing a gradient strip that animates via `cb-shimmer`.

### Constraints
- `flag('STATUS_LANGUAGE')` is read at render time (not cached)
- No changes to data flow, store, or IPC — purely visual
- Animations must respect `prefers-reduced-motion` — wrap in `@media (prefers-reduced-motion: no-preference)`
- Does NOT affect drag, selection, or click behavior

---

## Feature 2: ACTION_RAIL

### What it does

A minimal action strip that appears on ResourceNode hover. Surfacing 2 always-available actions inline eliminates the "select → Inspector → click" round-trip for the most common operations.

### Actions

| Action | Icon | Condition | Behavior |
|--------|------|-----------|----------|
| Copy ARN | `⌘` or clipboard SVG | Always shown | `navigator.clipboard.writeText(node.id)` + `showToast('ARN copied', 'success')` |
| Open Console | `↗` arrow SVG | `buildConsoleUrl(node) !== null` | `window.open(url, '_blank', 'noopener')` |

Edit and Delete are intentionally deferred — they require modal coordination that belongs in Phase 2's execution engine wiring.

### Component: `ActionRail.tsx`

```
src/renderer/components/canvas/nodes/ActionRail.tsx
```

Props:
```ts
interface ActionRailProps {
  node: CloudNode
  onToast: (msg: string, type: 'success' | 'error') => void
}
```

Rendered as `position: absolute; top: -28px; right: 0` on the ResourceNode wrapper — floating above the node, visible on hover. The parent wrapper gets `position: relative` (already is).

Visibility: CSS `opacity: 0; transition: opacity 150ms` on `.resource-node`, `.resource-node:hover .action-rail { opacity: 1 }`. Pure CSS — no JS hover state.

### Integration

`ResourceNode.tsx` renders `<ActionRail>` when `flag('ACTION_RAIL')`:
```tsx
{flag('ACTION_RAIL') && (
  <ActionRail node={d} onToast={(msg, type) => useUIStore.getState().showToast(msg, type)} />
)}
```

`onToast` calls `useUIStore.getState().showToast` directly — no prop drilling through React Flow.

### Constraints
- `pointer-events: none` on ActionRail when parent is being dragged (`dragging` prop)
- Does not interfere with node selection (click on rail buttons calls `e.stopPropagation()`)
- Rail is not rendered for `VpcNode`, `SubnetNode`, `GlobalZoneNode` — only `ResourceNode`
- No new IPC channels, no store changes

---

## Feature 3: COMMAND_BOARD

### What it does

A new **Command View** that arranges nodes in horizontal swim lanes by operational tier. The tier assignment reflects a canonical request path:

```
Internet → Edge → Compute → Data → Messaging → Config
```

This makes it immediately legible which tier is degraded and where in the request path it lives — the "aha moment" from the North Star doc.

### View addition

`ViewKey` in `src/renderer/store/ui.ts` becomes:
```ts
type ViewKey = 'topology' | 'graph' | 'command'
```

`CloudCanvas.tsx` adds a "Command" tab button and renders `<CommandView>` when `view === 'command'` AND `flag('COMMAND_BOARD')` is true. If the flag is off, the tab is not shown (the view is not reachable without the flag).

### Tier mapping

```ts
export const NODE_TIER: Partial<Record<NodeType, number>> = {
  // Tier 0 — Internet / DNS
  'igw': 0, 'cloudfront': 0, 'acm': 0, 'r53-zone': 0,

  // Tier 1 — Edge / Gateway
  'alb': 1, 'apigw': 1, 'apigw-route': 1,

  // Tier 2 — Compute
  'lambda': 2, 'ec2': 2, 'ecs': 2, 'eks': 2,

  // Tier 3 — Data
  'rds': 3, 'dynamo': 3, 's3': 3, 'opensearch': 3, 'kinesis': 3, 'elasticache': 3, 'msk': 3,

  // Tier 4 — Messaging
  'sqs': 4, 'sns': 4, 'eventbridge-bus': 4, 'sfn': 4, 'ses': 4,

  // Tier 5 — Config / Identity
  'ssm-param': 5, 'secret': 5, 'cognito': 5, 'ecr-repo': 5,
}
const DEFAULT_TIER = 6  // "Other" — catches unknown and any future unmapped types
```

`vpc`, `subnet`, `security-group`, `nat-gateway` are excluded from the swim lanes — they are infrastructure plumbing, not operational services. They are summarized as a context strip at the top of the view ("3 VPCs · 12 subnets · 8 security groups").

**Command tab visibility:** The Command tab only appears in `CloudCanvas.tsx`'s toolbar, not in the Sidebar's view switcher (which intentionally stays as `['topology', 'graph']`). This is by design — the command view is an advanced mode surfaced from the main canvas, not a peer to topology/graph in the sidebar.

### Layout algorithm

`buildCommandNodes(nodes: CloudNode[]): Node[]` — pure function, no side effects.

For each tier (0–6):
- Filter nodes belonging to this tier
- Arrange left-to-right: `x = LANE_X + col * (CMD_NODE_W + CMD_GAP_X)`, `y = tierY[tier]`
- Max nodes per row: `CMD_COLS = 8`
- Tier label rendered as a `type: 'tier-label'` React Flow node (non-interactive, no handles)

Tier Y positions:
```
tierY[t] = LANE_TOP + t * (CMD_NODE_H + CMD_TIER_GAP)
```

Constants:
- `CMD_NODE_W = 150`, `CMD_NODE_H = 66` (same as TopologyView — reuses ResourceNode)
- `CMD_GAP_X = 12`, `CMD_GAP_Y = 12`
- `CMD_COLS = 8`
- `CMD_TIER_GAP = 80` (space between tiers including label)
- `LANE_TOP = 60`, `LANE_X = 200` (left margin for tier labels)

### CommandView component

```
src/renderer/components/canvas/CommandView.tsx
```

Structure mirrors TopologyView:
- Imports `ReactFlow` from `@xyflow/react`
- Controlled nodes: `flowNodes` memo from `buildCommandNodes(nodes)`
- No VPC containers, no subnet containers — flat node list
- Existing `ResourceNode` type reused directly (no new node types needed)
- Edges: integration edges from `node.integrations` — same `buildTopologyEdges` logic adapted
- `livePositions` state for drag (same pattern as TopologyView)
- On drag-end: saves to `commandPositions` in `useUIStore` via a new `setCommandPosition(nodeId, pos)` setter. CommandView does NOT call `setNodePosition` (which is typed for `'topology' | 'graph'` only). This avoids breaking the existing `nodePositions` type.
- Drag-to-create is NOT supported in CommandView. The view does not wire up `onDrop`. It is a read-only operational view.
- Tidy layout is NOT available in CommandView. `CanvasContextMenu` shows tidy layout only for `'topology' | 'graph'` — the spec adds a `view !== 'command'` guard to the tidy layout menu item.

### TierLabelNode

A minimal read-only node (`type: 'tier-label'`) rendered as a left-margin label:
```tsx
// Minimal inline component, registered in nodeTypes prop of ReactFlow
const TIER_NAMES = ['Internet', 'Edge', 'Compute', 'Data', 'Messaging', 'Config', 'Other']
```

No handles, no interaction, no selection. Each tier-label node object in `flowNodes` has `draggable: false` set directly on the node (per-node field, NOT the global `nodesDraggable` ReactFlow prop). Resource nodes are draggable by default.

`CommandView` passes `nodeTypes={{ 'tier-label': TierLabelNode, resource: ResourceNode }}` to `<ReactFlow>`.

### Context strip

At the top of CommandView (above React Flow), a small text row:
```
{vpcCount} VPCs · {subnetCount} subnets · {sgCount} security groups  [region]
```

This gives infrastructure context without cluttering the swim lanes.

### UIStore changes

`src/renderer/store/ui.ts` additions:
```ts
commandPositions: Record<string, XYPosition>   // persisted drag positions for command view
setCommandPosition: (nodeId: string, pos: XYPosition) => void
```

`nodePositions` type stays unchanged (`{ topology: ...; graph: ... }`). `commandPositions` is a flat record (not nested by view) since there is only one command layout.

### Constraints
- CommandView does NOT replace TopologyView — it's an additive mode
- Flag must be `true` for the Command tab to appear (CloudCanvas toolbar only, not Sidebar)
- `fitView` works the same way as other views
- No new IPC channels, no main process changes
- `CanvasContextMenu.tsx` gets a `view !== 'command'` guard on tidy layout menu item (added to File Map)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/renderer/src/assets/main.css` | Add `@keyframes cb-pulse-error`, `cb-shimmer`, `cb-fade-pulse` |
| Modify | `src/renderer/components/canvas/nodes/ResourceNode.tsx` | STATUS_LANGUAGE conditionals + ActionRail render |
| Create | `src/renderer/components/canvas/nodes/ActionRail.tsx` | Copy ARN + Open Console hover actions |
| Create | `src/renderer/components/canvas/CommandView.tsx` | Command swim-lane layout + React Flow controlled view |
| Modify | `src/renderer/store/ui.ts` | Add `'command'` to `ViewKey`; add `commandPositions` + `setCommandPosition` |
| Modify | `src/renderer/components/canvas/CloudCanvas.tsx` | Add Command tab (flag-gated) + render CommandView |
| Modify | `src/renderer/components/canvas/CanvasContextMenu.tsx` | Add `view !== 'command'` guard on tidy layout menu item |
| Create | `tests/renderer/components/canvas/nodes/ActionRail.test.tsx` | Unit: copy ARN, console open, console null hides button, flag=false hides rail |
| Create | `tests/renderer/components/canvas/CommandView.test.tsx` | Unit: tier mapping, excluded types, flag=false hides tab |

---

## Testing Strategy

**STATUS_LANGUAGE** — no unit tests needed (pure visual CSS). Covered by Ladle stories (add `LambdaError_StatusLanguage` story). Vitest cannot test CSS animations.

**ACTION_RAIL** — unit tests:
- Copy ARN calls `navigator.clipboard.writeText` with `node.id`
- Open Console shown when `buildConsoleUrl(node) !== null`
- Open Console hidden when `buildConsoleUrl` returns null
- Click does not propagate to parent (stopPropagation)
- Rail not rendered when `flag('ACTION_RAIL')` is false (stubbed env)

**COMMAND_BOARD** — unit tests:
- `buildCommandNodes` places `lambda` in tier 2
- `buildCommandNodes` places `rds` in tier 3
- `buildCommandNodes` places unmapped type in tier 6 (DEFAULT_TIER)
- `vpc`, `subnet`, `security-group`, `nat-gateway` are excluded from output nodes
- Empty node list returns empty array
- CommandView renders without crashing (smoke test)

---

## What This Is NOT

- Not a Terraform viewer (no HCL changes)
- Not a new NodeType (no new AWS services)
- Not a UI redesign (existing Topology/Graph views unchanged)
- Not a data model change (no IPC, no scanner changes)
- Not a dark-mode or theme change

---

## Completion Criteria

- `npm run typecheck` exits 0
- `npm test` all tests pass (855 baseline + new tests from this feature)
- `flag('STATUS_LANGUAGE') = false` → ResourceNode renders exactly as today
- `flag('ACTION_RAIL') = false` → no rail visible, no behavior change
- `flag('COMMAND_BOARD') = false` → no Command tab in CloudCanvas
- `flag('COMMAND_BOARD') = true` → Command tab appears, CommandView renders tier lanes
- `npm run stories` shows new `ActionRail` story
