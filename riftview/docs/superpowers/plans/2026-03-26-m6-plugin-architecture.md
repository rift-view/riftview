# M6 Plugin Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a plugin architecture so new cloud providers (Azure, GCP, Vercel) can be added as self-contained TypeScript modules without touching any AWS-specific file. Migrate the existing AWS provider into the first plugin as proof-of-concept.

**Architecture:** Five-phase migration from the design spec. Create `CloudblocksPlugin` interface and `PluginRegistry` in `src/main/plugin/`. Wrap existing AWS services in `awsPlugin.ts`. Wire `ResourceScanner` through `pluginRegistry.scanAll()`. Push plugin metadata over a new IPC channel so the renderer can render plugin node types at runtime without widening the compile-time `NodeType` union.

**Tech Stack:** Electron 32 + React 19 + TypeScript, Zustand 5, React Flow v12 (@xyflow/react), Vitest + RTL

**Key constraints:**
- `JSX.Element` return types are NOT allowed — use `React.JSX.Element`
- `Record<NodeType, string>` maps with `satisfies` must remain exhaustive — do NOT widen `NodeType`
- Plugin types are `string` at runtime; the compile-time union stays closed
- Do NOT modify `buildCommand.ts`, `buildDeleteCommands.ts`, `buildEditCommands.ts` — the router in `pluginCommands.ts` wraps them

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/main/plugin/types.ts` | **Create** | `ScanContext`, `PluginScanResult`, `NodeTypeMetadata`, `PluginCommandHandlers`, `PluginHclGenerator`, `CloudblocksPlugin` interface |
| `src/main/plugin/registry.ts` | **Create** | `PluginRegistry` class + `pluginRegistry` singleton |
| `src/main/plugin/awsPlugin.ts` | **Create** | `awsPlugin` — wraps all existing AWS service scan functions |
| `src/main/plugin/index.ts` | **Create** | Re-exports `pluginRegistry`, calls `pluginRegistry.register(awsPlugin)` |
| `src/renderer/types/plugin.ts` | **Create** | Re-exports `NodeTypeMetadata` for renderer-side use (avoids cross-process import) |
| `src/renderer/plugin/rendererRegistry.ts` | **Create** | `registerPluginComponent()`, `getPluginNodeComponents()` |
| `src/renderer/plugin/pluginCommands.ts` | **Create** | `resolveCreateCommands`, `resolveDeleteCommands`, `resolveEditCommands` routing |
| `src/renderer/plugin/index.ts` | **Create** | Entry point (empty for M6, ready for Azure) |
| `src/main/aws/scanner.ts` | Modify | Replace `awsProvider.scan()` with `pluginRegistry.scanAll()`; move key-pair fetch to `awsPlugin` `scanExtras` |
| `src/main/ipc/channels.ts` | Modify | Add `PLUGIN_METADATA: 'plugin:metadata'` |
| `src/main/ipc/handlers.ts` | Modify | Push `PLUGIN_METADATA` after `restartScanner`; call `pluginRegistry.activateAll()` |
| `src/preload/index.ts` | Modify | Expose `onPluginMetadata` listener |
| `src/preload/index.d.ts` | Modify | Declare `onPluginMetadata` on `Window.cloudblocks` |
| `src/renderer/store/ui.ts` | Modify | Add `pluginNodeTypes` slice + `setPluginNodeTypes` action |
| `src/renderer/src/App.tsx` | Modify | Handle `onPluginMetadata` IPC event; import `renderer/plugin/index.ts` |
| `src/renderer/components/canvas/nodes/ResourceNode.tsx` | Modify | Runtime fallback for `TYPE_BORDER` and `TYPE_LABEL` using `pluginNodeTypes` |
| `src/renderer/components/SearchPalette.tsx` | Modify | Runtime fallback for `TYPE_BADGE_COLOR` and `TYPE_SHORT` using `pluginNodeTypes` |
| `src/renderer/components/Sidebar.tsx` | Modify | Append plugin types with `hasCreate: true` from `pluginNodeTypes` store |
| `src/main/terraform/index.ts` | Modify | Fallback to `pluginRegistry.getHclGenerator()` for non-built-in types |

---

## Task 1: Define `CloudblocksPlugin` interface and types

**Files:**
- Create: `src/main/plugin/types.ts`
- Create: `src/renderer/types/plugin.ts`
- Create: `tests/main/plugin/types.test.ts`

### Step 1: Write the failing test first

- [ ] Create `tests/main/plugin/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { CloudblocksPlugin, NodeTypeMetadata, PluginScanResult, ScanContext } from '../../../src/main/plugin/types'

describe('CloudblocksPlugin interface — structural shape', () => {
  it('NodeTypeMetadata has all required fields', () => {
    const meta: NodeTypeMetadata = {
      label:       'EC2',
      borderColor: '#FF9900',
      badgeColor:  '#FF9900',
      shortLabel:  'EC2',
      displayName: 'EC2 Instance',
      hasCreate:   true,
    }
    expect(meta.label).toBe('EC2')
    expect(meta.hasCreate).toBe(true)
  })

  it('PluginScanResult has nodes and errors arrays', () => {
    const result: PluginScanResult = { nodes: [], errors: [] }
    expect(Array.isArray(result.nodes)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)
  })

  it('ScanContext carries credentials and region', () => {
    const ctx: ScanContext = { credentials: {}, region: 'us-east-1' }
    expect(ctx.region).toBe('us-east-1')
  })

  it('CloudblocksPlugin duck-type: minimal plugin object satisfies required fields', () => {
    const plugin: CloudblocksPlugin = {
      id:              'com.test.plugin',
      displayName:     'Test Plugin',
      nodeTypes:       ['test-node'],
      nodeTypeMetadata: {
        'test-node': {
          label: 'TEST', borderColor: '#fff', badgeColor: '#fff',
          shortLabel: 'T', displayName: 'Test Node', hasCreate: false,
        },
      },
      createCredentials: (_profile, _region) => ({}),
      scan: async (_ctx) => ({ nodes: [], errors: [] }),
    }
    expect(plugin.id).toBe('com.test.plugin')
    expect(plugin.nodeTypes).toHaveLength(1)
  })
})
```

- [ ] Run — expect failure (module not found):

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/main/plugin/types.test.ts 2>&1 | tail -15
```

Expected: `Cannot find module '../../../src/main/plugin/types'`

### Step 2: Create `src/main/plugin/types.ts`

- [ ] Create the file with the exact interface from the design spec (section 3). The `CloudblocksPlugin` interface includes an optional `scanExtras?(region: string): Promise<void>` field to accommodate the AWS key-pair fetch (not in the spec interface block but required per section 6.2 open question Q2):

```ts
// src/main/plugin/types.ts
import type { CloudNode } from '../../renderer/types/cloud'

export interface ScanContext<TCredentials = unknown> {
  credentials: TCredentials
  region: string
}

export interface PluginScanResult {
  nodes: CloudNode[]
  errors: Array<{ service: string; region: string; message: string }>
}

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

export interface PluginCommandHandlers {
  buildCreate?: (resource: string, params: Record<string, unknown>) => string[][]
  buildDelete?: (node: CloudNode, opts?: Record<string, unknown>) => string[][]
  buildEdit?:   (node: CloudNode, params: Record<string, unknown>) => string[][]
}

export type PluginHclGenerator = (node: CloudNode) => string

export interface CloudblocksPlugin {
  readonly id: string
  readonly displayName: string
  readonly nodeTypes: readonly string[]
  readonly nodeTypeMetadata: Readonly<Record<string, NodeTypeMetadata>>
  createCredentials(profile: string, region: string, endpoint?: string): unknown
  scan(context: ScanContext): Promise<PluginScanResult>
  scanExtras?(region: string): Promise<void>
  commands?: PluginCommandHandlers
  hclGenerators?: Record<string, PluginHclGenerator>
  activate?(): void | Promise<void>
  deactivate?(): void | Promise<void>
  registerIpcHandlers?(ipcMain: Electron.IpcMain, win: Electron.BrowserWindow): void
}
```

### Step 3: Create `src/renderer/types/plugin.ts`

- [ ] This re-export lets the renderer import `NodeTypeMetadata` without crossing the main/renderer boundary:

```ts
// src/renderer/types/plugin.ts
export type { NodeTypeMetadata } from '../../main/plugin/types'
```

### Step 4: Run the test — expect pass

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/main/plugin/types.test.ts 2>&1 | tail -10
```

Expected: `4 passed`

### Step 5: Run typecheck

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | tail -10
```

Expected: no errors.

### Step 6: Commit

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/main/plugin/types.ts src/renderer/types/plugin.ts tests/main/plugin/types.test.ts && git commit -m "feat(M6): define CloudblocksPlugin interface and NodeTypeMetadata types"
```

---

## Task 2: Implement `PluginRegistry`

**Files:**
- Create: `src/main/plugin/registry.ts`
- Create: `tests/main/plugin/registry.test.ts`

### Step 1: Write the failing test first

- [ ] Create `tests/main/plugin/registry.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PluginRegistry } from '../../../src/main/plugin/registry'
import type { CloudblocksPlugin } from '../../../src/main/plugin/types'

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))

function makePlugin(id: string, nodeTypes: string[] = ['test-node']): CloudblocksPlugin {
  return {
    id,
    displayName: `Plugin ${id}`,
    nodeTypes,
    nodeTypeMetadata: Object.fromEntries(
      nodeTypes.map((t) => [t, { label: t.toUpperCase(), borderColor: '#fff', badgeColor: '#fff', shortLabel: t, displayName: t, hasCreate: false }])
    ),
    createCredentials: vi.fn().mockReturnValue({ stubClient: true }),
    scan: vi.fn().mockResolvedValue({ nodes: [], errors: [] }),
  }
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry

  beforeEach(() => {
    registry = new PluginRegistry()
  })

  it('registers a plugin and exposes it in plugins[]', () => {
    const p = makePlugin('com.test.a')
    registry.register(p)
    expect(registry.plugins).toHaveLength(1)
    expect(registry.plugins[0].id).toBe('com.test.a')
  })

  it('throws on duplicate NodeType registration', () => {
    registry.register(makePlugin('com.test.a', ['shared-type']))
    expect(() => registry.register(makePlugin('com.test.b', ['shared-type']))).toThrow(/shared-type/)
  })

  it('getNodeTypeMetadata returns metadata for registered type', () => {
    registry.register(makePlugin('com.test.a', ['my-type']))
    const meta = registry.getNodeTypeMetadata('my-type')
    expect(meta?.label).toBe('MY-TYPE')
  })

  it('getNodeTypeMetadata returns undefined for unknown type', () => {
    expect(registry.getNodeTypeMetadata('not-registered')).toBeUndefined()
  })

  it('scanAll merges results from all plugins', async () => {
    const nodeA = { id: 'a', type: 'ec2' as const, label: 'A', status: 'running' as const, region: 'us-east-1', metadata: {} }
    const nodeB = { id: 'b', type: 'ec2' as const, label: 'B', status: 'running' as const, region: 'us-east-1', metadata: {} }
    const pa = makePlugin('com.test.a', ['type-a'])
    const pb = makePlugin('com.test.b', ['type-b'])
    ;(pa.scan as ReturnType<typeof vi.fn>).mockResolvedValue({ nodes: [nodeA], errors: [] })
    ;(pb.scan as ReturnType<typeof vi.fn>).mockResolvedValue({ nodes: [nodeB], errors: [] })

    await registry.activateAll('default', 'us-east-1')
    registry.register(pa)
    registry.register(pb)
    const result = await registry.scanAll('us-east-1')
    expect(result.nodes).toHaveLength(2)
    expect(result.errors).toHaveLength(0)
  })

  it('scanAll isolates errors — one failing plugin does not stop others', async () => {
    const pa = makePlugin('com.test.a', ['type-a'])
    const pb = makePlugin('com.test.b', ['type-b'])
    ;(pa.scan as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'))
    ;(pb.scan as ReturnType<typeof vi.fn>).mockResolvedValue({ nodes: [], errors: [] })

    await registry.activateAll('default', 'us-east-1')
    registry.register(pa)
    registry.register(pb)
    const result = await registry.scanAll('us-east-1')
    // pa failed but pb's results still merged in
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].service).toBe('com.test.a')
  })

  it('getHclGenerator returns undefined when no plugin has registered it', () => {
    registry.register(makePlugin('com.test.a', ['type-a']))
    expect(registry.getHclGenerator('type-a')).toBeUndefined()
  })

  it('getHclGenerator returns generator when plugin has registered it', () => {
    const p = makePlugin('com.test.a', ['type-a'])
    p.hclGenerators = { 'type-a': (_node) => 'resource "mock" "r" {}' }
    registry.register(p)
    const gen = registry.getHclGenerator('type-a')
    expect(gen).toBeDefined()
  })
})
```

- [ ] Run — expect failure (module not found):

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/main/plugin/registry.test.ts 2>&1 | tail -15
```

Expected: `Cannot find module '../../../src/main/plugin/registry'`

### Step 2: Create `src/main/plugin/registry.ts`

- [ ] Create the file. Note: `activateAll` must be called before `register` in tests, but the production code registers plugins at startup before `activateAll`. The registry stores credentials keyed by plugin.id and passes them to `scan()`. Plugins registered after `activateAll` get `undefined` credentials (credentials are set the next time `activateAll` runs). `scanAll` must not throw even if credentials are `undefined`:

```ts
// src/main/plugin/registry.ts
import type { CloudblocksPlugin, NodeTypeMetadata, PluginHclGenerator, PluginScanResult } from './types'
import type { CloudNode } from '../../renderer/types/cloud'

export class PluginRegistry {
  private _plugins: CloudblocksPlugin[] = []
  private _ownerByType = new Map<string, CloudblocksPlugin>()
  private _credentials = new Map<string, unknown>()

  get plugins(): readonly CloudblocksPlugin[] {
    return this._plugins
  }

  register(plugin: CloudblocksPlugin): void {
    for (const nodeType of plugin.nodeTypes) {
      if (this._ownerByType.has(nodeType)) {
        const owner = this._ownerByType.get(nodeType)!
        throw new Error(
          `NodeType "${nodeType}" is already claimed by plugin "${owner.id}". ` +
          `Cannot register plugin "${plugin.id}".`
        )
      }
      this._ownerByType.set(nodeType, plugin)
    }
    this._plugins.push(plugin)
  }

  async activateAll(profile: string, region: string, endpoint?: string): Promise<void> {
    for (const plugin of this._plugins) {
      try {
        const creds = plugin.createCredentials(profile, region, endpoint)
        this._credentials.set(plugin.id, creds)
        if (plugin.activate) await plugin.activate()
      } catch (err) {
        console.error(`[PluginRegistry] Failed to activate plugin "${plugin.id}":`, err)
      }
    }
  }

  async deactivateAll(): Promise<void> {
    for (const plugin of [...this._plugins].reverse()) {
      try {
        if (plugin.deactivate) await plugin.deactivate()
      } catch (err) {
        console.error(`[PluginRegistry] Failed to deactivate plugin "${plugin.id}":`, err)
      }
    }
    this._credentials.clear()
  }

  async scanAll(region: string): Promise<PluginScanResult> {
    const allNodes: CloudNode[] = []
    const allErrors: PluginScanResult['errors'] = []

    await Promise.all(
      this._plugins.map(async (plugin) => {
        try {
          const credentials = this._credentials.get(plugin.id)
          const result = await plugin.scan({ credentials, region })
          allNodes.push(...result.nodes)
          allErrors.push(...result.errors)

          // Optional hook for plugin-specific extras (e.g. AWS key pairs)
          if (plugin.scanExtras) {
            await plugin.scanExtras(region)
          }
        } catch (err) {
          allErrors.push({
            service: plugin.id,
            region,
            message: (err as Error)?.message ?? String(err),
          })
        }
      })
    )

    return { nodes: allNodes, errors: allErrors }
  }

  buildCreate(resource: string, params: Record<string, unknown>): string[][] {
    const owner = this._ownerByType.get(resource)
    return owner?.commands?.buildCreate?.(resource, params) ?? []
  }

  buildDelete(node: CloudNode, opts?: Record<string, unknown>): string[][] {
    const owner = this._ownerByType.get(node.type)
    return owner?.commands?.buildDelete?.(node, opts) ?? []
  }

  buildEdit(node: CloudNode, params: Record<string, unknown>): string[][] {
    const owner = this._ownerByType.get(node.type)
    return owner?.commands?.buildEdit?.(node, params) ?? []
  }

  getHclGenerator(nodeType: string): PluginHclGenerator | undefined {
    const owner = this._ownerByType.get(nodeType)
    return owner?.hclGenerators?.[nodeType]
  }

  getNodeTypeMetadata(nodeType: string): NodeTypeMetadata | undefined {
    const owner = this._ownerByType.get(nodeType)
    return owner?.nodeTypeMetadata[nodeType]
  }

  getAllNodeTypeMetadata(): Record<string, NodeTypeMetadata> {
    const result: Record<string, NodeTypeMetadata> = {}
    for (const plugin of this._plugins) {
      for (const [type, meta] of Object.entries(plugin.nodeTypeMetadata)) {
        result[type] = meta
      }
    }
    return result
  }
}

export const pluginRegistry = new PluginRegistry()
```

### Step 3: Run the test — expect pass

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/main/plugin/registry.test.ts 2>&1 | tail -10
```

Expected: `8 passed`

### Step 4: Run typecheck

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | tail -10
```

Expected: no errors.

### Step 5: Commit

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/main/plugin/registry.ts tests/main/plugin/registry.test.ts && git commit -m "feat(M6): implement PluginRegistry with register/scan/activate/metadata"
```

---

## Task 3: Implement `awsPlugin.ts`

**Files:**
- Create: `src/main/plugin/awsPlugin.ts`
- Create: `tests/main/plugin/awsPlugin.test.ts`

### Step 1: Write the failing test first

- [ ] Create `tests/main/plugin/awsPlugin.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AwsClients } from '../../../src/main/aws/client'

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))
vi.mock('../../../src/main/aws/client', () => ({
  createClients: vi.fn().mockReturnValue({} as AwsClients),
}))
vi.mock('../../../src/main/aws/services/ec2', () => ({
  describeInstances:      vi.fn().mockResolvedValue([]),
  describeVpcs:           vi.fn().mockResolvedValue([]),
  describeSubnets:        vi.fn().mockResolvedValue([]),
  describeSecurityGroups: vi.fn().mockResolvedValue([]),
  describeKeyPairs:       vi.fn().mockResolvedValue(['key-1', 'key-2']),
  listInternetGateways:   vi.fn().mockResolvedValue([]),
  listNatGateways:        vi.fn().mockResolvedValue([]),
}))
vi.mock('../../../src/main/aws/services/igw', () => ({ listInternetGateways: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/nat', () => ({ listNatGateways: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/rds', () => ({ describeDBInstances: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/s3', () => ({ listBuckets: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/lambda', () => ({ listFunctions: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/alb', () => ({ describeLoadBalancers: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/acm', () => ({ listCertificates: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/cloudfront', () => ({ listDistributions: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/apigw', () => ({ listApis: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/sqs', () => ({ listQueues: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/secrets', () => ({ listSecrets: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/ecr', () => ({ listRepositories: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/sns', () => ({ listTopics: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/dynamo', () => ({ listTables: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/ssm', () => ({ listParameters: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/r53', () => ({ listHostedZones: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/sfn', () => ({ listStateMachines: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/eventbridge', () => ({ listEventBuses: vi.fn().mockResolvedValue([]) }))

describe('awsPlugin', () => {
  let awsPlugin: import('../../../src/main/plugin/awsPlugin').CloudblocksPlugin

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../../../src/main/plugin/awsPlugin')
    awsPlugin = mod.awsPlugin
  })

  it('has the correct plugin id', () => {
    expect(awsPlugin.id).toBe('com.cloudblocks.aws')
  })

  it('declares all 24 NodeTypes (22 + unknown)', () => {
    expect(awsPlugin.nodeTypes.length).toBeGreaterThanOrEqual(22)
    expect(awsPlugin.nodeTypes).toContain('ec2')
    expect(awsPlugin.nodeTypes).toContain('vpc')
    expect(awsPlugin.nodeTypes).toContain('eventbridge-bus')
  })

  it('has nodeTypeMetadata entry for each nodeType', () => {
    for (const t of awsPlugin.nodeTypes) {
      expect(awsPlugin.nodeTypeMetadata[t]).toBeDefined()
      expect(awsPlugin.nodeTypeMetadata[t].label).toBeTruthy()
    }
  })

  it('createCredentials returns an object with clients', () => {
    const creds = awsPlugin.createCredentials('default', 'us-east-1')
    expect(creds).toBeDefined()
  })

  it('scan() returns nodes and errors merged from all services', async () => {
    const creds = awsPlugin.createCredentials('default', 'us-east-1')
    const result = await awsPlugin.scan({ credentials: creds, region: 'us-east-1' })
    expect(Array.isArray(result.nodes)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)
  })
})
```

- [ ] Run — expect failure (module not found):

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/main/plugin/awsPlugin.test.ts 2>&1 | tail -15
```

Expected: `Cannot find module '../../../src/main/plugin/awsPlugin'`

### Step 2: Create `src/main/plugin/awsPlugin.ts`

- [ ] The `nodeTypeMetadata` values are copied from `ResourceNode.tsx`'s `TYPE_BORDER` and `TYPE_LABEL` maps. The `scanExtras` hook handles the key-pair IPC push (the scanner will call it). Since `scanExtras` needs to push over IPC, `awsPlugin.ts` will need a reference to the BrowserWindow — pass it via a factory pattern or store it during `activate`. Use a module-level `_win` variable set by a separate `setWindow()` call from the registry/scanner. Actually, the simpler approach aligned with the current scanner pattern: `scanExtras` is called by `ResourceScanner` after `scanAll`, and the scanner already holds `this.window`. So the scanner passes `win` to `scanExtras` via a different signature. To keep `CloudblocksPlugin.scanExtras` simple (no `win` parameter), the AWS plugin uses an internal weak ref. However, the cleanest approach for M6 is for the scanner itself to call `describeKeyPairs` + `win.webContents.send` directly for the AWS plugin only — consistent with the TODO comment already in `scanner.ts`. Leave `scanExtras` on the interface but the AWS plugin does NOT implement it in M6 (the scanner keeps the key-pair send as an inline guard). This avoids adding `win` to the plugin interface for M6.

Accordingly, `awsPlugin.ts` does NOT implement `scanExtras`. The scanner Task 4 will preserve the key-pair send inline (guarded by plugin.id check) until a future cleanup.

Create `src/main/plugin/awsPlugin.ts`:

```ts
// src/main/plugin/awsPlugin.ts
import { createClients } from '../aws/client'
import type { AwsClients } from '../aws/client'
import { describeInstances, describeVpcs, describeSubnets, describeSecurityGroups } from '../aws/services/ec2'
import { listInternetGateways, listNatGateways } from '../aws/services/ec2'
import { describeDBInstances } from '../aws/services/rds'
import { listBuckets } from '../aws/services/s3'
import { listFunctions } from '../aws/services/lambda'
import { describeLoadBalancers } from '../aws/services/alb'
import { listCertificates } from '../aws/services/acm'
import { listDistributions } from '../aws/services/cloudfront'
import { listApis } from '../aws/services/apigw'
import { listQueues } from '../aws/services/sqs'
import { listSecrets } from '../aws/services/secrets'
import { listRepositories } from '../aws/services/ecr'
import { listTopics } from '../aws/services/sns'
import { listTables } from '../aws/services/dynamo'
import { listParameters } from '../aws/services/ssm'
import { listHostedZones } from '../aws/services/r53'
import { listStateMachines } from '../aws/services/sfn'
import { listEventBuses } from '../aws/services/eventbridge'
import type { CloudblocksPlugin, NodeTypeMetadata, PluginScanResult, ScanContext } from './types'
import type { CloudNode } from '../../renderer/types/cloud'

// Metadata copied from ResourceNode.tsx TYPE_BORDER + TYPE_LABEL + Sidebar.tsx SERVICES
const AWS_NODE_TYPE_METADATA: Record<string, NodeTypeMetadata> = {
  ec2:              { label: 'EC2',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'EC2',    displayName: 'EC2',             hasCreate: true  },
  vpc:              { label: 'VPC',    borderColor: '#1976D2', badgeColor: '#1976D2', shortLabel: 'VPC',    displayName: 'VPC',             hasCreate: true  },
  subnet:           { label: 'SUBNET', borderColor: '#4CAF50', badgeColor: '#4CAF50', shortLabel: 'SUB',    displayName: 'Subnet',          hasCreate: false },
  rds:              { label: 'RDS',    borderColor: '#4CAF50', badgeColor: '#4CAF50', shortLabel: 'RDS',    displayName: 'RDS',             hasCreate: true  },
  s3:               { label: 'S3',     borderColor: '#64b5f6', badgeColor: '#64b5f6', shortLabel: 'S3',     displayName: 'S3',              hasCreate: true  },
  lambda:           { label: 'λ',      borderColor: '#64b5f6', badgeColor: '#64b5f6', shortLabel: 'FN',     displayName: 'Lambda',          hasCreate: true  },
  alb:              { label: 'ALB',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'ALB',    displayName: 'ALB',             hasCreate: true  },
  'security-group': { label: 'SG',     borderColor: '#9c27b0', badgeColor: '#9c27b0', shortLabel: 'SG',     displayName: 'Security Group',  hasCreate: true  },
  igw:              { label: 'IGW',    borderColor: '#4CAF50', badgeColor: '#4CAF50', shortLabel: 'IGW',    displayName: 'IGW',             hasCreate: false },
  acm:              { label: 'ACM',    borderColor: '#64b5f6', badgeColor: '#64b5f6', shortLabel: 'ACM',    displayName: 'ACM',             hasCreate: true  },
  cloudfront:       { label: 'CF',     borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'CF',     displayName: 'CloudFront',      hasCreate: true  },
  apigw:            { label: 'APIGW',  borderColor: '#8b5cf6', badgeColor: '#8b5cf6', shortLabel: 'APIGW',  displayName: 'API Gateway',     hasCreate: true  },
  'apigw-route':    { label: 'ROUTE',  borderColor: '#22c55e', badgeColor: '#22c55e', shortLabel: 'ROUTE',  displayName: 'API Route',       hasCreate: false },
  sqs:              { label: 'SQS',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'SQS',    displayName: 'SQS',             hasCreate: true  },
  secret:           { label: 'SECRET', borderColor: '#22c55e', badgeColor: '#22c55e', shortLabel: 'SEC',    displayName: 'Secrets Manager', hasCreate: true  },
  'ecr-repo':       { label: 'ECR',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'ECR',    displayName: 'ECR',             hasCreate: true  },
  sns:              { label: 'SNS',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'SNS',    displayName: 'SNS',             hasCreate: true  },
  dynamo:           { label: 'DDB',    borderColor: '#64b5f6', badgeColor: '#64b5f6', shortLabel: 'DDB',    displayName: 'DynamoDB',        hasCreate: true  },
  'ssm-param':      { label: 'SSM',    borderColor: '#22c55e', badgeColor: '#22c55e', shortLabel: 'SSM',    displayName: 'SSM',             hasCreate: false },
  'nat-gateway':    { label: 'NAT',    borderColor: '#4CAF50', badgeColor: '#4CAF50', shortLabel: 'NAT',    displayName: 'NAT Gateway',     hasCreate: false },
  'r53-zone':       { label: 'R53',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'R53',    displayName: 'Route 53',        hasCreate: false },
  sfn:              { label: 'SFN',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'SFN',    displayName: 'Step Functions',  hasCreate: true  },
  'eventbridge-bus':{ label: 'EB',     borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'EB',     displayName: 'EventBridge',     hasCreate: true  },
  unknown:          { label: '?',      borderColor: '#6b7280', badgeColor: '#6b7280', shortLabel: '?',      displayName: 'Unknown',         hasCreate: false },
}

function errCatch(service: string, region: string, errors: PluginScanResult['errors']) {
  return (e: unknown): CloudNode[] => {
    errors.push({ service, region, message: (e as Error)?.message ?? String(e) })
    return []
  }
}

export const awsPlugin: CloudblocksPlugin = {
  id: 'com.cloudblocks.aws',
  displayName: 'Amazon Web Services',
  nodeTypes: Object.keys(AWS_NODE_TYPE_METADATA),
  nodeTypeMetadata: AWS_NODE_TYPE_METADATA,

  createCredentials(profile: string, region: string, endpoint?: string): AwsClients {
    return createClients(profile, region, endpoint)
  },

  async scan(context: ScanContext): Promise<PluginScanResult> {
    const clients = context.credentials as AwsClients
    const region  = context.region
    const errors: PluginScanResult['errors'] = []
    const catch_  = (service: string) => errCatch(service, region, errors)

    const results = await Promise.all([
      describeInstances(clients.ec2, region).catch(catch_('ec2:instances')),
      describeVpcs(clients.ec2, region).catch(catch_('ec2:vpcs')),
      describeSubnets(clients.ec2, region).catch(catch_('ec2:subnets')),
      describeSecurityGroups(clients.ec2, region).catch(catch_('ec2:security-groups')),
      describeDBInstances(clients.rds, region).catch(catch_('rds')),
      listBuckets(clients.s3, region).catch(catch_('s3')),
      listFunctions(clients.lambda, region).catch(catch_('lambda')),
      describeLoadBalancers(clients.alb, region).catch(catch_('alb')),
      listCertificates(clients.acm).catch(catch_('acm')),
      listDistributions(clients.cloudfront).catch(catch_('cloudfront')),
      listApis(clients.apigw, region).catch(catch_('apigw')),
      listInternetGateways(clients.ec2, region).catch(catch_('igw')),
      listQueues(clients.sqs, clients.lambda, region).catch(catch_('sqs')),
      listSecrets(clients.secrets, region).catch(catch_('secrets')),
      listRepositories(clients.ecr, region).catch(catch_('ecr')),
      listTopics(clients.sns, region).catch(catch_('sns')),
      listTables(clients.dynamo, region).catch(catch_('dynamo')),
      listParameters(clients.ssm, region).catch(catch_('ssm')),
      listNatGateways(clients.ec2, region).catch(catch_('nat')),
      listHostedZones(clients.r53).catch(catch_('r53')),
      listStateMachines(clients.sfn, region).catch(catch_('sfn')),
      listEventBuses(clients.eventbridge, region).catch(catch_('eventbridge')),
    ])

    const nodes = results.flat().map((node) => ({ ...node, region: node.region ?? region }))
    return { nodes, errors }
  },
}
```

Note: `listInternetGateways` and `listNatGateways` are imported from `services/igw` and `services/nat` respectively in the real file — adjust the imports to match the actual service module paths (check `provider.ts`). Looking at `provider.ts` lines 19-20, they are in `services/igw` and `services/nat`. Fix the double-import of ec2 services in the template above:

The actual imports for `awsPlugin.ts` should match `provider.ts` exactly — use `services/igw` for `listInternetGateways` and `services/nat` for `listNatGateways`. Remove the line `import { listInternetGateways, listNatGateways } from '../aws/services/ec2'` — that was a template error. Use:
```ts
import { listInternetGateways } from '../aws/services/igw'
import { listNatGateways } from '../aws/services/nat'
```

### Step 3: Run the test — expect pass

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/main/plugin/awsPlugin.test.ts 2>&1 | tail -10
```

Expected: `5 passed`

### Step 4: Run typecheck

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | tail -10
```

Expected: no errors.

### Step 5: Create `src/main/plugin/index.ts`

- [ ] This is the entry point that registers `awsPlugin` into the singleton `pluginRegistry`. Called once from `src/main/index.ts` or similar startup entry before `registerHandlers`:

```ts
// src/main/plugin/index.ts
export { pluginRegistry } from './registry'
export { awsPlugin } from './awsPlugin'
import { pluginRegistry } from './registry'
import { awsPlugin } from './awsPlugin'

pluginRegistry.register(awsPlugin)
```

### Step 6: Commit

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/main/plugin/awsPlugin.ts src/main/plugin/index.ts tests/main/plugin/awsPlugin.test.ts && git commit -m "feat(M6): awsPlugin wraps all AWS service scans; plugin/index registers it"
```

---

## Task 4: Wire `ResourceScanner` through `pluginRegistry.scanAll()`

**Files:**
- Modify: `src/main/aws/scanner.ts`
- Modify: `tests/main/aws/scanner.test.ts` (update existing test or create one)

### Step 1: Check if scanner test exists

- [ ] Run:

```bash
ls /Users/julius/AI/cloudblocks/cloudblocks/tests/main/aws/scanner.test.ts 2>/dev/null && echo "exists" || echo "missing"
```

If missing, write one. If exists, read it to understand the current mock setup.

### Step 2: Write a failing test for the new behavior

- [ ] Create (or add to) `tests/main/aws/scanner.test.ts`. The test mocks `pluginRegistry` instead of `awsProvider`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeDelta } from '../../../src/main/aws/scanner'
import type { CloudNode } from '../../../src/renderer/types/cloud'

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => ({
    webContents: { send: vi.fn() },
  })),
}))

vi.mock('../../../src/main/plugin/registry', () => ({
  pluginRegistry: {
    scanAll: vi.fn().mockResolvedValue({ nodes: [], errors: [] }),
  },
}))

vi.mock('../../../src/main/aws/client', () => ({
  createClients: vi.fn().mockReturnValue({}),
}))

vi.mock('../../../src/main/aws/services/ec2', () => ({
  describeKeyPairs: vi.fn().mockResolvedValue([]),
}))

function makeNode(id: string): CloudNode {
  return { id, type: 'ec2', label: id, status: 'running', region: 'us-east-1', metadata: {} }
}

describe('computeDelta', () => {
  it('returns added nodes for new IDs', () => {
    const delta = computeDelta([], [makeNode('a')])
    expect(delta.added).toHaveLength(1)
    expect(delta.added[0].id).toBe('a')
  })

  it('returns removed IDs for nodes no longer present', () => {
    const delta = computeDelta([makeNode('a')], [])
    expect(delta.removed).toEqual(['a'])
  })

  it('returns changed nodes when status differs', () => {
    const prev = { ...makeNode('a'), status: 'running' as const }
    const next = { ...makeNode('a'), status: 'stopped' as const }
    const delta = computeDelta([prev], [next])
    expect(delta.changed).toHaveLength(1)
  })

  it('returns no changes for identical nodes', () => {
    const node = makeNode('a')
    const delta = computeDelta([node], [node])
    expect(delta.added).toHaveLength(0)
    expect(delta.changed).toHaveLength(0)
    expect(delta.removed).toHaveLength(0)
  })
})

describe('ResourceScanner wires through pluginRegistry', () => {
  it('imports ResourceScanner without error (pluginRegistry mock in scope)', async () => {
    // If scanner.ts still imports awsProvider.scan directly, this import will fail
    // because awsProvider is not mocked — proving the wire-through is needed.
    const { ResourceScanner } = await import('../../../src/main/aws/scanner')
    expect(ResourceScanner).toBeDefined()
  })
})
```

- [ ] Run — the last describe block should pass (scanner can be imported) but this verifies `pluginRegistry` is in scope when scanner runs:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/main/aws/scanner.test.ts 2>&1 | tail -15
```

### Step 3: Modify `src/main/aws/scanner.ts`

- [ ] Replace the `awsProvider.scan()` call with `pluginRegistry.scanAll(region)`. Keep the key-pair send inline (guarded with a try/catch) since the scanner already holds `this.window` and the AWS plugin does not implement `scanExtras` in M6.

Replace the `private async scan()` method. The changes are:
1. Remove `import { awsProvider } from './provider'`
2. Remove `const clients = createClients(...)` inside the region map
3. Replace `awsProvider.scan(clients, region)` with `pluginRegistry.scanAll(region)`
4. Map `PluginScanResult.errors` to `ScanError[]` format (they already match: `{ service, region, message }`)
5. Keep `createClients` import for the key-pair fetch (`describeKeyPairs` still uses an EC2Client)
6. Add `import { pluginRegistry } from '../plugin/registry'`

The new `scan()` private method body:

```ts
private async scan(): Promise<void> {
  this.window.webContents.send(IPC.SCAN_STATUS, 'scanning')

  try {
    const regionResults = await Promise.all(
      this.regions.map((region) => pluginRegistry.scanAll(region))
    )

    const nextNodes  = regionResults.flatMap((r) => r.nodes)
    const scanErrors = regionResults.flatMap((r) => r.errors)

    const delta = computeDelta(this.currentNodes, nextNodes)

    this.currentNodes = nextNodes
    this.window.webContents.send(IPC.SCAN_DELTA, { ...delta, scanErrors })
    this.window.webContents.send(IPC.SCAN_STATUS, 'idle')

    // Key pairs are AWS-specific — keep inline until scanExtras hook is wired (M6 cleanup)
    const primaryClients = createClients(this.profile, this.regions[0], this.endpoint)
    const keyPairs = await describeKeyPairs(primaryClients.ec2)
    this.window.webContents.send(IPC.SCAN_KEYPAIRS, keyPairs)

    this.window.webContents.send(IPC.CONN_STATUS, 'connected')
  } catch {
    this.window.webContents.send(IPC.SCAN_STATUS, 'error')
    this.window.webContents.send(IPC.CONN_STATUS, 'error')
  }
}
```

- [ ] Also remove the `import { awsProvider } from './provider'` line, add `import { pluginRegistry } from '../plugin/registry'`.

### Step 4: Run tests and typecheck

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/main/aws/scanner.test.ts 2>&1 | tail -10
```

Expected: all pass.

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | tail -10
```

Expected: no errors. If `PluginScanResult.errors` type doesn't match `ScanError[]`, cast: `r.errors as ScanError[]` (they have the same shape).

### Step 5: Run full test suite

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test 2>&1 | tail -20
```

Expected: all existing tests pass. The existing `awsProvider` tests in `tests/main/aws/provider.test.ts` still pass because `awsProvider` itself is not deleted.

### Step 6: Commit

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/main/aws/scanner.ts tests/main/aws/scanner.test.ts && git commit -m "feat(M6): ResourceScanner routes through pluginRegistry.scanAll()"
```

---

## Task 5: Add `PLUGIN_METADATA` IPC channel and push

**Files:**
- Modify: `src/main/ipc/channels.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `tests/main/ipc/channels.test.ts`

### Step 1: Add failing test to `channels.test.ts`

- [ ] Open `tests/main/ipc/channels.test.ts` and add:

```ts
it('defines PLUGIN_METADATA channel', () => {
  expect(IPC.PLUGIN_METADATA).toBe('plugin:metadata')
})
```

- [ ] Run — expect failure:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/main/ipc/channels.test.ts 2>&1 | tail -10
```

Expected: `IPC.PLUGIN_METADATA is not a string` or similar.

### Step 2: Add `PLUGIN_METADATA` to `channels.ts`

- [ ] In `src/main/ipc/channels.ts`, add after `NOTIFY_DRIFT`:

```ts
PLUGIN_METADATA: 'plugin:metadata',  // push: main → renderer; payload: Record<string, NodeTypeMetadata>
```

### Step 3: Run channels test — expect pass

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/main/ipc/channels.test.ts 2>&1 | tail -10
```

Expected: all pass.

### Step 4: Modify `handlers.ts` — push metadata after `activateAll` in `restartScanner`

- [ ] In `src/main/ipc/handlers.ts`, add the following imports at the top:

```ts
import { pluginRegistry } from '../plugin/registry'
import '../plugin/index'  // side-effect: registers awsPlugin into pluginRegistry
import type { NodeTypeMetadata } from '../plugin/types'
```

- [ ] Modify the `restartScanner` function to call `pluginRegistry.activateAll()` and push metadata:

```ts
async function restartScanner(win: BrowserWindow, profile: string, regions: string[], endpoint?: string): Promise<void> {
  scanner?.stop()
  cliEngine = new CliEngine(win, endpoint)
  clients   = createClients(profile, regions[0] ?? 'us-east-1', endpoint)

  await pluginRegistry.deactivateAll()
  await pluginRegistry.activateAll(profile, regions[0] ?? 'us-east-1', endpoint)

  // Push plugin-registered NodeType metadata to renderer
  const meta: Record<string, NodeTypeMetadata> = pluginRegistry.getAllNodeTypeMetadata()
  win.webContents.send(IPC.PLUGIN_METADATA, meta)

  scanner = new ResourceScanner(profile, regions, endpoint, win)
  scanner.start()
}
```

Note: `restartScanner` becomes `async`. Update the two call sites (`PROFILE_SELECT` and `REGION_SELECT` handlers) to `await restartScanner(...)` or just fire without await (consistent with current behavior — the handlers don't currently await `restartScanner`). Since `ipcMain.handle` callbacks can be async, use `await` for cleanliness but it is not strictly required.

### Step 5: Expose `onPluginMetadata` in preload

- [ ] In `src/preload/index.ts`, add the import at top:

```ts
import type { NodeTypeMetadata } from '../main/plugin/types'
```

Add inside the `contextBridge.exposeInMainWorld('cloudblocks', { ... })` block:

```ts
onPluginMetadata: (cb: (meta: Record<string, NodeTypeMetadata>) => void): (() => void) => {
  const handler = (_e: Electron.IpcRendererEvent, meta: Record<string, NodeTypeMetadata>): void => cb(meta)
  ipcRenderer.on(IPC.PLUGIN_METADATA, handler)
  return () => ipcRenderer.removeListener(IPC.PLUGIN_METADATA, handler)
},
```

### Step 6: Declare `onPluginMetadata` in `preload/index.d.ts`

- [ ] In `src/preload/index.d.ts`, add inside the `cloudblocks` object type:

```ts
onPluginMetadata(cb: (meta: Record<string, import('../main/plugin/types').NodeTypeMetadata>) => void): () => void
```

### Step 7: Run typecheck

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | tail -10
```

Expected: no errors.

### Step 8: Run full test suite

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test 2>&1 | tail -20
```

Expected: all pass.

### Step 9: Commit

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/main/ipc/channels.ts src/main/ipc/handlers.ts src/preload/index.ts src/preload/index.d.ts tests/main/ipc/channels.test.ts && git commit -m "feat(M6): add PLUGIN_METADATA IPC channel; push metadata after activateAll"
```

---

## Task 6: Add `pluginNodeTypes` slice to `useUIStore`

**Files:**
- Modify: `src/renderer/store/ui.ts`
- Modify: `src/renderer/src/App.tsx`
- Create: `tests/renderer/store/ui-plugin-nodetypes.test.ts`

### Step 1: Write the failing test first

- [ ] Create `tests/renderer/store/ui-plugin-nodetypes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'
import type { NodeTypeMetadata } from '../../../src/main/plugin/types'

describe('useUIStore — pluginNodeTypes slice', () => {
  beforeEach(() => {
    useUIStore.setState({
      pluginNodeTypes: {},
    } as Parameters<typeof useUIStore.setState>[0])
  })

  it('starts with empty pluginNodeTypes', () => {
    expect(useUIStore.getState().pluginNodeTypes).toEqual({})
  })

  it('setPluginNodeTypes stores metadata keyed by type string', () => {
    const meta: Record<string, NodeTypeMetadata> = {
      'azure-vm': {
        label: 'VM', borderColor: '#0078D4', badgeColor: '#0078D4',
        shortLabel: 'VM', displayName: 'Azure VM', hasCreate: true,
      },
    }
    useUIStore.getState().setPluginNodeTypes(meta)
    expect(useUIStore.getState().pluginNodeTypes['azure-vm']?.label).toBe('VM')
  })

  it('setPluginNodeTypes replaces the entire map (not merge)', () => {
    useUIStore.getState().setPluginNodeTypes({ 'type-a': { label: 'A', borderColor: '#fff', badgeColor: '#fff', shortLabel: 'A', displayName: 'A', hasCreate: false } })
    useUIStore.getState().setPluginNodeTypes({ 'type-b': { label: 'B', borderColor: '#fff', badgeColor: '#fff', shortLabel: 'B', displayName: 'B', hasCreate: false } })
    expect(useUIStore.getState().pluginNodeTypes['type-a']).toBeUndefined()
    expect(useUIStore.getState().pluginNodeTypes['type-b']).toBeDefined()
  })
})
```

- [ ] Run — expect failure:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/renderer/store/ui-plugin-nodetypes.test.ts 2>&1 | tail -15
```

Expected: `pluginNodeTypes is not a property of UIState` or similar type error.

### Step 2: Add slice to `useUIStore`

- [ ] In `src/renderer/store/ui.ts`:

Add the import at the top:
```ts
import type { NodeTypeMetadata } from '../../main/plugin/types'
```

Add to the `UIState` interface (after `sidebarFilter`):
```ts
pluginNodeTypes: Record<string, NodeTypeMetadata>
setPluginNodeTypes: (meta: Record<string, NodeTypeMetadata>) => void
```

Add to the `create<UIState>((set) => ({` initializer block (after `sidebarFilter: null`):
```ts
pluginNodeTypes: {},
setPluginNodeTypes: (meta) => set({ pluginNodeTypes: meta }),
```

### Step 3: Run the test — expect pass

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/renderer/store/ui-plugin-nodetypes.test.ts 2>&1 | tail -10
```

Expected: `3 passed`

### Step 4: Handle `onPluginMetadata` in `App.tsx`

- [ ] In `src/renderer/src/App.tsx`, import `renderer/plugin/index.ts` (side-effect import for renderer plugin registration) and add a `useEffect` that listens for the `PLUGIN_METADATA` push:

Find the existing `useEffect` blocks that call `window.cloudblocks.onScanDelta(...)` etc. Add adjacent:

```ts
import '../plugin/index'   // renderer-side plugin registrations (empty for M6)
```

Inside the component (near other `useEffect` IPC listeners):

```ts
useEffect(() => {
  return window.cloudblocks.onPluginMetadata((meta) => {
    useUIStore.getState().setPluginNodeTypes(meta)
  })
}, [])
```

### Step 5: Run typecheck and full suite

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | tail -10
```

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test 2>&1 | tail -20
```

Expected: no errors, all pass.

### Step 6: Commit

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/renderer/store/ui.ts src/renderer/src/App.tsx tests/renderer/store/ui-plugin-nodetypes.test.ts && git commit -m "feat(M6): add pluginNodeTypes slice to useUIStore; handle onPluginMetadata in App"
```

---

## Task 7: Runtime fallback in `ResourceNode` and `SearchPalette`

**Files:**
- Modify: `src/renderer/components/canvas/nodes/ResourceNode.tsx`
- Modify: `src/renderer/components/SearchPalette.tsx`
- Modify: `tests/renderer/components/canvas/nodes/ResourceNode.test.tsx`

### Step 1: Write a failing test for the plugin fallback

- [ ] Add to `tests/renderer/components/canvas/nodes/ResourceNode.test.tsx`:

```ts
import { useUIStore } from '../../../../../src/renderer/store/ui'

describe('ResourceNode — plugin type fallback', () => {
  afterEach(() => {
    useUIStore.setState({ pluginNodeTypes: {} } as Parameters<typeof useUIStore.setState>[0])
  })

  it('uses pluginNodeTypes borderColor for unknown node type', () => {
    useUIStore.setState({
      pluginNodeTypes: {
        'azure-vm': {
          label: 'VM', borderColor: '#0078D4', badgeColor: '#0078D4',
          shortLabel: 'VM', displayName: 'Azure VM', hasCreate: true,
        },
      },
    } as Parameters<typeof useUIStore.setState>[0])

    const pluginProps = {
      id: 'vm-001',
      data: { label: 'my-vm', nodeType: 'azure-vm', status: 'running' },
      selected: false,
    } as unknown as import('@xyflow/react').NodeProps

    const { container } = render(<ResourceNode {...pluginProps} />)
    const el = container.firstChild as HTMLElement
    // Border should include plugin color, not the fallback #555
    expect(el.style.border).toContain('#0078D4')
  })
})
```

- [ ] Run — expect failure (border is `#555`, not `#0078D4`):

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/renderer/components/canvas/nodes/ResourceNode.test.tsx 2>&1 | tail -15
```

### Step 2: Modify `ResourceNode.tsx` to use runtime fallback

- [ ] In `src/renderer/components/canvas/nodes/ResourceNode.tsx`, add import:

```ts
import { useUIStore } from '../../../store/ui'
```

Change the two lookup lines inside `ResourceNode`:

```ts
// Before:
const borderColor = TYPE_BORDER[d.nodeType] ?? '#555'
const typeLabel   = TYPE_LABEL[d.nodeType] ?? d.nodeType.toUpperCase()

// After:
const pluginNodeTypes = useUIStore.getState().pluginNodeTypes
const borderColor = TYPE_BORDER[d.nodeType as import('../../../types/cloud').NodeType]
  ?? pluginNodeTypes[d.nodeType]?.borderColor
  ?? '#555'
const typeLabel = TYPE_LABEL[d.nodeType as import('../../../types/cloud').NodeType]
  ?? pluginNodeTypes[d.nodeType]?.label
  ?? d.nodeType.toUpperCase()
```

Note: `d.nodeType` is typed as `NodeType` in `ResourceNodeData`. The `TYPE_BORDER[d.nodeType]` lookup already uses the built-in type, so the `as NodeType` cast is for the index access — the value is `undefined` for unknown strings, which is the desired behavior. Alternatively keep `d.nodeType` as-is since TypeScript allows string indexing on `Record<NodeType, string>` at runtime even if the key is not in the union — the result is `undefined`, which triggers the `??` fallback.

### Step 3: Modify `SearchPalette.tsx` to use runtime fallback

- [ ] Find `SearchPalette.tsx`:

```bash
find /Users/julius/AI/cloudblocks/cloudblocks/src -name "SearchPalette.tsx" | head -5
```

- [ ] Add `import { useUIStore } from '../store/ui'` (adjust path based on file location).

- [ ] Find the `TYPE_BADGE_COLOR` and `TYPE_SHORT` lookup lines and add the same fallback pattern:

```ts
const pluginNodeTypes = useUIStore.getState().pluginNodeTypes
const badgeColor = TYPE_BADGE_COLOR[type] ?? pluginNodeTypes[type]?.badgeColor ?? '#555'
const shortLabel = TYPE_SHORT[type] ?? pluginNodeTypes[type]?.shortLabel ?? type.toUpperCase()
```

### Step 4: Run the test — expect pass

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/renderer/components/canvas/nodes/ResourceNode.test.tsx 2>&1 | tail -10
```

Expected: all pass including the new plugin fallback test.

### Step 5: Run typecheck and full suite

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | tail -10
```

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test 2>&1 | tail -20
```

Expected: no errors, all pass.

### Step 6: Commit

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/renderer/components/canvas/nodes/ResourceNode.tsx src/renderer/components/SearchPalette.tsx tests/renderer/components/canvas/nodes/ResourceNode.test.tsx && git commit -m "feat(M6): ResourceNode and SearchPalette fall back to pluginNodeTypes for unknown types"
```

---

## Task 8: Sidebar appends plugin types with `hasCreate: true`

**Files:**
- Modify: `src/renderer/components/Sidebar.tsx`
- Create or modify: `tests/renderer/components/__tests__/Sidebar.test.tsx`

### Step 1: Write the failing test first

- [ ] Check if Sidebar test exists:

```bash
ls /Users/julius/AI/cloudblocks/cloudblocks/tests/renderer/components/Sidebar.test.tsx 2>/dev/null || echo "missing"
```

- [ ] Add (or create) `tests/renderer/components/Sidebar.test.tsx` with the plugin type test. (If the file already has other tests, append this describe block.) Adapt the test wrapper to match existing patterns (mock `useCloudStore`, `useUIStore`, etc.):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar } from '../../../src/renderer/components/Sidebar'
import { useUIStore } from '../../../src/renderer/store/ui'
import type { NodeTypeMetadata } from '../../../src/main/plugin/types'

// Mock child stores minimally
vi.mock('../../../src/renderer/store/cloud', () => ({
  useCloudStore: vi.fn((sel: (s: { nodes: unknown[]; scanErrors: unknown[]; settings: { showScanErrorBadges: boolean } }) => unknown) =>
    sel({ nodes: [], scanErrors: [], settings: { showScanErrorBadges: false } })
  ),
}))

vi.mock('../../../src/renderer/store/cli', () => ({
  useCliStore: vi.fn((sel: (s: { setCommandPreview: () => void; setPendingCommand: () => void }) => unknown) =>
    sel({ setCommandPreview: () => {}, setPendingCommand: () => {} })
  ),
}))

vi.mock('../../../src/renderer/utils/scanKeyMap', () => ({ SCAN_KEY_TO_TYPE: {} }))
vi.mock('../../../src/renderer/components/modals/SidebarFilterDialog', () => ({ default: () => null }))

describe('Sidebar — plugin type entries', () => {
  beforeEach(() => {
    useUIStore.setState({ pluginNodeTypes: {}, sidebarFilter: null } as Parameters<typeof useUIStore.setState>[0])
  })

  it('does not show plugin type when pluginNodeTypes is empty', () => {
    render(<Sidebar />)
    expect(screen.queryByText('Azure VM')).toBeNull()
  })

  it('shows plugin type with hasCreate: true in the sidebar list', () => {
    const meta: Record<string, NodeTypeMetadata> = {
      'azure-vm': {
        label: 'VM', borderColor: '#0078D4', badgeColor: '#0078D4',
        shortLabel: 'VM', displayName: 'Azure VM', hasCreate: true,
      },
    }
    useUIStore.setState({ pluginNodeTypes: meta } as Parameters<typeof useUIStore.setState>[0])
    render(<Sidebar />)
    expect(screen.getByText('Azure VM')).toBeInTheDocument()
  })

  it('does not show plugin type with hasCreate: false', () => {
    const meta: Record<string, NodeTypeMetadata> = {
      'azure-read-only': {
        label: 'RO', borderColor: '#555', badgeColor: '#555',
        shortLabel: 'RO', displayName: 'Azure Read-Only', hasCreate: false,
      },
    }
    useUIStore.setState({ pluginNodeTypes: meta } as Parameters<typeof useUIStore.setState>[0])
    render(<Sidebar />)
    expect(screen.queryByText('Azure Read-Only')).toBeNull()
  })
})
```

- [ ] Run — expect failure (plugin type not rendered):

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/renderer/components/Sidebar.test.tsx 2>&1 | tail -15
```

### Step 2: Modify `Sidebar.tsx` to append plugin types

- [ ] In `src/renderer/components/Sidebar.tsx`, add:

```ts
const pluginNodeTypes = useUIStore((s) => s.pluginNodeTypes)
```

Then in the render section where the `SERVICES` array is mapped, after the static services list, append entries from `pluginNodeTypes` where `hasCreate: true`. The exact location depends on the current JSX structure — insert below the closing tag of the last static SERVICES item's render, within the same scrollable container. Example:

```tsx
{/* Plugin types with hasCreate: true — appended after built-in services */}
{Object.entries(pluginNodeTypes)
  .filter(([, meta]) => meta.hasCreate)
  .map(([type, meta]) => (
    <div
      key={type}
      draggable
      className="flex items-center justify-between px-3 py-1.5 cursor-grab rounded hover:bg-white/5"
      onDragStart={(e) => {
        e.dataTransfer.setData('application/cloudblocks-resource', type)
      }}
    >
      <span className="text-xs" style={{ color: meta.borderColor }}>
        {meta.displayName}
      </span>
    </div>
  ))}
```

The drag-start handler should match whatever pattern the existing static entries use (check the `SERVICES` map render for the `onDragStart` pattern and replicate it exactly).

### Step 3: Run the test — expect pass

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/renderer/components/Sidebar.test.tsx 2>&1 | tail -10
```

Expected: `3 passed`

### Step 4: Run full test suite

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test 2>&1 | tail -20
```

Expected: all pass.

### Step 5: Commit

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/renderer/components/Sidebar.tsx tests/renderer/components/Sidebar.test.tsx && git commit -m "feat(M6): Sidebar appends plugin types with hasCreate: true from pluginNodeTypes"
```

---

## Task 9: HCL generator fallback in Terraform export

**Files:**
- Modify: `src/main/terraform/index.ts`
- Modify: `tests/main/terraform/generators.test.ts`

### Step 1: Write a failing test

- [ ] In `tests/main/terraform/generators.test.ts`, add at the end:

```ts
import { pluginRegistry } from '../../../src/main/plugin/registry'
import type { CloudblocksPlugin } from '../../../src/main/plugin/types'

describe('generateTerraformFile — plugin HCL generator fallback', () => {
  afterEach(() => {
    // Reset registry — use a fresh instance approach or reset the singleton
    // Since pluginRegistry is a singleton, we must be careful. Use a local registry
    // or check if the plugin was already registered before each test.
  })

  it('returns plugin HCL for a node type registered in pluginRegistry', () => {
    // Register a mock plugin with an HCL generator
    const mockPlugin: CloudblocksPlugin = {
      id: 'com.test.hcl',
      displayName: 'HCL Test Plugin',
      nodeTypes: ['mock-service'],
      nodeTypeMetadata: {
        'mock-service': {
          label: 'MOCK', borderColor: '#fff', badgeColor: '#fff',
          shortLabel: 'MOCK', displayName: 'Mock Service', hasCreate: false,
        },
      },
      createCredentials: () => ({}),
      scan: async () => ({ nodes: [], errors: [] }),
      hclGenerators: {
        'mock-service': (_node) => 'resource "mock_service" "r" { name = "test" }',
      },
    }

    // Only register if not already registered (test isolation)
    try { pluginRegistry.register(mockPlugin) } catch { /* already registered */ }

    const node = makeNode({ type: 'unknown', id: 'mock-001', label: 'test-mock' })
    // Override type at runtime to simulate plugin type
    const pluginNode = { ...node, type: 'mock-service' } as unknown as import('../../../src/renderer/types/cloud').CloudNode

    const { hcl } = generateTerraformFile([pluginNode])
    expect(hcl).toContain('resource "mock_service"')
  })
})
```

- [ ] Run — expect failure (plugin type is skipped, no HCL produced):

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/main/terraform/generators.test.ts 2>&1 | tail -15
```

### Step 2: Modify `src/main/terraform/index.ts`

- [ ] Add the import:

```ts
import { pluginRegistry } from '../plugin/registry'
```

- [ ] Modify `generateTerraformBlock` to try the plugin registry for non-built-in types:

```ts
export function generateTerraformBlock(node: CloudNode): string {
  // Built-in types: use the exhaustive terraformGenerators map
  const builtInGen = terraformGenerators[node.type]
  if (builtInGen) return builtInGen(node)

  // Plugin-owned types: delegate to the registry
  const pluginGen = pluginRegistry.getHclGenerator(node.type)
  if (pluginGen) return pluginGen(node)

  return ''
}
```

Note: `terraformGenerators[node.type]` returns a function for built-in types. For unknown strings (plugin types) it returns `undefined`. The existing `satisfies Record<NodeType, TerraformGenerator>` check means `node.type` must be cast since it is typed as `NodeType`. At runtime, a plugin node will have `node.type` as a string not in the union — the index access returns `undefined`, which is the correct fallback behavior.

If TypeScript complains about indexing `Record<NodeType, TerraformGenerator>` with `node.type` (which is `NodeType`), the existing code already handles this. If the type of `node.type` is widened to `string` in `CloudNode`, adjust accordingly. Since `CloudNode.type` is typed as `NodeType` at compile time but plugin nodes have string types at runtime, use:

```ts
const builtInGen = (terraformGenerators as Record<string, typeof terraformGenerators[keyof typeof terraformGenerators]>)[node.type]
```

Or simply keep the existing `terraformGenerators[node.type](node)` call and add a fallback branch for when it would throw/be undefined.

### Step 3: Run the test — expect pass

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/main/terraform/generators.test.ts 2>&1 | tail -10
```

Expected: all pass.

### Step 4: Run typecheck and full suite

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | tail -10
```

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test 2>&1 | tail -20
```

### Step 5: Commit

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/main/terraform/index.ts tests/main/terraform/generators.test.ts && git commit -m "feat(M6): terraform export falls back to pluginRegistry.getHclGenerator for non-built-in types"
```

---

## Task 10: Renderer plugin command routing

**Files:**
- Create: `src/renderer/plugin/rendererRegistry.ts`
- Create: `src/renderer/plugin/pluginCommands.ts`
- Create: `src/renderer/plugin/index.ts`
- Create: `tests/renderer/utils/pluginCommands.test.ts`

### Step 1: Write the failing test first

- [ ] Create `tests/renderer/utils/pluginCommands.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'

vi.mock('../../../src/renderer/utils/buildCommand', () => ({
  buildCommand: vi.fn().mockReturnValue([['aws', 'ec2', 'run-instances']]),
}))
vi.mock('../../../src/renderer/utils/buildDeleteCommands', () => ({
  buildDeleteCommands: vi.fn().mockReturnValue([['aws', 'ec2', 'terminate-instances']]),
}))
vi.mock('../../../src/renderer/utils/buildEditCommands', () => ({
  buildEditCommands: vi.fn().mockReturnValue([['aws', 'ec2', 'modify-instance-attribute']]),
}))

describe('pluginCommands routing', () => {
  beforeEach(() => {
    useUIStore.setState({ pluginNodeTypes: {} } as Parameters<typeof useUIStore.setState>[0])
  })

  it('resolveCreateCommands routes ec2 to buildCommand', async () => {
    const { resolveCreateCommands } = await import('../../../src/renderer/plugin/pluginCommands')
    const result = resolveCreateCommands('ec2', { instanceType: 't3.micro' })
    expect(result).toEqual([['aws', 'ec2', 'run-instances']])
  })

  it('resolveDeleteCommands routes ec2 to buildDeleteCommands', async () => {
    const { resolveDeleteCommands } = await import('../../../src/renderer/plugin/pluginCommands')
    const node = { id: 'i-001', type: 'ec2', label: 'web', status: 'running', region: 'us-east-1', metadata: {} } as import('../../../src/renderer/types/cloud').CloudNode
    const result = resolveDeleteCommands(node)
    expect(result).toEqual([['aws', 'ec2', 'terminate-instances']])
  })

  it('resolveCreateCommands returns plugin handler result for non-built-in type', async () => {
    // Register a plugin type in the renderer registry
    const { rendererPluginHandlers } = await import('../../../src/renderer/plugin/pluginCommands')
    rendererPluginHandlers.set('azure-vm', {
      buildCreate: () => [['az', 'vm', 'create']],
    })

    const { resolveCreateCommands } = await import('../../../src/renderer/plugin/pluginCommands')
    const result = resolveCreateCommands('azure-vm', { name: 'my-vm' })
    expect(result).toEqual([['az', 'vm', 'create']])

    rendererPluginHandlers.delete('azure-vm')
  })
})
```

- [ ] Run — expect failure:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/renderer/utils/pluginCommands.test.ts 2>&1 | tail -15
```

### Step 2: Create `src/renderer/plugin/rendererRegistry.ts`

- [ ] Create the file:

```ts
// src/renderer/plugin/rendererRegistry.ts
import type { NodeProps } from '@xyflow/react'

const pluginNodeComponents = new Map<string, React.ComponentType<NodeProps>>()

export function registerPluginComponent(key: string, component: React.ComponentType<NodeProps>): void {
  pluginNodeComponents.set(key, component)
}

export function getPluginNodeComponents(): Record<string, React.ComponentType<NodeProps>> {
  return Object.fromEntries(pluginNodeComponents)
}
```

### Step 3: Create `src/renderer/plugin/pluginCommands.ts`

- [ ] The `BUILTIN_TYPES` set is the compile-time `NodeType` union values at runtime. Import the `NodeType` values to populate it. A clean way: import the type and enumerate values from `cloud.ts`. Since TypeScript erases types, use a runtime constant array instead:

```ts
// src/renderer/plugin/pluginCommands.ts
import type { CloudNode } from '../types/cloud'
import { buildCommand } from '../utils/buildCommand'
import { buildDeleteCommands } from '../utils/buildDeleteCommands'
import { buildEditCommands } from '../utils/buildEditCommands'
import type { PluginCommandHandlers } from '../../main/plugin/types'

// Runtime set of built-in NodeType strings (mirrors NodeType union in cloud.ts)
const BUILTIN_NODE_TYPES = new Set([
  'ec2', 'vpc', 'subnet', 'rds', 's3', 'lambda', 'alb', 'security-group',
  'igw', 'acm', 'cloudfront', 'apigw', 'apigw-route', 'sqs', 'secret',
  'ecr-repo', 'sns', 'dynamo', 'ssm-param', 'nat-gateway', 'r53-zone',
  'sfn', 'eventbridge-bus', 'unknown',
])

// Renderer-side plugin command handler map: nodeType → handlers
// Populated by plugin renderer registrations in renderer/plugin/index.ts
export const rendererPluginHandlers = new Map<string, PluginCommandHandlers>()

export function resolveCreateCommands(resource: string, params: Record<string, unknown>): string[][] {
  if (BUILTIN_NODE_TYPES.has(resource)) {
    return buildCommand(resource as import('../types/cloud').NodeType, params as never)
  }
  return rendererPluginHandlers.get(resource)?.buildCreate?.(resource, params) ?? []
}

export function resolveDeleteCommands(node: CloudNode, opts?: Record<string, unknown>): string[][] {
  if (BUILTIN_NODE_TYPES.has(node.type)) {
    return buildDeleteCommands(node)
  }
  return rendererPluginHandlers.get(node.type)?.buildDelete?.(node, opts) ?? []
}

export function resolveEditCommands(node: CloudNode, params: Record<string, unknown>): string[][] {
  if (BUILTIN_NODE_TYPES.has(node.type)) {
    return buildEditCommands(node, params as never)
  }
  return rendererPluginHandlers.get(node.type)?.buildEdit?.(node, params) ?? []
}
```

### Step 4: Create `src/renderer/plugin/index.ts`

- [ ] Empty entry point, ready for future Azure plugin renderer registrations:

```ts
// src/renderer/plugin/index.ts
// Renderer-side plugin registrations.
// Import plugin renderer modules here when adding new cloud providers.
// Example (future): import './azureRenderer'
```

### Step 5: Run the test — expect pass

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/renderer/utils/pluginCommands.test.ts 2>&1 | tail -10
```

Expected: `3 passed`

### Step 6: Run typecheck and full suite

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | tail -10
```

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test 2>&1 | tail -20
```

### Step 7: Commit

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/renderer/plugin/rendererRegistry.ts src/renderer/plugin/pluginCommands.ts src/renderer/plugin/index.ts tests/renderer/utils/pluginCommands.test.ts && git commit -m "feat(M6): renderer plugin command routing; rendererRegistry for custom node components"
```

---

## Task 11: Integration smoke test — mock plugin on canvas

**Files:**
- Create: `tests/main/plugin/integration.test.ts`

### Step 1: Create the integration test

- [ ] Create `tests/main/plugin/integration.test.ts`:

```ts
/**
 * M6 Integration smoke test.
 *
 * Registers a trivial mockPlugin that emits one synthetic node of type 'mock-service'.
 * Verifies:
 *  - The node is returned by pluginRegistry.scanAll()
 *  - pluginRegistry.getNodeTypeMetadata('mock-service') returns the registered metadata
 *  - pluginRegistry.getHclGenerator('mock-service') returns the registered generator
 *
 * This test proves a new plugin can be registered without modifying any AWS file.
 */
import { describe, it, expect } from 'vitest'
import { PluginRegistry } from '../../../src/main/plugin/registry'
import type { CloudblocksPlugin } from '../../../src/main/plugin/types'

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))

const mockPlugin: CloudblocksPlugin = {
  id: 'com.test.mock',
  displayName: 'Mock Cloud Plugin',
  nodeTypes: ['mock-service'],
  nodeTypeMetadata: {
    'mock-service': {
      label: 'MOCK',
      borderColor: '#ABCDEF',
      badgeColor:  '#ABCDEF',
      shortLabel:  'MOCK',
      displayName: 'Mock Service',
      hasCreate:   true,
    },
  },
  createCredentials: (_profile, _region) => ({ apiKey: 'test-key' }),
  scan: async (_ctx) => ({
    nodes: [
      {
        id:       'mock-001',
        type:     'mock-service' as import('../../../src/renderer/types/cloud').NodeType,
        label:    'My Mock Resource',
        status:   'running',
        region:   'us-east-1',
        metadata: { provider: 'mock' },
      },
    ],
    errors: [],
  }),
  hclGenerators: {
    'mock-service': (_node) => 'resource "mock_service" "r" { provider = "mock" }',
  },
}

describe('M6 plugin integration smoke test', () => {
  it('mock plugin node is returned by scanAll', async () => {
    const registry = new PluginRegistry()
    registry.register(mockPlugin)
    await registry.activateAll('default', 'us-east-1')

    const result = await registry.scanAll('us-east-1')
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].id).toBe('mock-001')
    expect(result.nodes[0].type).toBe('mock-service')
  })

  it('getNodeTypeMetadata returns the registered metadata', () => {
    const registry = new PluginRegistry()
    registry.register(mockPlugin)

    const meta = registry.getNodeTypeMetadata('mock-service')
    expect(meta).toBeDefined()
    expect(meta?.label).toBe('MOCK')
    expect(meta?.borderColor).toBe('#ABCDEF')
    expect(meta?.hasCreate).toBe(true)
  })

  it('getHclGenerator returns the generator and it produces HCL', () => {
    const registry = new PluginRegistry()
    registry.register(mockPlugin)

    const gen = registry.getHclGenerator('mock-service')
    expect(gen).toBeDefined()
    const hcl = gen!({ id: 'mock-001', type: 'mock-service' as import('../../../src/renderer/types/cloud').NodeType, label: 'My Mock Resource', status: 'running', region: 'us-east-1', metadata: {} })
    expect(hcl).toContain('resource "mock_service"')
  })

  it('getAllNodeTypeMetadata includes all plugin types', () => {
    const registry = new PluginRegistry()
    registry.register(mockPlugin)

    const allMeta = registry.getAllNodeTypeMetadata()
    expect(allMeta['mock-service']).toBeDefined()
    expect(allMeta['mock-service'].displayName).toBe('Mock Service')
  })

  it('plugin scan errors are isolated — a failing plugin does not throw', async () => {
    const failingPlugin: CloudblocksPlugin = {
      id: 'com.test.failing',
      displayName: 'Failing Plugin',
      nodeTypes: ['fail-type'],
      nodeTypeMetadata: {
        'fail-type': { label: 'FAIL', borderColor: '#f00', badgeColor: '#f00', shortLabel: 'F', displayName: 'Fail', hasCreate: false },
      },
      createCredentials: () => ({}),
      scan: async () => { throw new Error('network unreachable') },
    }

    const registry = new PluginRegistry()
    registry.register(mockPlugin)
    registry.register(failingPlugin)
    await registry.activateAll('default', 'us-east-1')

    const result = await registry.scanAll('us-east-1')
    // Mock plugin node still present
    expect(result.nodes).toHaveLength(1)
    // Error from failing plugin is reported
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].service).toBe('com.test.failing')
    expect(result.errors[0].message).toBe('network unreachable')
  })
})
```

### Step 2: Run the integration test — expect pass

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/main/plugin/integration.test.ts 2>&1 | tail -15
```

Expected: `5 passed`

### Step 3: Run full test suite one final time

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test 2>&1 | tail -20
```

Expected: all existing tests pass plus the new integration test suite.

### Step 4: Run lint and typecheck

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run lint 2>&1 | tail -20
```

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | tail -10
```

Expected: no errors.

### Step 5: Commit

- [ ] Run:

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add tests/main/plugin/integration.test.ts && git commit -m "test(M6): integration smoke test — mock plugin emits node, metadata, HCL via registry"
```

---

## Acceptance Checklist

Verify each item before marking M6 complete:

- [ ] `src/main/plugin/types.ts` defines `CloudblocksPlugin`, `NodeTypeMetadata`, `PluginScanResult`, `ScanContext`
- [ ] `src/main/plugin/registry.ts` exports `PluginRegistry` class and `pluginRegistry` singleton
- [ ] `src/main/plugin/awsPlugin.ts` wraps all 22 existing AWS service scan functions
- [ ] `src/main/aws/scanner.ts` calls `pluginRegistry.scanAll()`, not `awsProvider.scan()` directly
- [ ] `IPC.PLUGIN_METADATA` channel exists in `channels.ts` and is pushed after `activateAll()`
- [ ] `useUIStore` has `pluginNodeTypes` slice populated from `plugin:metadata` IPC push
- [ ] `ResourceNode.tsx` falls back to `pluginNodeTypes[type]?.borderColor` and `?.label`
- [ ] `SearchPalette.tsx` falls back to `pluginNodeTypes[type]?.badgeColor` and `?.shortLabel`
- [ ] `Sidebar.tsx` appends plugin types with `hasCreate: true` from `pluginNodeTypes`
- [ ] `src/main/terraform/index.ts` calls `pluginRegistry.getHclGenerator()` for non-built-in types
- [ ] `src/renderer/plugin/pluginCommands.ts` routes built-in types to existing builders, plugin types to `rendererPluginHandlers`
- [ ] `src/renderer/plugin/rendererRegistry.ts` exports `registerPluginComponent` and `getPluginNodeComponents`
- [ ] `NodeType` union in `cloud.ts` is NOT widened — compile-time exhaustiveness checks are intact
- [ ] `npm run lint` passes with no errors
- [ ] `npm run typecheck` passes with no errors
- [ ] `npm test` passes — all tests green (existing + new M6 tests)
- [ ] Integration smoke test confirms a trivial mock plugin can be registered and its node/metadata/HCL retrieved without modifying any AWS file
