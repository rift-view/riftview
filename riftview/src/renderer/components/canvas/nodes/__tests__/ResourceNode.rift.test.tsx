import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ResourceNode } from '../ResourceNode'
import { useUIStore } from '../../../../store/ui'
import type { NodeProps } from '@xyflow/react'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' }
}))

vi.mock('../ActionRail', () => ({
  ActionRail: () => null
}))

function makeProps(
  overrides: {
    nodeType?: string
    status?: string
    label?: string
    selected?: boolean
    metadata?: Record<string, unknown>
  } = {}
): NodeProps {
  return {
    id: 'test-id',
    type: 'resource',
    selected: overrides.selected ?? false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    data: {
      label: overrides.label ?? 'web-server',
      nodeType: overrides.nodeType ?? 'ec2',
      status: overrides.status ?? 'running',
      region: 'us-east-1',
      metadata: overrides.metadata ?? {}
    }
  } as unknown as NodeProps
}

beforeEach(() => {
  useUIStore.setState({ pluginNodeTypes: {} } as Parameters<typeof useUIStore.setState>[0])
})

describe('ResourceNode (Rift editorial pattern)', () => {
  it('renders with the rift-node root class', () => {
    const { container } = render(<ResourceNode {...makeProps()} />)
    const root = container.querySelector('.rift-node')
    expect(root).not.toBeNull()
    expect(root?.getAttribute('data-node-type')).toBe('ec2')
  })

  it('renders rift-node-eye with the correct TYPE_LABEL for the node type', () => {
    const { container } = render(<ResourceNode {...makeProps({ nodeType: 'lambda' })} />)
    const eye = container.querySelector('.rift-node-eye')
    expect(eye).not.toBeNull()
    expect(eye?.textContent).toContain('λ')
  })

  it('renders rift-node-title with the node label', () => {
    const { container } = render(<ResourceNode {...makeProps({ label: 'prod-api' })} />)
    const title = container.querySelector('.rift-node-title')
    expect(title).not.toBeNull()
    expect(title?.textContent).toBe('prod-api')
  })

  it('applies rift-node--focused when React Flow selected prop is true', () => {
    const { container } = render(<ResourceNode {...makeProps({ selected: true })} />)
    expect(container.querySelector('.rift-node--focused')).not.toBeNull()
  })

  it('does not apply rift-node--focused when selected is false', () => {
    const { container } = render(<ResourceNode {...makeProps({ selected: false })} />)
    expect(container.querySelector('.rift-node--focused')).toBeNull()
  })

  it('renders advisory-badge when the node has advisories', () => {
    const { container } = render(
      <ResourceNode {...makeProps({ nodeType: 'ec2', metadata: { hasPublicSsh: true } })} />
    )
    expect(container.querySelector('.advisory-badge')).not.toBeNull()
  })

  it('does not render advisory-badge when the node has no advisories', () => {
    const { container } = render(<ResourceNode {...makeProps({ nodeType: 'ec2', metadata: {} })} />)
    expect(container.querySelector('.advisory-badge')).toBeNull()
  })

  it('applies dot.-ok for running status', () => {
    const { container } = render(<ResourceNode {...makeProps({ status: 'running' })} />)
    const dot = container.querySelector('.rift-node-meta .dot')
    expect(dot).not.toBeNull()
    expect(dot?.classList.contains('-ok')).toBe(true)
  })

  it('applies dot.-err for error status (and rift-node--error root class)', () => {
    const { container } = render(<ResourceNode {...makeProps({ status: 'error' })} />)
    const dot = container.querySelector('.rift-node-meta .dot')
    expect(dot?.classList.contains('-err')).toBe(true)
    expect(container.querySelector('.rift-node--error')).not.toBeNull()
  })

  it('applies dot.-pending and rift-node--pending for pending status', () => {
    const { container } = render(<ResourceNode {...makeProps({ status: 'pending' })} />)
    const dot = container.querySelector('.rift-node-meta .dot')
    expect(dot?.classList.contains('-pending')).toBe(true)
    expect(container.querySelector('.rift-node--pending')).not.toBeNull()
  })
})
