/**
 * RIFT-21: RESTORE_COST_ESTIMATE handler wiring.
 *
 * Verifies that the handler calls computeCostDelta with the held plan and
 * returns structured CostDelta data (not null as in the pre-RIFT-21 stub).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IPC } from '../../src/main/ipc/channels'
import type { RestorePlan } from '@riftview/cloud-scan'

const mockWin = (): Electron.BrowserWindow =>
  ({
    webContents: { send: vi.fn(), capturePage: vi.fn() },
    isFocused: vi.fn().mockReturnValue(true)
  }) as unknown as Electron.BrowserWindow

vi.mock('../../src/main/aws/credentials', () => ({
  listProfiles: vi.fn().mockReturnValue([]),
  getDefaultRegion: vi.fn().mockReturnValue('us-east-1')
}))
vi.mock('../../src/main/aws/client', () => ({
  createClients: vi.fn().mockReturnValue({})
}))
vi.mock('../../src/main/aws/scanner', () => ({
  ResourceScanner: vi.fn(function () {
    return {
      start: vi.fn(),
      stop: vi.fn(),
      triggerManualScan: vi.fn(),
      updateRegions: vi.fn(),
      updateInterval: vi.fn()
    }
  }),
  historyFilePath: vi.fn().mockReturnValue('/tmp/history/node.json')
}))
vi.mock('../../src/main/cli/engine', () => ({
  CliEngine: vi.fn(function () {
    return { execute: vi.fn(), cancel: vi.fn() }
  })
}))
vi.mock('../../src/main/terraform/index', () => ({
  generateTerraformFile: vi.fn().mockReturnValue({ hcl: '', skippedTypes: [] })
}))
vi.mock('../../src/main/terraform/provider', () => ({
  buildLocalStackProvider: vi.fn().mockReturnValue('')
}))
vi.mock('@riftview/shared', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    parseTfState: vi.fn().mockReturnValue([]),
    parseTfStateModules: vi.fn().mockReturnValue([])
  }
})
vi.mock('../../src/main/aws/iam/fetcher', () => ({
  fetchEc2IamData: vi.fn().mockResolvedValue([]),
  fetchLambdaIamData: vi.fn().mockResolvedValue([]),
  fetchS3IamData: vi.fn().mockResolvedValue([])
}))
vi.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: vi.fn(function () {
    return {}
  })
}))
vi.mock('../../src/main/aws/services/cloudwatch', () => ({
  fetchMetrics: vi.fn().mockResolvedValue([])
}))

const STUB_PLAN: RestorePlan = {
  planId: 'p1',
  pluginId: 'com.riftview.aws',
  versionFormat: 'scan-snapshot',
  from: { versionId: 'v1', capturedAt: '', pluginId: '', region: 'us-east-1', versionFormat: '' },
  to: 'live',
  steps: [],
  createdAt: '2026-04-20T00:00:00Z',
  planToken: ''
}

describe('RESTORE_COST_ESTIMATE — RIFT-21 wiring', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('electron', () => ({
      ipcMain: { handle: vi.fn(), on: vi.fn() },
      BrowserWindow: vi.fn(),
      app: {
        getPath: vi.fn().mockReturnValue('/tmp'),
        getVersion: vi.fn().mockReturnValue('0.0.0')
      },
      dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
      Notification: vi.fn(function () {
        return { show: vi.fn() }
      }),
      safeStorage: { isEncryptionAvailable: vi.fn().mockReturnValue(true) }
    }))
    delete process.env.RIFTVIEW_DEMO_MODE
  })

  it('returns null when no matching plan token', async () => {
    const { ipcMain } = await import('electron')
    const { registerHandlers } = await import('../../src/main/ipc/handlers')
    registerHandlers(mockWin())
    const call = vi
      .mocked(ipcMain.handle)
      .mock.calls.find((c) => c[0] === IPC.RESTORE_COST_ESTIMATE)
    expect(call).toBeDefined()
    const handler = call![1] as (_: unknown, planToken: unknown) => Promise<unknown>
    expect(await handler(null, 'nonexistent-token')).toBeNull()
  })

  it('returns null when planToken argument is not a string', async () => {
    const { ipcMain } = await import('electron')
    const { registerHandlers } = await import('../../src/main/ipc/handlers')
    registerHandlers(mockWin())
    const call = vi
      .mocked(ipcMain.handle)
      .mock.calls.find((c) => c[0] === IPC.RESTORE_COST_ESTIMATE)
    const handler = call![1] as (_: unknown, planToken: unknown) => Promise<unknown>
    expect(await handler(null, 42)).toBeNull()
  })

  it('returns a CostDelta with planId and aggregate when a valid plan token is held', async () => {
    const { ipcMain } = await import('electron')
    const { registerHandlers } = await import('../../src/main/ipc/handlers')
    const { mintPlanToken } = await import('../../src/main/restore/planStore')
    registerHandlers(mockWin())

    const token = mintPlanToken('snap-1', 'ver-1', STUB_PLAN)

    const call = vi
      .mocked(ipcMain.handle)
      .mock.calls.find((c) => c[0] === IPC.RESTORE_COST_ESTIMATE)
    const handler = call![1] as (_: unknown, planToken: unknown) => Promise<unknown>
    const result = (await handler(null, token)) as { planId: string; aggregate: unknown }

    expect(result).not.toBeNull()
    expect(result).toHaveProperty('planId')
    expect(result).toHaveProperty('aggregate')
    // Empty plan → aggregate recurring is $0
    expect((result as { aggregate: { recurringMonthly: number } }).aggregate.recurringMonthly).toBe(
      0
    )
  })
})
