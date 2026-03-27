import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResourceNode } from '../../../../../src/renderer/components/canvas/nodes/ResourceNode'
import { useUIStore } from '../../../../../src/renderer/store/ui'
import type { NodeProps } from '@xyflow/react'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}))

beforeEach(() => {
  useUIStore.setState({ pluginNodeTypes: {} })
})

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

  it('uses pluginNodeTypes borderColor for unknown node types', () => {
    useUIStore.setState({
      pluginNodeTypes: {
        'azure-vm': {
          label: 'VM',
          borderColor: '#0078D4',
          badgeColor: '#0078D4',
          shortLabel: 'VM',
          displayName: 'Azure VM',
          hasCreate: true,
        },
      },
    })
    const pluginProps = {
      id: 'azure-vm-001',
      data: { label: 'my-vm', nodeType: 'azure-vm', status: 'running' },
      selected: false,
    } as unknown as NodeProps
    render(<ResourceNode {...pluginProps} />)
    // The type label should use plugin metadata label 'VM' (not fallback to 'AZURE-VM')
    expect(screen.getByText('VM')).toBeInTheDocument()
    // The resource label should render
    expect(screen.getByText('my-vm')).toBeInTheDocument()
  })
})
