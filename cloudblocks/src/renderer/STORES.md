# Renderer State Stores

Three Zustand stores cover the renderer. Each owns a strict slice — do not
reach into the wrong store for convenience.

---

## 1. Store Ownership

### `useCloudStore` — `store/cloud.ts`

**Owns:** AWS resource data and scan lifecycle.

| Field | Purpose |
|---|---|
| `nodes` | Live `CloudNode[]` from the last scan (includes drift annotations) |
| `pendingNodes` | Nodes pending a write operation (not yet confirmed by scan) |
| `importedNodes` | Terraform-imported nodes used for drift comparison |
| `scanStatus` | `'idle' \| 'scanning' \| 'error'` |
| `lastScannedAt` | Timestamp of last successful scan |
| `scanGeneration` | Monotonic counter; incremented on profile/region change to discard stale deltas |
| `scanErrors` | Per-service scan errors surfaced in the UI |
| `profile` | Active `AwsProfile` (name, endpoint) |
| `region` | Primary scan region |
| `selectedRegions` | Multi-region selection |
| `errorMessage` | Top-level scan error string |
| `keyPairs` | EC2 key pair names fetched alongside scan |
| `settings` | Persisted `Settings` (theme, scan interval, delete style, …) |
| `previousCounts` | Per-NodeType counts from previous scan (badge animation) |

**Does NOT own:** canvas positions, selection, modals, CLI output, view mode, filters.

**Primary consumers:** `App.tsx`, `Inspector.tsx`, `Sidebar.tsx`, `TopologyView`, `GraphView`, create/edit/delete modals.

---

### `useUIStore` — `store/ui.ts`

**Owns:** All canvas and UI interaction state that has no AWS-data meaning.

| Field | Purpose |
|---|---|
| `view` | Active canvas view: `'topology' \| 'graph' \| 'command'` |
| `selectedNodeId` | Single selected node (clears edge selection) |
| `selectedNodeIds` | Multi-selection set |
| `selectedEdgeId / selectedEdgeInfo` | Selected edge |
| `activeCreate` | Pending drag-to-create payload (resource type + drop position) |
| `toast` | In-canvas feedback message (auto-clears after 2.5 s) |
| `nodePositions` | Persisted positions per view (`{ topology: {…}, graph: {…} }`) |
| `savedViews` | Up to 4 named view snapshots (slots 0–3) |
| `activeViewSlot` | Currently active saved-view slot |
| `commandPositions` | Node positions specific to the command board view |
| `commandFocusId` | Focused command node ID |
| `blastRadiusId` | Node whose blast radius is highlighted (mutually exclusive with pathTraceId) |
| `pathTraceId` | Node whose dependency path is traced (mutually exclusive with blastRadiusId) |
| `showIntegrations` | Toggle for integration edges |
| `snapToGrid` | Canvas snap-to-grid flag |
| `expandedSsmGroups` | SSM parameter group prefixes that are expanded |
| `lockedNodes` | Node IDs pinned against drag |
| `collapsedSubnets / collapsedVpcs / collapsedApigws` | Collapsed container sets |
| `expandedGroups` | Expanded group node IDs |
| `showAbout / showSettings` | Modal visibility flags |
| `annotations` | Per-node text annotations (`Record<nodeId, string>`) |
| `stickyNotes` | Free-floating canvas sticky notes |
| `driftFilterActive / driftBannerDismissed` | Drift UI state |
| `activeFilters / activeFilterTypes / activeSidebarType` | Sidebar type filters |
| `pluginNodeTypes` | Runtime plugin NodeType metadata |
| `zoneSizes` | Measured zone container sizes |
| `customEdges` | User-drawn edges |
| `isExporting` | Export-in-progress flag |
| `keyboardHelpOpen` | Keyboard shortcut overlay |
| `terminalSessionId / terminalNodeId` | Embedded terminal pane state |

**Does NOT own:** `CloudNode` data, scan status, AWS credentials, CLI output.

**Primary consumers:** `CloudCanvas`, `TopologyView`, `GraphView`, `Inspector.tsx`, `Sidebar.tsx`, `CommandView`, `SearchPalette`, `App.tsx`.

---

### `useCliStore` — `store/cli.ts`

**Owns:** CLI subprocess I/O and command preview state.

| Field | Purpose |
|---|---|
| `cliOutput` | Current session stdout/stderr lines |
| `logHistory` | Persistent log with timestamps (survives `clearCliOutput`) |
| `commandPreview` | Argv array for the command shown in `CommandDrawer` |
| `pendingCommand` | Multi-command batch awaiting user confirmation |

**Does NOT own:** node state, UI visibility, AWS data.

**Primary consumers:** `CommandDrawer.tsx`, `App.tsx` (IPC output listener).

---

## 2. Access Patterns

### Inside React components — use the hook with a selector

```ts
// Re-renders only when nodes changes
const nodes = useCloudStore((s) => s.nodes)

// Stable reference — action functions never change identity
const showToast = useUIStore((s) => s.showToast)
```

Avoid subscribing to the whole store (`useCloudStore()`) — it re-renders on
every mutation.

### Outside React — use `getState()`

Event handlers, IPC callbacks, and effects that fire after React has finished
rendering should call `getState()` directly:

```ts
// IPC callback (not inside a component)
window.terminus.onScanDelta((delta) => {
  useCloudStore.getState().applyDelta(delta)
})

// Post-action toast from a utility function
useUIStore.getState().showToast('Created', 'success')
```

### Cross-store calls

`useCloudStore` calls `useUIStore.getState()` directly in two places
(`resetDriftBanner`, `resetDriftFilter`). This is acceptable because those
are write-only fire-and-forget calls — there is no subscription across stores.
Never read state from another store inside a selector.

---

## 3. Anti-Patterns

| Anti-pattern | Why | Fix |
|---|---|---|
| `useCloudStore.getState()` inside render | Bypasses reactivity; component won't re-render on change | Use `useCloudStore(selector)` |
| Subscribing to whole store: `useUIStore()` | Re-renders on every mutation | Add a selector |
| Derived state stored in the store | Gets stale, duplicates source of truth | Use `useMemo` in the component |
| Writing UI state into `useCloudStore` | Breaks ownership contract | Use `useUIStore` |
| Reading AWS data from `useUIStore` | Wrong store | Use `useCloudStore` |
| Calling `useStore(selector)` in an event handler | React hook rules violation | Use `getState()` instead |

---

## 4. State Slice Index

| Field | Store |
|---|---|
| `activeCreate` | `useUIStore` |
| `activeFilterTypes` | `useUIStore` |
| `activeFilters` | `useUIStore` |
| `activeSidebarType` | `useUIStore` |
| `activeViewSlot` | `useUIStore` |
| `annotations` | `useUIStore` |
| `blastRadiusId` | `useUIStore` |
| `cliOutput` | `useCliStore` |
| `collapsedApigws` | `useUIStore` |
| `collapsedSubnets` | `useUIStore` |
| `collapsedVpcs` | `useUIStore` |
| `commandFocusId` | `useUIStore` |
| `commandPositions` | `useUIStore` |
| `commandPreview` | `useCliStore` |
| `customEdges` | `useUIStore` |
| `driftBannerDismissed` | `useUIStore` |
| `driftFilterActive` | `useUIStore` |
| `errorMessage` | `useCloudStore` |
| `expandedGroups` | `useUIStore` |
| `expandedSsmGroups` | `useUIStore` |
| `importedNodes` | `useCloudStore` |
| `isExporting` | `useUIStore` |
| `keyPairs` | `useCloudStore` |
| `keyboardHelpOpen` | `useUIStore` |
| `lastScannedAt` | `useCloudStore` |
| `lockedNodes` | `useUIStore` |
| `logHistory` | `useCliStore` |
| `nodePositions` | `useUIStore` |
| `nodes` | `useCloudStore` |
| `pathTraceId` | `useUIStore` |
| `pendingCommand` | `useCliStore` |
| `pendingNodes` | `useCloudStore` |
| `pluginNodeTypes` | `useUIStore` |
| `previousCounts` | `useCloudStore` |
| `profile` | `useCloudStore` |
| `region` | `useCloudStore` |
| `savedViews` | `useUIStore` |
| `scanErrors` | `useCloudStore` |
| `scanGeneration` | `useCloudStore` |
| `scanStatus` | `useCloudStore` |
| `selectedEdgeId / selectedEdgeInfo` | `useUIStore` |
| `selectedNodeId` | `useUIStore` |
| `selectedNodeIds` | `useUIStore` |
| `selectedRegions` | `useCloudStore` |
| `settings` | `useCloudStore` |
| `showAbout` | `useUIStore` |
| `showIntegrations` | `useUIStore` |
| `showSettings` | `useUIStore` |
| `snapToGrid` | `useUIStore` |
| `stickyNotes` | `useUIStore` |
| `terminalNodeId` | `useUIStore` |
| `terminalSessionId` | `useUIStore` |
| `toast` | `useUIStore` |
| `view` | `useUIStore` |
| `zoneSizes` | `useUIStore` |
