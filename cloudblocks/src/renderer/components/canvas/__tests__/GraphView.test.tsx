import { render, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GraphView } from '../GraphView'
import { useCloudStore } from '../../../store/cloud'
import { useUIStore } from '../../../store/ui'
import type { CloudNode } from '../../../types/cloud'

const mockFitView = vi.fn()

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>()
  return {
    ...actual,
    ReactFlow: () => <div data-testid="react-flow" />,
    useReactFlow: () => ({
      fitView: mockFitView,
      screenToFlowPosition: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    }),
  }
})

const vpc = (id: string): CloudNode => ({
  id, type: 'vpc', label: id, status: 'running',
  region: 'us-east-1', metadata: {},
})

beforeEach(() => {
  mockFitView.mockClear()
  useCloudStore.setState({ nodes: [], pendingNodes: [] })
  useUIStore.setState({
    nodePositions: { topology: {}, graph: {} },
    savedViews: [null, null, null, null],
    activeViewSlot: null,
    selectedNodeId: null,
  })
})

describe('GraphView — one-time fitView', () => {
  it('does not call fitView on initial render with no nodes', () => {
    render(<GraphView onNodeContextMenu={vi.fn()} />)
    expect(mockFitView).not.toHaveBeenCalled()
  })

  it('calls fitView when nodes first become non-empty', () => {
    render(<GraphView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [vpc('vpc-1')] }) })
    expect(mockFitView).toHaveBeenCalledOnce()
  })

  it('does NOT call fitView again on subsequent node updates', () => {
    render(<GraphView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [vpc('vpc-1')] }) })
    mockFitView.mockClear()
    act(() => { useCloudStore.setState({ nodes: [vpc('vpc-1'), vpc('vpc-2')] }) })
    expect(mockFitView).not.toHaveBeenCalled()
  })

  it('calls fitView again after node count drops to 0 then rises', () => {
    render(<GraphView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [vpc('vpc-1')] }) })
    act(() => { useCloudStore.setState({ nodes: [] }) })
    mockFitView.mockClear()
    act(() => { useCloudStore.setState({ nodes: [vpc('vpc-1')] }) })
    expect(mockFitView).toHaveBeenCalledOnce()
  })
})
