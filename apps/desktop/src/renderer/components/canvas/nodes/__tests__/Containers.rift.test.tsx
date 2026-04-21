import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { NodeProps } from '@xyflow/react'
import { VpcNode } from '../VpcNode'
import { SubnetNode } from '../SubnetNode'
import { GlobalZoneNode } from '../GlobalZoneNode'
import { RegionZoneNode } from '../RegionZoneNode'
import { ResourceGroupNode } from '../ResourceGroupNode'
import { useUIStore } from '../../../../store/ui'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  NodeResizer: () => null
}))

function makeProps(data: Record<string, unknown>, overrides: Partial<NodeProps> = {}): NodeProps {
  return {
    id: overrides.id ?? 'test-id',
    type: overrides.type ?? 'container',
    selected: overrides.selected ?? false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    data
  } as unknown as NodeProps
}

beforeEach(() => {
  useUIStore.setState({
    pluginNodeTypes: {},
    expandedGroups: new Set<string>()
  } as Parameters<typeof useUIStore.setState>[0])
})

describe('VpcNode (Rift container)', () => {
  it('renders with the rift-vpc root class', () => {
    const { container } = render(
      <VpcNode {...makeProps({ label: 'vpc-0abc', cidr: '10.0.0.0/16' })} />
    )
    expect(container.querySelector('.rift-vpc')).not.toBeNull()
  })

  it('renders rift-container-label with the VPC label and CIDR', () => {
    const { container } = render(
      <VpcNode {...makeProps({ label: 'vpc-0abc', cidr: '10.0.0.0/16' })} />
    )
    const label = container.querySelector('.rift-container-label')
    expect(label).not.toBeNull()
    expect(label?.textContent).toContain('VPC')
    expect(label?.textContent).toContain('vpc-0abc')
    expect(label?.textContent).toContain('10.0.0.0/16')
  })
})

describe('SubnetNode (Rift container)', () => {
  it('renders with the rift-subnet root class', () => {
    const { container } = render(
      <SubnetNode {...makeProps({ label: 'subnet-1a', isPublic: true, az: 'us-east-1a' })} />
    )
    expect(container.querySelector('.rift-subnet')).not.toBeNull()
  })

  it('renders rift-container-label with the Public/Private tag and AZ', () => {
    const { container: pub } = render(
      <SubnetNode {...makeProps({ label: 'subnet-1a', isPublic: true, az: 'us-east-1a' })} />
    )
    const pubLabel = pub.querySelector('.rift-container-label')
    expect(pubLabel?.textContent).toContain('Public')
    expect(pubLabel?.textContent).toContain('us-east-1a')

    const { container: priv } = render(
      <SubnetNode {...makeProps({ label: 'subnet-1b', isPublic: false, az: 'us-east-1b' })} />
    )
    const privLabel = priv.querySelector('.rift-container-label')
    expect(privLabel?.textContent).toContain('Private')
  })
})

describe('GlobalZoneNode (Rift container)', () => {
  it('renders with the rift-zone root class', () => {
    const { container } = render(<GlobalZoneNode {...makeProps({})} />)
    expect(container.querySelector('.rift-zone')).not.toBeNull()
  })

  it('renders rift-container-label with a Global label', () => {
    const { container } = render(<GlobalZoneNode {...makeProps({})} />)
    const label = container.querySelector('.rift-container-label')
    expect(label).not.toBeNull()
    expect(label?.textContent).toContain('Global')
  })
})

describe('RegionZoneNode (Rift container)', () => {
  it('renders with the rift-zone root class', () => {
    const { container } = render(
      <RegionZoneNode {...makeProps({ label: 'us-east-1', onResizeEnd: () => {} })} />
    )
    expect(container.querySelector('.rift-zone')).not.toBeNull()
  })

  it('renders rift-container-label with Region prefix and label text', () => {
    const { container } = render(
      <RegionZoneNode {...makeProps({ label: 'us-east-1', onResizeEnd: () => {} })} />
    )
    const label = container.querySelector('.rift-container-label')
    expect(label).not.toBeNull()
    expect(label?.textContent).toContain('Region')
    expect(label?.textContent).toContain('us-east-1')
  })
})

describe('ResourceGroupNode (Rift container)', () => {
  it('renders with the rift-zone root class', () => {
    const { container } = render(
      <ResourceGroupNode {...makeProps({ nodeType: 'ec2', count: 5 }, { id: 'group-ec2' })} />
    )
    expect(container.querySelector('.rift-zone')).not.toBeNull()
  })

  it('renders rift-container-label with TYPE_LABEL and count', () => {
    const { container } = render(
      <ResourceGroupNode {...makeProps({ nodeType: 'ec2', count: 5 }, { id: 'group-ec2' })} />
    )
    const label = container.querySelector('.rift-container-label')
    expect(label).not.toBeNull()
    expect(label?.textContent).toContain('EC2')
    expect(label?.textContent).toContain('5')
  })
})
