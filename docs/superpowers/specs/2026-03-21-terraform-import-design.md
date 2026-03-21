# Terraform State Import — Design Spec

**Date:** 2026-03-21
**Status:** Team-approved (autonomous session)
**Pillar:** Post-1.0 #2

---

## Goal

Allow users to drop a Terraform `.tfstate` file into Cloudblocks and visualize the infrastructure on the canvas — with no live AWS credentials required. Provides a zero-friction onramp for teams with existing Terraform-managed infrastructure.

---

## Decisions

| Question | Decision |
|----------|----------|
| Mode | Import-only (separate store slice, does not mix with live scan) |
| Ingestion path | File picker dialog → main process reads + parses → CloudNode[] via IPC |
| Visual distinction | Dashed border + TF badge, status='imported' |
| Unmapped types | Render as 'unknown' node with warning badge — never silently drop |
| Sensitive values | Stripped in main process — raw tfstate never reaches renderer |
| Overlay with live scan | Out of scope (deferred to post-1.1) |
| Supported types (v1) | 10 most common aws_* resource types |

---

## Architecture

Terraform state files are JSON documents. The `resources[]` array contains typed resource definitions with `instances[].attributes` holding the resource properties. The ingestion pipeline is:

```
File picker (native dialog)
  → main process reads file (fs.readFile)
  → parseTfState(json): CloudNode[]     ← pure function, strips sensitive values
  → TFSTATE_IMPORT IPC
  → renderer: importedNodes store slice
  → canvas renders both nodes + importedNodes
```

No AWS SDK calls. No network. No credentials. Pure local file processing.

---

## New NodeStatus Value

```typescript
// Add to NodeStatus union in src/renderer/types/cloud.ts
export type NodeStatus = 'running' | 'stopped' | 'pending' | 'error' | 'unknown' | 'creating' | 'deleting' | 'imported'
```

`'imported'` nodes are:
- Never removed by scan delta (separate slice)
- Never eligible for optimistic update
- Visually distinct on canvas (dashed border, TF badge)
- Not editable or deletable via Inspector actions
- Only present in `importedNodes` store slice — `applyDelta()` must **never** mutate `importedNodes`

---

## New NodeType: 'unknown'

`'unknown'` is not currently in the `NodeType` union and must be added. Unmapped `aws_*` resources from tfstate render as this type with a warning badge.

```typescript
// Add to NodeType union in src/renderer/types/cloud.ts
// 'unknown' must be added as a 23rd NodeType value
```

Adding `'unknown'` requires updates to all `Record<NodeType, ...>` exhaustive maps (typecheck-enforced via `satisfies`):
- `src/renderer/types/cloud.ts` — union
- `src/renderer/components/canvas/nodes/ResourceNode.tsx` — TYPE_BORDER, TYPE_LABEL
- `src/renderer/components/canvas/nodes/SearchPalette.tsx` — TYPE_BADGE_COLOR, TYPE_SHORT
- `src/renderer/utils/buildHclCommands.ts` — stub returning `''`

Note: `buildDeleteCommands.ts` uses `switch` with `default: return []` — not exhaustiveness-enforced, no update required.
- Never removed by scan delta (separate slice)
- Never eligible for optimistic update
- Visually distinct on canvas (dashed border, TF badge)
- Not editable or deletable via Inspector actions

---

## Resource Type Mapping (v1 — 10 types)

| Terraform type | NodeType | Key attributes mapped |
|---------------|----------|----------------------|
| `aws_instance` | `ec2` | instance_id, instance_type, subnet_id, vpc_security_group_ids |
| `aws_vpc` | `vpc` | id, cidr_block, tags.Name |
| `aws_subnet` | `subnet` | id, vpc_id, cidr_block, availability_zone |
| `aws_security_group` | `security-group` | id, vpc_id, name, description |
| `aws_s3_bucket` | `s3` | id (bucket name), region |
| `aws_lambda_function` | `lambda` | function_name, runtime, memory_size, timeout |
| `aws_db_instance` | `rds` | id, engine, instance_class, db_subnet_group_name |
| `aws_lb` / `aws_alb` | `alb` | arn, name, scheme, subnets |
| `aws_api_gateway_v2_api` | `apigw` | id, name, protocol_type |
| `aws_cloudfront_distribution` | `cloudfront` | id, domain_name |

All other `aws_*` types: render as NodeType `'unknown'` with a warning badge in Inspector ("Unsupported Terraform resource type: aws_xxx").

Non-`aws_*` types (azurerm, google, etc.): silently skipped — this is AWS-only tooling.

---

## Parser: `src/main/aws/tfstate/parser.ts`

```typescript
interface TfStateResource {
  type: string
  name: string
  instances: Array<{ attributes: Record<string, unknown> }>
}

interface TfState {
  version: number
  resources: TfStateResource[]
}

export function parseTfState(raw: string): CloudNode[] {
  let state: TfState
  try {
    state = JSON.parse(raw) as TfState
  } catch {
    throw new Error('Invalid tfstate file: not valid JSON')
  }
  if (!Array.isArray(state.resources)) {
    throw new Error('Invalid tfstate file: missing resources array')
  }
  return state.resources
    .filter(r => r.type.startsWith('aws_'))
    .flatMap(r => (r.instances ?? []).map(instance =>
      mapResource(r.type, r.name, sanitizeAttributes(instance.attributes ?? {}))
    ))
    .filter(Boolean) as CloudNode[]
}

// Strips known sensitive tfstate fields before any data leaves main process
function sanitizeAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_KEYS = ['password', 'secret', 'token', 'key_pair', 'private_key', 'sensitive_values']
  return Object.fromEntries(
    Object.entries(attrs).filter(([k]) => !SENSITIVE_KEYS.some(s => k.includes(s)))
  )
}
```

All nodes produced by parser have `status: 'imported'`.

---

## New IPC Channels

| Channel | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `TFSTATE_IMPORT` | renderer→main | `void` | Open file picker, parse, return `{ nodes: CloudNode[] }` |
| `TFSTATE_CLEAR` | renderer→main | `void` | No-op in main process — renderer calls `clearImportedNodes()` directly in response |

Note: `TFSTATE_CLEAR` exists as an IPC channel for architectural symmetry, but the main process has no state to clear — it does no work. The renderer clears its own `importedNodes` store slice without needing a round-trip. An alternative: remove `TFSTATE_CLEAR` from IPC entirely and call `clearImportedNodes()` directly in the CloudCanvas button handler without any IPC call. Either approach is valid; the simpler direct-store approach is recommended.

### Handler (`handlers.ts`)
```typescript
ipcMain.handle(IPC.TFSTATE_IMPORT, async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Terraform State', extensions: ['tfstate', 'json'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return { nodes: [] }
  try {
    const raw = await fs.readFile(filePaths[0], 'utf-8')
    const nodes = parseTfState(raw)  // throws on invalid JSON / missing resources[]
    return { nodes }
  } catch (err) {
    return { nodes: [], error: (err as Error).message }
  }
})

// TFSTATE_CLEAR: no main-process state to clear — handler is a no-op
ipcMain.handle(IPC.TFSTATE_CLEAR, () => ({ ok: true }))
```

### `window.cloudblocks` additions
```typescript
importTfState(): Promise<{ nodes: CloudNode[]; error?: string }>
clearTfState(): Promise<{ ok: boolean }>
```

---

## Store Changes (`useCloudStore`)

```typescript
// New state (separate from nodes — never touched by scan delta)
importedNodes: CloudNode[]

// New actions
setImportedNodes(nodes: CloudNode[]): void
clearImportedNodes(): void
```

`applyDelta()` must never touch `importedNodes`. The canvas renders `[...nodes, ...importedNodes]` — merged only at render time in `flowNodes` memo.

---

## Canvas Rendering

### Visual distinction
`ResourceNode` checks `node.status === 'imported'` and applies:
- Border style: dashed (via CSS `border-style: dashed`)
- Small `TF` badge in top-right corner of node
- Color: same as node type (no color change — just border style)

### Layout
Imported nodes use the same topology layout as scanned nodes. `parentId` relationships parsed from tfstate (e.g. subnet → vpc) drive hierarchy. Imported nodes with no matching parent float in the global zone.

---

## UI Entry Points

### TitleBar / Sidebar
Add "Import .tfstate" button — opens `importTfState()` IPC, renders toast on success:
`"Imported 47 resources from terraform.tfstate"`

### Inspector (when imported node selected)
- Show normal metadata
- All action buttons (Edit, Delete, quick actions) hidden
- Banner: `"Imported from Terraform — read-only"`
- Show "Unsupported type" warning if NodeType is 'unknown'

### Canvas toolbar
Add "Clear Import" button (visible only when `importedNodes.length > 0`) — calls `clearTfState()` IPC.

---

## Security Constraints

- File read happens entirely in main process
- `parseTfState()` runs in main process — sanitized output only crosses IPC
- Sensitive keys stripped: `password`, `secret`, `token`, `key_pair`, `private_key`, `sensitive_values`
- Raw tfstate JSON never reaches renderer
- No network calls at any point in this feature

---

## Files Touched Summary

| File | Action |
|------|--------|
| `src/renderer/types/cloud.ts` | Add `'imported'` to NodeStatus; add `'unknown'` to NodeType |
| `src/main/aws/tfstate/parser.ts` | Create — parseTfState(), sanitizeAttributes(), mapResource() |
| `src/main/ipc/channels.ts` | Add TFSTATE_IMPORT, TFSTATE_CLEAR |
| `src/main/ipc/handlers.ts` | Register both handlers |
| `src/preload/index.ts` | Expose importTfState, clearTfState |
| `src/preload/index.d.ts` | Type declarations |
| `src/renderer/store/cloud.ts` | Add importedNodes, setImportedNodes, clearImportedNodes |
| `src/renderer/components/canvas/nodes/ResourceNode.tsx` | Add imported visual treatment (dashed border, TF badge); add `'unknown'` entries to TYPE_BORDER, TYPE_LABEL |
| `src/renderer/components/canvas/nodes/SearchPalette.tsx` | Add `'unknown'` entries to TYPE_BADGE_COLOR, TYPE_SHORT |
| `src/renderer/utils/buildHclCommands.ts` | Add `'unknown': () => ''` stub |
| `src/renderer/components/canvas/TopologyView.tsx` | Merge importedNodes into flowNodes at render |
| `src/renderer/components/canvas/GraphView.tsx` | Same merge |
| `src/renderer/components/Inspector.tsx` | Hide actions for imported nodes, show banner; show unsupported-type warning for `type === 'unknown'` |
| `src/renderer/components/TitleBar.tsx` | Add "Import .tfstate" button |
| `src/renderer/components/canvas/CloudCanvas.tsx` | Add "Clear Import" button |
| `tests/main/aws/tfstate/parser.test.ts` | Create — test all 10 type mappings + unknown mapping + sanitization + error handling |

---

## Out of Scope

- Overlay mode (imported + live scan diff comparison)
- Terraform plan file import (`.tfplan`)
- Non-AWS providers (Azure, GCP)
- Write-back (editing imported resources and generating Terraform HCL changes)
- Module-aware parsing (nested modules in tfstate)
