# Cloudblocks M5.5 — Consolidation + Service Expansion

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the platform (CI, distribution, architecture), polish core UX interactions, and expand AWS service coverage from 10 to 20+ services.

**Architecture:** Four independent tracks — Platform, Architecture, UX Polish, and Service Sprints. Service sprints share a single boilerplate pattern defined once in Chunk 4; each sprint is a manifest table + deviations only. Tracks are independent and can be parallelized by separate subagents.

**Tech Stack:** Electron 32 + electron-vite, React 19, TypeScript, Zustand 5, Tailwind CSS 4, Vitest + RTL, AWS SDK v3, GitHub Actions

---

All commands run from `/Users/julius/AI/proj1/cloudblocks` unless otherwise noted.

---

## Chunk 1: Platform — CI Pipeline + Distribution Config

### Task 1: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the directory and workflow file**

  ```bash
  mkdir -p /Users/julius/AI/proj1/.github/workflows
  ```

  Create `.github/workflows/ci.yml` at the repo root (`/Users/julius/AI/proj1/`):

  ```yaml
  name: CI

  on:
    push:
      branches: [main]
    pull_request:
      branches: [main]

  jobs:
    ci:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: npm
            cache-dependency-path: cloudblocks/package-lock.json
        - name: Install dependencies
          run: npm ci
          working-directory: cloudblocks
        - name: Lint
          run: npm run lint
          working-directory: cloudblocks
        - name: Typecheck
          run: npm run typecheck
          working-directory: cloudblocks
        - name: Test
          run: npm test
          working-directory: cloudblocks
  ```

- [ ] **Step 2: Verify it parses (review manually)**

  ```bash
  cat /Users/julius/AI/proj1/.github/workflows/ci.yml
  ```

  Expected: file prints cleanly with correct indentation.

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/julius/AI/proj1
  git add .github/workflows/ci.yml
  git commit -m "ci: add GitHub Actions workflow — lint, typecheck, test on push/PR"
  ```

---

### Task 2: Fix Distribution Config

**Files:**
- Modify: `electron-builder.yml`
- Modify: `package.json`

Current issues: `appId: com.electron.app`, `author: example.com`, unused Mac entitlements (camera, microphone, documents), auto-update URL is a placeholder.

- [ ] **Step 1: Update electron-builder.yml**

  Read the file first. Make these changes:

  - `appId: com.electron.app` → `appId: com.cloudblocks.desktop`
  - Remove these entries from `mac.extendInfo` (not needed for an AWS tool):
    - `NSCameraUsageDescription`
    - `NSMicrophoneUsageDescription`
    - `NSDocumentsFolderUsageDescription`
  - Leave `NSDownloadsFolderUsageDescription` (used for .tf export later)
  - `notarize: false` — leave as-is but add comment: `# TODO: enable before public release — requires Apple Developer account + notarize config`
  - `url: https://example.com/auto-updates` → `url: https://releases.cloudblocks.app/auto-updates`

- [ ] **Step 2: Update package.json**

  - `"author": "example.com"` → `"author": "cloudblocks"`
  - `"description": "An Electron application with React and TypeScript"` → `"description": "Visual AWS infrastructure management desktop app"`

- [ ] **Step 3: Typecheck (YAML change only, but verify nothing broke)**

  ```bash
  npm run typecheck
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add electron-builder.yml package.json
  git commit -m "chore: fix distribution config — real appId, description, strip unused mac entitlements"
  ```

---

## Chunk 2: Architecture — Delta Fix + CloudProvider Interface + Store Split

### Task 3: Fix computeDelta to detect metadata changes

**Files:**
- Modify: `src/main/aws/scanner.ts`
- Create: `src/main/aws/__tests__/scanner.test.ts` *(new file — no existing tests for scanner)*

Current bug: `computeDelta` only compares `status` and `label`. Metadata changes (e.g. SG rule updated, instance type changed) are silently dropped.

- [ ] **Step 1: Create the test directory**

  ```bash
  mkdir -p src/main/aws/__tests__
  ```

  Expected: directory created (or already exists — both fine).

- [ ] **Step 2: Write failing test**

  Read `src/main/aws/__tests__/scanner.test.ts`. Add:

  ```ts
  it('computeDelta marks node as changed when metadata differs', () => {
    const prev: CloudNode[] = [{
      id: 'a', type: 'ec2', label: 'A', status: 'running',
      region: 'us-east-1', metadata: { instanceType: 't3.micro' },
    }]
    const next: CloudNode[] = [{
      id: 'a', type: 'ec2', label: 'A', status: 'running',
      region: 'us-east-1', metadata: { instanceType: 't3.large' },
    }]
    const delta = computeDelta(prev, next)
    expect(delta.changed).toHaveLength(1)
    expect(delta.changed[0].metadata).toEqual({ instanceType: 't3.large' })
  })
  ```

- [ ] **Step 3: Run to verify it fails**

  ```bash
  ./node_modules/.bin/vitest run src/main/aws/__tests__/scanner.test.ts 2>&1 | tail -10
  ```

  Expected: FAIL — metadata change not detected.

- [ ] **Step 4: Fix computeDelta in scanner.ts**

  Find:
  ```ts
  if (p.status !== node.status || p.label !== node.label) {
  ```

  Change to:
  ```ts
  if (
    p.status !== node.status ||
    p.label  !== node.label  ||
    JSON.stringify(p.metadata) !== JSON.stringify(node.metadata)
  ) {
  ```

- [ ] **Step 5: Run tests to confirm passing**

  ```bash
  ./node_modules/.bin/vitest run src/main/aws/__tests__/scanner.test.ts 2>&1 | tail -5
  ```

  Expected: all pass.

- [ ] **Step 6: Commit**

  ```bash
  git add src/main/aws/scanner.ts src/main/aws/__tests__/scanner.test.ts
  git commit -m "fix(scanner): detect metadata changes in computeDelta"
  ```

---

### Task 4: Define CloudProvider interface + AwsProvider

**Files:**
- Create: `src/main/aws/provider.ts`
- Modify: `src/main/aws/scanner.ts`

This extracts the scan logic from `ResourceScanner` into a named provider, establishing the contract M6 plugins will implement.

- [ ] **Step 1: Create `src/main/aws/provider.ts`**

  ```ts
  // src/main/aws/provider.ts
  import type { CloudNode } from '../../renderer/types/cloud'
  import type { AwsClients } from './client'
  import { describeInstances, describeVpcs, describeSubnets, describeSecurityGroups } from './services/ec2'
  import { describeDBInstances } from './services/rds'
  import { listBuckets } from './services/s3'
  import { listFunctions } from './services/lambda'
  import { describeLoadBalancers } from './services/alb'
  import { listCertificates } from './services/acm'
  import { listDistributions } from './services/cloudfront'
  import { listApis } from './services/apigw'

  /**
   * Contract every cloud provider plugin must satisfy.
   * M6 will add AzureProvider, GcpProvider implementing this.
   */
  export interface CloudProvider {
    readonly id: string
    scan(clients: AwsClients, region: string): Promise<CloudNode[]>
  }

  export const awsProvider: CloudProvider = {
    id: 'aws',
    async scan(clients, region) {
      const results = await Promise.all([
        describeInstances(clients.ec2, region),
        describeVpcs(clients.ec2, region),
        describeSubnets(clients.ec2, region),
        describeSecurityGroups(clients.ec2, region),
        describeDBInstances(clients.rds, region),
        listBuckets(clients.s3, region),
        listFunctions(clients.lambda, region),
        describeLoadBalancers(clients.alb, region),
        listCertificates(clients.acm),
        listDistributions(clients.cloudfront),
        listApis(clients.apigw, region),
      ])
      return results.flat()
    },
  }
  ```

- [ ] **Step 2: Update ResourceScanner to use awsProvider**

  In `src/main/aws/scanner.ts`, import and use the provider:

  ```ts
  import { awsProvider } from './provider'
  ```

  Replace the inline `Promise.all` block in `scan()` with:

  ```ts
  const nextNodes = await awsProvider.scan(this.clients, this.region)
  ```

  Remove the now-unused service imports from `scanner.ts`. The existing import line is:
  ```ts
  import { describeInstances, describeVpcs, describeSubnets, describeSecurityGroups, describeKeyPairs } from './services/ec2'
  ```
  Trim it to keep only `describeKeyPairs` (used after the main scan):
  ```ts
  import { describeKeyPairs } from './services/ec2'
  ```
  Remove all other service imports (rds, s3, lambda, alb, acm, cloudfront, apigw) — they now live in `provider.ts`.

- [ ] **Step 3: Typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: no errors.

- [ ] **Step 4: Run full test suite**

  ```bash
  npm test 2>&1 | tail -10
  ```

  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/main/aws/provider.ts src/main/aws/scanner.ts
  git commit -m "refactor(arch): extract CloudProvider interface + AwsProvider adapter"
  ```

---

### Task 5: Zustand store split

**Files:**
- Create: `src/renderer/store/ui.ts`
- Create: `src/renderer/store/cli.ts`
- Modify: `src/renderer/store/cloud.ts`
- Modify: all components that import the moved selectors

Split plan:
- **`useUIStore`** (new): `view`, `selectedNodeId`, `activeCreate`
- **`useCliStore`** (new): `cliOutput`, `commandPreview`, `pendingCommand`
- **`useCloudStore`** (keep): `nodes`, `scanStatus`, `lastScannedAt`, `profile`, `region`, `errorMessage`, `keyPairs`, `settings`, `pendingNodes`, `addOptimisticNode`, `removeOptimisticNode`

- [ ] **Step 1: Create `src/renderer/store/ui.ts`**

  ```ts
  import { create } from 'zustand'

  interface UIState {
    view:            'topology' | 'graph'
    selectedNodeId:  string | null
    activeCreate:    { resource: string; view: 'topology' | 'graph'; dropPosition?: { x: number; y: number } } | null
    setView:         (view: 'topology' | 'graph') => void
    selectNode:      (id: string | null) => void
    setActiveCreate: (val: UIState['activeCreate']) => void
    showToast:       (message: string, type?: 'success' | 'error') => void
    clearToast:      () => void
    toast:           { message: string; type: 'success' | 'error' } | null
  }

  export const useUIStore = create<UIState>((set) => ({
    view:           'topology',
    selectedNodeId: null,
    activeCreate:   null,
    toast:          null,

    setView:         (view) => set({ view }),
    selectNode:      (id)   => set({ selectedNodeId: id }),
    setActiveCreate: (val)  => set({ activeCreate: val }),
    showToast: (message, type = 'success') => {
      set({ toast: { message, type } })
      setTimeout(() => set({ toast: null }), 2500)
    },
    clearToast: () => set({ toast: null }),
  }))
  ```

- [ ] **Step 2: Create `src/renderer/store/cli.ts`**

  ```ts
  import { create } from 'zustand'

  interface CliState {
    cliOutput:      Array<{ line: string; stream: 'stdout' | 'stderr' }>
    commandPreview: string[]
    pendingCommand: string[][] | null

    appendCliOutput:   (entry: { line: string; stream: 'stdout' | 'stderr' }) => void
    clearCliOutput:    () => void
    setCommandPreview: (cmd: string[]) => void
    setPendingCommand: (cmds: string[][] | null) => void
  }

  export const useCliStore = create<CliState>((set) => ({
    cliOutput:      [],
    commandPreview: [],
    pendingCommand: null,

    appendCliOutput:   (entry) => set((s) => ({ cliOutput: [...s.cliOutput, entry] })),
    clearCliOutput:    ()      => set({ cliOutput: [] }),
    setCommandPreview: (cmd)   => set({ commandPreview: cmd }),
    setPendingCommand: (cmds)  => set({ pendingCommand: cmds }),
  }))
  ```

- [ ] **Step 3: Remove moved fields from `src/renderer/store/cloud.ts`**

  Remove from the `CloudState` interface and implementation:
  - `view` + `setView`
  - `selectedNodeId` + `selectNode`
  - `activeCreate` + `setActiveCreate`
  - `cliOutput` + `appendCliOutput` + `clearCliOutput`
  - `commandPreview` + `setCommandPreview`
  - `pendingCommand` + `setPendingCommand`

  Also remove them from the `createCloudStore` factory at the bottom of the file (used in tests).

- [ ] **Step 4: Find all components using the moved selectors**

  ```bash
  grep -r "useCloudStore" src/renderer --include="*.tsx" --include="*.ts" -l
  ```

  For each file, replace selectors:

  | Old | New store | Import to add |
  |-----|-----------|--------------|
  | `useCloudStore((s) => s.view)` | `useUIStore((s) => s.view)` | `import { useUIStore } from '../store/ui'` |
  | `useCloudStore((s) => s.setView)` | `useUIStore((s) => s.setView)` | same |
  | `useCloudStore((s) => s.selectedNodeId)` | `useUIStore((s) => s.selectedNodeId)` | same |
  | `useCloudStore((s) => s.selectNode)` | `useUIStore((s) => s.selectNode)` | same |
  | `useCloudStore((s) => s.activeCreate)` | `useUIStore((s) => s.activeCreate)` | same |
  | `useCloudStore((s) => s.setActiveCreate)` | `useUIStore((s) => s.setActiveCreate)` | same |
  | `useCloudStore((s) => s.cliOutput)` | `useCliStore((s) => s.cliOutput)` | `import { useCliStore } from '../store/cli'` |
  | `useCloudStore((s) => s.commandPreview)` | `useCliStore((s) => s.commandPreview)` | same |
  | `useCloudStore((s) => s.pendingCommand)` | `useCliStore((s) => s.pendingCommand)` | same |
  | `useCloudStore((s) => s.appendCliOutput)` | `useCliStore((s) => s.appendCliOutput)` | same |
  | `useCloudStore((s) => s.clearCliOutput)` | `useCliStore((s) => s.clearCliOutput)` | same |
  | `useCloudStore((s) => s.setCommandPreview)` | `useCliStore((s) => s.setCommandPreview)` | same |
  | `useCloudStore((s) => s.setPendingCommand)` | `useCliStore((s) => s.setPendingCommand)` | same |

- [ ] **Step 5: Typecheck + full test**

  ```bash
  npm run typecheck && npm test 2>&1 | tail -20
  ```

  Expected: all pass.

- [ ] **Step 6: Commit**

  ```bash
  git add src/renderer/store/ src/renderer/
  git commit -m "refactor(store): split useCloudStore into cloud/ui/cli slices"
  ```

---

## Chunk 3: UX Polish

### Task 6: Commit uncommitted Sidebar count badges

**Files:**
- `src/renderer/components/Sidebar.tsx` (already modified — just commit)

- [ ] **Step 1: Typecheck + test**

  ```bash
  npm run typecheck && npm test 2>&1 | tail -5
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/renderer/components/Sidebar.tsx
  git commit -m "feat(sidebar): show per-service resource count badges"
  ```

---

### Task 7: Drag-and-drop node creation from sidebar

**Files:**
- Read first: the file that renders `<ReactFlow>` (likely `src/renderer/components/Canvas.tsx` or similar)
- Modify: that file
- Modify: `src/renderer/store/ui.ts` (activeCreate type already includes dropPosition)

Sidebar already sets `draggable` and `onDragStart={(e) => e.dataTransfer.setData('text/plain', s.type)}`. Canvas needs `onDragOver` + `onDrop`.

- [ ] **Step 1: Find the ReactFlow render site**

  ```bash
  grep -r "ReactFlow\|useReactFlow" src/renderer --include="*.tsx" -l
  ```

  Read that file to understand the current structure.

- [ ] **Step 2: Add onDragOver + onDrop to the ReactFlow element**

  ```tsx
  import { useReactFlow } from '@xyflow/react'
  import type { NodeType } from '../types/cloud'

  // inside the component:
  const { screenToFlowPosition } = useReactFlow()
  const setActiveCreate = useUIStore((s) => s.setActiveCreate)
  const view = useUIStore((s) => s.view)

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('text/plain') as NodeType
    if (!type) return
    const dropPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setActiveCreate({ resource: type, view, dropPosition })
  }, [screenToFlowPosition, view, setActiveCreate])
  ```

  Add `onDragOver={onDragOver}` and `onDrop={onDrop}` to the `<ReactFlow>` JSX element.

  Note: `dropPosition` is passed into `activeCreate` but `CreateModal` does not consume it in M5.5 — it is intentionally wired for future use (pre-positioning new nodes on the canvas). No `CreateModal` changes needed.

- [ ] **Step 3: Typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: no errors.

- [ ] **Step 4: Smoke test manually**

  Run `npm run dev`. Drag a service from the sidebar and drop it on the canvas. The create modal should open pre-filled with that resource type.

- [ ] **Step 5: Commit**

  ```bash
  git add src/renderer/
  git commit -m "feat(ux): drag-and-drop node creation from sidebar to canvas"
  ```

---

### Task 8: Search-to-fly (verify existing implementation)

**Files:** None — this is already implemented. Verify only.

Search-to-fly is fully wired: `SearchPalette` (`⌘K`) → `onSelect` → `App.tsx:handleSearchSelect` → `selectNode(id)` + `window.dispatchEvent(new CustomEvent('cloudblocks:fitnode', { detail: { nodeId } }))` → `CloudCanvas.tsx` listens and calls `fitView({ nodes: [{ id }], duration: 400, padding: 0.5 })`.

- [ ] **Step 1: Verify search-to-fly works end-to-end**

  Run `npm run dev`. Press `⌘K` to open the search palette, type a resource name, click a result. The canvas should pan and zoom to that node.

  Expected: camera flies to the selected node.

- [ ] **Step 2: No code changes needed — move on**

  If the behavior works, this task is complete. If something is broken, read `src/renderer/components/SearchPalette.tsx`, `src/renderer/src/App.tsx` (line 39–43), and `src/renderer/components/canvas/CloudCanvas.tsx` (lines 40–48) to diagnose.

---

### Task 9: In-canvas post-action feedback toast

**Files:**
- Create: `src/renderer/components/CanvasToast.tsx`
- Modify: wherever CLI `done`/`error` events are handled in the renderer

Note: `toast`, `showToast`, and `clearToast` are already defined in `useUIStore` from Task 5 — do not re-add them.

- [ ] **Step 1: Create `src/renderer/components/CanvasToast.tsx`**

  ```tsx
  import { useUIStore } from '../store/ui'

  export function CanvasToast() {
    const toast = useUIStore((s) => s.toast)
    if (!toast) return null
    return (
      <div
        style={{
          position:  'absolute',
          bottom:    52,
          left:      '50%',
          transform: 'translateX(-50%)',
          zIndex:    1000,
          background: toast.type === 'error'
            ? 'var(--cb-status-error)'
            : 'var(--cb-status-running)',
          color:        'var(--cb-bg)',
          padding:      '5px 14px',
          borderRadius: 4,
          fontSize:     11,
          fontFamily:   'monospace',
          pointerEvents: 'none',
          whiteSpace:   'nowrap',
        }}
      >
        {toast.message}
      </div>
    )
  }
  ```

- [ ] **Step 3: Mount CanvasToast in the canvas container**

  In the file that renders the canvas area, add `<CanvasToast />` inside the relative-positioned canvas wrapper div (it uses `position: absolute` so the parent must be `position: relative`).

- [ ] **Step 4: Call showToast after CLI operations complete**

  Find where `cli:done` (or equivalent IPC event) is handled in the renderer. After a successful delete or stop, call:

  ```ts
  const showToast = useUIStore.getState().showToast
  showToast('Deleted')          // or 'Stopped', 'Created', etc.
  ```

  After an error:
  ```ts
  showToast('Command failed', 'error')
  ```

- [ ] **Step 5: Typecheck + test**

  ```bash
  npm run typecheck && npm test 2>&1 | tail -10
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/renderer/
  git commit -m "feat(ux): in-canvas toast for post-action feedback"
  ```

---

## Chunk 4: Standard Service Pattern (reference — read before Chunks 5–7)

**Chunks 5–7 provide a manifest table only. Do not repeat these steps per service — follow the template below.**

---

### Standard Service Steps (A–G)

**A. Install SDK package**
```bash
npm install @aws-sdk/client-{sdk-name}
```
Skip if using an existing client (e.g. EC2Client for IGW/NAT).

---

**B. Write failing NodeType test**

In `src/renderer/store/__tests__/cloud.test.ts`, add:
```ts
it('NodeType includes {nodeType}', () => {
  const t: NodeType = '{nodeType}'
  expect(t).toBeTruthy()
})
```
Run: `./node_modules/.bin/vitest run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -5`
Expected: FAIL (TypeScript type error — `'{nodeType}'` not assignable to `NodeType`).

---

**C. Extend NodeType in `src/renderer/types/cloud.ts`**

Add to the `NodeType` union:
```ts
  | '{nodeType}'
```
Run the test again. Expected: PASS.

---

**D. Add client to `src/main/aws/client.ts`**

1. Add import: `import { {Client} } from '@aws-sdk/client-{sdk-name}'`
2. Add to `AwsClients` interface: `{key}: {Client}`
3. Add to `createClients()` return object: `{key}: new {Client}(config)`
   - For **global services** (Route 53): use `{ region: 'us-east-1' }` instead of `config`
   - For **EC2-based services** (IGW, NAT): skip — reuse `clients.ec2`, no new entry needed

Run: `npm run typecheck` — no errors.

---

**E. Create `src/main/aws/services/{file}.ts`**

Standard template for flat-list services:
```ts
import { {Client}, {ListCommand} } from '@aws-sdk/client-{sdk-name}'
import { scanFlatService } from './scanFlatService'
import type { CloudNode } from '../../../renderer/types/cloud'

export function list{Resources}(client: {Client}, region: string): Promise<CloudNode[]> {
  return scanFlatService(client, region, {
    fetch: async (c) => {
      const res = await c.send(new {ListCommand}({}))
      return res.{ItemsField} ?? []
    },
    map: (item, region): CloudNode => ({
      id:     {id expression},
      type:   '{nodeType}',
      label:  {label expression},
      status: 'running',
      region,
      metadata: {},
    }),
  })
}
```

For **string-list services** (SQS→`QueueUrls: string[]`, DynamoDB→`TableNames: string[]`):
- `TItem = string`, `map(url, region)` receives the string directly — no `.Arn`, `.Id`, etc.

For **paginated services that can't use scanFlatService** (SSM Params — see Chunk 6 note):
- Use a manual `do { ... } while (nextToken)` loop, same pattern as `apigw.ts`.

---

**F. Wire into `src/main/aws/provider.ts`**

1. Import the new function at the top of `provider.ts`
2. Add `clients.{key}` as an argument in the `Promise.all` call
3. Add the result variable to the `results.flat()` spread (or add it to the `Promise.all` array and update the return)

Run: `npm run typecheck && npm test` — all pass.

---

**G. Commit**
```bash
git add src/
git commit -m "feat(services): add {ServiceName} scan"
```

---

### Pattern deviations quick reference

| Situation | Deviation |
|-----------|-----------|
| EC2-based service (IGW, NAT) | Skip step A. Use `clients.ec2`. No new `AwsClients` key. |
| Global service (Route 53) | `new {Client}({ region: 'us-east-1' })` in `createClients()` |
| String-list SDK (SQS, DynamoDB) | `TItem = string`. `fetch` returns `res.{Field} ?? []`. `map(str, region)`. |
| ARN-only SDK (SNS topics) | `TItem = { TopicArn?: string }`. Derive label from ARN suffix. |
| Paginated service (SSM) | Manual `do...while(nextToken)` loop — skip `scanFlatService`. |

---

## Chunk 5: Service Sprint 1 — Quick Wins

For each service below, follow Steps A–G from Chunk 4. Deviations are noted per row.

| # | Service | SDK package | Client | AwsClients key | NodeType | File | Export fn | ListCommand | Items field | `id` | `label` | Deviation |
|---|---------|------------|--------|----------------|----------|------|-----------|-------------|-------------|------|---------|-----------|
| 1 | Internet Gateway | *(skip — EC2Client)* | `EC2Client` | *(none — use `clients.ec2`)* | `'igw'` *(already in NodeType — skip step B+C)* | `igw.ts` | `listInternetGateways` | `DescribeInternetGatewaysCommand` | `InternetGateways` | `item.InternetGatewayId ?? ''` | tag `Name` or id | Skip A, B, C. `parentId: item.Attachments?.[0]?.VpcId`. `status: item.Attachments?.[0]?.State === 'available' ? 'running' : 'unknown'`. metadata: `{ state: item.Attachments?.[0]?.State }` |
| 2 | SQS | `@aws-sdk/client-sqs` | `SQSClient` | `sqs` | `'sqs'` | `sqs.ts` | `listQueues` | `ListQueuesCommand` | `QueueUrls` *(string[])* | the URL string | `url.split('/').pop() ?? url` | `TItem = string`. `fetch` returns `res.QueueUrls ?? []`. `map(url, region)` — url is both id and label source. |
| 3 | Secrets Manager | `@aws-sdk/client-secrets-manager` | `SecretsManagerClient` | `secrets` | `'secret'` | `secrets.ts` | `listSecrets` | `ListSecretsCommand` | `SecretList` | `item.ARN ?? ''` | `item.Name ?? item.ARN ?? ''` | metadata: `{ description: item.Description ?? '', lastRotated: item.LastRotatedDate?.toISOString() ?? '' }` |
| 4 | ECR | `@aws-sdk/client-ecr` | `ECRClient` | `ecr` | `'ecr-repo'` | `ecr.ts` | `listRepositories` | `DescribeRepositoriesCommand` | `repositories` | `item.repositoryArn ?? ''` | `item.repositoryName ?? ''` | metadata: `{ uri: item.repositoryUri ?? '' }` |

After all 4 services are wired:

- [ ] **Run full test suite**

  ```bash
  npm test 2>&1 | tail -10
  ```

  Expected: all pass.

- [ ] **Run typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: no errors.

---

## Chunk 6: Service Sprint 2

| # | Service | SDK package | Client | AwsClients key | NodeType | File | Export fn | ListCommand | Items field | `id` | `label` | Deviation |
|---|---------|------------|--------|----------------|----------|------|-----------|-------------|-------------|------|---------|-----------|
| 5 | SNS | `@aws-sdk/client-sns` | `SNSClient` | `sns` | `'sns'` | `sns.ts` | `listTopics` | `ListTopicsCommand` | `Topics` | `item.TopicArn ?? ''` | `item.TopicArn?.split(':').pop() ?? ''` | `TItem = { TopicArn?: string }`. Skip N+1 `GetTopicAttributes` for POC — label from ARN suffix. |
| 6 | DynamoDB | `@aws-sdk/client-dynamodb` | `DynamoDBClient` | `dynamo` | `'dynamo'` | `dynamo.ts` | `listTables` | `ListTablesCommand` | `TableNames` *(string[])* | the table name string | the table name string | `TItem = string`. Skip `DescribeTable` for POC. |
| 7 | SSM Params | `@aws-sdk/client-ssm` | `SSMClient` | `ssm` | `'ssm-param'` | `ssm.ts` | `listParameters` | *(manual loop — see note)* | `Parameters` | `item.ARN ?? item.Name ?? ''` | `item.Name ?? ''` | **Cannot use `scanFlatService`** — must paginate via `NextToken`. Use manual loop (code below). |
| 8 | NAT Gateway | *(skip — EC2Client)* | `EC2Client` | *(none — use `clients.ec2`)* | `'nat-gateway'` | `nat.ts` | `listNatGateways` | `DescribeNatGatewaysCommand` | `NatGateways` | `item.NatGatewayId ?? ''` | tag `Name` or id | Skip A. Use `clients.ec2`. `parentId: item.VpcId`. Status map: `available→running`, `pending→pending`, `deleting/deleted→deleting`, `failed→error`. |

**SSM manual loop (service #7):**

```ts
import { SSMClient, DescribeParametersCommand } from '@aws-sdk/client-ssm'
import type { CloudNode } from '../../../renderer/types/cloud'

export async function listParameters(client: SSMClient, region: string): Promise<CloudNode[]> {
  const nodes: CloudNode[] = []
  try {
    let nextToken: string | undefined
    do {
      const res = await client.send(new DescribeParametersCommand({ NextToken: nextToken }))
      for (const p of res.Parameters ?? []) {
        nodes.push({
          id:     p.ARN ?? p.Name ?? '',
          type:   'ssm-param',
          label:  p.Name ?? '',
          status: 'running',
          region,
          metadata: { type: p.Type ?? '', tier: p.Tier ?? '' },
        })
      }
      nextToken = res.NextToken
    } while (nextToken)
  } catch {
    // return partial results
  }
  return nodes
}
```

After all 4 services:

- [ ] `npm run typecheck && npm test 2>&1 | tail -10` — all pass.

---

## Chunk 7: Service Sprint 3

| # | Service | SDK package | Client | AwsClients key | NodeType | File | Export fn | ListCommand | Items field | `id` | `label` | Deviation |
|---|---------|------------|--------|----------------|----------|------|-----------|-------------|-------------|------|---------|-----------|
| 9 | Route 53 | `@aws-sdk/client-route-53` | `Route53Client` | `r53` | `'r53-zone'` | `r53.ts` | `listHostedZones` | `ListHostedZonesCommand` | `HostedZones` | `item.Id ?? ''` | `item.Name ?? ''` | **Global service**: `new Route53Client({ region: 'us-east-1' })`. **Function signature drops `region`**: `export function listHostedZones(client: Route53Client): Promise<CloudNode[]>` — call site is `listHostedZones(clients.r53)` (no region arg). Use `region: 'global'` hardcoded in the node. metadata: `{ private: item.Config?.PrivateZone ?? false, recordCount: item.ResourceRecordSetCount ?? 0 }`. Skip record set scan for POC. |
| 10 | Step Functions | `@aws-sdk/client-sfn` | `SFNClient` | `sfn` | `'sfn'` | `sfn.ts` | `listStateMachines` | `ListStateMachinesCommand` | `stateMachines` | `item.stateMachineArn ?? ''` | `item.name ?? ''` | metadata: `{ type: item.type ?? '', createdAt: item.creationDate?.toISOString() ?? '' }`. Do NOT call `DescribeStateMachine` — avoids large JSON definition fetch. |
| 11 | EventBridge | `@aws-sdk/client-eventbridge` | `EventBridgeClient` | `eventbridge` | `'eventbridge-bus'` | `eventbridge.ts` | `listEventBuses` | `ListEventBusesCommand` | `EventBuses` | `item.Arn ?? ''` | `item.Name ?? ''` | metadata: `{ policy: item.Policy ? 'custom' : 'default' }`. Skip per-bus rules scan for POC. |

After all 3 services:

- [ ] `npm run typecheck && npm test 2>&1 | tail -10` — all pass.

- [ ] **Final commit for full service expansion**

  ```bash
  git add src/
  git commit -m "feat(services): complete M5.5 service expansion — 11 new services"
  ```

---

## Appendix: provider.ts wire-up after all sprints

After Chunks 5–7, `src/main/aws/provider.ts` should import and call all new scan functions. The `Promise.all` in `awsProvider.scan()` will grow to include:

```ts
// Sprint 1
listInternetGateways(clients.ec2, region).catch(() => [] as CloudNode[]),
listQueues(clients.sqs, region).catch(() => [] as CloudNode[]),
listSecrets(clients.secrets, region).catch(() => [] as CloudNode[]),
listRepositories(clients.ecr, region).catch(() => [] as CloudNode[]),
// Sprint 2
listTopics(clients.sns, region).catch(() => [] as CloudNode[]),
listTables(clients.dynamo, region).catch(() => [] as CloudNode[]),
listParameters(clients.ssm, region).catch(() => [] as CloudNode[]),
listNatGateways(clients.ec2, region).catch(() => [] as CloudNode[]),
// Sprint 3
listHostedZones(clients.r53).catch(() => [] as CloudNode[]),
listStateMachines(clients.sfn, region).catch(() => [] as CloudNode[]),
listEventBuses(clients.eventbridge, region).catch(() => [] as CloudNode[]),
```

The `.catch(() => [] as CloudNode[])` per entry ensures a single failing service does not abort the entire scan — consistent with existing service files that return `[]` on error. `scanFlatService` itself has no internal try/catch, so this is required at the call site.

Use `results.flat()` on the `Promise.all` array (already the pattern from Task 4) so adding new entries is one line each.

---

## Out of scope for M5.5 (design discussion needed before implementation)

| Service | Blocker |
|---------|---------|
| ECS | 3-tier hierarchy (Cluster→Service→Task) needs canvas representation decision |
| EKS | Same — 2-tier hierarchy + complex create form |
| IAM | Better as Inspector metadata annotation than canvas nodes — needs spec |
| ElastiCache | Redis vs Memcached use different SDK call paths |
| CloudWatch | Not assessed by Tech Lead — needs complexity evaluation |
| Beanstalk | Canvas duplication risk (provisions EC2/ALB/RDS underneath) |

---

## Optional M5.5 tail: Terraform spike (no UI — types + mappers only)

If sprint capacity allows after Chunks 1–7, define the foundation for M6.1 Terraform export:

- [ ] **Create `src/renderer/types/terraform.ts`**

  ```ts
  export interface TerraformResource {
    resourceType: string   // e.g. 'aws_vpc', 'aws_security_group'
    logicalName:  string   // stable HCL identifier — derived from label or user-set
    attributes:   Record<string, string | number | boolean | string[]>
    dependsOn?:   string[] // logical names of resources this depends on
  }
  ```

- [ ] **Create `src/main/terraform/mappers/vpc.ts`** (example mapper)

  ```ts
  import type { CloudNode } from '../../../renderer/types/cloud'
  import type { TerraformResource } from '../../renderer/types/terraform'

  export function vpcToTerraform(node: CloudNode): TerraformResource {
    return {
      resourceType: 'aws_vpc',
      logicalName:  slugify(node.label) || node.id.slice(-8),
      attributes: {
        cidr_block:           node.metadata.cidrBlock as string ?? '10.0.0.0/16',
        enable_dns_support:   true,
        enable_dns_hostnames: true,
        tags: `{ Name = "${node.label}" }`,
      },
    }
  }

  function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  }
  ```

- [ ] **Write mapper tests for VPC, SG, EC2 against mock CloudNode data**

  This surfaces field-mapping complexity (SDK response shape vs. Terraform argument schema) without any UI work.

- [ ] **Commit**

  ```bash
  git add src/
  git commit -m "feat(terraform-spike): TerraformResource type + VPC/SG/EC2 mappers"
  ```
