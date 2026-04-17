import { render, screen } from '@testing-library/react'
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

function n(id: string, integrations?: { targetId: string; edgeType: 'trigger' | 'origin' | 'subscription' }[]): CloudNode {
  return {
    id,
    label: id,
    type: 'lambda',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    integrations: integrations ?? [],
  }
}

function setup(nodes: CloudNode[], sourceId: string): ReturnType<typeof render> {
  useUIStore.setState({ selectedNodeId: sourceId, blastRadiusId: sourceId })
  useCloudStore.setState({ nodes, importedNodes: [] })
  return render(
    <Inspector
      onDelete={vi.fn()}
      onEdit={vi.fn()}
      onQuickAction={vi.fn()}
    />
  )
}

describe('Inspector BLAST RADIUS section', () => {
  beforeEach(() => {
    useUIStore.setState({
      selectedNodeId: null,
      blastRadiusId: null,
      annotations: {},
      selectedEdgeId: null,
      selectedEdgeInfo: null,
    })
    useCloudStore.setState({ nodes: [], importedNodes: [] })
  })

  it('does not render BLAST RADIUS section when blastRadiusId !== selectedId', () => {
    useUIStore.setState({ selectedNodeId: 'A', blastRadiusId: 'B' })
    useCloudStore.setState({ nodes: [n('A'), n('B')], importedNodes: [] })
    render(<Inspector onDelete={vi.fn()} onEdit={vi.fn()} onQuickAction={vi.fn()} />)
    expect(screen.queryByText('BLAST RADIUS')).toBeNull()
  })

  it('renders BLAST RADIUS section header when blastRadiusId === selectedId', () => {
    setup([n('A', [{ targetId: 'B', edgeType: 'trigger' }]), n('B')], 'A')
    expect(screen.getByText('BLAST RADIUS')).toBeTruthy()
  })

  it('shows reach summary with upstream/downstream counts', () => {
    // X→A (upstream), A→Y (downstream)
    setup(
      [
        n('X', [{ targetId: 'A', edgeType: 'trigger' }]),
        n('A', [{ targetId: 'Y', edgeType: 'trigger' }]),
        n('Y'),
      ],
      'A',
    )
    expect(screen.getByText(/1 upstream/)).toBeTruthy()
    expect(screen.getByText(/1 downstream/)).toBeTruthy()
  })

  it('shows "No known dependencies" for isolated source', () => {
    setup([n('SOLO')], 'SOLO')
    expect(screen.getByText(/No known dependencies/)).toBeTruthy()
  })

  it('renders UPSTREAM group header when there is an upstream member', () => {
    setup(
      [
        n('X', [{ targetId: 'A', edgeType: 'trigger' }]),
        n('A'),
      ],
      'A',
    )
    expect(screen.getByText(/UPSTREAM/)).toBeTruthy()
  })

  it('renders DOWNSTREAM group header when there is a downstream member', () => {
    setup(
      [
        n('A', [{ targetId: 'Y', edgeType: 'trigger' }]),
        n('Y'),
      ],
      'A',
    )
    expect(screen.getByText(/DOWNSTREAM/)).toBeTruthy()
  })

  it('shows COPY and CLEAR buttons', () => {
    setup([n('A', [{ targetId: 'B', edgeType: 'trigger' }]), n('B')], 'A')
    expect(screen.getByText('COPY')).toBeTruthy()
    expect(screen.getByText('CLEAR')).toBeTruthy()
  })
})
