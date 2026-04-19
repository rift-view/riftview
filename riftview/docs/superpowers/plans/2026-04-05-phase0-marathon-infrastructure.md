# Phase 0: Marathon Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product to RiftView, add a compile-time feature flag system, set up Ladle for isolated component development, and create marathon process infrastructure.

**Architecture:** Four sequential tasks. Task 1 (rename) is a mechanical find-and-replace across ~200 occurrences in source + test files, executed atomically. Tasks 2–4 are independent additions that do not touch renamed code. All tasks verified with `npm run typecheck && npm test` before commit.

**Tech Stack:** Electron 32 + electron-vite · React 19 · TypeScript · Vite · `@ladle/react` · Vitest

---

## Working Directory

All commands run from `riftview/` (the directory containing `package.json`).

## Critical Constraints

- **IPC channel strings** (`src/main/ipc/channels.ts`) are NOT renamed — they are internal transport strings
- **`commanddrawer:run`** event string is NOT renamed — it is not a `riftview:` prefix
- **`repo: riftview`** in `electron-builder.yml` is NOT renamed — it must stay in sync with the GitHub repo name
- **`flags.ts`** is renderer-only — never import from `src/main/` or `src/preload/`
- **`vite.ladle.config.ts`** must import `defineConfig` from `'vite'`, NOT from `'electron-vite'`

---

## Task 1: RiftView Rename

**Files modified:** 37 files total — see complete list below.

**Completion criteria:**
- `grep -r "window\.riftview" src tests --include="*.ts" --include="*.tsx"` → zero results
- `grep -r "'riftview'" src tests --include="*.ts" --include="*.tsx"` → zero results
- `npm run typecheck` → zero errors
- `npm test` → all 852+ tests pass

---

- [ ] **Step 1: Record current occurrence counts (baseline)**

```bash
echo "=== window.riftview occurrences ==="
grep -r "window\.riftview" src tests --include="*.ts" --include="*.tsx" | wc -l

echo "=== riftview: event strings ==="
grep -r "riftview:" src --include="*.ts" --include="*.tsx" | grep "addEventListener\|removeEventListener\|dispatchEvent\|CustomEvent" | wc -l
```

Record both numbers. After the rename both must be 0.

---

- [ ] **Step 2: Update `package.json` name**

In `package.json`, change:
```json
"name": "riftview"
```
to:
```json
"name": "riftview"
```

---

- [ ] **Step 3: Update `electron-builder.yml`**

Make these three changes in `electron-builder.yml`:

```yaml
# Change productName:
productName: RiftView

# Change appId:
appId: com.riftview.desktop

# Change win.executableName:
executableName: riftview
```

**Do NOT change `repo: riftview`** — it must match the GitHub repository name.

---

- [ ] **Step 4: Update `src/preload/index.ts` — contextBridge**

Find line with `contextBridge.exposeInMainWorld('riftview',` and change `'riftview'` to `'riftview'`:

```ts
// Before
contextBridge.exposeInMainWorld('riftview', {

// After
contextBridge.exposeInMainWorld('riftview', {
```

---

- [ ] **Step 5: Update `src/preload/index.d.ts` — Window interface**

```ts
// Before
interface Window {
  riftview: {

// After
interface Window {
  riftview: {
```

---

- [ ] **Step 6: Update `src/main/plugin/types.ts` — interface name**

```ts
// Before
export interface RiftViewPlugin {

// After
export interface RiftViewPlugin {
```

---

- [ ] **Step 7: Update `src/main/plugin/registry.ts` — 5 occurrences**

Replace all 5 occurrences of `RiftViewPlugin` with `RiftViewPlugin`:
- Import statement
- `private _plugins: RiftViewPlugin[]`
- `private _ownerByType = new Map<string, RiftViewPlugin>`
- `get plugins(): readonly RiftViewPlugin[]`
- `register(plugin: RiftViewPlugin)`

(Use find-and-replace all in the file.)

---

- [ ] **Step 8: Update `src/main/plugin/awsPlugin.ts` — interface + plugin ID**

Two changes:
```ts
// Import line:
// Before: import type { RiftViewPlugin, ... } from './types'
// After:  import type { RiftViewPlugin, ... } from './types'

// Plugin definition:
// Before:
export const awsPlugin: RiftViewPlugin = {
  id: 'com.riftview.aws',

// After:
export const awsPlugin: RiftViewPlugin = {
  id: 'com.riftview.aws',
```

---

- [ ] **Step 9: Update `src/main/index.ts` — window title**

```ts
// Before
title: 'RiftView',

// After
title: 'RiftView',
```

---

- [ ] **Step 10: Update `src/main/ipc/handlers.ts` — OS notification string**

```ts
// Before
title: 'RiftView — Drift Detected',

// After
title: 'RiftView — Drift Detected',
```

---

- [ ] **Step 11: Replace `window.riftview.` → `window.riftview.` in all 25 renderer source files**

Run this replacement across every file in `src/renderer/`:

```bash
# Dry run first — verify count matches baseline
grep -r "window\.riftview\." src/renderer --include="*.ts" --include="*.tsx" | wc -l

# Apply replacement
find src/renderer -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/window\.riftview\./window\.riftview\./g'
```

Files that will be changed (verify all are touched):
- `src/renderer/src/App.tsx`
- `src/renderer/hooks/useIpc.ts`
- `src/renderer/hooks/useScanner.ts`
- `src/renderer/store/cloud.ts`
- `src/renderer/utils/exportCanvas.ts`
- `src/renderer/components/TitleBar.tsx`
- `src/renderer/components/Inspector.tsx`
- `src/renderer/components/CommandDrawer.tsx`
- `src/renderer/components/SettingsModal.tsx`
- `src/renderer/components/IamAdvisor.tsx`
- `src/renderer/components/TemplatesModal.tsx`
- `src/renderer/components/RegionBar.tsx`
- `src/renderer/components/AboutModal.tsx`
- `src/renderer/components/canvas/CloudCanvas.tsx`
- `src/renderer/components/canvas/TopologyView.tsx`
- `src/renderer/components/canvas/GraphView.tsx`
- `src/renderer/components/canvas/DriftModeStrip.tsx`
- `src/renderer/components/canvas/ScanErrorStrip.tsx`
- `src/renderer/components/canvas/BulkActionToolbar.tsx`
- `src/renderer/components/canvas/CanvasContextMenu.tsx`
- `src/renderer/components/canvas/EmptyCanvasState.tsx`
- `src/renderer/components/canvas/edges/UserEdge.tsx`
- `src/renderer/components/canvas/nodes/useStickyNoteCallbacks.ts`
- `src/renderer/components/modals/CreateModal.tsx`
- `src/renderer/components/modals/EditModal.tsx`

---

- [ ] **Step 12: Replace `riftview:` event strings → `riftview:` in 6 renderer files**

```bash
# Dry run
grep -r "riftview:" src/renderer --include="*.ts" --include="*.tsx" | grep "addEventListener\|removeEventListener\|dispatchEvent\|CustomEvent" | wc -l

# Apply (only event-string prefixes, not window.riftview.)
find src/renderer -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s/'riftview:/'riftview:/g"
```

This replaces these 7 event name strings:
- `'riftview:fitnode'` → `'riftview:fitnode'`
- `'riftview:fitview'` → `'riftview:fitview'`
- `'riftview:export-canvas'` → `'riftview:export-canvas'`
- `'riftview:add-sticky-note'` → `'riftview:add-sticky-note'`
- `'riftview:show-templates'` → `'riftview:show-templates'`
- `'riftview:show-settings'` → `'riftview:show-settings'`
- `'riftview:show-about'` → `'riftview:show-about'`

**After running:** verify `commanddrawer:run` was NOT changed (it has no `riftview:` prefix so it is safe).

---

- [ ] **Step 13: Update UI display strings in renderer components**

Three files with "RiftView" brand text:

**`src/renderer/components/AboutModal.tsx`** — find the JSX text `RiftView` and change to `RiftView`.

**`src/renderer/components/TitleBar.tsx`** — find `title="About RiftView"` and change to `title="About RiftView"`.

**`src/renderer/components/Onboarding.tsx`** — find `restart RiftView` and change to `restart RiftView`.

**`src/renderer/components/TemplatesModal.tsx`** — find `restart RiftView` and change to `restart RiftView`.

---

- [ ] **Step 14: Update test files — `tests/main/preload.test.ts`**

```ts
// Before
expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
  'riftview',

// After
expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
  'riftview',
```

---

- [ ] **Step 15: Update test files — `tests/main/plugin/awsPlugin.test.ts`**

Find the assertion `expect(awsPlugin.id).toBe('com.riftview.aws')` and change to:
```ts
expect(awsPlugin.id).toBe('com.riftview.aws')
```

---

- [ ] **Step 16: Update test files — window mock assignments**

Run this across all test files:

```bash
# Replace window.riftview assignments in tests (includes src/renderer/__tests__ files)
find tests src/renderer -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/window\.riftview/window.riftview/g'

# Replace Object.defineProperty(window, 'riftview' → 'riftview'
find tests src/renderer -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s/defineProperty(window, 'riftview'/defineProperty(window, 'riftview'/g"

# Replace makeRiftView → makeRiftView in TemplatesModal.deploy.test.tsx
sed -i '' 's/makeRiftView/makeRiftView/g' tests/renderer/components/TemplatesModal.deploy.test.tsx

# Replace typeof window.riftview → typeof window.riftview
find tests src/renderer -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/typeof window\.riftview/typeof window.riftview/g'
```

Files touched:
- `tests/renderer/components/DriftModeStrip.test.tsx`
- `tests/renderer/components/Inspector.test.tsx`
- `tests/renderer/components/IamAdvisor.test.tsx`
- `tests/renderer/components/canvas/nodes/StickyNoteNode.test.tsx`
- `tests/renderer/components/canvas/BulkActionToolbar.test.tsx`
- `tests/renderer/components/TemplatesModal.deploy.test.tsx`
- `tests/renderer/hooks/useScanner.test.ts`
- `tests/renderer/hooks/useIpc.test.ts`

---

- [ ] **Step 17: Update `CLAUDE.md` — product name references**

In `CLAUDE.md` (at the project root, not inside `riftview/`), update product-name occurrences:
- `"RiftView"` → `"RiftView"` (product name in prose)
- `riftview` → `riftview` where it refers to the product name (not file paths or store names)

Keep unchanged:
- `useCloudStore`, `useUIStore`, `useCliStore` (store names)
- File paths like `riftview/src/`
- CSS prefix `--cb-`

---

- [ ] **Step 18: Run verification — zero occurrences**

```bash
echo "=== Remaining window.riftview (must be 0) ==="
grep -r "window\.riftview" src tests --include="*.ts" --include="*.tsx"

echo "=== Remaining 'riftview' string literals (must be 0) ==="
grep -r "'riftview'" src tests --include="*.ts" --include="*.tsx"

echo "=== Remaining riftview: event strings (must be 0) ==="
grep -r "riftview:" src --include="*.ts" --include="*.tsx"
```

All three must return zero results.

---

- [ ] **Step 19: Run typecheck**

```bash
npm run typecheck
```

Expected: exits with code 0, zero errors.

If errors appear — they will be in files that still reference `RiftViewPlugin` (check registry.ts/awsPlugin.ts) or `window.riftview` (check any missed renderer file).

---

- [ ] **Step 20: Run test suite**

```bash
npm test
```

Expected: all 852+ tests pass, zero failures.

If failures appear — they will be in test files that still have `window.riftview` mock assignments or `'riftview'` string assertions. Fix the specific file and re-run.

---

- [ ] **Step 21: Commit**

```bash
git add -A
git commit -m "feat: rename product to RiftView — window.riftview, RiftViewPlugin, riftview: events, UI strings"
```

---

## Task 2: Feature Flag System

**Files:**
- Create: `src/renderer/utils/flags.ts`
- Create: `tests/renderer/utils/flags.test.ts`
- Create: `.env.local.example`
- Modify: `.gitignore`

**Completion criteria:** 3 tests pass; `flag('COMMAND_BOARD')` returns false by default; TypeScript rejects invalid flag names.

---

- [ ] **Step 1: Write the failing test**

Create `tests/renderer/utils/flags.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { flag } from '../../../src/renderer/utils/flags'

describe('flag()', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns false when env var is not set', () => {
    expect(flag('COMMAND_BOARD')).toBe(false)
  })

  it('returns true when env var is "true"', () => {
    vi.stubEnv('VITE_FLAG_COMMAND_BOARD', 'true')
    expect(flag('COMMAND_BOARD')).toBe(true)
  })

  it('returns false when env var is set to a non-"true" value', () => {
    vi.stubEnv('VITE_FLAG_COMMAND_BOARD', '1')
    expect(flag('COMMAND_BOARD')).toBe(false)
  })
})
```

Note: `flag()` reads `import.meta.env` at call time (not cached), so `vi.stubEnv` takes effect immediately without needing dynamic re-import.

---

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/renderer/utils/flags.test.ts
```

Expected: FAIL — `Cannot find module '../../../src/renderer/utils/flags'`

---

- [ ] **Step 3: Create `src/renderer/utils/flags.ts`**

```ts
// RENDERER-ONLY: Do not import from src/main/ or src/preload/.
// Scoped to tsconfig.web.json — import.meta.env is only available in renderer context.

export type FlagName =
  | 'COMMAND_BOARD'      // Phase 1: relationship-first layout engine
  | 'STATUS_LANGUAGE'    // Phase 1: live health visual texture on nodes
  | 'ACTION_RAIL'        // Phase 1: node hover inline action surface
  | 'EXECUTION_ENGINE'   // Phase 2: bulk ops + action chains
  | 'OP_INTELLIGENCE'    // Phase 3: command palette + CloudWatch log tail

const ENV_PREFIX = 'VITE_FLAG_'

/**
 * Reads a feature flag from Vite compile-time env vars.
 * Reads at call time (not cached) — vi.stubEnv works correctly in tests.
 */
export function flag(name: FlagName): boolean {
  const key = `${ENV_PREFIX}${name}`
  return (import.meta.env as Record<string, string | undefined>)[key] === 'true'
}
```

---

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/renderer/utils/flags.test.ts
```

Expected: 3 tests pass.

---

- [ ] **Step 5: Create `.env.local.example`**

Create at project root (`riftview/.env.local.example`):

```bash
# Copy this file to .env.local to enable in-progress features during development.
# .env.local is gitignored and never committed.
# All flags default to false (disabled) unless set to 'true'.

# Phase 1: Visual Command Board
VITE_FLAG_COMMAND_BOARD=false
VITE_FLAG_STATUS_LANGUAGE=false
VITE_FLAG_ACTION_RAIL=false

# Phase 2: Execution Engine
VITE_FLAG_EXECUTION_ENGINE=false

# Phase 3: Operational Intelligence
VITE_FLAG_OP_INTELLIGENCE=false
```

---

- [ ] **Step 6: Verify `.env.local` is in `.gitignore`**

```bash
grep "\.env\.local" .gitignore
```

If no result, add `.env.local` to `.gitignore`.

---

- [ ] **Step 7: Run full suite**

```bash
npm run typecheck && npm test
```

Expected: typecheck passes, all tests pass.

---

- [ ] **Step 8: Commit**

```bash
git add src/renderer/utils/flags.ts tests/renderer/utils/flags.test.ts .env.local.example .gitignore
git commit -m "feat: compile-time feature flag system (FlagName union, call-time reads, .env.local.example)"
```

---

## Task 3: Ladle Component Dev Environment

**Files:**
- Modify: `package.json`
- Create: `vite.ladle.config.ts`
- Create: `ladle.config.mjs`
- Create: `src/renderer/components/canvas/nodes/ResourceNode.stories.tsx`
- Create: `src/renderer/components/canvas/nodes/VpcNode.stories.tsx`
- Create: `src/renderer/components/canvas/nodes/SubnetNode.stories.tsx`

**Completion criteria:** `npm run stories` starts Ladle at `http://localhost:61000`; stories render without console errors; node borders and labels visible (CSS variables resolve).

---

- [ ] **Step 1: Install Ladle**

```bash
npm install --save-dev @ladle/react
```

Expected: `@ladle/react` appears in `package.json` devDependencies. No peer-dep errors.

---

- [ ] **Step 2: Create `vite.ladle.config.ts`**

**Critical:** import from `'vite'`, NOT from `'electron-vite'`. The electron-vite config is a tri-partite `{ main, preload, renderer }` object that Ladle cannot consume.

```ts
// vite.ladle.config.ts
// Standalone Vite config for Ladle's dev server.
// Replicates only the renderer Vite setup — no electron-vite wrapper.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
})
```

---

- [ ] **Step 3: Create `ladle.config.mjs`**

```js
// ladle.config.mjs
export default {
  stories: 'src/**/*.stories.{tsx,jsx}',
  viteConfig: './vite.ladle.config.ts',
  port: 61000,
}
```

---

- [ ] **Step 4: Add `stories` script to `package.json`**

In the `"scripts"` block of `package.json`, add:
```json
"stories": "ladle serve"
```

---

- [ ] **Step 5: Create `ResourceNode.stories.tsx`**

`ResourceNode` takes `NodeProps` from `@xyflow/react`. Its `data` field is cast to `ResourceNodeData` internally. For stories, pass data via `data` prop.

```tsx
// src/renderer/components/canvas/nodes/ResourceNode.stories.tsx
import type { Story } from '@ladle/react'
import { ResourceNode } from './ResourceNode'
import type { NodeType, NodeStatus } from '../../../types/cloud'

// Minimal NodeProps shape for stories — only fields ResourceNode actually reads
function makeProps(nodeType: NodeType, status: NodeStatus, label: string) {
  return {
    id: `story-${nodeType}-${status}`,
    type: 'resource',
    selected: false,
    dragging: false,
    zIndex: 1,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    data: { label, nodeType, status, metadata: {} },
  } as Parameters<typeof ResourceNode>[0]
}

// --- Running state ---
export const LambdaRunning: Story = () => (
  <ResourceNode {...makeProps('lambda', 'running', 'my-function')} />
)
export const Ec2Running: Story = () => (
  <ResourceNode {...makeProps('ec2', 'running', 'i-0abc123')} />
)
export const S3Running: Story = () => (
  <ResourceNode {...makeProps('s3', 'running', 'my-bucket')} />
)
export const RdsRunning: Story = () => (
  <ResourceNode {...makeProps('rds', 'running', 'my-db')} />
)
export const AlbRunning: Story = () => (
  <ResourceNode {...makeProps('alb', 'running', 'my-alb')} />
)
export const SqsRunning: Story = () => (
  <ResourceNode {...makeProps('sqs', 'running', 'my-queue')} />
)
export const DynamoRunning: Story = () => (
  <ResourceNode {...makeProps('dynamo', 'running', 'my-table')} />
)
export const CloudfrontRunning: Story = () => (
  <ResourceNode {...makeProps('cloudfront', 'running', 'E1234ABCD')} />
)
export const EcrRunning: Story = () => (
  <ResourceNode {...makeProps('ecr-repo', 'running', 'my-app')} />
)
export const CognitoRunning: Story = () => (
  <ResourceNode {...makeProps('cognito', 'running', 'us-east-1_abc')} />
)

// --- Error state ---
export const LambdaError: Story = () => (
  <ResourceNode {...makeProps('lambda', 'error', 'broken-function')} />
)
export const Ec2Error: Story = () => (
  <ResourceNode {...makeProps('ec2', 'error', 'i-broken')} />
)

// --- Pending state ---
export const RdsPending: Story = () => (
  <ResourceNode {...makeProps('rds', 'pending', 'creating-db')} />
)
export const LambdaPending: Story = () => (
  <ResourceNode {...makeProps('lambda', 'pending', 'deploying-fn')} />
)

// --- Unknown state ---
export const LambdaUnknown: Story = () => (
  <ResourceNode {...makeProps('lambda', 'unknown', 'mystery-fn')} />
)

// --- Theme variants ---
export const DarkTheme: Story = () => (
  <div data-theme="dark" style={{ background: '#0f1117', padding: 24, display: 'flex', gap: 16 }}>
    <ResourceNode {...makeProps('lambda', 'running', 'dark-fn')} />
    <ResourceNode {...makeProps('ec2', 'error', 'dark-ec2')} />
    <ResourceNode {...makeProps('rds', 'pending', 'dark-rds')} />
  </div>
)

export const LightTheme: Story = () => (
  <div data-theme="light" style={{ background: '#f9fafb', padding: 24, display: 'flex', gap: 16 }}>
    <ResourceNode {...makeProps('lambda', 'running', 'light-fn')} />
    <ResourceNode {...makeProps('ec2', 'error', 'light-ec2')} />
    <ResourceNode {...makeProps('rds', 'pending', 'light-rds')} />
  </div>
)
```

---

- [ ] **Step 6: Create `VpcNode.stories.tsx`**

```tsx
// src/renderer/components/canvas/nodes/VpcNode.stories.tsx
import type { Story } from '@ladle/react'
import { VpcNode } from './VpcNode'

function makeVpcProps(label: string, cidr?: string, collapsed?: boolean) {
  return {
    id: `story-vpc`,
    type: 'vpc',
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    data: { label, cidr, collapsed, childCount: 3 },
  } as Parameters<typeof VpcNode>[0]
}

export const Default: Story = () => (
  <div style={{ width: 300, height: 200 }}>
    <VpcNode {...makeVpcProps('vpc-0abc1234', '10.0.0.0/16')} />
  </div>
)

export const Collapsed: Story = () => (
  <div style={{ width: 300, height: 60 }}>
    <VpcNode {...makeVpcProps('vpc-0abc1234', '10.0.0.0/16', true)} />
  </div>
)

export const NoCidr: Story = () => (
  <div style={{ width: 300, height: 200 }}>
    <VpcNode {...makeVpcProps('vpc-no-cidr')} />
  </div>
)
```

---

- [ ] **Step 7: Create `SubnetNode.stories.tsx`**

```tsx
// src/renderer/components/canvas/nodes/SubnetNode.stories.tsx
import type { Story } from '@ladle/react'
import { SubnetNode } from './SubnetNode'

function makeSubnetProps(label: string, isPublic: boolean, az?: string) {
  return {
    id: `story-subnet`,
    type: 'subnet',
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    data: { label, isPublic, az },
  } as Parameters<typeof SubnetNode>[0]
}

export const PublicSubnet: Story = () => (
  <div style={{ width: 220, height: 120 }}>
    <SubnetNode {...makeSubnetProps('subnet-public-1a', true, 'us-east-1a')} />
  </div>
)

export const PrivateSubnet: Story = () => (
  <div style={{ width: 220, height: 120 }}>
    <SubnetNode {...makeSubnetProps('subnet-private-1b', false, 'us-east-1b')} />
  </div>
)

export const NoAz: Story = () => (
  <div style={{ width: 220, height: 120 }}>
    <SubnetNode {...makeSubnetProps('subnet-0abc', true)} />
  </div>
)
```

---

- [ ] **Step 8: Verify `@renderer` alias in `vitest.config.ts`**

```bash
grep -r "@renderer/" tests --include="*.ts" --include="*.tsx"
```

If any results: add the alias to `vitest.config.ts`:

```ts
import { resolve } from 'path'
// inside defineConfig({ ... }):
resolve: {
  alias: { '@renderer': resolve(__dirname, 'src/renderer/src') }
}
```

If no results: no change needed.

---

- [ ] **Step 9: Verify Ladle launches**

```bash
npm run stories
```

Expected: Ladle starts, prints `Listening at http://localhost:61000`. Open the URL and verify:
- Stories tree shows ResourceNode, VpcNode, SubnetNode
- `LambdaRunning` story renders a node with `λ` badge and green stripe
- `LambdaError` renders with red stripe
- `DarkTheme` story renders on dark background with correct colors

Stop the server with Ctrl+C when verified.

---

- [ ] **Step 10: Run full suite (Ladle changes must not affect tests)**

```bash
npm run typecheck && npm test
```

Expected: typecheck passes, all tests pass.

---

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json ladle.config.mjs vite.ladle.config.ts \
  src/renderer/components/canvas/nodes/ResourceNode.stories.tsx \
  src/renderer/components/canvas/nodes/VpcNode.stories.tsx \
  src/renderer/components/canvas/nodes/SubnetNode.stories.tsx
git commit -m "feat: Ladle component dev environment with ResourceNode/VpcNode/SubnetNode stories"
```

---

## Task 4: Process Infrastructure

**Files:**
- Create: `scripts/README.md`
- Create: `RESUME.md`
- Scribe: Initialize Obsidian changelog

**Completion criteria:** Both files exist at project root; Scribe confirms Obsidian changelog created.

---

- [ ] **Step 1: Create `scripts/` directory and README**

```bash
mkdir -p scripts
```

Create `scripts/README.md`:

```markdown
# scripts/

Automation and tooling scripts for the RiftView marathon.

## Contents

(populated as scripts are added during the marathon)

## Conventions

- All scripts are committed alongside the work that needs them
- Scripts must be executable: `chmod +x scripts/foo.sh`
- Each script has a comment header with: purpose, usage, and required env vars
```

---

- [ ] **Step 2: Create `RESUME.md` at project root**

Create `RESUME.md`:

```markdown
# RESUME.md — Marathon Pause State

Written when a session approaches context limits (~90% usage).
Delete this file once the session is successfully resumed.

## Status
(populated at pause time: PAUSED / IN_PROGRESS)

## Current Task
(populated at pause time)

## Last Completed Step
(populated at pause time — copy the checkbox text from the plan)

## Next Step
(populated at pause time — exact next action)

## Files Modified But Not Committed
(populated at pause time)

## Git State
Branch: (populated at pause time)
Last commit: (populated at pause time — git log --oneline -1)

## Resume Instructions
1. Read this file
2. Run: npm run typecheck && npm test (verify baseline)
3. Continue from "Next Step" above
4. Delete this file when resumed successfully
```

---

- [ ] **Step 3: Initialize Obsidian changelog via Scribe**

Scribe creates `RiftView/Changelog/CHANGELOG.md` in Obsidian with initial structure. If Obsidian MCP is unavailable, create the file manually with this content:

```markdown
# RiftView — Changelog

## Phase 0: Marathon Infrastructure

### 2026-04-05 — Task 1: RiftView Rename
Status: complete
Changes: window.riftview, RiftViewPlugin, riftview: events, UI strings, build config

### 2026-04-05 — Task 2: Feature Flag System
Status: complete
Changes: src/renderer/utils/flags.ts, FlagName union, .env.local.example

### 2026-04-05 — Task 3: Ladle Component Dev Environment
Status: complete
Changes: @ladle/react, vite.ladle.config.ts, ResourceNode/VpcNode/SubnetNode stories

### 2026-04-05 — Task 4: Process Infrastructure
Status: complete
Changes: scripts/README.md, RESUME.md template
```

---

- [ ] **Step 4: Commit**

```bash
git add scripts/ RESUME.md
git commit -m "chore: marathon process infrastructure — scripts dir and RESUME pause protocol"
```

---

## Phase 0 Final Verification

Run this block after all 4 tasks are complete:

```bash
echo "=== Zero riftview occurrences ==="
grep -r "window\.riftview" src tests --include="*.ts" --include="*.tsx" | wc -l
# Must be 0

echo "=== Typecheck ==="
npm run typecheck
# Must exit 0

echo "=== Full test suite ==="
npm test
# Must pass all 852+ tests

echo "=== Feature flag default ==="
node -e "console.log('flag test: env not set')"
# flag() returns false by default (verified in tests)

echo "=== Stories script exists ==="
npm run stories -- --help 2>&1 | head -3
# Must show Ladle help output

echo "=== Process files ==="
ls scripts/README.md RESUME.md
# Must list both files
```

**Foreman sign-off required before Phase 0 is marked complete.**
