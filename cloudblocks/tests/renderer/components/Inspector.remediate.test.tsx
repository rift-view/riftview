import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Inspector } from '../../../src/renderer/components/Inspector'
import { useUIStore } from '../../../src/renderer/store/ui'
import { useCloudStore } from '../../../src/renderer/store/cloud'
import type { CloudNode } from '../../../src/renderer/types/cloud'

// ---- Mocks (same pattern as Inspector.test.tsx) ----------------------------

const saveAnnotationsMock = vi.fn().mockResolvedValue(undefined)
const analyzeIamMock      = vi.fn().mockResolvedValue({ nodeId: '', findings: [], fetchedAt: 0 })

Object.defineProperty(window, 'terminus', {
  value: { saveAnnotations: saveAnnotationsMock, analyzeIam: analyzeIamMock },
  writable: true,
})

vi.mock('../../../src/renderer/components/IamAdvisor', () => ({
  IamAdvisor: () => null,
}))

// ---------------------------------------------------------------------------

function baseNode(overrides: Partial<CloudNode> = {}): CloudNode {
  return {
    id: 'arn:aws:lambda:us-east-1:123:function:foo',
    label: 'foo',
    type: 'lambda',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides,
  } as CloudNode
}

type OnRemediate = (node: CloudNode, commands: string[][]) => Promise<{ code: number }>

function setup(node: CloudNode, onRemediate?: OnRemediate): ReturnType<typeof render> {
  useUIStore.setState({ selectedNodeId: node.id })
  useCloudStore.setState({ nodes: [node], importedNodes: [] })
  return render(
    <Inspector
      onDelete={vi.fn()}
      onEdit={vi.fn()}
      onQuickAction={vi.fn()}
      onRemediate={onRemediate}
    />
  )
}

describe('Inspector REMEDIATE section', () => {
  beforeEach(() => {
    saveAnnotationsMock.mockClear()
    analyzeIamMock.mockClear()
    vi.stubEnv('VITE_FLAG_EXECUTION_ENGINE', 'true')
    useUIStore.setState({ selectedNodeId: null, annotations: {}, selectedEdgeId: null, selectedEdgeInfo: null })
    useCloudStore.setState({ nodes: [], importedNodes: [] })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('hidden when EXECUTION_ENGINE flag is false', () => {
    vi.unstubAllEnvs()
    setup(baseNode({ driftStatus: 'unmanaged' }))
    expect(screen.queryByText('REMEDIATE')).toBeNull()
  })

  it('hidden when driftStatus is undefined', () => {
    setup(baseNode())
    expect(screen.queryByText('REMEDIATE')).toBeNull()
  })

  it('hidden when driftStatus is missing', () => {
    setup(baseNode({ driftStatus: 'missing' }))
    expect(screen.queryByText('REMEDIATE')).toBeNull()
  })

  it('shown for unmanaged node', () => {
    setup(baseNode({ driftStatus: 'unmanaged' }))
    expect(screen.getByText('REMEDIATE')).toBeTruthy()
  })

  it('shown for matched node with commands', () => {
    setup(baseNode({
      driftStatus: 'matched',
      metadata: { runtime: 'python3.9' },
      tfMetadata: { runtime: 'python3.11' },
    }))
    expect(screen.getByText('REMEDIATE')).toBeTruthy()
  })

  it('shows "Manual remediation required" when matched but no supported diff', () => {
    setup(baseNode({
      driftStatus: 'matched',
      metadata: { tags: '{}' },
      tfMetadata: { tags: '{"env":"prod"}' },
    }))
    expect(screen.getByText(/Manual remediation required/)).toBeTruthy()
  })

  it('Execute button calls onRemediate with node and commands', async () => {
    const onRemediate = vi.fn<OnRemediate>().mockResolvedValue({ code: 0 })
    setup(baseNode({ driftStatus: 'unmanaged' }), onRemediate)
    fireEvent.click(screen.getByText('Execute'))
    expect(onRemediate).toHaveBeenCalledOnce()
    const [calledNode, calledCmds] = onRemediate.mock.calls[0]
    expect(calledNode.id).toBe('arn:aws:lambda:us-east-1:123:function:foo')
    expect(calledCmds.length).toBeGreaterThan(0)
  })

  it('shows Executing… while running, then ✓ Done on success', async () => {
    let resolve!: (v: { code: number }) => void
    const onRemediate = vi.fn<OnRemediate>().mockReturnValue(new Promise((r) => { resolve = r }))
    setup(baseNode({ driftStatus: 'unmanaged' }), onRemediate)

    fireEvent.click(screen.getByText('Execute'))
    expect(screen.getByText('Executing…')).toBeTruthy()

    resolve({ code: 0 })
    await waitFor(() => expect(screen.getByText('✓ Done')).toBeTruthy())
  })

  it('shows ✗ Failed when onRemediate resolves with non-zero exit code', async () => {
    const onRemediate = vi.fn<OnRemediate>().mockResolvedValue({ code: 1 })
    setup(baseNode({ driftStatus: 'unmanaged' }), onRemediate)
    fireEvent.click(screen.getByText('Execute'))
    await waitFor(() => expect(screen.getByText(/✗ Failed \(exit 1\)/)).toBeTruthy())
  })

  it('Execute button disabled when onRemediate not provided', () => {
    setup(baseNode({ driftStatus: 'unmanaged' }))
    const btn = screen.getByText('Execute').closest('button')
    expect(btn).toBeDisabled()
  })
})
