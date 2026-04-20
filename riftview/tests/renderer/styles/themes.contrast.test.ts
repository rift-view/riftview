/**
 * Light theme WCAG AA contrast audit.
 *
 * Validates text-on-background contrast ratios for each light theme against
 * WCAG AA threshold (≥ 4.5:1 for normal text, ≥ 3:1 for large text).
 *
 * Pairs tested per theme:
 *   - text-primary   on bg-app       (body text on app background)
 *   - text-primary   on bg-panel     (body text on panel background)
 *   - text-primary   on bg-elevated  (body text on elevated surface)
 *   - text-secondary on bg-panel     (secondary labels)
 *   - text-muted     on bg-panel     (muted labels — 3:1 large-text threshold)
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const CSS_PATH = path.join(__dirname, '../../../src/renderer/styles/themes.css')
const css = fs.readFileSync(CSS_PATH, 'utf-8')

function parseTheme(name: string): Record<string, string> {
  const re = new RegExp(`:root\\[data-theme="${name}"\\]\\s*\\{([^}]+)\\}`, 's')
  const body = css.match(re)?.[1] ?? ''
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--cb-[a-z-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim()
  }
  return out
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return [r, g, b]
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(hexToRgb(fg))
  const l2 = luminance(hexToRgb(bg))
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

const LIGHT_THEMES = [
  'light',
  'solarized-light',
  'github-light',
  'nord-light',
  'gruvbox-light'
] as const

describe('Light theme WCAG AA contrast audit', () => {
  for (const name of LIGHT_THEMES) {
    describe(`theme: ${name}`, () => {
      const t = parseTheme(name)

      it('text-primary on bg-app meets WCAG AA (≥ 4.5:1)', () => {
        const ratio = contrastRatio(t['--cb-text-primary'], t['--cb-bg-app'])
        expect(ratio, `ratio ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
      })

      it('text-primary on bg-panel meets WCAG AA (≥ 4.5:1)', () => {
        const ratio = contrastRatio(t['--cb-text-primary'], t['--cb-bg-panel'])
        expect(ratio, `ratio ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
      })

      it('text-primary on bg-elevated meets WCAG AA (≥ 4.5:1)', () => {
        const ratio = contrastRatio(t['--cb-text-primary'], t['--cb-bg-elevated'])
        expect(ratio, `ratio ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
      })

      it('text-secondary on bg-panel meets WCAG AA (≥ 4.5:1)', () => {
        const ratio = contrastRatio(t['--cb-text-secondary'], t['--cb-bg-panel'])
        expect(ratio, `ratio ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
      })

      it('text-muted on bg-panel meets WCAG AA-large (≥ 3:1)', () => {
        const ratio = contrastRatio(t['--cb-text-muted'], t['--cb-bg-panel'])
        expect(ratio, `ratio ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3)
      })

      it('accent on bg-panel is distinguishable (≥ 3:1)', () => {
        const ratio = contrastRatio(t['--cb-accent'], t['--cb-bg-panel'])
        expect(ratio, `ratio ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3)
      })
    })
  }
})
