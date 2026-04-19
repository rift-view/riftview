# Additional Themes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Solarized Dark, Rosé Pine, and Catppuccin Mocha themes and replace the two-button Dark/Light toggle in Settings with a named swatch list.

**Architecture:** Three new CSS custom property blocks added to `themes.css`. `Theme` type extended to include three new values. `SettingsPanel` toggle replaced with a vertical swatch list driven by a `THEME_META` map. No new files, no IPC changes, no store changes.

**Tech Stack:** CSS Custom Properties, TypeScript, React 18, Vitest

---

## File Map

| Status | Path | Change |
|--------|------|--------|
| Modify | `src/renderer/styles/themes.css` | Add 3 new token blocks |
| Modify | `src/renderer/types/cloud.ts` | Extend `Theme` union |
| Modify | `src/renderer/components/SettingsPanel.tsx` | Replace toggle with swatch list |

---

## Chunk 1: Tokens + types

### Task 1: Add theme token blocks to themes.css

**Files:**
- Modify: `src/renderer/styles/themes.css`

- [ ] **Step 1: Read the current file**

Read `src/renderer/styles/themes.css` to see the existing two blocks.

- [ ] **Step 2: Append the three new blocks**

Append to the end of `src/renderer/styles/themes.css`:

```css
:root[data-theme="solarized"] {
  --cb-bg-app:         #002b36;
  --cb-bg-panel:       #073642;
  --cb-bg-elevated:    #0d3742;
  --cb-bg-hover:       #134652;
  --cb-border:         #2a4a55;
  --cb-border-strong:  #1d3d48;
  --cb-text-primary:   #839496;
  --cb-text-secondary: #657b83;
  --cb-text-muted:     #586e75;
  --cb-accent:         #2aa198;
  --cb-accent-subtle:  rgba(42, 161, 152, 0.1);
  --cb-canvas-bg:      #002b36;
  --cb-canvas-grid:    #073642;
  --cb-minimap-bg:     #011e27;
  --cb-minimap-border: #1d3d48;
}

:root[data-theme="rose-pine"] {
  --cb-bg-app:         #191724;
  --cb-bg-panel:       #1f1d2e;
  --cb-bg-elevated:    #26233a;
  --cb-bg-hover:       #2d2a3e;
  --cb-border:         #393552;
  --cb-border-strong:  #2d2a3e;
  --cb-text-primary:   #e0def4;
  --cb-text-secondary: #908caa;
  --cb-text-muted:     #6e6a86;
  --cb-accent:         #eb6f92;
  --cb-accent-subtle:  rgba(235, 111, 146, 0.1);
  --cb-canvas-bg:      #191724;
  --cb-canvas-grid:    #26233a;
  --cb-minimap-bg:     #120f1d;
  --cb-minimap-border: #2d2a3e;
}

:root[data-theme="catppuccin"] {
  --cb-bg-app:         #1e1e2e;
  --cb-bg-panel:       #181825;
  --cb-bg-elevated:    #313244;
  --cb-bg-hover:       #363653;
  --cb-border:         #45475a;
  --cb-border-strong:  #363653;
  --cb-text-primary:   #cdd6f4;
  --cb-text-secondary: #a6adc8;
  --cb-text-muted:     #7f849c;
  --cb-accent:         #fab387;
  --cb-accent-subtle:  rgba(250, 179, 135, 0.1);
  --cb-canvas-bg:      #1e1e2e;
  --cb-canvas-grid:    #2a2b3d;
  --cb-minimap-bg:     #181825;
  --cb-minimap-border: #313244;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/styles/themes.css
git commit -m "feat: add Solarized Dark, Rosé Pine, Catppuccin Mocha token blocks"
```

---

### Task 2: Extend Theme type

**Files:**
- Modify: `src/renderer/types/cloud.ts`
- Modify: `src/renderer/store/__tests__/cloud.test.ts` (add test)

- [ ] **Step 1: Write failing test**

Read `src/renderer/store/__tests__/cloud.test.ts`. Find the `theme defaults` describe block added in M4. Add a new test to it:

```ts
it('Theme type includes all five values', () => {
  const themes: Theme[] = ['dark', 'light', 'solarized', 'rose-pine', 'catppuccin']
  themes.forEach(t => {
    const store = createCloudStore()
    store.setState(s => ({ settings: { ...s.settings, theme: t } }))
    expect(store.getState().settings.theme).toBe(t)
  })
})
```

Make sure `Theme` is imported at the top of `src/renderer/store/__tests__/cloud.test.ts`. If it isn't already, add:
```ts
import type { Theme } from '../../types/cloud'
```
(Two levels up from `src/renderer/store/__tests__/` to reach `src/renderer/types/cloud`.)

- [ ] **Step 2: Run test to verify it fails**

```bash
./node_modules/.bin/vitest run tests/renderer/store/cloud.test.ts 2>&1 | tail -15
```

Expected: TypeScript error — `'solarized'` not assignable to `Theme`

- [ ] **Step 3: Extend the Theme type**

Read `src/renderer/types/cloud.ts`. Find:

```ts
export type Theme = 'dark' | 'light'
```

Replace with:

```ts
export type Theme = 'dark' | 'light' | 'solarized' | 'rose-pine' | 'catppuccin'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
./node_modules/.bin/vitest run tests/renderer/store/cloud.test.ts 2>&1 | tail -10
```

Expected: PASS — all tests in that file pass

- [ ] **Step 5: Run full suite to catch any exhaustiveness errors**

```bash
./node_modules/.bin/vitest run 2>&1 | tail -8
```

Expected: all 135+ tests pass (TypeScript exhaustiveness checks in any switch statements will surface here if missed)

- [ ] **Step 6: Commit**

```bash
git add src/renderer/types/cloud.ts src/renderer/store/__tests__/cloud.test.ts
git commit -m "feat: extend Theme type with solarized, rose-pine, catppuccin"
```

Edit `src/renderer/store/__tests__/cloud.test.ts` — that is the file with the `theme defaults` describe block from M4.

---

## Chunk 2: Settings panel swatch UI

### Task 3: Replace theme toggle with named swatch list

**Files:**
- Modify: `src/renderer/components/SettingsPanel.tsx`

- [ ] **Step 1: Read the file**

Read `src/renderer/components/SettingsPanel.tsx` in full. The theme section currently looks like:

```tsx
{/* Theme */}
<div style={{ marginBottom: 16 }}>
  <div style={{ fontSize: 9, color: 'var(--cb-text-muted)', ... }}>
    Theme
  </div>
  <div style={{ display: 'flex', gap: 6 }}>
    {(['dark', 'light'] as const).map((t) => (
      <button
        key={t}
        onClick={() => setLocal((f) => ({ ...f, theme: t }))}
        style={{ ... }}
      >
        {t}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Replace the theme section**

Replace the entire `{/* Theme */}` block with the swatch list below. The `THEME_META` constant goes at the top of the component function body (before the return), right after the existing `const label` and `const selectStyle` constants.

Add `THEME_META` constant (place before the return statement):

```ts
const THEME_META: Record<Theme, { label: string; accent: string }> = {
  dark:          { label: 'Dark',             accent: '#FF9900' },
  light:         { label: 'Light',            accent: '#e07800' },
  solarized:     { label: 'Solarized Dark',   accent: '#2aa198' },
  'rose-pine':   { label: 'Rosé Pine',        accent: '#eb6f92' },
  catppuccin:    { label: 'Catppuccin Mocha', accent: '#fab387' },
}
```

`Theme` is already imported via `Settings` from the store. If it isn't imported directly, add it:
```ts
import type { Theme } from '../types/cloud'
```

Replace the `{/* Theme */}` JSX block with:

```tsx
{/* Theme */}
<div style={{ marginBottom: 16 }}>
  <div style={{ fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
    Theme
  </div>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {(Object.entries(THEME_META) as [Theme, { label: string; accent: string }][]).map(([t, { label, accent }]) => (
      <button
        key={t}
        onClick={() => setLocal((f) => ({ ...f, theme: t }))}
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           8,
          padding:       '4px 10px',
          borderRadius:  3,
          border:        `1px solid ${local.theme === t ? accent : 'var(--cb-border)'}`,
          background:    local.theme === t ? 'var(--cb-accent-subtle)' : 'transparent',
          color:         local.theme === t ? accent : 'var(--cb-text-secondary)',
          fontFamily:    'monospace',
          fontSize:      10,
          cursor:        'pointer',
          textAlign:     'left',
        }}
      >
        <span style={{
          width:        10,
          height:       10,
          borderRadius: '50%',
          background:   accent,
          flexShrink:   0,
          display:      'inline-block',
        }} />
        {label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Typecheck**

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.web.json 2>&1 | grep "error TS" | grep -v TS6307 | head -20
```

Expected: no real errors

- [ ] **Step 4: Run full test suite**

```bash
./node_modules/.bin/vitest run 2>&1 | tail -8
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/SettingsPanel.tsx
git commit -m "feat: replace theme toggle with named swatch list (5 themes)"
```

---

## Done

All tasks complete. Use `superpowers:finishing-a-development-branch` to merge.
