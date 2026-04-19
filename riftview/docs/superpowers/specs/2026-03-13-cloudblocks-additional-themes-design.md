# Cloudblocks — Additional Themes Design Spec
**Date:** 2026-03-13
**Status:** Approved

## Overview

Add three new built-in themes — Solarized Dark, Rosé Pine, and Catppuccin Mocha — and replace the two-button Dark/Light toggle in the Settings panel with a named swatch list that scales to all five themes.

---

## New Themes

### Solarized Dark

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
```

### Rosé Pine

```css
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
```

### Catppuccin Mocha

```css
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

---

## Type Change

Extend `Theme` in `src/renderer/types/cloud.ts`:

```ts
export type Theme = 'dark' | 'light' | 'solarized' | 'rose-pine' | 'catppuccin'
```

No changes needed to `DEFAULT_SETTINGS` (default stays `'dark'`).

---

## Settings Panel UI

Replace the current two-button row (`Dark` / `Light`) with a vertical named swatch list. Each row: `[10px color dot] [theme name]`. Active row highlighted with accent border and subtle background tint.

A static map in `SettingsPanel.tsx` provides the label and accent dot color per theme:

```ts
const THEME_META: Record<Theme, { label: string; accent: string }> = {
  dark:        { label: 'Dark',             accent: '#FF9900' },
  light:       { label: 'Light',            accent: '#e07800' },
  solarized:   { label: 'Solarized Dark',   accent: '#2aa198' },
  'rose-pine': { label: 'Rosé Pine',        accent: '#eb6f92' },
  catppuccin:  { label: 'Catppuccin Mocha', accent: '#fab387' },
}
```

The list renders using `Object.entries(THEME_META)`. Clicking a row calls `setLocal(f => ({ ...f, theme: t }))` — same pattern as the current buttons. Save + `applyTheme` flow unchanged.

Row style (active):
```ts
border: `1px solid ${accent}`,
background: `${accent}10`,
color: accent,
```

Row style (inactive):
```ts
border: '1px solid var(--cb-border)',
background: 'transparent',
color: 'var(--cb-text-secondary)',
```

### Dropdown fallback

If the theme list grows beyond ~6 entries in a future milestone, switch the swatch list to a `<select>` dropdown matching the existing settings select style. Not implemented now — YAGNI.

---

## Scope

**In scope:**
- `src/renderer/styles/themes.css` — 3 new token blocks
- `src/renderer/types/cloud.ts` — extend `Theme` union
- `src/renderer/components/SettingsPanel.tsx` — replace button toggle with swatch list

**Out of scope:**
- AWS resource color changes (EC2 orange, VPC blue, etc. stay hardcoded)
- Any new IPC channels or store fields
- Animated theme transitions
- `theme.json` community override changes

---

## Files Changed

| File | Change |
|------|--------|
| `src/renderer/styles/themes.css` | Add 3 token blocks |
| `src/renderer/types/cloud.ts` | Extend `Theme` type |
| `src/renderer/components/SettingsPanel.tsx` | Replace toggle with swatch list |
