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

  it('renders an SVG line preview for each edge type', () => {
    const { container } = render(<IntegrationLegend />)
    // Each row now has an SVG line element instead of a dot swatch
    const lines = container.querySelectorAll('svg line')
    expect(lines).toHaveLength(3)
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
