import { render, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TopologyView } from '../TopologyView'
import { useCloudStore } from '../../../store/cloud'
import { useUIStore } from '../../../store/ui'
import type { NodeChange } from '@xyflow/react'
import type { CloudNode } from '../../../types/cloud'

const mockFitView = vi.fn()
let capturedOnNodesChange: ((changes: NodeChange[]) => void) | undefined

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>()
  return {
    ...actual,
    ReactFlow: ({ onNodesChange }: { onNodesChange?: (changes: NodeChange[]) => void }) => {
      capturedOnNodesChange = onNodesChange
      return <div data-testid="react-flow" />
    },
    useReactFlow: () => ({
      fitView: mockFitView,
      screenToFlowPosition: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    }),
  }
})

const baseVpc = (id: string): CloudNode => ({
  id, type: 'vpc', label: id, status: 'running',
  region: 'us-east-1', metadata: {},
})

beforeEach(() => {
  mockFitView.mockClear()
  capturedOnNodesChange = undefined
  useCloudStore.setState({ nodes: [], pendingNodes: [] })
  useUIStore.setState({
    nodePositions:  { topology: {}, graph: {} },
    savedViews:     [null, null, null, null],
    activeViewSlot: null,
    selectedNodeId: null,
  })
})

describe('TopologyView — one-time fitView', () => {
  it('does not call fitView on initial render with no nodes', () => {
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    expect(mockFitView).not.toHaveBeenCalled()
  })

  it('calls fitView when nodes first become non-empty', () => {
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1')] }) })
    expect(mockFitView).toHaveBeenCalledOnce()
  })

  it('does NOT call fitView again on subsequent node updates', () => {
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1')] }) })
    mockFitView.mockClear()
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1'), baseVpc('vpc-2')] }) })
    expect(mockFitView).not.toHaveBeenCalled()
  })

  it('calls fitView again after node count drops to 0 then rises', () => {
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1')] }) })
    act(() => { useCloudStore.setState({ nodes: [] }) })
    mockFitView.mockClear()
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1')] }) })
    expect(mockFitView).toHaveBeenCalledOnce()
  })
})

describe('TopologyView — position overrides (extent guard)', () => {
  it('does NOT persist position for a node not present in flowNodes', () => {
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    act(() => {
      capturedOnNodesChange?.([
        { type: 'position', id: 'subnet-phantom', position: { x: 5, y: 5 }, dragging: false },
      ])
    })
    expect(useUIStore.getState().nodePositions.topology['subnet-phantom']).toBeUndefined()
  })

  it('persists position for a top-level VPC node after drag-end', () => {
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1')] }) })
    act(() => {
      capturedOnNodesChange?.([
        { type: 'position', id: 'vpc-1', position: { x: 300, y: 400 }, dragging: false },
      ])
    })
    expect(useUIStore.getState().nodePositions.topology['vpc-1']).toEqual({ x: 300, y: 400 })
  })

  it('does NOT persist mid-drag positions (dragging: true)', () => {
    render(<TopologyView onNodeContextMenu={vi.fn()} />)
    act(() => { useCloudStore.setState({ nodes: [baseVpc('vpc-1')] }) })
    act(() => {
      capturedOnNodesChange?.([
        { type: 'position', id: 'vpc-1', position: { x: 300, y: 400 }, dragging: true },
      ])
    })
    expect(useUIStore.getState().nodePositions.topology['vpc-1']).toBeUndefined()
  })
})
