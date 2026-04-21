// Curated CloudNode fixture used by demo mode to seed the renderer on boot.
// The data shape matches the live scan output — no adapter layer needed.
// Kept small and readable; additions should match one resource per
// NodeType that appears in the PR-tier E2E assertions.
import type { CloudNode } from '@riftview/shared'

export const DEMO_FIXTURE_NODES: CloudNode[] = [
  {
    id: 'i-demo-web',
    type: 'ec2',
    label: 'demo-web',
    status: 'running',
    region: 'us-east-1',
    metadata: { instanceType: 't3.micro' }
  },
  {
    id: 'arn:aws:lambda:us-east-1:000000000000:function:demo-api',
    type: 'lambda',
    label: 'demo-api',
    status: 'running',
    region: 'us-east-1',
    metadata: { timeout: 30, memorySize: 256 }
  },
  {
    id: 'demo-assets',
    type: 's3',
    label: 'demo-assets',
    status: 'running',
    region: 'us-east-1',
    metadata: {}
  }
]
