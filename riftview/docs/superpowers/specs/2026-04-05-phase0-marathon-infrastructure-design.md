# Phase 0: Marathon Infrastructure Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the foundational infrastructure required for the command board marathon — rename the product to Terminus, add a compile-time feature flag system, set up Ladle for isolated component development, and put the marathon process infrastructure in place.

**Architecture:** Four independent workstreams executed in sequence: (1) atomic Terminus rename, (2) Vite compile-time feature flags with type-safe accessor, (3) Ladle component dev environment with initial node stories, (4) process infrastructure (Foreman review gates, token pause protocol, Obsidian changelog, scripts directory).

**Tech Stack:** Electron 32 + electron-vite · React 19 · TypeScript · Vite env vars · `@ladle/react` · Obsidian MCP · Vitest

---

## Context

This is Phase 0 of the Terminus command board marathon — a revolutionary redesign of the product from a resource browser into a real-time operational interface for AWS. Phase 0 establishes the infrastructure that all future phases depend on. Nothing from Phase 1 (Visual Command Board), Phase 2 (Execution Engine), or Phase 3 (Operational Intelligence) begins until Phase 0 is complete and CI is green.

**Product direction (locked):** The product is now called **Terminus**. It is an operational tool, not a diagram tool. The IPC boundary (credentials never cross to renderer) is sacred and unchanged.

**Process rules for this marathon:**
- Foreman must sign off on every task before it is marked complete
- At ~90% context usage, commit in-progress work, write `RESUME.md` at project root, stop cleanly
- All new tools/scripts go into `scripts/` and are committed
- Scribe appends to `Cloudblocks/Changelog/CHANGELOG.md` in Obsidian after each task

---

## File Map

### Task 1 — Terminus Rename
**Source files:**
- Modify: `package.json`
- Modify: `electron-builder.yml`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/main/plugin/types.ts`
- Modify: `src/main/plugin/registry.ts`
- Modify: `src/main/plugin/awsPlugin.ts`
- Modify: All 24 renderer source files listed in the Renderer Callsites section below

**Test files (must be updated atomically with source):**
- Modify: `tests/main/preload.test.ts`
- Modify: `tests/main/plugin/awsPlugin.test.ts`
- Modify: `tests/renderer/components/DriftModeStrip.test.tsx`
- Modify: `tests/renderer/components/Inspector.test.tsx`
- Modify: `tests/renderer/components/IamAdvisor.test.tsx`
- Modify: `tests/renderer/components/canvas/nodes/StickyNoteNode.test.tsx`
- Modify: `tests/renderer/components/canvas/BulkActionToolbar.test.tsx`
- Modify: `tests/renderer/components/TemplatesModal.deploy.test.tsx`
- Modify: `tests/renderer/hooks/useScanner.test.ts`
- Modify: `tests/renderer/hooks/useIpc.test.ts`

**Documentation:**
- Modify: `CLAUDE.md`

### Task 2 — Feature Flag System
- Create: `src/renderer/utils/flags.ts`
- Create: `tests/renderer/utils/flags.test.ts`
- Create: `.env.local.example`
- Modify: `.gitignore` (ensure `.env.local` is listed)

### Task 3 — Ladle Component Dev Environment
- Modify: `package.json` (devDependency + `stories` script)
- Create: `ladle.config.mjs`
- Create: `vite.ladle.config.ts` (standalone Vite config for Ladle — see below)
- Create: `src/renderer/components/canvas/nodes/ResourceNode.stories.tsx`
- Create: `src/renderer/components/canvas/nodes/VpcNode.stories.tsx`
- Create: `src/renderer/components/canvas/nodes/SubnetNode.stories.tsx`

### Task 4 — Process Infrastructure
- Create: `scripts/README.md`
- Create: `RESUME.md` (template at project root)
- Scribe: Initialize `Cloudblocks/Changelog/CHANGELOG.md` in Obsidian

---

## Task 1: Terminus Rename

**Completion criteria:** `npm run typecheck` passes, `npm test` passes (all 852+ tests), `window.terminus` is defined, `window.cloudblocks` is undefined. Zero remaining occurrences of `window.cloudblocks` in source.

### Complete Rename Targets

#### Build & Config
| File | Change |
|---|---|
| `package.json` | `"name": "cloudblocks"` → `"terminus"` |
| `electron-builder.yml` | `productName: cloudblocks` → `Terminus` |
| `electron-builder.yml` | `appId: com.cloudblocks.desktop` → `com.terminus.desktop` |
| `electron-builder.yml` | `win.executableName: cloudblocks` → `terminus` |
| `electron-builder.yml` | `publish.repo: cloudblocks` → `terminus` |

#### Preload Bridge (the canonical rename point)
| File | Change |
|---|---|
| `src/preload/index.ts` | `contextBridge.exposeInMainWorld('cloudblocks', …)` → `'terminus'` |
| `src/preload/index.d.ts` | `interface Window { cloudblocks: … }` → `terminus` |

#### Main Process — Plugin Interface & ID
| File | Change |
|---|---|
| `src/main/plugin/types.ts` | `export interface CloudblocksPlugin` → `TerminusPlugin` |
| `src/main/plugin/registry.ts` | All 4 occurrences of `CloudblocksPlugin` → `TerminusPlugin` |
| `src/main/plugin/awsPlugin.ts` | `CloudblocksPlugin` → `TerminusPlugin` (import + type) |
| `src/main/plugin/awsPlugin.ts` | `id: 'com.cloudblocks.aws'` → `'com.terminus.aws'` |

#### Renderer — `window.cloudblocks.*` Callsites (26 files)
Every `window.cloudblocks.` → `window.terminus.` in:
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

#### Renderer — CustomEvent Name Strings
All `'cloudblocks:*'` event strings → `'terminus:*'`. These are used in pairs (dispatchEvent + addEventListener) within the renderer. They are NOT IPC channel strings and are being renamed for consistency.

Full list of event string replacements:
| Old | New |
|---|---|
| `'cloudblocks:fitnode'` | `'terminus:fitnode'` |
| `'cloudblocks:fitview'` | `'terminus:fitview'` |
| `'cloudblocks:export-canvas'` | `'terminus:export-canvas'` |
| `'cloudblocks:add-sticky-note'` | `'terminus:add-sticky-note'` |
| `'cloudblocks:show-templates'` | `'terminus:show-templates'` |
| `'cloudblocks:show-settings'` | `'terminus:show-settings'` |
| `'cloudblocks:show-about'` | `'terminus:show-about'` |

Files containing these event strings:
- `src/renderer/components/TitleBar.tsx`
- `src/renderer/components/Inspector.tsx`
- `src/renderer/components/canvas/CloudCanvas.tsx`
- `src/renderer/components/canvas/CanvasContextMenu.tsx`
- `src/renderer/components/canvas/EmptyCanvasState.tsx`
- `src/renderer/src/App.tsx`

**Note:** `commanddrawer:run` and other non-cloudblocks event strings are NOT renamed — they are already correctly prefixed.

**Note:** IPC channel string values in `src/main/ipc/channels.ts` (e.g. `'canvas:save-image'`) are NOT renamed — they are internal transport strings, not product-facing identifiers.

#### Test Files
| File | Change |
|---|---|
| `tests/main/preload.test.ts` | `'cloudblocks'` string literal → `'terminus'` |
| `tests/main/plugin/awsPlugin.test.ts` | `'com.cloudblocks.aws'` → `'com.terminus.aws'` |
| `tests/renderer/components/DriftModeStrip.test.tsx` | `window.cloudblocks` → `window.terminus` (all occurrences) |
| `tests/renderer/components/Inspector.test.tsx` | `Object.defineProperty(window, 'cloudblocks', …)` → `'terminus'` |
| `tests/renderer/components/IamAdvisor.test.tsx` | `Object.defineProperty(window, 'cloudblocks', …)` → `'terminus'` |
| `tests/renderer/components/canvas/nodes/StickyNoteNode.test.tsx` | `Object.defineProperty(window, 'cloudblocks', …)` → `'terminus'` |
| `tests/renderer/components/canvas/BulkActionToolbar.test.tsx` | `Object.defineProperty(window, 'cloudblocks', …)` → `'terminus'` |
| `tests/renderer/components/TemplatesModal.deploy.test.tsx` | `window.cloudblocks` → `window.terminus`; `makeCloudblocks` → `makeTerminus`; `typeof window.cloudblocks` → `typeof window.terminus` |
| `tests/renderer/hooks/useScanner.test.ts` | `window.cloudblocks` → `window.terminus` |
| `tests/renderer/hooks/useIpc.test.ts` | `window.cloudblocks` → `window.terminus` |

#### UI String Literals ("Cloudblocks" display text)
| File | Change |
|---|---|
| `src/main/index.ts` | `title: 'Cloudblocks'` → `'Terminus'` (window title bar) |
| `src/main/ipc/handlers.ts` | `'Cloudblocks — Drift Detected'` → `'Terminus — Drift Detected'` (OS notification) |
| `src/renderer/components/AboutModal.tsx` | Brand name display string → `Terminus` |
| `src/renderer/components/TitleBar.tsx` | `title="About Cloudblocks"` tooltip → `"About Terminus"` |
| `src/renderer/components/Onboarding.tsx` | `restart Cloudblocks` → `restart Terminus` |
| `src/renderer/components/TemplatesModal.tsx` | `restart Cloudblocks` → `restart Terminus` |

#### electron-builder.yml — `repo:` field
**Do NOT change `repo: cloudblocks`** until the GitHub repository is renamed on GitHub. `electron-updater` uses this field to construct the auto-update download URL — changing it without renaming the repo will silently break auto-updates in production builds. This field stays as-is for now.

#### CLAUDE.md
Update all product-name occurrences of "Cloudblocks"/"cloudblocks" to "Terminus"/"terminus" where they refer to the product name. Keep structural identifiers (file paths, store names, CSS class names) unchanged — only update the product name references.

### Steps

- [ ] **Step 1: Audit — record the current count**

```bash
grep -r "window\.cloudblocks" src tests --include="*.ts" --include="*.tsx" | wc -l
grep -r "cloudblocks:" src --include="*.ts" --include="*.tsx" | grep "addEventListener\|removeEventListener\|dispatchEvent\|CustomEvent" | wc -l
```

Record the numbers. After the rename, both must be zero.

- [ ] **Step 2: Update build & config files**

Update `package.json` name, `electron-builder.yml` productName/appId/executableName/repo.

- [ ] **Step 3: Update preload bridge**

`src/preload/index.ts`: change `'cloudblocks'` → `'terminus'` in `exposeInMainWorld`.
`src/preload/index.d.ts`: change `cloudblocks:` → `terminus:` in the Window interface.

- [ ] **Step 4: Update plugin interface and ID**

`src/main/plugin/types.ts`: `CloudblocksPlugin` → `TerminusPlugin`.
`src/main/plugin/registry.ts`: all 4 occurrences.
`src/main/plugin/awsPlugin.ts`: type reference + `id: 'com.cloudblocks.aws'` → `'com.terminus.aws'`.

- [ ] **Step 5: Update all renderer `window.cloudblocks.*` callsites**

Global replace `window.cloudblocks.` → `window.terminus.` across all 26 renderer files listed above.

- [ ] **Step 6: Update CustomEvent name strings**

Replace all 7 `cloudblocks:*` event strings → `terminus:*` across the 6 files listed above.

- [ ] **Step 7: Update all test files**

Update all 10 test files listed in the Test Files table above.

- [ ] **Step 8: Update CLAUDE.md**

Update product-name references.

- [ ] **Step 9: Verify — zero remaining occurrences**

```bash
grep -r "window\.cloudblocks" src tests --include="*.ts" --include="*.tsx"
# Must return zero results

grep -r "'cloudblocks'" src tests --include="*.ts" --include="*.tsx"
# Must return zero results (excluding comments)

npm run typecheck
npm test
```

Expected: zero occurrences, typecheck passes, all 852+ tests pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: rename product to Terminus — window.terminus, TerminusPlugin, terminus: events"
```

---

## Task 2: Feature Flag System

**Completion criteria:** `flag('COMMAND_BOARD')` returns `false` by default; returns `true` when `VITE_FLAG_COMMAND_BOARD=true` is in the environment; TypeScript rejects unknown flag names at compile time; 3 tests pass.

### Design

```ts
// src/renderer/utils/flags.ts
// RENDERER-ONLY — do not import from main process or preload.
// This file is scoped to tsconfig.web.json which covers src/renderer/**/*.

export type FlagName =
  | 'COMMAND_BOARD'      // Phase 1: relationship-first layout engine
  | 'STATUS_LANGUAGE'    // Phase 1: live health visual texture on nodes
  | 'ACTION_RAIL'        // Phase 1: node hover inline action surface
  | 'EXECUTION_ENGINE'   // Phase 2: bulk ops + action chains
  | 'OP_INTELLIGENCE'    // Phase 3: command palette + CloudWatch log tail

const ENV_PREFIX = 'VITE_FLAG_'

/**
 * Reads a feature flag from Vite compile-time env vars.
 * Reads at call time (not cached) so vi.stubEnv works in tests.
 */
export function flag(name: FlagName): boolean {
  const key = `${ENV_PREFIX}${name}`
  return (import.meta.env as Record<string, string | undefined>)[key] === 'true'
}
```

**Important:** `flag()` is a function, not a cached constant. This ensures `vi.stubEnv` in Vitest works correctly — the env value is read on every call, not once at module load time.

**Important:** This file must only be imported from renderer code (`src/renderer/`). It must never be imported from `src/main/` or `src/preload/` — those contexts do not have `import.meta.env` available via the same Vite client transform.

```bash
# .env.local.example
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

### Steps

- [ ] **Step 1: Write failing test**

Because `flag()` reads `import.meta.env` at call time (not at module load), `vi.stubEnv` takes effect immediately without requiring dynamic re-import or module cache invalidation.

```ts
// tests/renderer/utils/flags.test.ts
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

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/renderer/utils/flags.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/renderer/utils/flags.ts`**

Implement as designed above. Function reads at call time, not cached.

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/renderer/utils/flags.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Create `.env.local.example`**

As designed above. Verify `.env.local` is in `.gitignore` (add if missing).

- [ ] **Step 6: Run full suite**

```bash
npm run typecheck && npm test
```

Expected: all tests pass, zero type errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/utils/flags.ts tests/renderer/utils/flags.test.ts .env.local.example .gitignore
git commit -m "feat: compile-time feature flag system (FlagName union, call-time reads, .env.local.example)"
```

---

## Task 3: Ladle Component Dev Environment

**Completion criteria:** `npm run stories` launches Ladle at `http://localhost:61000`; ResourceNode stories render all 24 NodeTypes in running/pending/error/unknown states without console errors; theme CSS variables apply correctly.

### Why a Separate Vite Config

`electron.vite.config.ts` uses `defineConfig` from `electron-vite`, which bundles main, preload, and renderer configs together. Ladle runs its own Vite dev server and cannot consume an electron-vite config directly. A standalone `vite.ladle.config.ts` replicates only the renderer's Vite setup (React plugin, Tailwind, path alias).

### Design

**Critical:** Use `import { defineConfig } from 'vite'` — NOT from `electron-vite`. The `electron-vite` `defineConfig` expects a `{ main, preload, renderer }` tri-partite shape. Ladle runs its own standalone Vite dev server and requires a single-target Vite config. Using the wrong import will cause Ladle to fail on startup.

```ts
// vite.ladle.config.ts — renderer-only Vite config for Ladle
// Import from 'vite', NOT from 'electron-vite'
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

```js
// ladle.config.mjs
export default {
  stories: 'src/**/*.stories.{tsx,jsx}',
  viteConfig: './vite.ladle.config.ts',
  port: 61000,
}
```

```jsonc
// package.json additions
{
  "scripts": {
    "stories": "ladle serve"
  },
  "devDependencies": {
    "@ladle/react": "^4.0.0"
  }
}
```

### Initial Stories

**ResourceNode stories** — representative spread of NodeTypes × all 4 status states:

```tsx
// ResourceNode.stories.tsx
import type { Story } from '@ladle/react'
// Stories render ResourceNode in isolation across types and statuses.
// Each story wraps the node with the required ReactFlow node props shape.
```

NodeTypes to cover in stories (representative, not all 24):
`lambda`, `ec2`, `s3`, `rds`, `alb`, `sqs`, `dynamo`, `cloudfront`, `ecr-repo`, `cognito`

Status states: `running`, `pending`, `error`, `unknown`

Theme variants: wrap stories in `data-theme="dark"` and `data-theme="light"` containers to verify CSS variable inheritance.

### Steps

- [ ] **Step 1: Install Ladle**

```bash
npm install --save-dev @ladle/react
```

- [ ] **Step 2: Create `vite.ladle.config.ts`**

As designed above. Must include `@vitejs/plugin-react`, `@tailwindcss/vite`, and the `@renderer` alias.

- [ ] **Step 3: Create `ladle.config.mjs`**

As designed above. Point `viteConfig` at `./vite.ladle.config.ts`.

- [ ] **Step 4: Add `stories` script to `package.json`**

Add `"stories": "ladle serve"` to the scripts block.

- [ ] **Step 5: Create `ResourceNode.stories.tsx`**

Stories covering the NodeType × status matrix described above, plus two theme wrapper stories (dark, light).

- [ ] **Step 6: Create `VpcNode.stories.tsx` and `SubnetNode.stories.tsx`**

Container nodes in isolation with mocked children.

- [ ] **Step 7: Verify Ladle launches**

```bash
npm run stories
```

Expected: server starts at `http://localhost:61000`, stories render, no console errors, CSS variables resolve correctly (node borders and labels are visible).

- [ ] **Step 8: Verify `vitest.config.ts` path alias**

`vitest.config.ts` currently has no `resolve.alias`. Story files themselves are not run by vitest. However, if any test file imports a component that internally uses `@renderer/*` paths, vitest will fail to resolve them. Check:

```bash
grep -r "@renderer/" tests --include="*.ts" --include="*.tsx"
```

If any results appear, add to `vitest.config.ts`:
```ts
import { resolve } from 'path'
// inside defineConfig:
resolve: { alias: { '@renderer': resolve(__dirname, 'src/renderer/src') } }
```

- [ ] **Step 9: Commit**

```bash
git add ladle.config.mjs vite.ladle.config.ts package.json package-lock.json src/**/*.stories.tsx
git commit -m "feat: Ladle component dev environment with ResourceNode/VpcNode/SubnetNode stories"
```

---

## Task 4: Process Infrastructure

**Completion criteria:** `scripts/README.md` exists; `RESUME.md` exists at project root; Scribe confirms Obsidian changelog path is initialized.

### Steps

- [ ] **Step 1: Create `scripts/README.md`**

```markdown
# scripts/

Automation and tooling scripts for the Terminus marathon.

## Contents

(populated as scripts are added during the marathon)

## Conventions

- All scripts are committed alongside the work that needs them
- Scripts must be executable: `chmod +x scripts/foo.sh`
- Each script has a comment header with: purpose, usage, and required env vars
```

- [ ] **Step 2: Create `RESUME.md` at project root**

```markdown
# RESUME.md — Marathon Pause State

Written when a session approaches context limits (~90% usage).
Delete this file once the session is successfully resumed.

## Status
(populated at pause time: PAUSED / IN_PROGRESS)

## Current Task
(populated at pause time)

## Last Completed Step
(populated at pause time — copy the checkbox text)

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
4. Delete this file when resumed
```

- [ ] **Step 3: Initialize Obsidian changelog**

Scribe creates `Cloudblocks/Changelog/CHANGELOG.md` with:

```markdown
# Terminus — Changelog

## Phase 0: Marathon Infrastructure

### 2026-04-05 — Task 1: Terminus Rename
(populated by Scribe after Task 1 completes)

### 2026-04-05 — Task 2: Feature Flag System
(populated by Scribe after Task 2 completes)

### 2026-04-05 — Task 3: Ladle Component Dev Environment
(populated by Scribe after Task 3 completes)

### 2026-04-05 — Task 4: Process Infrastructure
(populated by Scribe after Task 4 completes)
```

- [ ] **Step 4: Commit**

```bash
git add scripts/ RESUME.md
git commit -m "chore: marathon process infrastructure — scripts dir and RESUME pause protocol"
```

---

## Phase 0 Complete — Success Criteria

All of the following must be true before Phase 0 is signed off:

- [ ] `window.terminus` defined in DevTools, `window.cloudblocks` undefined
- [ ] Zero occurrences of `window.cloudblocks` or `'cloudblocks'` string literals in source
- [ ] `npm run typecheck` — zero errors (both node and web configs)
- [ ] `npm test` — all 852+ tests pass
- [ ] `flag('COMMAND_BOARD')` returns `false` by default
- [ ] `npm run stories` — Ladle launches, ResourceNode stories render without errors
- [ ] `scripts/README.md` exists
- [ ] `RESUME.md` template at project root
- [ ] Obsidian changelog initialized at `Cloudblocks/Changelog/CHANGELOG.md`

---

## Marathon Process Rules (apply to all phases)

1. **Foreman sign-off** — every task requires Foreman review before marked complete. Foreman reviews: completion criteria met, CI green, no regressions.
2. **Token pause** — at ~90% context, commit all in-progress work, write `RESUME.md` with exact state, stop. Next session resumes from `RESUME.md`.
3. **New tools go in `scripts/`** — any automation, utilities, or CLI tooling added during the marathon is committed to `scripts/` with the work that needs it.
4. **Obsidian changelog** — Scribe appends a dated entry after every task completion.
5. **Spec-first for Phases 1–3** — each phase gets its own brainstorming → spec → plan cycle before any implementation begins. No implementation starts without an approved spec.
