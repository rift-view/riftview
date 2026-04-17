import { describe, it, expect } from 'vitest'
import { buildDeleteCommands } from '../../../src/renderer/utils/buildDeleteCommands'
import type { CloudNode } from '../../../src/renderer/types/cloud'

const makeNode = (id: string, type: CloudNode['type'], label = id): CloudNode => ({
  id,
  type,
  label,
  status: 'running',
  region: 'us-east-1',
  metadata: {}
})

describe('bulk delete — flattened commands from multiple nodes', () => {
  it('produces one command per EC2 node', () => {
    const nodes: CloudNode[] = [
      makeNode('i-001', 'ec2'),
      makeNode('i-002', 'ec2'),
      makeNode('i-003', 'ec2')
    ]
    const commands = nodes.flatMap((n) => buildDeleteCommands(n))
    expect(commands).toHaveLength(3)
    commands.forEach((cmd) => {
      expect(cmd).toContain('terminate-instances')
    })
    expect(commands[0]).toContain('i-001')
    expect(commands[1]).toContain('i-002')
    expect(commands[2]).toContain('i-003')
  })

  it('produces mixed commands for mixed node types', () => {
    const nodes: CloudNode[] = [
      makeNode('i-001', 'ec2'),
      makeNode('my-bucket', 's3'),
      makeNode('fn-name', 'lambda')
    ]
    const commands = nodes.flatMap((n) => buildDeleteCommands(n))
    expect(commands).toHaveLength(3)
    expect(commands[0]).toContain('terminate-instances')
    expect(commands[1]).toContain('rb')
    expect(commands[2]).toContain('delete-function')
  })

  it('includes both detach and delete commands for igw with vpcId', () => {
    const igwNode: CloudNode = {
      id: 'igw-abc',
      type: 'igw',
      label: 'igw-abc',
      status: 'running',
      region: 'us-east-1',
      parentId: 'vpc-123',
      metadata: {}
    }
    const commands = buildDeleteCommands(igwNode)
    expect(commands).toHaveLength(2)
    expect(commands[0]).toContain('detach-internet-gateway')
    expect(commands[1]).toContain('delete-internet-gateway')
  })

  it('returns empty array for unsupported types (cloudfront)', () => {
    const node = makeNode('dist-001', 'cloudfront')
    const commands = buildDeleteCommands(node)
    expect(commands).toHaveLength(0)
  })

  it('flatMap over 3 nodes including igw produces correct total count', () => {
    const nodes: CloudNode[] = [
      makeNode('i-001', 'ec2'),
      {
        id: 'igw-abc',
        type: 'igw',
        label: 'igw-abc',
        status: 'running',
        region: 'us-east-1',
        parentId: 'vpc-123',
        metadata: {}
      },
      makeNode('fn-name', 'lambda')
    ]
    const commands = nodes.flatMap((n) => buildDeleteCommands(n))
    // ec2: 1, igw: 2, lambda: 1 = 4 total
    expect(commands).toHaveLength(4)
  })
})
