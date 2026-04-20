import { describe, test, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const STYLES = join(__dirname, '..')

function css(file: string): string {
  return readFileSync(join(STYLES, file), 'utf8')
}

describe('R1 foundation: tokens.css', () => {
  test('exports warm-ink palette', () => {
    const s = css('tokens.css')
    expect(s).toContain('--ink-1000')
    expect(s).toContain('--ink-950')
    expect(s).toContain('--ink-900')
    expect(s).toContain('--ink-700')
  })
  test('exports bone palette', () => {
    const s = css('tokens.css')
    expect(s).toContain('--bone-50')
    expect(s).toContain('--bone-100')
    expect(s).toContain('--bone-400')
  })
  test('exports ember accent', () => {
    const s = css('tokens.css')
    expect(s).toContain('--ember-500')
    expect(s).toContain('--ember-glow')
  })
  test('exports semantic aliases', () => {
    const s = css('tokens.css')
    expect(s).toMatch(/--bg:\s*var\(--ink-950\)/)
    expect(s).toMatch(/--fg:\s*var\(--bone-100\)/)
    expect(s).toMatch(/--accent:\s*var\(--ember-500\)/)
  })
  test('exports typography tokens', () => {
    const s = css('tokens.css')
    expect(s).toContain('--font-display')
    expect(s).toContain('--font-body')
    expect(s).toContain('--font-mono')
    expect(s).toContain('Archivo Narrow')
    expect(s).toContain('Libre Franklin')
    expect(s).toContain('Fragment Mono')
  })
  test('exports canvas aliases', () => {
    const s = css('tokens.css')
    expect(s).toContain('--canvas-bg')
    expect(s).toContain('--canvas-grid-dot')
    expect(s).toContain('--container-vpc-stroke')
    expect(s).toContain('--edge-flow')
  })
})

describe('R1 foundation: motion.css', () => {
  test('defines named keyframes', () => {
    const s = css('motion.css')
    expect(s).toContain('@keyframes rift-pulse')
    expect(s).toContain('@keyframes rift-shimmer')
    expect(s).toContain('@keyframes rift-error-pulse')
    expect(s).toContain('@keyframes rift-fade-in-up')
    expect(s).toContain('@keyframes rift-hairline-sweep')
  })
  test('respects prefers-reduced-motion', () => {
    const s = css('motion.css')
    expect(s).toContain('@media (prefers-reduced-motion: reduce)')
  })
})

describe('R1 foundation: primitives.css', () => {
  test('defines core classes', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.eyebrow\s*\{/)
    expect(s).toMatch(/\.label\s*\{/)
    expect(s).toMatch(/\.pill\s*\{/)
    expect(s).toMatch(/\.hairline\s*\{/)
    expect(s).toMatch(/\.panel\s*\{/)
    expect(s).toMatch(/\.term\s*\{/)
    expect(s).toMatch(/\.diff\s*\{/)
    expect(s).toMatch(/\.advisory-card\s*\{/)
    expect(s).toMatch(/\.register\s*\{/)
    expect(s).toMatch(/\.rift-seam\s*\{/)
  })
  test('defines button variants', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.btn\s*\{/)
    expect(s).toMatch(/\.btn-primary\s*\{/)
    expect(s).toMatch(/\.btn-ghost\s*\{/)
    expect(s).toMatch(/\.btn-link\s*\{/)
    expect(s).toMatch(/\.btn-sm\s*\{/)
  })
})

describe('R1 foundation: wired into main.tsx', () => {
  test('main.tsx imports the new style files', () => {
    const main = readFileSync(join(__dirname, '..', '..', 'src', 'main.tsx'), 'utf8')
    expect(main).toContain("'../styles/tokens.css'")
    expect(main).toContain("'../styles/motion.css'")
    expect(main).toContain("'../styles/primitives.css'")
    expect(main).toContain('@fontsource')
  })
  test('logo asset present', () => {
    expect(existsSync(join(__dirname, '..', '..', 'assets', 'riftview-logo.jpg'))).toBe(true)
  })
})

describe('R3 foundation: canvas primitives', () => {
  test('defines rift-node pattern', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.rift-node\s*\{/)
    expect(s).toMatch(/\.rift-node-eye\s*\{/)
    expect(s).toMatch(/\.rift-node-title\s*\{/)
    expect(s).toMatch(/\.rift-node-rule\s*\{/)
    expect(s).toMatch(/\.rift-node-meta\s*\{/)
  })
  test('defines status dot variants', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.dot\.-ok/)
    expect(s).toMatch(/\.dot\.-warn/)
    expect(s).toMatch(/\.dot\.-err/)
    expect(s).toMatch(/\.dot\.-pending/)
    expect(s).toMatch(/\.dot\.-neutral/)
  })
  test('defines containers', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.rift-vpc\s*\{/)
    expect(s).toMatch(/\.rift-subnet\s*\{/)
    expect(s).toMatch(/\.rift-zone\s*\{/)
    expect(s).toMatch(/\.rift-container-label\s*\{/)
  })
  test('defines advisory badge + canvas bg + sweep + action rail', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.advisory-badge\s*\{/)
    expect(s).toMatch(/\.rift-canvas-bg\s*\{/)
    expect(s).toMatch(/\.rift-sweep\s*\{/)
    expect(s).toMatch(/\.action-rail\s*\{/)
  })
})

describe('R4 foundation: inspector primitives', () => {
  test('defines inspector header + title', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.insp-header\s*\{/)
    expect(s).toMatch(/\.insp-title\s*\{/)
  })
  test('defines inspector section + label + rows', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.insp-section\s*\{/)
    expect(s).toMatch(/\.insp-label\s*\{/)
    expect(s).toMatch(/\.insp-rows\s*\{/)
    expect(s).toMatch(/\.insp-row\s*\{/)
    expect(s).toMatch(/\.insp-row \.k\s*\{/)
    expect(s).toMatch(/\.insp-row \.v\s*\{/)
  })
  test('defines inspector metric tiles', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.insp-metrics\s*\{/)
    expect(s).toMatch(/\.insp-metric\s*\{/)
  })
  test('defines critical advisory variant', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.advisory-card--critical\s*\{/)
  })
})

describe('R6 foundation: modal + form primitives', () => {
  test('defines modal shell classes', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.modal-backdrop\s*\{/)
    expect(s).toMatch(/\.modal\s*\{/)
    expect(s).toMatch(/\.modal-head\s*\{/)
    expect(s).toMatch(/\.modal-body\s*\{/)
    expect(s).toMatch(/\.modal-foot\s*\{/)
    expect(s).toMatch(/\.modal-title\s*\{/)
    expect(s).toMatch(/\.modal-close\s*\{/)
  })
  test('defines modal size variants', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.modal--sm\s*\{/)
    expect(s).toMatch(/\.modal--md\s*\{/)
    expect(s).toMatch(/\.modal--lg\s*\{/)
  })
  test('defines form field + input + helper + error', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.form-field\s*\{/)
    expect(s).toMatch(/\.form-input/)
    expect(s).toMatch(/\.form-select/)
    expect(s).toMatch(/\.form-textarea/)
    expect(s).toMatch(/\.form-helper\s*\{/)
    expect(s).toMatch(/\.form-error\s*\{/)
  })
  test('defines invalid state + form-grid-2 + form-checkbox', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.form-field\.-invalid/)
    expect(s).toMatch(/\.form-grid-2\s*\{/)
    expect(s).toMatch(/\.form-checkbox\s*\{/)
  })
})

describe('R7 foundation: empty-state + keyboard-help + toast primitives', () => {
  test('defines empty-state shell + card + title + body', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.empty-state\s*\{/)
    expect(s).toMatch(/\.empty-state-card\s*\{/)
    expect(s).toMatch(/\.empty-state-title\s*\{/)
    expect(s).toMatch(/\.empty-state-body\s*\{/)
  })
  test('empty-state-title uses display font + bone-50', () => {
    const s = css('primitives.css')
    const block = s.match(/\.empty-state-title\s*\{[^}]*\}/)?.[0] ?? ''
    expect(block).toMatch(/font-family:\s*var\(--font-display\)/)
    expect(block).toMatch(/color:\s*var\(--bone-50\)/)
  })
  test('defines kbd chip + kbd-help shell + group/rows/row', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.kbd\s*\{/)
    expect(s).toMatch(/\.modal\.kbd-help\s*\{/)
    expect(s).toMatch(/\.kbd-group\s*\{/)
    expect(s).toMatch(/\.kbd-rows\s*\{/)
    expect(s).toMatch(/\.kbd-row\s*\{/)
  })
  test('kbd chip uses mono + ink-900 background + ink-700 border', () => {
    const s = css('primitives.css')
    const block = s.match(/\.kbd\s*\{[^}]*\}/)?.[0] ?? ''
    expect(block).toMatch(/font-family:\s*var\(--font-mono\)/)
    expect(block).toMatch(/background:\s*var\(--ink-900\)/)
    expect(block).toMatch(/border:\s*1px solid var\(--ink-700\)/)
  })
  test('defines rift-toast base + success + error variants', () => {
    const s = css('primitives.css')
    expect(s).toMatch(/\.rift-toast\s*\{/)
    expect(s).toMatch(/\.rift-toast--success\s*\{/)
    expect(s).toMatch(/\.rift-toast--error\s*\{/)
  })
  test('rift-toast binds rift-fade-in-up + alert-card grammar', () => {
    const s = css('primitives.css')
    const block = s.match(/\.rift-toast\s*\{[^}]*\}/)?.[0] ?? ''
    expect(block).toMatch(/animation:\s*rift-fade-in-up/)
    expect(block).toMatch(/border-left:/)
    expect(block).toMatch(/background:\s*var\(--bg-elev-1\)/)
  })
  test('toast variants set border-left-color to semantic tokens', () => {
    const s = css('primitives.css')
    const ok = s.match(/\.rift-toast--success\s*\{[^}]*\}/)?.[0] ?? ''
    const err = s.match(/\.rift-toast--error\s*\{[^}]*\}/)?.[0] ?? ''
    expect(ok).toMatch(/border-left-color:\s*var\(--moss-500\)/)
    expect(err).toMatch(/border-left-color:\s*var\(--fault-500\)/)
  })
})
