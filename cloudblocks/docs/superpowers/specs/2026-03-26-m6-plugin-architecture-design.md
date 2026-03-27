# M6 Plugin Architecture Design

**Status:** Draft
**Date:** 2026-03-26
**Milestone:** M6
**Author:** Architecture planning session

---

## 1. Motivation and Scope

Cloudblocks is currently a single-provider desktop app. Every service, node type, scan function, CRUD command builder, and HCL generator is hardcoded to AWS. The code is structured cleanly — `awsProvider` behind the `CloudProvider` interface, scan functions in `services/`, command builders in `renderer/utils/` — but none of these seams allow a second cloud provider to be added without forking or touching AWS-specific files.

M6's goal is to introduce a plugin architecture that makes provider addition a self-contained operation. A plugin should be able to declare the node types it introduces, wire in its own scan functions, register its own CRUD command builders, HCL generators, and canvas rendering metadata, all without editing any AWS-specific file.

**M6 scope (internal plugins only):** Plugins are TypeScript modules bundled with the app. There is no external loading, no npm install at runtime, no user-facing plugin marketplace. The architecture must be designed so that external loading is addable later, but M6 does not implement it.

**First plugin target:** The existing AWS provider. Refactoring `awsProvider` into a plugin is the migration path and the proof the design works.

---

## 2. The Core Tension: Static Types vs. Runtime Extension

The biggest design challenge is that `NodeType` is a compile-time string union and four maps — `TYPE_BORDER`, `TYPE_LABEL` in `ResourceNode.tsx`, `TYPE_BADGE_COLOR`, `TYPE_SHORT` in `SearchPalette.tsx`, plus `TerraformGeneratorMap` — use `Record<NodeType, ...>` with `satisfies` to guarantee exhaustiveness at compile time. This is a deliberate correctness guarantee: if you add a NodeType you must fill every map, or typecheck fails.

Plugin-provided NodeTypes cannot be part of the compile-time `NodeType` union without the plugin's string literals being imported into `cloud.ts`. That import would break the abstraction — the core would depend on each plugin.

The resolution is a two-tier NodeType system:

- **Built-in NodeTypes** remain the closed compile-time union in `cloud.ts`. Every `Record<NodeType, ...>` map, `satisfies` check, and typecheck continues to cover exactly these types. The AWS plugin contributes to this union (since its types are already there).
- **Plugin NodeTypes** are declared as `string` at runtime. The four exhaustive maps fall back gracefully for unknown strings (they already do — `ResourceNode` uses `TYPE_BORDER[d.nodeType] ?? '#555'` and `TYPE_LABEL[d.nodeType] ?? d.nodeType.toUpperCase()`). Plugin metadata registrations fill in the correct values at runtime so the fallback is never seen by the user.

This means:

1. The compile-time guarantees remain intact for all built-in (AWS) types.
2. Plugin types are registered at runtime via a `PluginRegistry` (described in section 4).
3. There is a deliberate decision point when a plugin ships with the app vs. when its types are "promoted" to built-ins: types can be promoted by adding them to the `NodeType` union and the four maps, giving compile-time safety. External/community plugins stay runtime.

---

## 3. Plugin Interface

A plugin is a TypeScript object satisfying the `CloudblocksPlugin` interface. This interface lives in a new file: `src/main/plugin/types.ts`.

```ts
// src/main/plugin/types.ts

import type { CloudNode } from '../../renderer/types/cloud'

/**
 * Credentials context passed to plugin scan functions.
 * Each plugin defines its own credentials shape via the generic.
 * The registry passes the credentials opaque object constructed by
 * the plugin's own credentialFactory — credentials never cross the
 * IPC boundary and never reach the renderer.
 */
export interface ScanContext<TCredentials = unknown> {
  credentials: TCredentials
  region: string
}

/**
 * Result of a single scan invocation.
 */
export interface PluginScanResult {
  nodes: CloudNode[]
  errors: Array<{ service: string; region: string; message: string }>
}

/**
 * Per-NodeType rendering metadata registered by a plugin.
 * Mirrors the four exhaustive maps in ResourceNode and SearchPalette
 * but supplied at runtime for plugin-owned types.
 */
export interface NodeTypeMetadata {
  /** Short all-caps badge shown inside the canvas node card. e.g. "AKS", "GCE" */
  label: string
  /** Border/accent hex color on the canvas node card. e.g. "#0078D4" */
  borderColor: string
  /** Badge background color in SearchPalette. Usually matches borderColor. */
  badgeColor: string
  /** Short abbreviation for SearchPalette chips. e.g. "AKS" */
  shortLabel: string
  /** Human-readable display name for Sidebar list. e.g. "Azure Kubernetes Service" */
  displayName: string
  /** Whether this type appears as a draggable item in the Sidebar create list. */
  hasCreate: boolean
}

/**
 * CRUD command builders.
 * Each function returns string[][] — same format as buildCommands / buildDeleteCommands /
 * buildEditCommands. Returning [] means "no CLI command" (e.g. uses SDK via IPC instead).
 *
 * All three are optional. A plugin that only scans read-only resources may omit them.
 */
export interface PluginCommandHandlers {
  buildCreate?: (resource: string, params: Record<string, unknown>) => string[][]
  buildDelete?: (node: CloudNode, opts?: Record<string, unknown>) => string[][]
  buildEdit?:   (node: CloudNode, params: Record<string, unknown>) => string[][]
}

/**
 * HCL generator for a single NodeType string.
 * Returns empty string if not supported — same convention as the built-in generators.
 */
export type PluginHclGenerator = (node: CloudNode) => string

/**
 * The full plugin contract.
 */
export interface CloudblocksPlugin {
  /**
   * Unique plugin identifier. Reverse-domain recommended: "com.cloudblocks.aws",
   * "com.cloudblocks.azure", "io.example.vercel".
   */
  readonly id: string

  /**
   * Human-readable name shown in future Settings > Plugins panel.
   */
  readonly displayName: string

  /**
   * The NodeType strings this plugin introduces. These are runtime strings, not
   * entries in the compile-time NodeType union (unless the plugin is bundled and
   * the types are promoted — see section 2).
   *
   * Each entry here must have a corresponding entry in nodeTypeMetadata.
   */
  readonly nodeTypes: readonly string[]

  /**
   * Rendering and sidebar metadata for each NodeType this plugin introduces.
   * Key is the NodeType string.
   */
  readonly nodeTypeMetadata: Readonly<Record<string, NodeTypeMetadata>>

  /**
   * Build a credentials object for this plugin given the current profile/endpoint.
   * Called in the main process when the profile is selected or region changes.
   * The returned object is opaque to the registry — it is only passed back into
   * this plugin's scan() function.
   *
   * Must never return anything that would be serialized across IPC.
   */
  createCredentials(profile: string, region: string, endpoint?: string): unknown

  /**
   * Scan all resources this plugin owns for the given region.
   * Receives the credentials object produced by createCredentials().
   * Must not throw — errors should be returned in PluginScanResult.errors.
   */
  scan(context: ScanContext): Promise<PluginScanResult>

  /**
   * Optional CRUD command builders.
   */
  commands?: PluginCommandHandlers

  /**
   * Optional HCL generators keyed by NodeType string.
   * Used by the Terraform export pipeline.
   */
  hclGenerators?: Record<string, PluginHclGenerator>

  /**
   * Called once when the plugin is activated (profile selected, app start).
   * Optional. Use to set up long-lived resources, background polling, etc.
   */
  activate?(): void | Promise<void>

  /**
   * Called when the plugin should release all resources (profile change, shutdown).
   * Optional.
   */
  deactivate?(): void | Promise<void>

  /**
   * Optional IPC handler registration. The plugin may register custom IPC channels
   * using the plugin's ID as a namespace prefix (e.g. "azure:vm:create").
   * Called once during registerHandlers().
   */
  registerIpcHandlers?(ipcMain: Electron.IpcMain, win: Electron.BrowserWindow): void
}
```

---

## 4. Plugin Registry

The registry is the central coordinator for all registered plugins. It lives in the main process.

**File:** `src/main/plugin/registry.ts`

### 4.1 Registration

Plugins register themselves by calling `pluginRegistry.register(plugin)`. This is a synchronous call that stores the plugin and indexes its metadata.

```
pluginRegistry.register(awsPlugin)
pluginRegistry.register(azurePlugin)  // future
```

Registration happens at app startup in `src/main/index.ts` (or wherever `registerHandlers` is called), before the IPC handlers are set up.

### 4.2 Registry API

```ts
interface PluginRegistry {
  /** Register a plugin. Call before registerHandlers. */
  register(plugin: CloudblocksPlugin): void

  /** Activate all registered plugins for the given profile/region. */
  activateAll(profile: string, region: string, endpoint?: string): Promise<void>

  /** Deactivate all plugins (e.g. on profile switch before re-activating). */
  deactivateAll(): Promise<void>

  /** Run scan() on all plugins for the given region. Results are merged. */
  scanAll(region: string): Promise<PluginScanResult>

  /** Build create commands for a resource type. Delegates to the owning plugin. */
  buildCreate(resource: string, params: Record<string, unknown>): string[][]

  /** Build delete commands for a node. Delegates to the owning plugin by node.type. */
  buildDelete(node: CloudNode, opts?: Record<string, unknown>): string[][]

  /** Build edit commands for a node. Delegates to the owning plugin by node.type. */
  buildEdit(node: CloudNode, params: Record<string, unknown>): string[][]

  /** Get the HCL generator for a NodeType string. Returns undefined if none. */
  getHclGenerator(nodeType: string): PluginHclGenerator | undefined

  /** Get NodeTypeMetadata for a runtime NodeType string. Returns undefined for built-ins. */
  getNodeTypeMetadata(nodeType: string): NodeTypeMetadata | undefined

  /** All registered plugins, in registration order. */
  readonly plugins: readonly CloudblocksPlugin[]
}
```

### 4.3 Ownership Model

The registry maintains a `Map<string, CloudblocksPlugin>` from NodeType string to owning plugin. A NodeType can only be owned by one plugin. If two plugins claim the same NodeType string, `register()` throws at startup — fail fast, not silently.

For built-in AWS NodeTypes (the compile-time union), the AWS plugin claims ownership at registration time, but the built-in CRUD functions in `buildCommand.ts`, `buildDeleteCommands.ts`, `buildEditCommands.ts` remain authoritative for those types. The registry delegates to these built-in functions for built-in types, and to plugin command handlers for plugin-owned types. This allows the AWS plugin to be refactored gradually — see Migration Path in section 10.

### 4.4 Credential Lifecycle

When `activateAll(profile, region, endpoint)` is called, the registry calls `plugin.createCredentials(profile, region, endpoint)` for each plugin and stores the returned credentials object in a `Map<string, unknown>` keyed by `plugin.id`. When `scanAll()` is called, the stored credentials are passed to each plugin's `scan()` as `context.credentials`. Credentials are never serialized and never leave the main process.

On profile switch: `deactivateAll()` → clear credentials map → `activateAll()` with new profile.

---

## 5. NodeType Extensibility

### 5.1 Renderer-Side Metadata Access

The four exhaustive maps in `ResourceNode.tsx` and `SearchPalette.tsx` continue to cover the built-in `NodeType` union with compile-time correctness. No changes to those files are needed for M6 internal plugins.

To support plugin NodeTypes at runtime, both components add a runtime fallback lookup against a lightweight renderer-side metadata store. This store is populated from plugin metadata sent over IPC at startup.

**New IPC channel:** `plugin:metadata` — a push from main to renderer that sends a serialized `Record<string, NodeTypeMetadata>` covering all plugin-registered node types. This fires once after `activateAll()` completes.

**Renderer store addition:** A new slice `pluginNodeTypes: Record<string, NodeTypeMetadata>` is added to `useUIStore`. The `plugin:metadata` handler in `App.tsx` calls `useUIStore.getState().setPluginNodeTypes(data)`.

`ResourceNode.tsx` lookup order:
1. `TYPE_BORDER[d.nodeType]` — built-in (compile-time safe, always defined for built-in types)
2. `useUIStore.getState().pluginNodeTypes[d.nodeType]?.borderColor` — plugin-registered
3. `'#555'` — existing fallback (no change)

`SearchPalette.tsx` follows the same pattern for `TYPE_BADGE_COLOR` and `TYPE_SHORT`.

### 5.2 Sidebar

`Sidebar.tsx` currently has a static `SERVICES` array. For M6, this array continues to drive the sidebar for built-in types. Plugin types that have `hasCreate: true` in their `NodeTypeMetadata` are appended to the rendered list dynamically from `pluginNodeTypes` in `useUIStore`.

This means the Sidebar does not need a compile-time `NodeType` for plugin services — it reads from the runtime store.

### 5.3 Type Promotion Path

When a plugin is promoted to "bundled built-in" (e.g. after Azure reaches production quality), its NodeType strings are added to the `NodeType` union in `cloud.ts`, its metadata entries are added to `TYPE_BORDER`, `TYPE_LABEL`, `TYPE_BADGE_COLOR`, `TYPE_SHORT`, and the plugin's IPC-pushed metadata for those types becomes redundant but harmless (the built-in map takes precedence). The plugin's scan/command/HCL handlers remain plugin-owned and are not merged into AWS files.

---

## 6. Scan Handler Registration

### 6.1 How It Works

`ResourceScanner.scan()` currently calls `awsProvider.scan(clients, region)` directly. After M6, `ResourceScanner` calls `pluginRegistry.scanAll(region)` instead.

`pluginRegistry.scanAll(region)` iterates registered plugins, calls each plugin's `scan({ credentials: storedCredentials[plugin.id], region })`, catches errors per-plugin to prevent one broken plugin from stopping others, and merges all results.

### 6.2 ResourceScanner Changes

The `ResourceScanner` constructor stops accepting `profile` and `endpoint` directly for client creation (these are now the concern of each plugin's `createCredentials()`). The scanner's job is reduced to: run the poll loop, call `pluginRegistry.scanAll(region)`, compute delta, push IPC events.

The key-pair lookup (`describeKeyPairs`) is AWS-specific. It moves inside the AWS plugin via an optional `scanExtras?(region: string): Promise<void>` hook on `CloudblocksPlugin`. The scanner calls `plugin.scanExtras?.(region)` after `scanAll()` for each plugin that implements it.

### 6.3 Multi-Region

`ResourceScanner.scan()` fans out across `this.regions` with `Promise.all`. This fan-out stays in `ResourceScanner`. Each region still calls `pluginRegistry.scanAll(region)`, which in turn calls all plugins for that region. Plugins do not need to know about the multi-region fan-out.

---

## 7. CRUD Command Registration

The current command builders (`buildCommand.ts`, `buildDeleteCommands.ts`, `buildEditCommands.ts`) are renderer-side pure functions. They remain authoritative for built-in AWS types. Plugin CRUD commands are dispatched by the renderer via a thin routing layer.

### 7.1 Renderer Plugin Command Dispatcher

**File:** `src/renderer/utils/pluginCommands.ts`

Three exported functions:
- `resolveCreateCommands(resource: string, params: Record<string, unknown>): string[][]`
- `resolveDeleteCommands(node: CloudNode, opts?: Record<string, unknown>): string[][]`
- `resolveEditCommands(node: CloudNode, params: Record<string, unknown>): string[][]`

Each checks if the resource/node type is a built-in `NodeType`:
1. If yes → delegate to the existing `buildCommands` / `buildDeleteCommands` / `buildEditCommands` functions (no change to those files).
2. If no → look up the plugin command handlers from the renderer-side plugin metadata store (populated via `plugin:metadata` IPC push, extended to include `commandSchema`).

Call sites in `CreateModal`, `DeleteDialog`, `EditModal`, and `Inspector.tsx` (quick actions) import from `pluginCommands.ts` instead of directly from the built-in builders. The built-in functions are unchanged.

### 7.2 Why Not IPC for Command Building?

Command building is pure computation — it transforms input parameters into argv arrays. The renderer already has all the information it needs. Routing through IPC would add latency for no security benefit. Plugin command builders are renderer-side code, credentials are never involved.

### 7.3 Main-Process SDK Commands

Some resources use the SDK directly in the main process via dedicated IPC channels (CloudFront pattern). Plugin resources that need this pattern register custom IPC channels via `registerIpcHandlers?()`. Plugin channels use the plugin's ID as a namespace prefix: `azure:vm:create`, `gcp:storage:create`, etc.

---

## 8. HCL Generator Registration

The `terraformGenerators` map in `generators.ts` is a `Record<NodeType, TerraformGenerator>` — exhaustive over the built-in union. It continues to be the authoritative source for built-in types.

`generateTerraformFile` in `terraform/index.ts` is modified to fall back for non-built-in types:
1. First attempt `terraformGenerators[node.type]` — works for built-ins.
2. For unknown types, call `pluginRegistry.getHclGenerator(node.type)`.

Since `generateTerraformFile` runs in the main process (called from the `TERRAFORM_EXPORT` IPC handler), it has direct access to the plugin registry. No additional IPC is needed.

---

## 9. Canvas Node Rendering

React Flow's `nodeTypes` prop maps string keys to React components. Currently `TopologyView` and `GraphView` pass a static `nodeTypes` object.

Plugin canvas components are optional. If a plugin does not provide a custom React component, plugin nodes render using the existing `ResourceNode` component (which handles unknown types gracefully via the `?? '#555'` fallback chain).

For plugins that want a fully custom node component, `NodeTypeMetadata` gains an optional `componentKey?: string` field.

**File:** `src/renderer/plugin/rendererRegistry.ts`

```ts
const pluginNodeComponents = new Map<string, React.ComponentType<NodeProps>>()

export function registerPluginComponent(key: string, component: React.ComponentType<NodeProps>): void {
  pluginNodeComponents.set(key, component)
}

export function getPluginNodeComponents(): Record<string, React.ComponentType<NodeProps>> {
  return Object.fromEntries(pluginNodeComponents)
}
```

`TopologyView` and `GraphView` build their `nodeTypes` prop by merging the static built-in map with `getPluginNodeComponents()`. For M6 (internal plugins only), plugin component registration happens in `src/renderer/plugin/index.ts`, imported once by `App.tsx`.

---

## 10. Plugin Lifecycle

### 10.1 Startup Sequence

```
main/index.ts:
  1. Import plugin modules (static imports, bundled)
  2. pluginRegistry.register(awsPlugin)
  3. pluginRegistry.register(azurePlugin)  // future
  4. registerHandlers(win)                 // handlers.ts — calls plugin.registerIpcHandlers()
  5. win loads renderer

renderer App.tsx:
  6. renderer/plugin/index.ts runs — registers plugin React components
  7. App.tsx useEffect: listens for IPC.PLUGIN_METADATA push
  8. Scanner starts (profile:select / region:select)

profile:select / region:select:
  9.  pluginRegistry.deactivateAll()
  10. pluginRegistry.activateAll(profile, region, endpoint)
  11. registry calls plugin.createCredentials() for each plugin → stores credentials
  12. registry calls plugin.activate() for each plugin
  13. main pushes IPC.PLUGIN_METADATA to renderer
  14. scanner.start()
```

### 10.2 Error Isolation

Each plugin's `activate()`, `deactivate()`, and `scan()` are wrapped in try/catch inside the registry. A plugin that throws during activation is marked `status: 'error'` and excluded from subsequent scan calls. Scan errors from a failed plugin are reported in `scanErrors` with `service: plugin.id` so the renderer's scan-error badge system surfaces them.

### 10.3 Deactivation

On profile switch: `scanner.stop()` → `pluginRegistry.deactivateAll()` → `pluginRegistry.activateAll(newProfile, ...)` → `scanner.start()`. The registry calls `plugin.deactivate()` for each active plugin and awaits completion before proceeding.

---

## 11. Migration Path: AWS Provider as First Plugin

The existing `awsProvider` and `createClients()` become the AWS plugin. This is the proof-of-concept that validates the design. Migration is incremental.

### Phase 1: Create the plugin skeleton (no behavior change)

Create `src/main/plugin/awsPlugin.ts` exporting a `CloudblocksPlugin` object. Its `createCredentials()` calls `createClients()`. Its `scan()` calls all existing service scan functions exactly as `awsProvider.scan()` does today. `nodeTypes` enumerates all 22 current `NodeType` values.

Create `src/main/plugin/registry.ts` with the `PluginRegistry` implementation. Register `awsPlugin` — but `ResourceScanner` still calls `awsProvider.scan()` directly. The registry exists but nothing routes through it yet.

### Phase 2: Wire scanner through registry

Change `ResourceScanner.scan()` to call `pluginRegistry.scanAll(region)`. The AWS plugin's `scan()` now drives the scan. Remove the direct `awsProvider` import from `scanner.ts`.

### Phase 3: Wire command builders through registry for new types

Add `pluginCommands.ts` routing. Keep existing builders unchanged for AWS types. New plugin types now have a path to emit their own commands.

### Phase 4: Wire HCL generators through registry for new types

Modify `generateTerraformFile` to fall back to `pluginRegistry.getHclGenerator()` for non-built-in NodeTypes.

### Phase 5: IPC push for plugin metadata

Add `IPC.PLUGIN_METADATA` channel. Main pushes `NodeTypeMetadata` for all plugin-registered types after `activateAll()`. Renderer `useUIStore` stores it. `ResourceNode` and `SearchPalette` pick it up as fallback.

At this point the full system is live: an Azure plugin can be added by creating `src/main/plugin/azurePlugin.ts` and registering it — no changes to any AWS file.

---

## 12. New Files Summary

```
src/main/plugin/
  types.ts          — CloudblocksPlugin interface, NodeTypeMetadata, PluginScanResult
  registry.ts       — PluginRegistry implementation
  awsPlugin.ts      — AWS CloudblocksPlugin (wraps existing awsProvider / services)
  index.ts          — exports pluginRegistry singleton, called from main/index.ts

src/renderer/plugin/
  rendererRegistry.ts  — registerPluginComponent(), getPluginNodeComponents()
  pluginCommands.ts    — renderer-side command routing for plugin-owned node types
  index.ts             — static imports of bundled plugin renderer registrations
```

### Files modified (not created)

```
src/main/aws/scanner.ts          — scanAll() instead of awsProvider.scan()
src/main/ipc/channels.ts         — add PLUGIN_METADATA push channel
src/main/ipc/handlers.ts         — call plugin.registerIpcHandlers(); push PLUGIN_METADATA
src/main/terraform/index.ts      — fallback to pluginRegistry.getHclGenerator()
src/renderer/store/ui.ts         — add pluginNodeTypes slice
src/renderer/components/canvas/nodes/ResourceNode.tsx  — runtime fallback lookup
src/renderer/components/SearchPalette.tsx              — runtime fallback lookup
src/renderer/components/Sidebar.tsx                    — append plugin types with hasCreate
src/renderer/src/App.tsx         — import renderer/plugin/index.ts; handle PLUGIN_METADATA
```

---

## 13. IPC Contract Extension

One new channel added to `channels.ts`:

```ts
PLUGIN_METADATA: 'plugin:metadata'
// push: main → renderer
// payload: Record<string, NodeTypeMetadata>
// fired once per activateAll() completion
```

`preload/index.ts` and `preload/index.d.ts` gain:

```ts
onPluginMetadata: (cb: (meta: Record<string, NodeTypeMetadata>) => void) => () => void
```

`NodeTypeMetadata` is defined in `src/main/plugin/types.ts` and re-exported from `src/renderer/types/plugin.ts` so both main and renderer can reference it without creating a cross-process import.

---

## 14. TypeScript Strictness

The `CloudblocksPlugin` interface uses `unknown` for credentials rather than a type parameter on the interface itself, to allow the registry to store heterogeneous plugins in a `CloudblocksPlugin[]` array without generics variance issues. Each plugin casts `context.credentials` to its own SDK client type internally.

The `Record<NodeType, ...>` exhaustive maps in `ResourceNode.tsx`, `SearchPalette.tsx`, and `generators.ts` are not changed. The `satisfies` checks remain. Adding a new built-in NodeType still requires updating all four maps, as documented in CLAUDE.md.

Plugin NodeType strings are typed as `string`, not `NodeType`. The union is not widened.

---

## 15. Out of Scope for M6

1. **External plugin loading** — loading plugins from filesystem, npm, or a marketplace at runtime
2. **Plugin UI in Settings** — no "Installed Plugins" panel
3. **Plugin versioning and compatibility** — no semver checks
4. **Azure or GCP implementations** — M6 produces architecture + AWS plugin migration only
5. **Vercel plugin** — same as above
6. **Plugin sandboxing** — bundled plugins run in the same process with full Node.js access
7. **Per-plugin settings UI** — plugins cannot expose user-configurable settings
8. **Hot reload / plugin update without restart**
9. **Plugin dependency injection** — plugins cannot declare dependencies on other plugins
10. **Custom canvas layout algorithms** — plugin nodes render as flat nodes in the global zone
11. **Custom Inspector panels** — plugin nodes use generic metadata key-value display
12. **Custom CreateModal / EditModal forms** — plugin nodes use a generic key-value form
13. **Terraform state import for plugin types** — `parseTfState` handles AWS resources only

---

## 16. Open Questions

**Q1: Should `awsPlugin.ts` re-export the existing `awsProvider.ts` or replace it?**
Recommendation: `awsPlugin.ts` wraps the existing service functions directly. Keep `awsProvider.ts` in place during migration and delete it in a later cleanup commit once `scanner.ts` no longer imports it.

**Q2: Where does the AWS plugin's key-pair scan go?**
The key-pair scan feeds the EC2 create form, not the topology. Add an optional `scanExtras?(region: string): Promise<void>` to `CloudblocksPlugin`. The AWS plugin implements it to fetch key pairs and push `IPC.SCAN_KEYPAIRS`.

**Q3: Should renderer-side command routing live in `pluginCommands.ts` or inline at each call site?**
Recommendation: centralize in `pluginCommands.ts` with three exported functions: `resolveCreateCommands`, `resolveDeleteCommands`, `resolveEditCommands`. Call sites import from `pluginCommands.ts`.

**Q4: Does `NodeTypeMetadata` need to travel over IPC?**
Only plugin-introduced types need to cross IPC. Built-in type metadata is already in the static maps. The `plugin:metadata` push contains only the delta (plugin-owned NodeTypes).

---

## 17. Acceptance Criteria for M6

- [ ] `CloudblocksPlugin` interface defined in `src/main/plugin/types.ts`
- [ ] `PluginRegistry` implementation in `src/main/plugin/registry.ts`
- [ ] `awsPlugin.ts` exists and wraps all existing scan service functions
- [ ] `ResourceScanner` calls `pluginRegistry.scanAll()`, not `awsProvider.scan()` directly
- [ ] `IPC.PLUGIN_METADATA` channel exists and is pushed after `activateAll()`
- [ ] `useUIStore` has `pluginNodeTypes` slice populated from `plugin:metadata`
- [ ] `ResourceNode` and `SearchPalette` use runtime fallback for non-built-in types
- [ ] `Sidebar` appends plugin types with `hasCreate: true`
- [ ] `generateTerraformFile` falls back to `pluginRegistry.getHclGenerator()` for non-built-in types
- [ ] All existing Vitest tests pass without modification
- [ ] Lint and typecheck pass
- [ ] A trivial test plugin (e.g. `mockPlugin` emitting one synthetic node) can be registered and its node appears on the canvas with correct label and color from its `NodeTypeMetadata`
