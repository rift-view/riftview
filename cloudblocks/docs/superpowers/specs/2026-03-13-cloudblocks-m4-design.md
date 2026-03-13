# Cloudblocks M4 — Design Spec
**Date:** 2026-03-13
**Status:** Approved

## Overview

M4 adds a theme system: two built-in themes (retro dark and clean slate light), switchable from the Settings panel, with a file-based plugin hook for community themes in M5.

Every color in the UI chrome is replaced with a CSS custom property reference. AWS resource colors (EC2 orange, VPC blue, etc.) are semantic and stay hardcoded.

---

## Approach

CSS Custom Properties on `:root[data-theme]`. A single `themes.css` file defines two blocks of variables. Switching themes sets `document.documentElement.setAttribute('data-theme', value)` — no React re-renders required.

Plugin hook: on startup, check `userData/theme.json`. If present, inject a `<style>` tag overriding any tokens. No UI to manage files in M4 — that's M5.

---

## Token System

File: `src/renderer/styles/themes.css`

All tokens use the `--cb-` prefix to avoid conflicts.

### Dark theme (retro — current default)

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
```

### Light theme (clean slate)

```css
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

### Fixed (not tokens)

These are never replaced with tokens:
- macOS traffic light buttons: `#ff5f57`, `#febc2e`, `#28c840`
- AWS resource colors: EC2 `#FF9900`, VPC `#1976D2`, subnet green `#4CAF50`, RDS green, Lambda/S3 blue `#64b5f6`, ALB orange, SG purple `#9c27b0`, IGW green

---

## Types

Add to `src/renderer/types/cloud.ts`:
```ts
export type Theme = 'dark' | 'light'
```

Extend `Settings` in `src/renderer/types/cloud.ts`:
```ts
export interface Settings {
  deleteConfirmStyle: 'type-to-confirm' | 'command-drawer'
  scanInterval: 15 | 30 | 60 | 'manual'
  theme: Theme
}
```

Default: `theme: 'dark'`. Also update `DEFAULT_SETTINGS` in `src/renderer/store/cloud.ts` to include `theme: 'dark'`.

---

## Theme Application

New file: `src/renderer/utils/applyTheme.ts`

```ts
import type { Theme } from '../types/cloud'

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}
```

Called in two places:
1. **`loadSettings`** in `src/renderer/store/cloud.ts` — modify the action to call `applyTheme(s.theme)` between the `await window.cloudblocks.getSettings()` and `set({ settings: s })`. Do not call `applyTheme` from outside the store at startup.
2. **`SettingsPanel`** — after `await saveSettings(newSettings)` resolves, the component calls `applyTheme(newSettings.theme)`. The store action itself does NOT call `applyTheme` on save, only on load.

`themes.css` is imported once at the renderer entry point (`src/renderer/src/main.tsx`).

---

## Settings Panel

The "Theme" section (currently a greyed-out placeholder) activates as a two-button toggle:

```
Theme   [Dark]  [Light]
```

Active button has accent border/background. Selecting a new theme calls `saveSettings` then `applyTheme` immediately (no page reload).

---

## File-Based Plugin Stub

### IPC channel

Add to `src/main/ipc/channels.ts`:
```ts
THEME_OVERRIDES: 'theme:overrides'
```

### Main process handler (`src/main/ipc/handlers.ts`)

```ts
ipcMain.handle(IPC.THEME_OVERRIDES, async () => {
  const file = path.join(app.getPath('userData'), 'theme.json')
  try {
    const raw = await fs.readFile(file, 'utf-8')
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
})
```

### Preload (`src/preload/index.ts` + `index.d.ts`)

In `src/preload/index.ts`, add inside `contextBridge.exposeInMainWorld`:
```ts
getThemeOverrides: () => ipcRenderer.invoke(IPC.THEME_OVERRIDES)
```

In `src/preload/index.d.ts`, add to the `Window.cloudblocks` interface:
```ts
getThemeOverrides(): Promise<Record<string, string>>
```

### Renderer startup (`src/renderer/src/App.tsx`)

On mount (in the same `useEffect` that calls `loadSettings`), also call `getThemeOverrides()`. If result is non-empty, inject:

```ts
const el = document.getElementById('cb-theme-overrides') ?? document.createElement('style')
el.id = 'cb-theme-overrides'
el.textContent = `:root { ${Object.entries(overrides).map(([k, v]) => `${k}: ${v}`).join('; ')} }`
if (!el.parentElement) document.head.appendChild(el)
```

**Example `theme.json`** (community theme, M5 UI):
```json
{ "--cb-accent": "#7c3aed", "--cb-bg-app": "#1e1e2e", "--cb-bg-panel": "#181825" }
```

---

## Component Migration

Replace every hardcoded chrome color with `var(--cb-...)` in `style={{}}` props. Batched by component group:

### Shell
- `src/renderer/src/App.tsx` — `#080c14` → `var(--cb-bg-app)`
- `src/renderer/components/TitleBar.tsx`
- `src/renderer/components/Sidebar.tsx`
- `src/renderer/components/Inspector.tsx`
- `src/renderer/components/ErrorBanner.tsx`
- `src/renderer/components/Onboarding.tsx`

### Overlays
- `src/renderer/components/SettingsPanel.tsx`
- `src/renderer/components/CommandDrawer.tsx`
- `src/renderer/components/modals/CreateModal.tsx`
- `src/renderer/components/modals/EditModal.tsx`
- `src/renderer/components/modals/DeleteDialog.tsx`
- `src/renderer/components/canvas/NodeContextMenu.tsx`
- `src/renderer/components/canvas/CanvasContextMenu.tsx`

### Canvas
- `src/renderer/components/canvas/CloudCanvas.tsx`
- `src/renderer/components/canvas/TopologyView.tsx`
- `src/renderer/components/canvas/GraphView.tsx`
- `src/renderer/components/canvas/nodes/ResourceNode.tsx` — node background `#0d1117` → `var(--cb-bg-panel)`

### Forms
All create forms (VpcForm, Ec2Form, SgForm, S3Form, RdsForm, LambdaForm, AlbForm) and all edit forms (VpcEditForm, Ec2EditForm, SgEditForm, RdsEditForm, S3EditForm, LambdaEditForm, AlbEditForm) — input borders, labels, select backgrounds, error states.

---

## Out of Scope

- Theme marketplace or UI to install/remove theme files (M5)
- Per-resource-type color customization
- System dark/light mode auto-detection (`prefers-color-scheme`) — intentionally not implemented; the user's explicit preference in Settings takes precedence
- Animated theme transitions
