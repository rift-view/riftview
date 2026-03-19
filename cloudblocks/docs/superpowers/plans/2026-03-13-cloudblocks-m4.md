# Cloudblocks M4 — Theme System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-theme system (retro dark + clean slate light) driven by CSS custom properties, switchable from Settings, with a file-based plugin stub for community themes.

**Architecture:** A single `themes.css` file defines all `--cb-*` tokens under `:root[data-theme="dark"]` and `:root[data-theme="light"]`. Switching sets `document.documentElement.setAttribute('data-theme', value)` — no React re-renders. An `applyTheme` utility centralizes the DOM write. Component migration replaces hardcoded chrome colors with `var(--cb-*)` references. A startup IPC call reads `userData/theme.json` and injects overrides as a `<style>` tag — the file-based plugin hook for M5.

**Tech Stack:** React 18, TypeScript, CSS Custom Properties, Electron IPC, Zustand 5, Vitest

---

## File Map

| Status | Path | Role |
|--------|------|------|
| **Create** | `src/renderer/styles/themes.css` | All `--cb-*` token definitions for dark + light |
| **Create** | `src/renderer/utils/applyTheme.ts` | One-liner: sets `data-theme` on `document.documentElement` |
| **Modify** | `src/renderer/types/cloud.ts` | Add `Theme` type; add `theme` field to `Settings` |
| **Modify** | `src/renderer/store/cloud.ts` | Add `theme: 'dark'` to `DEFAULT_SETTINGS`; call `applyTheme` in `loadSettings` |
| **Modify** | `src/renderer/src/main.tsx` | Import `themes.css` |
| **Modify** | `src/renderer/src/App.tsx` | Call `getThemeOverrides()` on mount; inject override `<style>` tag |
| **Modify** | `src/renderer/components/SettingsPanel.tsx` | Activate theme toggle; call `applyTheme` after save |
| **Modify** | `src/main/ipc/channels.ts` | Add `THEME_OVERRIDES` channel |
| **Modify** | `src/main/ipc/handlers.ts` | Handle `THEME_OVERRIDES` — read `userData/theme.json` |
| **Modify** | `src/preload/index.ts` | Expose `getThemeOverrides` via contextBridge |
| **Modify** | `src/preload/index.d.ts` | Add `getThemeOverrides` to Window type |
| **Modify** | Shell components (6 files) | Replace hardcoded chrome colors |
| **Modify** | Overlay components (7 files) | Replace hardcoded chrome colors |
| **Modify** | Canvas components (4 files) | Replace hardcoded chrome colors |
| **Modify** | Form components (14 files) | Replace hardcoded input/label colors |

---

## Chunk 1: Foundation — tokens, applyTheme, types, store

### Task 1: CSS token file + applyTheme utility

**Files:**
- Create: `src/renderer/styles/themes.css`
- Create: `src/renderer/utils/applyTheme.ts`
- Create: `src/renderer/utils/__tests__/applyTheme.test.ts`
- Modify: `src/renderer/src/main.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/utils/__tests__/applyTheme.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { applyTheme } from '../applyTheme'

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  it('sets data-theme="dark" on document.documentElement', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('sets data-theme="light" on document.documentElement', () => {
    applyTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('switches from dark to light', () => {
    applyTheme('dark')
    applyTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/julius/AI/proj1/.worktrees/m4/cloudblocks/cloudblocks
npx vitest run src/renderer/utils/__tests__/applyTheme.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../applyTheme'`

- [ ] **Step 3: Create the CSS token file**

Create `src/renderer/styles/themes.css`:

```css
:root[data-theme="dark"] {
  --cb-bg-app:         #080c14;
  --cb-bg-panel:       #0d1117;
  --cb-bg-elevated:    #1a2332;
  --cb-bg-hover:       #1e2d40;
  --cb-border:         #30363d;
  --cb-border-strong:  #1e2d40;
  --cb-text-primary:   #e6edf3;
  --cb-text-secondary: #aaaaaa;
  --cb-text-muted:     #666666;
  --cb-accent:         #FF9900;
  --cb-accent-subtle:  rgba(255, 153, 0, 0.1);
  --cb-canvas-bg:      #080c14;
  --cb-canvas-grid:    #1a1a2e;
  --cb-minimap-bg:     #0d1320;
  --cb-minimap-border: #1e2d40;
}

:root[data-theme="light"] {
  --cb-bg-app:         #fafafa;
  --cb-bg-panel:       #efefef;
  --cb-bg-elevated:    #ffffff;
  --cb-bg-hover:       #e8e8e8;
  --cb-border:         #dddddd;
  --cb-border-strong:  #cccccc;
  --cb-text-primary:   #1a1a1a;
  --cb-text-secondary: #555555;
  --cb-text-muted:     #888888;
  --cb-accent:         #e07800;
  --cb-accent-subtle:  rgba(224, 120, 0, 0.08);
  --cb-canvas-bg:      #fafafa;
  --cb-canvas-grid:    #e8e8e8;
  --cb-minimap-bg:     #f0f0f0;
  --cb-minimap-border: #dddddd;
}
```

- [ ] **Step 4: Create applyTheme**

Create `src/renderer/utils/applyTheme.ts`:

```ts
import type { Theme } from '../types/cloud'

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}
```

- [ ] **Step 5: Import themes.css in main.tsx**

Edit `src/renderer/src/main.tsx` — add after the existing `'./assets/main.css'` import:

```ts
import '../styles/themes.css'
```

Full file after edit:

```ts
import './assets/main.css'
import '../styles/themes.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx vitest run src/renderer/utils/__tests__/applyTheme.test.ts 2>&1 | tail -10
```

Expected: PASS — 3 tests

- [ ] **Step 7: Commit**

```bash
git add src/renderer/styles/themes.css src/renderer/utils/applyTheme.ts src/renderer/utils/__tests__/applyTheme.test.ts src/renderer/src/main.tsx
git commit -m "feat: add CSS theme tokens and applyTheme utility"
```

---

### Task 2: Types + store wiring

**Files:**
- Modify: `src/renderer/types/cloud.ts`
- Modify: `src/renderer/store/cloud.ts`
- Modify: `src/renderer/store/__tests__/cloud.test.ts`

- [ ] **Step 1: Write failing tests**

Open `src/renderer/store/__tests__/cloud.test.ts`.

Add these tests to the existing file. The file imports `createCloudStore` — use that:

```ts
describe('theme defaults', () => {
  it('DEFAULT_SETTINGS includes theme: dark', () => {
    const store = createCloudStore()
    expect(store.getState().settings.theme).toBe('dark')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -15
```

Expected: FAIL — `theme` property missing or TypeScript error

- [ ] **Step 3: Add Theme type and update Settings**

Edit `src/renderer/types/cloud.ts`. Current `Settings` interface:

```ts
export interface Settings {
  deleteConfirmStyle: 'type-to-confirm' | 'command-drawer'
  scanInterval: 15 | 30 | 60 | 'manual'
}
```

Replace with:

```ts
export type Theme = 'dark' | 'light'

export interface Settings {
  deleteConfirmStyle: 'type-to-confirm' | 'command-drawer'
  scanInterval: 15 | 30 | 60 | 'manual'
  theme: Theme
}
```

- [ ] **Step 4: Update DEFAULT_SETTINGS and loadSettings in cloud.ts**

Open `src/renderer/store/cloud.ts`.

Find `DEFAULT_SETTINGS` (lines ~6–9):
```ts
const DEFAULT_SETTINGS: Settings = {
  deleteConfirmStyle: 'type-to-confirm',
  scanInterval: 30,
}
```

Replace with:
```ts
const DEFAULT_SETTINGS: Settings = {
  deleteConfirmStyle: 'type-to-confirm',
  scanInterval: 30,
  theme: 'dark',
}
```

Add import at top of file (after existing imports):
```ts
import { applyTheme } from '../utils/applyTheme'
```

Find `loadSettings` action (around line 98):
```ts
loadSettings: async () => {
  const s = await window.cloudblocks.getSettings()
  set({ settings: s })
},
```

Replace with:
```ts
loadSettings: async () => {
  const s = await window.cloudblocks.getSettings()
  applyTheme(s.theme ?? 'dark')
  set({ settings: s })
},
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -15
```

Expected: PASS — all existing tests + new theme default test

- [ ] **Step 6: Run full test suite to check nothing broken**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/renderer/types/cloud.ts src/renderer/store/cloud.ts src/renderer/store/__tests__/cloud.test.ts
git commit -m "feat: add Theme type, theme field to Settings, applyTheme on load"
```

---

## Chunk 2: IPC plugin stub

### Task 3: THEME_OVERRIDES IPC channel

**Files:**
- Modify: `src/main/ipc/channels.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `tests/main/ipc/channels.test.ts`

- [ ] **Step 1: Write the failing test**

Open `tests/main/ipc/channels.test.ts`. Add:

```ts
it('defines THEME_OVERRIDES channel', () => {
  expect(IPC.THEME_OVERRIDES).toBe('theme:overrides')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/main/ipc/channels.test.ts 2>&1 | tail -10
```

Expected: FAIL — `IPC.THEME_OVERRIDES` is undefined

- [ ] **Step 3: Add channel**

Open `src/main/ipc/channels.ts`. Add `THEME_OVERRIDES: 'theme:overrides'` to the `IPC` object (next to other channels).

- [ ] **Step 4: Add handler**

Open `src/main/ipc/handlers.ts`.

The file already imports `fs` (sync) and `path` at the top:
```ts
import fs from 'fs'
import path from 'path'
```
Do NOT add another `fs` import — that would cause a naming collision.

Add this handler alongside the other `ipcMain.handle` calls, using the existing sync `fs`:

```ts
ipcMain.handle(IPC.THEME_OVERRIDES, () => {
  const file = path.join(app.getPath('userData'), 'theme.json')
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
})
```

- [ ] **Step 5: Expose in preload**

Open `src/preload/index.ts`. Inside `contextBridge.exposeInMainWorld('cloudblocks', { ... })`, add:

```ts
getThemeOverrides: () => ipcRenderer.invoke(IPC.THEME_OVERRIDES),
```

Open `src/preload/index.d.ts`. Inside the `cloudblocks` interface, add:

```ts
getThemeOverrides(): Promise<Record<string, string>>
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run tests/main/ipc/channels.test.ts 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 7: Run full suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add src/main/ipc/channels.ts src/main/ipc/handlers.ts src/preload/index.ts src/preload/index.d.ts tests/main/ipc/channels.test.ts
git commit -m "feat: add THEME_OVERRIDES IPC channel and preload stub"
```

---

### Task 4: App.tsx — inject theme overrides on mount

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Read the file**

Read `src/renderer/src/App.tsx` to understand the existing `useEffect` structure.

- [ ] **Step 2: Update the useEffect**

The existing `useEffect` (around line 36) calls `useCloudStore.getState().loadSettings()`.

Update it to also call `getThemeOverrides` and inject the override `<style>` tag. The existing effect also calls `window.cloudblocks.listProfiles().then(setProfiles)` — preserve that call:

```ts
useEffect(() => {
  window.cloudblocks.listProfiles().then(setProfiles)
  useCloudStore.getState().loadSettings()

  window.cloudblocks.getThemeOverrides().then((overrides) => {
    if (Object.keys(overrides).length === 0) return
    const el = document.getElementById('cb-theme-overrides') ?? document.createElement('style')
    el.id = 'cb-theme-overrides'
    el.textContent = `:root { ${Object.entries(overrides).map(([k, v]) => `${k}: ${v}`).join('; ')} }`
    if (!el.parentElement) document.head.appendChild(el)
  })
}, [])
```

- [ ] **Step 3: Build check (no tests for this, it's a side-effect)**

```bash
npx tsc --noEmit -p tsconfig.web.json 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: inject theme.json overrides as <style> tag on startup"
```

---

## Chunk 3: Settings panel theme toggle

### Task 5: SettingsPanel theme toggle

**Files:**
- Modify: `src/renderer/components/SettingsPanel.tsx`

- [ ] **Step 1: Read the file**

Read `src/renderer/components/SettingsPanel.tsx` to understand the current layout. There is a greyed-out "Theme" placeholder row.

- [ ] **Step 2: Replace the theme section**

Find and remove the greyed-out theme placeholder. Replace with an active two-button toggle.

The component uses `local` / `setLocal` state (not `form`/`setForm`). The existing `handleSave` is:
```ts
const handleSave = async () => {
  try {
    await saveSettings(local)
  } finally {
    onClose()
  }
}
```

Add `applyTheme` import at the top:
```ts
import { applyTheme } from '../utils/applyTheme'
```

Replace the theme section in the JSX with:

```tsx
{/* Theme */}
<div style={{ marginBottom: 16 }}>
  <div style={{ fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
    Theme
  </div>
  <div style={{ display: 'flex', gap: 6 }}>
    {(['dark', 'light'] as const).map((t) => (
      <button
        key={t}
        onClick={() => setLocal((f) => ({ ...f, theme: t }))}
        style={{
          background:   local.theme === t ? 'var(--cb-accent-subtle)' : 'var(--cb-bg-elevated)',
          border:       `1px solid ${local.theme === t ? 'var(--cb-accent)' : 'var(--cb-border)'}`,
          borderRadius: 3,
          padding:      '3px 14px',
          color:        local.theme === t ? 'var(--cb-accent)' : 'var(--cb-text-secondary)',
          fontFamily:   'monospace',
          fontSize:     10,
          cursor:       'pointer',
          textTransform: 'capitalize',
        }}
      >
        {t}
      </button>
    ))}
  </div>
</div>
```

Update `handleSave` to call `applyTheme` after saving (preserve `onClose()`):

```ts
const handleSave = async () => {
  try {
    await saveSettings(local)
    applyTheme(local.theme)
  } finally {
    onClose()
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.web.json 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/SettingsPanel.tsx
git commit -m "feat: activate theme toggle in SettingsPanel"
```

---

## Chunk 4: Component migration — shell + overlays

**Key mapping reference** (hardcoded → token):

| Hardcoded value | Token |
|----------------|-------|
| `#080c14` | `var(--cb-bg-app)` |
| `#0d1117` | `var(--cb-bg-panel)` |
| `#060d14` | `var(--cb-bg-panel)` (slightly darker input bg → same token) |
| `#0d1320` | `var(--cb-minimap-bg)` (only in minimap/TitleBar — else use `var(--cb-bg-panel)`) |
| `#1a2332` | `var(--cb-bg-elevated)` |
| `#111` | `var(--cb-bg-elevated)` |
| `#1e2d40` | `var(--cb-border-strong)` |
| `#30363d` | `var(--cb-border)` |
| `#333` | `var(--cb-border)` |
| `#e6edf3` or `#eee` | `var(--cb-text-primary)` |
| `#aaa` or `#aaaaaa` | `var(--cb-text-secondary)` |
| `#555` or `#666` or `#666666` | `var(--cb-text-muted)` |
| `#FF9900` (accent use) | `var(--cb-accent)` |
| `rgba(255,153,0,0.1)` | `var(--cb-accent-subtle)` |

**Do NOT replace:**
- macOS traffic light colors: `#ff5f57`, `#febc2e`, `#28c840`
- AWS service colors: `#FF9900` as EC2/ALB orange, `#1976D2`, `#4CAF50`, `#64b5f6`, `#9c27b0`
- Canvas grid `#1a1a2e` in TopologyView/GraphView Background component — replace with `var(--cb-canvas-grid)`
- Canvas background `#080c14` in style prop — replace with `var(--cb-canvas-bg)`
- MiniMap colors — replace with `var(--cb-minimap-bg)` / `var(--cb-minimap-border)`

---

### Task 6: Shell components

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/components/TitleBar.tsx`
- Modify: `src/renderer/components/Sidebar.tsx`
- Modify: `src/renderer/components/Inspector.tsx`
- Modify: `src/renderer/components/ErrorBanner.tsx`
- Modify: `src/renderer/components/Onboarding.tsx`

For each file, replace every hardcoded chrome color per the mapping table above.

**`src/renderer/src/App.tsx`** — two occurrences of `#080c14`:
```tsx
// Line ~66: loading state div
style={{ background: 'var(--cb-bg-app)', height: '100vh' }}

// Line ~70: root wrapper div
style={{ background: 'var(--cb-bg-app)' }}
```

**`src/renderer/components/TitleBar.tsx`:**
```tsx
// Line ~50: outer div
style={{ background: 'var(--cb-bg-panel)', borderBottom: '1px solid var(--cb-border-strong)' }}

// Line ~59: app name span (FF9900 is accent here — replace)
style={{ color: 'var(--cb-accent)' }}

// Line ~70: scan button (active state)
style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-accent)', color: 'var(--cb-accent)' }}

// Line ~82: other toolbar buttons
style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }}
```

**`src/renderer/components/Sidebar.tsx`:**
```tsx
// outer div
style={{ background: 'var(--cb-bg-panel)', borderRight: '1px solid var(--cb-border-strong)' }}

// inactive tab background (#111 → elevated)
background: view === v ? 'var(--cb-bg-elevated)' : 'transparent',
```

**`src/renderer/components/Inspector.tsx`:**
```tsx
// outer div
style={{ background: 'var(--cb-bg-panel)', borderLeft: '1px solid var(--cb-border-strong)', fontFamily: 'monospace' }}

// section header (FF9900 accent)
style={{ color: 'var(--cb-accent)', borderBottom: '1px solid var(--cb-border-strong)' }}

// section divider
style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}

// action buttons: keep resource-semantic colors (blue #64b5f6 for fetch/reboot, red #ff5f57 for stop, etc.)
// but replace backgrounds: #1a2332 → var(--cb-bg-elevated)
```

**`src/renderer/components/ErrorBanner.tsx`:**
```tsx
// error banner outer
style={{ background: 'var(--cb-bg-elevated)', border: '1px solid #ff5f57', borderLeft: '3px solid #ff5f57', fontFamily: 'monospace' }}
// note: #ff5f57 stays — it's a status color

// dismiss button
style={{ color: 'var(--cb-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
```

**`src/renderer/components/Onboarding.tsx`:**
```tsx
// info box
style={{ background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border-strong)' }}
// CLOUDBLOCKS title (FF9900 accent)
style={{ color: 'var(--cb-accent)' }}
// aws configure inline code (FF9900 accent)
style={{ color: 'var(--cb-accent)' }}
```

- [ ] **Step 1: Migrate App.tsx, TitleBar.tsx, Sidebar.tsx**
- [ ] **Step 2: Migrate Inspector.tsx, ErrorBanner.tsx, Onboarding.tsx**

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.web.json 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/components/TitleBar.tsx src/renderer/components/Sidebar.tsx src/renderer/components/Inspector.tsx src/renderer/components/ErrorBanner.tsx src/renderer/components/Onboarding.tsx
git commit -m "refactor: migrate shell components to CSS custom property tokens"
```

---

### Task 7: Overlay components

**Files:**
- Modify: `src/renderer/components/SettingsPanel.tsx`
- Modify: `src/renderer/components/CommandDrawer.tsx`
- Modify: `src/renderer/components/modals/CreateModal.tsx`
- Modify: `src/renderer/components/modals/EditModal.tsx`
- Modify: `src/renderer/components/modals/DeleteDialog.tsx`
- Modify: `src/renderer/components/canvas/NodeContextMenu.tsx`
- Modify: `src/renderer/components/canvas/CanvasContextMenu.tsx`

Apply the same mapping table as Task 6. Key notes per file:

**`SettingsPanel.tsx`** — `#060d14` (darker input bg) → `var(--cb-bg-panel)`. Save button `#22c55e` stays (success green). Cancel button `#1a2332` → `var(--cb-bg-elevated)`, `#aaa` → `var(--cb-text-secondary)`.

**`CommandDrawer.tsx`** — outer `#0d1117` → `var(--cb-bg-panel)`. Inner bg `#060d14` → `var(--cb-bg-panel)`. `#555` muted text → `var(--cb-text-muted)`. Success `#22c55e` stays. Error `#ff5f57` stays. Cancel button `#1a2332` → `var(--cb-bg-elevated)`.

**`CreateModal.tsx` / `EditModal.tsx`** — modal container `#0d1117` → `var(--cb-bg-panel)`. Accent border `#FF9900` → `var(--cb-accent)`. Header color `#FF9900` → `var(--cb-accent)`. Footer separator `#1e2d40` → `var(--cb-border-strong)`. Cancel button `#1a2332` → `var(--cb-bg-elevated)`, `#aaa` → `var(--cb-text-secondary)`. Save button `#22c55e` stays.

**`DeleteDialog.tsx`** — container `#0d1117` → `var(--cb-bg-panel)`. Input bg `#060d14` → `var(--cb-bg-panel)`. `#ff5f57` stays (delete color). Cancel `#1a2332` → `var(--cb-bg-elevated)`.

**`NodeContextMenu.tsx`** — background `#0d1117` → `var(--cb-bg-panel)`. Border `#30363d` → `var(--cb-border)`. Hover `#1a2332` → `var(--cb-bg-elevated)`. `#555` → `var(--cb-text-muted)`. Separator `#1e2d40` → `var(--cb-border-strong)`. Red delete color `#ff5f57` stays.

**`CanvasContextMenu.tsx`** — background `#0d1117` → `var(--cb-bg-panel)`. Accent border `#FF9900` → `var(--cb-accent)`. Hover `#1a2332` → `var(--cb-bg-elevated)`. Disabled item `#1e2d40` / `#555` → `var(--cb-border-strong)` / `var(--cb-text-muted)`.

- [ ] **Step 1: Migrate SettingsPanel.tsx and CommandDrawer.tsx**
- [ ] **Step 2: Migrate CreateModal.tsx, EditModal.tsx, DeleteDialog.tsx**
- [ ] **Step 3: Migrate NodeContextMenu.tsx and CanvasContextMenu.tsx**

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.web.json 2>&1 | head -20
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/SettingsPanel.tsx src/renderer/components/CommandDrawer.tsx src/renderer/components/modals/CreateModal.tsx src/renderer/components/modals/EditModal.tsx src/renderer/components/modals/DeleteDialog.tsx src/renderer/components/canvas/NodeContextMenu.tsx src/renderer/components/canvas/CanvasContextMenu.tsx
git commit -m "refactor: migrate overlay components to CSS custom property tokens"
```

---

## Chunk 5: Canvas + form migration

### Task 8: Canvas components

**Files:**
- Modify: `src/renderer/components/canvas/CloudCanvas.tsx`
- Modify: `src/renderer/components/canvas/TopologyView.tsx`
- Modify: `src/renderer/components/canvas/GraphView.tsx`
- Modify: `src/renderer/components/canvas/nodes/ResourceNode.tsx`

**`CloudCanvas.tsx`** — toolbar container `#0d1320` → `var(--cb-minimap-bg)` (same visual slot), border → `var(--cb-border-strong)`. Scan button bg `#1a2332` → `var(--cb-bg-elevated)`, accent colors stay. Other buttons `#111` → `var(--cb-bg-elevated)`, `#333` → `var(--cb-border)`, `#aaa` → `var(--cb-text-secondary)`. View toggle active bg `#1a2332` → `var(--cb-bg-elevated)`.

**`TopologyView.tsx`** — `style={{ background: '#080c14' }}` → `var(--cb-canvas-bg)`. Background component `color="#1a1a2e"` → `color="var(--cb-canvas-grid)"` (note: ReactFlow Background `color` prop accepts CSS). MiniMap: `background: '#0d1320'` → `var(--cb-minimap-bg)`, `border: '1px solid #1e2d40'` → `var(--cb-minimap-border)`.

**`GraphView.tsx`** — same canvas/minimap changes as TopologyView.

**`ResourceNode.tsx`** — node `background: '#0d1117'` → `var(--cb-bg-panel)`. All AWS service colors stay hardcoded (TYPE_BORDER, STATUS_COLORS). VPC badge background computed from VPC color — stays hardcoded (it's AWS-semantic).

- [ ] **Step 1: Migrate CloudCanvas.tsx and ResourceNode.tsx**
- [ ] **Step 2: Migrate TopologyView.tsx and GraphView.tsx**

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.web.json 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/canvas/CloudCanvas.tsx src/renderer/components/canvas/TopologyView.tsx src/renderer/components/canvas/GraphView.tsx src/renderer/components/canvas/nodes/ResourceNode.tsx
git commit -m "refactor: migrate canvas components to CSS custom property tokens"
```

---

### Task 9: Form components

**Files (14 total):**
- Modify: `src/renderer/components/modals/VpcForm.tsx`
- Modify: `src/renderer/components/modals/Ec2Form.tsx`
- Modify: `src/renderer/components/modals/SgForm.tsx`
- Modify: `src/renderer/components/modals/S3Form.tsx`
- Modify: `src/renderer/components/modals/RdsForm.tsx`
- Modify: `src/renderer/components/modals/LambdaForm.tsx`
- Modify: `src/renderer/components/modals/AlbForm.tsx`
- Modify: `src/renderer/components/modals/VpcEditForm.tsx`
- Modify: `src/renderer/components/modals/Ec2EditForm.tsx`
- Modify: `src/renderer/components/modals/SgEditForm.tsx`
- Modify: `src/renderer/components/modals/RdsEditForm.tsx`
- Modify: `src/renderer/components/modals/S3EditForm.tsx`
- Modify: `src/renderer/components/modals/LambdaEditForm.tsx`
- Modify: `src/renderer/components/modals/AlbEditForm.tsx`

All forms share the same color pattern. Apply consistently:

**Input style** (the `inp` / `inputStyle` constant in each form):
```ts
// Before
background: '#060d14', border: '1px solid #30363d', color: '#eee'

// After
background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-primary)'
```

**Error border** (when validation fails):
```ts
// Before
border: `1px solid ${err ? '#ff5f57' : '#30363d'}`

// After
border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`
// Note: #ff5f57 stays — it's a status color
```

**Label style** (the `lbl` / `labelStyle` / `label` constant):
```ts
// Before
color: '#555'

// After
color: 'var(--cb-text-muted)'
```

**Checkbox label text** (`color: '#aaa'`):
```ts
color: 'var(--cb-text-secondary)'
```

**"No items found" text** (`color: '#555'`):
```ts
color: 'var(--cb-text-muted)'
```

**SgForm add-rule button** (`border: '1px solid #30363d'`, `color: '#aaa'`):
```ts
border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)'
```

**SgForm separator** (`color: '#555'`):
```ts
color: 'var(--cb-text-muted)'
```

- [ ] **Step 1: Migrate VpcForm.tsx, Ec2Form.tsx, SgForm.tsx, S3Form.tsx**
- [ ] **Step 2: Migrate RdsForm.tsx, LambdaForm.tsx, AlbForm.tsx**
- [ ] **Step 3: Migrate all 7 edit forms (VpcEditForm through AlbEditForm)**

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.web.json 2>&1 | head -20
```

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/modals/VpcForm.tsx src/renderer/components/modals/Ec2Form.tsx src/renderer/components/modals/SgForm.tsx src/renderer/components/modals/S3Form.tsx src/renderer/components/modals/RdsForm.tsx src/renderer/components/modals/LambdaForm.tsx src/renderer/components/modals/AlbForm.tsx src/renderer/components/modals/VpcEditForm.tsx src/renderer/components/modals/Ec2EditForm.tsx src/renderer/components/modals/SgEditForm.tsx src/renderer/components/modals/RdsEditForm.tsx src/renderer/components/modals/S3EditForm.tsx src/renderer/components/modals/LambdaEditForm.tsx src/renderer/components/modals/AlbEditForm.tsx
git commit -m "refactor: migrate all form components to CSS custom property tokens"
```

---

## Chunk 6: Final verification

### Task 10: Build check + dark theme bootstrap

**Goal:** Ensure the app boots into dark theme by default (no flash of unstyled content), all TypeScript is clean, and tests pass.

**Files:**
- Modify: `src/renderer/src/index.html` (if it exists) or `electron/main` entry — add data-theme="dark" to `<html>` tag so the correct theme is applied before JS loads

- [ ] **Step 1: Add default data-theme to HTML**

Check if there is an `index.html` at `src/renderer/index.html` or similar (electron-vite projects usually have one).

```bash
find . -name "index.html" | head -5
```

Open the file and add `data-theme="dark"` to the `<html>` tag:

```html
<html lang="en" data-theme="dark">
```

This prevents any flash of unstyled content before `loadSettings` fires.

- [ ] **Step 2: Full typecheck**

```bash
npx tsc --noEmit -p tsconfig.web.json 2>&1
npx tsc --noEmit -p tsconfig.node.json 2>&1
```

Expected: no errors in either

- [ ] **Step 3: Full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/renderer/index.html   # or wherever index.html lives
git commit -m "fix: set data-theme=dark on html element to prevent FOUC"
```

---

## Done

All tasks complete. Use `superpowers:finishing-a-development-branch` to create the PR.
