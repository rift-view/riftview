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
