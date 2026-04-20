/**
 * Smoke test: handleRemediate → runCli IPC connection
 *
 * handleRemediate is defined inline in App.tsx. Rather than render the full
 * App (which pulls in a large component tree), we reproduce the exact function
 * body here, wired to the real Zustand stores and a mocked window.riftview,
 * and verify the IPC and store side-effects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCloudStore } from '../../src/renderer/store/cloud'
import { useUIStore } from '../../src/renderer/store/ui'
import type { CloudNode } from '@riftview/shared'

// ---- window.riftview mock --------------------------------------------------

const runCliMock = vi.fn()

Object.defineProperty(window, 'riftview', {
  value: {
    runCli: runCliMock,
    // stubs for any other calls that may be triggered indirectly
    saveAnnotations: vi.fn().mockResolvedValue(undefined),
    analyzeIam: vi.fn().mockResolvedValue({ nodeId: '', findings: [], fetchedAt: 0 }),
    listProfiles: vi.fn().mockResolvedValue([]),
    loadAnnotations: vi.fn().mockResolvedValue({}),
    loadCustomEdges: vi.fn().mockResolvedValue([]),
    getThemeOverrides: vi.fn().mockResolvedValue({}),
    onUpdateAvailable: vi.fn().mockReturnValue(() => {}),
    onPluginMetadata: vi.fn().mockReturnValue(() => {})
  },
  writable: true
})

// ---- helpers ---------------------------------------------------------------

function baseNode(overrides: Partial<CloudNode> = {}): CloudNode {
  return {
    id: 'arn:aws:lambda:us-east-1:123:function:my-fn',
    label: 'my-fn',
    type: 'lambda',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides
  } as CloudNode
}

/**
 * handleRemediate — reproduced verbatim from App.tsx (lines 199–212).
 * triggerScan is injected so we can assert it was called.
 */
async function handleRemediate(
  node: CloudNode,
  commands: string[][],
  triggerScan: () => void,
  setFixCount: (fn: (n: number) => number) => void
): Promise<{ code: number }> {
  const prevStatus = node.status
  useCloudStore.getState().patchNodeStatus(node.id, 'pending')
  const result = await window.riftview.runCli(commands)
  if (result.code === 0) {
    setFixCount((n) => n + 1)
    useUIStore.getState().showToast('Remediation complete')
    triggerScan()
  } else {
    useCloudStore.getState().patchNodeStatus(node.id, prevStatus)
    useUIStore.getState().showToast('Remediation failed', 'error')
  }
  return result
}

// ---- tests -----------------------------------------------------------------

describe('handleRemediate → runCli IPC', () => {
  const triggerScan = vi.fn()
  const setFixCount = vi.fn()

  beforeEach(() => {
    runCliMock.mockReset()
    triggerScan.mockReset()
    setFixCount.mockReset()
    useUIStore.setState({ toast: null })
    useCloudStore.setState({ nodes: [], importedNodes: [] })
  })

  it('happy path: calls runCli with provided commands and shows success toast', async () => {
    const node = baseNode({ driftStatus: 'unmanaged' })
    useCloudStore.setState({ nodes: [node], importedNodes: [] })

    const commands = [['lambda', 'delete-function', '--function-name', node.id]]
    runCliMock.mockResolvedValue({ code: 0 })

    const result = await handleRemediate(node, commands, triggerScan, setFixCount)

    // runCli called with the exact commands
    expect(runCliMock).toHaveBeenCalledOnce()
    expect(runCliMock).toHaveBeenCalledWith(commands)

    // success side-effects
    expect(result.code).toBe(0)
    expect(triggerScan).toHaveBeenCalledOnce()
    expect(setFixCount).toHaveBeenCalledOnce()
    expect(useUIStore.getState().toast?.message).toBe('Remediation complete')
    expect(useUIStore.getState().toast?.type).toBe('success')
  })

  it('error path: runCli non-zero code → shows error toast and restores node status', async () => {
    const node = baseNode({ status: 'running', driftStatus: 'unmanaged' })
    useCloudStore.setState({ nodes: [node], importedNodes: [] })

    const commands = [['lambda', 'delete-function', '--function-name', node.id]]
    runCliMock.mockResolvedValue({ code: 1 })

    const result = await handleRemediate(node, commands, triggerScan, setFixCount)

    // runCli still called
    expect(runCliMock).toHaveBeenCalledOnce()

    // no scan triggered, no fixCount increment
    expect(triggerScan).not.toHaveBeenCalled()
    expect(setFixCount).not.toHaveBeenCalled()

    // error toast
    expect(result.code).toBe(1)
    expect(useUIStore.getState().toast?.message).toBe('Remediation failed')
    expect(useUIStore.getState().toast?.type).toBe('error')

    // status restored to pre-call value
    const stored = useCloudStore.getState().nodes.find((n) => n.id === node.id)
    expect(stored?.status).toBe('running')
  })

  it('empty commands: runCli called with empty array (no guard in implementation)', async () => {
    const node = baseNode()
    useCloudStore.setState({ nodes: [node], importedNodes: [] })

    runCliMock.mockResolvedValue({ code: 0 })
    await handleRemediate(node, [], triggerScan, setFixCount)

    expect(runCliMock).toHaveBeenCalledWith([])
  })
})
