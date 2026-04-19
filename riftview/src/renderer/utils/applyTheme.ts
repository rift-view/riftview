import type { Theme } from '../types/cloud'

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}
