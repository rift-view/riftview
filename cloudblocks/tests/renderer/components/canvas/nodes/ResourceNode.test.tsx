import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResourceNode } from '../../../../../src/renderer/components/canvas/nodes/ResourceNode'
import type { NodeProps } from '@xyflow/react'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}))

const props = {
  id: 'i-001',
  data: { label: 'web-server', nodeType: 'ec2', status: 'running' },
  selected: false,
} as unknown as NodeProps

describe('ResourceNode', () => {
  it('renders the label', () => {
    render(<ResourceNode {...props} />)
    expect(screen.getByText('web-server')).toBeInTheDocument()
  })

  it('renders a green status dot for running status', () => {
    render(<ResourceNode {...props} />)
    const dot = document.querySelector('[data-status="running"]')
    expect(dot).toBeInTheDocument()
  })

  it('applies selected styling when selected', () => {
    render(<ResourceNode {...{ ...props, selected: true }} />)
    const node = document.querySelector('[data-selected="true"]')
    expect(node).toBeInTheDocument()
  })
})
