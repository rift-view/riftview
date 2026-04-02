import { describe, it, expect } from 'vitest'
import { buildDeleteCommands } from '../../../src/renderer/utils/buildDeleteCommands'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function makeNode(overrides: Partial<CloudNode>): CloudNode {
  return {
    id: 'test-id',
    type: 'ec2',
    label: 'test-label',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides,
  }
}

describe('buildDeleteCommands — nat-gateway', () => {
  it('returns correct delete-nat-gateway command', () => {
    const node = makeNode({ id: 'nat-0abc1234', type: 'nat-gateway' })
    const cmds = buildDeleteCommands(node)
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toEqual(['ec2', 'delete-nat-gateway', '--nat-gateway-id', 'nat-0abc1234'])
  })
})

describe('buildDeleteCommands — eventbridge-bus', () => {
  it('returns empty array for the default bus', () => {
    const node = makeNode({ type: 'eventbridge-bus', label: 'default' })
    const cmds = buildDeleteCommands(node)
    expect(cmds).toEqual([])
  })

  it('returns delete command for non-default bus', () => {
    const node = makeNode({ type: 'eventbridge-bus', label: 'my-bus' })
    const cmds = buildDeleteCommands(node)
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toEqual(['events', 'delete-event-bus', '--name', 'my-bus'])
  })
})

describe('buildDeleteCommands — rds with disableProtectionFirst', () => {
  it('returns 2 commands when disableProtectionFirst is true', () => {
    const node = makeNode({
      id: 'db-myinstance',
      type: 'rds',
      metadata: { deletionProtection: true },
    })
    const cmds = buildDeleteCommands(node, { disableProtectionFirst: true })
    expect(cmds).toHaveLength(2)
    expect(cmds[0]).toEqual([
      'rds', 'modify-db-instance',
      '--db-instance-identifier', 'db-myinstance',
      '--no-deletion-protection',
    ])
    expect(cmds[1]).toEqual([
      'rds', 'delete-db-instance',
      '--db-instance-identifier', 'db-myinstance',
    ])
  })

  it('returns 1 command when disableProtectionFirst is not set', () => {
    const node = makeNode({ id: 'db-myinstance', type: 'rds' })
    const cmds = buildDeleteCommands(node)
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toEqual([
      'rds', 'delete-db-instance',
      '--db-instance-identifier', 'db-myinstance',
    ])
  })
})
