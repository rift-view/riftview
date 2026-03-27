import { describe, it, expect, vi } from 'vitest'
import { resolveDeleteCommands, registerPluginCommandHandlers } from '../../../src/renderer/plugin/pluginCommands'
import type { CloudNode } from '../../../src/renderer/types/cloud'

describe('pluginCommands — routing', () => {
  const ec2Node: CloudNode = {
    id: 'i-001', type: 'ec2', label: 'web', status: 'running', region: 'us-east-1', metadata: {}
  }

  it('resolveDeleteCommands for built-in ec2 type returns non-empty commands', () => {
    const cmds = resolveDeleteCommands(ec2Node)
    expect(cmds.length).toBeGreaterThan(0)
  })

  it('resolveDeleteCommands for plugin type delegates to registered handler', () => {
    const mockDelete = vi.fn().mockReturnValue([['mock', 'delete', 'cmd']])
    registerPluginCommandHandlers('azure-vm', { buildDelete: mockDelete })

    const azureNode: CloudNode = { id: 'vm-001', type: 'azure-vm' as CloudNode['type'], label: 'vm', status: 'running', region: 'eastus', metadata: {} }
    const cmds = resolveDeleteCommands(azureNode)
    expect(mockDelete).toHaveBeenCalledWith(azureNode, undefined)
    expect(cmds).toEqual([['mock', 'delete', 'cmd']])
  })

  it('resolveDeleteCommands for unknown plugin type with no handler returns []', () => {
    const unknownNode: CloudNode = { id: 'x-001', type: 'unknown-type' as CloudNode['type'], label: 'x', status: 'running', region: 'us-east-1', metadata: {} }
    const cmds = resolveDeleteCommands(unknownNode)
    expect(cmds).toEqual([])
  })
})
