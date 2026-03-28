import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IntegrationLegend from '../../../../src/renderer/components/canvas/IntegrationLegend'

describe('IntegrationLegend', () => {
  it('renders labels for all three edge types', () => {
    render(<IntegrationLegend />)
    expect(screen.getByText('triggers')).toBeTruthy()
    expect(screen.getByText('subscribes to')).toBeTruthy()
    expect(screen.getByText('serves')).toBeTruthy()
  })

  it('renders a colored swatch for each edge type', () => {
    const { container } = render(<IntegrationLegend />)
    // Each row has a swatch span with borderRadius '50%'
    const swatches = Array.from(container.querySelectorAll('span')).filter(
      (el) => (el as HTMLElement).style.borderRadius === '50%'
    )
    expect(swatches).toHaveLength(3)
  })

  it('renders the title "Integration Edges"', () => {
    render(<IntegrationLegend />)
    expect(screen.getByText('Integration Edges')).toBeTruthy()
  })

  it('renders the dismiss button', () => {
    render(<IntegrationLegend />)
    const btn = screen.getByTitle('Dismiss')
    expect(btn).toBeTruthy()
  })

  it('hides the legend when the dismiss button is clicked', () => {
    const { container } = render(<IntegrationLegend />)
    expect(container.firstChild).not.toBeNull()

    fireEvent.click(screen.getByTitle('Dismiss'))

    expect(container.firstChild).toBeNull()
  })
})
