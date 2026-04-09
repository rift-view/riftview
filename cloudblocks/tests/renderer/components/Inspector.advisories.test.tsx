import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Inspector } from '../../../src/renderer/components/Inspector'
import { useUIStore } from '../../../src/renderer/store/ui'
import { useCloudStore } from '../../../src/renderer/store/cloud'
import type { CloudNode } from '../../../src/renderer/types/cloud'

const saveAnnotationsMock = vi.fn().mockResolvedValue(undefined)
const analyzeIamMock = vi.fn().mockResolvedValue({ nodeId: '', findings: [], fetchedAt: 0 })

Object.defineProperty(window, 'terminus', {
  value: { saveAnnotations: saveAnnotationsMock, analyzeIam: analyzeIamMock },
  writable: true,
})

vi.mock('../../../src/renderer/components/IamAdvisor', () => ({
  IamAdvisor: () => null,
}))

function baseNode(overrides: Partial<CloudNode> = {}): CloudNode {
  return {
    id: 'fn-arn',
    label: 'my-fn',
    type: 'lambda',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides,
  } as CloudNode
}

function setup(node: CloudNode): ReturnType<typeof render> {
  useUIStore.setState({ selectedNodeId: node.id })
  useCloudStore.setState({ nodes: [node], importedNodes: [] })
  return render(
    <Inspector
      onDelete={vi.fn()}
      onEdit={vi.fn()}
      onQuickAction={vi.fn()}
    />
  )
}

describe('Inspector ADVISORIES section', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FLAG_OP_INTELLIGENCE', 'true')
    useUIStore.setState({ selectedNodeId: null, annotations: {}, selectedEdgeId: null, selectedEdgeInfo: null })
    useCloudStore.setState({ nodes: [], importedNodes: [] })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('hidden when OP_INTELLIGENCE flag is false', () => {
    vi.unstubAllEnvs()
    setup(baseNode({ metadata: {} }))
    expect(screen.queryByText('ADVISORIES ▾')).toBeNull()
  })

  it('shows ADVISORIES section for lambda with no timeout', () => {
    setup(baseNode({ metadata: {} }))
    expect(screen.getByText(/ADVISORIES/)).toBeTruthy()
  })

  it('shows advisory title for lambda-no-timeout', () => {
    setup(baseNode({ metadata: {} }))
    expect(screen.getByText('No timeout configured')).toBeTruthy()
  })

  it('shows "No issues detected" for a lambda with timeout and non-default memory', () => {
    setup(baseNode({ metadata: { timeout: 30, memorySize: 512 } }))
    expect(screen.getByText('No issues detected')).toBeTruthy()
  })

  it('shows both critical and warning for lambda with timeout=0 and memory=128', () => {
    setup(baseNode({ metadata: { timeout: 0, memorySize: 128 } }))
    expect(screen.getByText('No timeout configured')).toBeTruthy()
    expect(screen.getByText('Memory at default (128 MB)')).toBeTruthy()
  })

  it('critical advisory appears before warning (severity order)', () => {
    setup(baseNode({ metadata: { timeout: 0, memorySize: 128 } }))
    const items = screen.getAllByRole('listitem')
    const titles = items.map((el) => el.textContent ?? '')
    const criticalIdx = titles.findIndex((t) => t.includes('No timeout'))
    const warningIdx  = titles.findIndex((t) => t.includes('Memory at default'))
    expect(criticalIdx).toBeLessThan(warningIdx)
  })

  it('collapse toggle hides advisory list', () => {
    setup(baseNode({ metadata: {} }))
    fireEvent.click(screen.getByText(/ADVISORIES/))
    expect(screen.queryByText('No timeout configured')).toBeNull()
  })

  it('vpc node with flag on → shows "No issues detected"', () => {
    setup(baseNode({ type: 'vpc', metadata: {} }))
    expect(screen.getByText('No issues detected')).toBeTruthy()
  })
})
