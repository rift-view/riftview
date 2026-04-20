import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { KeyboardHelp } from '../KeyboardHelp'
import { useUIStore } from '../../store/ui'

beforeEach(() => {
  useUIStore.setState({ keyboardHelpOpen: true })
})

describe('KeyboardHelp rift shape', () => {
  it('renders modal-backdrop + .modal.modal--sm.kbd-help shell', () => {
    const { container } = render(<KeyboardHelp />)
    expect(container.querySelector('.modal-backdrop')).toBeTruthy()
    const dialog = container.querySelector('.modal.modal--sm.kbd-help')
    expect(dialog).toBeTruthy()
  })

  it('modal-head shows eyebrow KEYBOARD + .modal-title "Shortcuts"', () => {
    render(<KeyboardHelp />)
    const eyebrow = screen.getByText('KEYBOARD')
    expect(eyebrow).toHaveClass('eyebrow')
    const title = screen.getByText('Shortcuts')
    expect(title).toHaveClass('modal-title')
  })

  it('renders three .kbd-group sections with .label headers', () => {
    const { container } = render(<KeyboardHelp />)
    const groups = container.querySelectorAll('.kbd-group')
    expect(groups.length).toBeGreaterThanOrEqual(3)
    for (const g of Array.from(groups)) {
      expect(g.querySelector('.label')).toBeTruthy()
    }
  })

  it('renders .kbd chips inside .kbd-row instances', () => {
    const { container } = render(<KeyboardHelp />)
    const rows = container.querySelectorAll('.kbd-row')
    expect(rows.length).toBeGreaterThanOrEqual(5)
    const chips = container.querySelectorAll('.kbd')
    expect(chips.length).toBeGreaterThanOrEqual(5)
  })

  it('clicking the backdrop closes the help', () => {
    const { container } = render(<KeyboardHelp />)
    const backdrop = container.querySelector('.modal-backdrop') as HTMLElement
    fireEvent.click(backdrop)
    expect(useUIStore.getState().keyboardHelpOpen).toBe(false)
  })

  it('renders nothing when keyboardHelpOpen is false', () => {
    useUIStore.setState({ keyboardHelpOpen: false })
    const { container } = render(<KeyboardHelp />)
    expect(container.firstChild).toBeNull()
  })
})
