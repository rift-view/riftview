// src/renderer/components/canvas/nodes/ResourceNode.stories.tsx
import type { Story } from '@ladle/react'
import { ResourceNode } from './ResourceNode'
import type { NodeType, NodeStatus } from '../../../types/cloud'

// Minimal NodeProps shape for stories — only fields ResourceNode actually reads
function makeProps(nodeType: NodeType, status: NodeStatus, label: string): Record<string, unknown> {
  return {
    id: `story-${nodeType}-${status}`,
    type: 'resource',
    selected: false,
    dragging: false,
    zIndex: 1,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    data: { label, nodeType, status, metadata: {} },
  } as Parameters<typeof ResourceNode>[0]
}

// --- Running state ---
export const LambdaRunning: Story = () => (
  <ResourceNode {...makeProps('lambda', 'running', 'my-function')} />
)
export const Ec2Running: Story = () => (
  <ResourceNode {...makeProps('ec2', 'running', 'i-0abc123')} />
)
export const S3Running: Story = () => (
  <ResourceNode {...makeProps('s3', 'running', 'my-bucket')} />
)
export const RdsRunning: Story = () => (
  <ResourceNode {...makeProps('rds', 'running', 'my-db')} />
)
export const AlbRunning: Story = () => (
  <ResourceNode {...makeProps('alb', 'running', 'my-alb')} />
)
export const SqsRunning: Story = () => (
  <ResourceNode {...makeProps('sqs', 'running', 'my-queue')} />
)
export const DynamoRunning: Story = () => (
  <ResourceNode {...makeProps('dynamo', 'running', 'my-table')} />
)
export const CloudfrontRunning: Story = () => (
  <ResourceNode {...makeProps('cloudfront', 'running', 'E1234ABCD')} />
)
export const EcrRunning: Story = () => (
  <ResourceNode {...makeProps('ecr-repo', 'running', 'my-app')} />
)
export const CognitoRunning: Story = () => (
  <ResourceNode {...makeProps('cognito', 'running', 'us-east-1_abc')} />
)

// --- Error state ---
export const LambdaError: Story = () => (
  <ResourceNode {...makeProps('lambda', 'error', 'broken-function')} />
)
export const Ec2Error: Story = () => (
  <ResourceNode {...makeProps('ec2', 'error', 'i-broken')} />
)

// --- Pending state ---
export const RdsPending: Story = () => (
  <ResourceNode {...makeProps('rds', 'pending', 'creating-db')} />
)
export const LambdaPending: Story = () => (
  <ResourceNode {...makeProps('lambda', 'pending', 'deploying-fn')} />
)

// --- Unknown state ---
export const LambdaUnknown: Story = () => (
  <ResourceNode {...makeProps('lambda', 'unknown', 'mystery-fn')} />
)

// --- Theme variants ---
export const DarkTheme: Story = () => (
  <div data-theme="dark" style={{ background: '#0f1117', padding: 24, display: 'flex', gap: 16 }}>
    <ResourceNode {...makeProps('lambda', 'running', 'dark-fn')} />
    <ResourceNode {...makeProps('ec2', 'error', 'dark-ec2')} />
    <ResourceNode {...makeProps('rds', 'pending', 'dark-rds')} />
  </div>
)

export const LightTheme: Story = () => (
  <div data-theme="light" style={{ background: '#f9fafb', padding: 24, display: 'flex', gap: 16 }}>
    <ResourceNode {...makeProps('lambda', 'running', 'light-fn')} />
    <ResourceNode {...makeProps('ec2', 'error', 'light-ec2')} />
    <ResourceNode {...makeProps('rds', 'pending', 'light-rds')} />
  </div>
)
