import { describe, it, expect } from 'vitest'
import { buildRemediateCommands } from '../../../src/renderer/utils/buildRemediateCommands'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function node(overrides: Partial<CloudNode>): CloudNode {
  return {
    id: 'test-id',
    label: 'test-label',
    type: 'lambda',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides,
  } as CloudNode
}

describe('buildRemediateCommands', () => {
  it('unmanaged lambda → delete command', () => {
    const result = buildRemediateCommands(node({ type: 'lambda', driftStatus: 'unmanaged' }))
    expect(result).toEqual([['lambda', 'delete-function', '--function-name', 'test-id']])
  })

  it('unmanaged eventbridge default bus → []', () => {
    const result = buildRemediateCommands(
      node({ type: 'eventbridge-bus', label: 'default', driftStatus: 'unmanaged' })
    )
    expect(result).toEqual([])
  })

  it('missing node → []', () => {
    expect(buildRemediateCommands(node({ driftStatus: 'missing' }))).toEqual([])
  })

  it('no driftStatus → []', () => {
    expect(buildRemediateCommands(node({}))).toEqual([])
  })

  it('matched with no tfMetadata → []', () => {
    expect(buildRemediateCommands(node({ driftStatus: 'matched', tfMetadata: undefined }))).toEqual([])
  })

  it('matched lambda runtime diff → update-function-configuration --runtime', () => {
    const result = buildRemediateCommands(
      node({
        driftStatus: 'matched',
        metadata: { runtime: 'python3.9' },
        tfMetadata: { runtime: 'python3.11' },
      })
    )
    expect(result).toEqual([
      ['lambda', 'update-function-configuration', '--function-name', 'test-id', '--runtime', 'python3.11'],
    ])
  })

  it('matched lambda memorySize + timeout diff → single merged command', () => {
    const result = buildRemediateCommands(
      node({
        driftStatus: 'matched',
        metadata: { memorySize: '128', timeout: '3' },
        tfMetadata: { memorySize: '512', timeout: '30' },
      })
    )
    expect(result).toHaveLength(1)
    const cmd = result[0]
    expect(cmd.slice(0, 2)).toEqual(['lambda', 'update-function-configuration'])
    expect(cmd).toContain('--memory-size')
    expect(cmd).toContain('512')
    expect(cmd).toContain('--timeout')
    expect(cmd).toContain('30')
  })

  it('matched lambda unsupported key only → []', () => {
    const result = buildRemediateCommands(
      node({
        driftStatus: 'matched',
        metadata: { tags: '{}' },
        tfMetadata: { tags: '{"env":"prod"}' },
      })
    )
    expect(result).toEqual([])
  })

  it('matched ec2 instanceType diff, status running → stop + modify + start', () => {
    const result = buildRemediateCommands(
      node({
        id: 'i-abc123',
        type: 'ec2',
        status: 'running',
        driftStatus: 'matched',
        metadata: { instanceType: 't3.small' },
        tfMetadata: { instanceType: 't3.medium' },
      })
    )
    expect(result).toEqual([
      ['ec2', 'stop-instances', '--instance-ids', 'i-abc123'],
      ['ec2', 'modify-instance-attribute', '--instance-id', 'i-abc123', '--instance-type', 'Value=t3.medium'],
      ['ec2', 'start-instances', '--instance-ids', 'i-abc123'],
    ])
  })

  it('matched ec2 instanceType diff, status stopped → modify only', () => {
    const result = buildRemediateCommands(
      node({
        id: 'i-abc123',
        type: 'ec2',
        status: 'stopped',
        driftStatus: 'matched',
        metadata: { instanceType: 't3.small' },
        tfMetadata: { instanceType: 't3.medium' },
      })
    )
    expect(result).toEqual([
      ['ec2', 'modify-instance-attribute', '--instance-id', 'i-abc123', '--instance-type', 'Value=t3.medium'],
    ])
  })

  it('matched rds instanceClass diff → modify-db-instance --apply-immediately', () => {
    const result = buildRemediateCommands(
      node({
        id: 'my-db',
        type: 'rds',
        driftStatus: 'matched',
        metadata: { instanceClass: 'db.t3.small' },
        tfMetadata: { instanceClass: 'db.t3.medium' },
      })
    )
    expect(result).toEqual([
      ['rds', 'modify-db-instance', '--db-instance-identifier', 'my-db', '--db-instance-class', 'db.t3.medium', '--apply-immediately'],
    ])
  })
})
