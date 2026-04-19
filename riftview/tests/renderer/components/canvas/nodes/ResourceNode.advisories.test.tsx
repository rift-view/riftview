import { render } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ResourceNode } from '../../../../../src/renderer/components/canvas/nodes/ResourceNode'
import { useUIStore } from '../../../../../src/renderer/store/ui'
import type { NodeProps } from '@xyflow/react'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' }
}))

vi.mock('../../../../../src/renderer/components/canvas/nodes/ActionRail', () => ({
  ActionRail: () => null
}))

function makeProps(nodeType = 'ec2', metadata: Record<string, unknown> = {}): NodeProps {
  return {
    id: 'test-node',
    type: 'resource',
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    data: {
      label: 'test',
      nodeType,
      status: 'running',
      region: 'us-east-1',
      metadata
    }
  } as unknown as NodeProps
}

describe('ResourceNode advisory badge', () => {
  beforeEach(() => {
    useUIStore.setState({ pluginNodeTypes: {} } as Parameters<typeof useUIStore.setState>[0])
  })

  it('shows critical badge when ec2 has public SSH', () => {
    render(<ResourceNode {...makeProps('ec2', { hasPublicSsh: true })} />)
    const badge = document.querySelector('[title*="critical"]')
    expect(badge).not.toBeNull()
  })

  it('shows no badge when no advisories', () => {
    render(<ResourceNode {...makeProps('ec2', {})} />)
    expect(document.querySelector('[title*="critical"]')).toBeNull()
    expect(document.querySelector('[title*="warning"]')).toBeNull()
  })

  it('always-on: advisory badge visible without flag (OP_INTELLIGENCE always-on)', () => {
    render(<ResourceNode {...makeProps('ec2', { hasPublicSsh: true })} />)
    expect(document.querySelector('[title*="critical"]')).not.toBeNull()
  })
})
