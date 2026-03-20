import { describe, it, expect, vi } from 'vitest'
import { computeDelta } from '../../../src/main/aws/scanner'
import type { CloudNode } from '../../../src/renderer/types/cloud'

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}))

const makeNode = (id: string, status = 'running', label = id): CloudNode => ({
  id, type: 'ec2', label, status: status as import('../../../src/renderer/types/cloud').NodeStatus, region: 'us-east-1', metadata: {},
})

describe('computeDelta', () => {
  it('detects added nodes', () => {
    const prev: CloudNode[] = []
    const next: CloudNode[] = [makeNode('i-001')]
    const delta = computeDelta(prev, next)
    expect(delta.added).toHaveLength(1)
    expect(delta.added[0].id).toBe('i-001')
    expect(delta.changed).toHaveLength(0)
    expect(delta.removed).toHaveLength(0)
  })

  it('detects removed nodes', () => {
    const prev = [makeNode('i-001')]
    const next: CloudNode[] = []
    const delta = computeDelta(prev, next)
    expect(delta.removed).toEqual(['i-001'])
    expect(delta.added).toHaveLength(0)
  })

  it('detects changed nodes (status change)', () => {
    const prev = [makeNode('i-001', 'running')]
    const next = [makeNode('i-001', 'stopped')]
    const delta = computeDelta(prev, next)
    expect(delta.changed).toHaveLength(1)
    expect(delta.changed[0].status).toBe('stopped')
  })

  it('returns empty delta when nothing changed', () => {
    const nodes = [makeNode('i-001')]
    const delta = computeDelta(nodes, nodes)
    expect(delta.added).toHaveLength(0)
    expect(delta.changed).toHaveLength(0)
    expect(delta.removed).toHaveLength(0)
  })

  it('detects changed nodes (label change)', () => {
    const prev = [makeNode('i-001', 'running', 'old-name')]
    const next = [makeNode('i-001', 'running', 'new-name')]
    const delta = computeDelta(prev, next)
    expect(delta.changed).toHaveLength(1)
    expect(delta.changed[0].label).toBe('new-name')
  })
})

vi.mock('../../../src/main/aws/client', () => ({
  createClients: vi.fn().mockReturnValue({}),
}))
vi.mock('../../../src/main/aws/provider', () => ({
  awsProvider: { scan: vi.fn().mockResolvedValue({ nodes: [], scanErrors: [] }) },
}))
vi.mock('../../../src/main/aws/services/ec2', () => ({
  describeKeyPairs: vi.fn().mockResolvedValue([]),
}))

import { ResourceScanner } from '../../../src/main/aws/scanner'

describe('ResourceScanner', () => {
  it('updateRegions does not throw and scanner remains usable', () => {
    const mockWin = { webContents: { send: vi.fn() } } as unknown as Electron.BrowserWindow
    const scanner = new ResourceScanner('default', ['us-east-1'], undefined, mockWin)
    expect(() => scanner.updateRegions(['eu-west-1', 'ap-southeast-1'])).not.toThrow()
    expect(typeof scanner.start).toBe('function')
    expect(typeof scanner.stop).toBe('function')
    expect(typeof scanner.triggerManualScan).toBe('function')
  })
})
