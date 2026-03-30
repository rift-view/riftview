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
vi.mock('../../../src/main/plugin/index', () => ({
  pluginRegistry: {
    activateAll: vi.fn().mockResolvedValue(undefined),
    scanAll: vi.fn().mockResolvedValue({ nodes: [], errors: [] }),
  },
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

  it('manual mode: start() does not set a repeating timer', () => {
    vi.useFakeTimers()
    const mockWin = { webContents: { send: vi.fn() } } as unknown as Electron.BrowserWindow
    const scanner = new ResourceScanner('default', ['us-east-1'], undefined, mockWin, 'manual')
    scanner.start()
    // Advance time well beyond any interval — should not trigger additional scans
    const sendBefore = (mockWin.webContents.send as ReturnType<typeof vi.fn>).mock.calls.length
    vi.advanceTimersByTime(300_000)
    const sendAfter = (mockWin.webContents.send as ReturnType<typeof vi.fn>).mock.calls.length
    // Only the initial scan from start() should have fired — no additional interval ticks
    expect(sendAfter).toBe(sendBefore)
    scanner.stop()
    vi.useRealTimers()
  })

  it('updateInterval switches from manual to timed', () => {
    vi.useFakeTimers()
    const mockWin = { webContents: { send: vi.fn() } } as unknown as Electron.BrowserWindow
    const scanner = new ResourceScanner('default', ['us-east-1'], undefined, mockWin, 'manual')
    scanner.start()
    const sendAfterStart = (mockWin.webContents.send as ReturnType<typeof vi.fn>).mock.calls.length
    // Switch to a 60s interval
    scanner.updateInterval(60_000)
    vi.advanceTimersByTime(60_000)
    const sendAfterTick = (mockWin.webContents.send as ReturnType<typeof vi.fn>).mock.calls.length
    // At least one additional scan should have fired after the interval tick
    expect(sendAfterTick).toBeGreaterThan(sendAfterStart)
    scanner.stop()
    vi.useRealTimers()
  })

  it('updateInterval to manual stops the existing timer', () => {
    vi.useFakeTimers()
    const mockWin = { webContents: { send: vi.fn() } } as unknown as Electron.BrowserWindow
    const scanner = new ResourceScanner('default', ['us-east-1'], undefined, mockWin, 60_000)
    scanner.start()
    // Switch to manual — no more interval scans
    scanner.updateInterval('manual')
    const sendAfterSwitch = (mockWin.webContents.send as ReturnType<typeof vi.fn>).mock.calls.length
    vi.advanceTimersByTime(300_000)
    const sendAfterWait = (mockWin.webContents.send as ReturnType<typeof vi.fn>).mock.calls.length
    expect(sendAfterWait).toBe(sendAfterSwitch)
    scanner.stop()
    vi.useRealTimers()
  })
})
