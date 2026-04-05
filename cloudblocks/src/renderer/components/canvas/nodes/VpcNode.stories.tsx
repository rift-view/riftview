// src/renderer/components/canvas/nodes/VpcNode.stories.tsx
import type { Story } from '@ladle/react'
import { VpcNode } from './VpcNode'

function makeVpcProps(label: string, cidr?: string, collapsed?: boolean) {
  return {
    id: `story-vpc`,
    type: 'vpc',
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    data: { label, cidr, collapsed, childCount: 3 },
  } as Parameters<typeof VpcNode>[0]
}

export const Default: Story = () => (
  <div style={{ width: 300, height: 200 }}>
    <VpcNode {...makeVpcProps('vpc-0abc1234', '10.0.0.0/16')} />
  </div>
)

export const Collapsed: Story = () => (
  <div style={{ width: 300, height: 60 }}>
    <VpcNode {...makeVpcProps('vpc-0abc1234', '10.0.0.0/16', true)} />
  </div>
)

export const NoCidr: Story = () => (
  <div style={{ width: 300, height: 200 }}>
    <VpcNode {...makeVpcProps('vpc-no-cidr')} />
  </div>
)
