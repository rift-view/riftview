import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
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
    useUIStore.setState({ selectedNodeId: null, annotations: {}, selectedEdgeId: null, selectedEdgeInfo: null })
    useCloudStore.setState({ nodes: [], importedNodes: [] })
  })

  it('always-on: ADVISORIES section visible without flag (OP_INTELLIGENCE always-on)', () => {
    setup(baseNode({ metadata: {} }))
    expect(screen.getByText(/ADVISORIES/)).toBeTruthy()
  })

  it('shows ADVISORIES section for lambda with no timeout', () => {
    setup(baseNode({ metadata: {} }))
    expect(screen.getByText(/ADVISORIES/)).toBeTruthy()
  })

  it('shows advisory title for lambda-no-timeout', () => {
    setup(baseNode({ metadata: {} }))
    expect(screen.getByText('No timeout configured')).toBeTruthy()
  })

  it('shows "No issues detected" for a lambda with timeout and memory above threshold', () => {
    setup(baseNode({ metadata: { timeout: 30, memorySize: 1024 } }))
    expect(screen.getByText('No issues detected')).toBeTruthy()
  })

  it('shows both critical and info for lambda with timeout=0 and memory=128', () => {
    setup(baseNode({ metadata: { timeout: 0, memorySize: 128 } }))
    expect(screen.getByText('No timeout configured')).toBeTruthy()
    expect(screen.getByText('Low memory allocation (≤ 512 MB)')).toBeTruthy()
  })

  it('critical advisory appears before info (severity order)', () => {
    const { container } = setup(baseNode({ metadata: { timeout: 0, memorySize: 128 } }))
    // Severity labels are rendered as span text content "critical" / "info"
    const allSpans = Array.from(container.querySelectorAll('span'))
    const criticalIdx = allSpans.findIndex((s) => s.textContent === 'critical')
    const infoIdx     = allSpans.findIndex((s) => s.textContent === 'info')
    expect(criticalIdx).toBeGreaterThanOrEqual(0)
    expect(infoIdx).toBeGreaterThanOrEqual(0)
    expect(criticalIdx).toBeLessThan(infoIdx)
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

describe('Inspector Advisory Queue group-by-rule toggle', () => {
  beforeEach(() => {
    useUIStore.setState({ selectedNodeId: null, annotations: {}, selectedEdgeId: null, selectedEdgeInfo: null })
    useCloudStore.setState({ nodes: [], importedNodes: [], lastScannedAt: new Date() })
  })

  function setupGlobal(nodes: CloudNode[]): ReturnType<typeof render> {
    // No selectedNodeId → Inspector renders FirstScanSummary (Top Risks view)
    useUIStore.setState({ selectedNodeId: null })
    useCloudStore.setState({ nodes, importedNodes: [], lastScannedAt: new Date() })
    return render(
      <Inspector
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onQuickAction={vi.fn()}
      />
    )
  }

  const lambdaNode = (id: string, label: string): CloudNode => ({
    id,
    label,
    type: 'lambda',
    status: 'running',
    region: 'us-east-1',
    metadata: { timeout: 0 }, // triggers lambda-no-timeout (critical)
  } as CloudNode)

  it('default post-scan view shows TOP RISKS header', () => {
    setupGlobal([lambdaNode('fn-a', 'fn-alpha'), lambdaNode('fn-b', 'fn-beta')])
    expect(screen.getByText('TOP RISKS')).toBeTruthy()
  })

  it('top risks view shows "View all →" button when advisories exist', () => {
    setupGlobal([lambdaNode('fn-a', 'fn-alpha'), lambdaNode('fn-b', 'fn-beta')])
    expect(screen.getByRole('button', { name: 'View all →' })).toBeTruthy()
  })

  it('clicking "View all →" switches to full advisory list with ADVISORIES header', () => {
    setupGlobal([lambdaNode('fn-a', 'fn-alpha'), lambdaNode('fn-b', 'fn-beta')])
    fireEvent.click(screen.getByRole('button', { name: 'View all →' }))
    expect(screen.getByText('ADVISORIES')).toBeTruthy()
  })

  it('toggle button shows "By Node" by default (indicating what you switch to from By Rule)', () => {
    setupGlobal([lambdaNode('fn-a', 'fn-alpha'), lambdaNode('fn-b', 'fn-beta')])
    fireEvent.click(screen.getByRole('button', { name: 'View all →' }))
    // Default is node-grouped, so button label is "By Node" (what you'd switch to would be "By Rule")
    // Per source: groupByRule=false → button text is "By Node"
    expect(screen.getByRole('button', { name: 'By Node' })).toBeTruthy()
  })

  it('clicking By Node toggle switches to rule-grouped view', () => {
    setupGlobal([lambdaNode('fn-a', 'fn-alpha'), lambdaNode('fn-b', 'fn-beta')])
    fireEvent.click(screen.getByRole('button', { name: 'View all →' }))
    fireEvent.click(screen.getByRole('button', { name: 'By Node' }))
    // Rule-grouped view shows rule titles
    expect(screen.getByText('No timeout configured')).toBeTruthy()
  })

  it('toggle button shows "By Rule" when in rule-grouped mode', () => {
    setupGlobal([lambdaNode('fn-a', 'fn-alpha'), lambdaNode('fn-b', 'fn-beta')])
    fireEvent.click(screen.getByRole('button', { name: 'View all →' }))
    fireEvent.click(screen.getByRole('button', { name: 'By Node' }))
    // After toggling to rule view, button label becomes "By Rule" (indicating what you'd switch to next)
    expect(screen.getByRole('button', { name: 'By Rule' })).toBeTruthy()
  })

  it('clicking toggle again switches back to node-grouped view', () => {
    setupGlobal([lambdaNode('fn-a', 'fn-alpha'), lambdaNode('fn-b', 'fn-beta')])
    fireEvent.click(screen.getByRole('button', { name: 'View all →' }))
    // Switch to rule view
    fireEvent.click(screen.getByRole('button', { name: 'By Node' }))
    // Switch back to node view
    fireEvent.click(screen.getByRole('button', { name: 'By Rule' }))
    // Node labels should be visible again
    expect(screen.getByText('fn-alpha')).toBeTruthy()
    expect(screen.getByText('fn-beta')).toBeTruthy()
  })
})
