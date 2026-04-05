// src/renderer/components/canvas/nodes/SubnetNode.stories.tsx
import type { Story } from '@ladle/react'
import { SubnetNode } from './SubnetNode'

function makeSubnetProps(label: string, isPublic: boolean, az?: string) {
  return {
    id: `story-subnet`,
    type: 'subnet',
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    data: { label, isPublic, az },
  } as Parameters<typeof SubnetNode>[0]
}

export const PublicSubnet: Story = () => (
  <div style={{ width: 220, height: 120 }}>
    <SubnetNode {...makeSubnetProps('subnet-public-1a', true, 'us-east-1a')} />
  </div>
)

export const PrivateSubnet: Story = () => (
  <div style={{ width: 220, height: 120 }}>
    <SubnetNode {...makeSubnetProps('subnet-private-1b', false, 'us-east-1b')} />
  </div>
)

export const NoAz: Story = () => (
  <div style={{ width: 220, height: 120 }}>
    <SubnetNode {...makeSubnetProps('subnet-0abc', true)} />
  </div>
)
