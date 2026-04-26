import { render, screen, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ResourceNode } from '../../../../../src/renderer/components/canvas/nodes/ResourceNode'
import { useUIStore } from '../../../../../src/renderer/store/ui'
import type { NodeProps } from '@xyflow/react'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' }
}))

vi.mock('../../../../../src/renderer/components/canvas/nodes/ActionRail', () => ({
  ActionRail: () => null
}))

function makeProps(nodeType: string, metadata: Record<string, unknown> = {}): NodeProps {
  return {
    id: 'test-node-001',
    type: 'resource',
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    data: {
      label: 'my-function',
      nodeType,
      status: 'running',
      region: 'us-east-1',
      metadata
    }
  } as unknown as NodeProps
}

describe('ResourceNode metric badges', () => {
  beforeEach(() => {
    useUIStore.setState({ pluginNodeTypes: {} } as Parameters<typeof useUIStore.setState>[0])
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    // clean up window.riftview
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).riftview
  })

  it('calls fetchMetrics with nodeType=lambda for a lambda node', async () => {
    const fetchMetrics = vi.fn().mockResolvedValue([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).riftview = { fetchMetrics }

    render(<ResourceNode {...makeProps('aws:lambda', { functionName: 'my-fn' })} />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchMetrics).toHaveBeenCalledOnce()
    expect(fetchMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ nodeType: 'aws:lambda', resourceId: 'my-fn' })
    )
  })

  it('renders metric badges when metrics are returned', async () => {
    const fetchMetrics = vi.fn().mockResolvedValue([
      { name: 'Invocations', value: 42, unit: '' },
      { name: 'Duration', value: 123, unit: 'ms' }
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).riftview = { fetchMetrics }

    render(<ResourceNode {...makeProps('aws:lambda')} />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('Invocations')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('123ms')).toBeInTheDocument()
  })

  it('does not call fetchMetrics for non-metric types (s3)', async () => {
    const fetchMetrics = vi.fn().mockResolvedValue([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).riftview = { fetchMetrics }

    render(<ResourceNode {...makeProps('aws:s3')} />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchMetrics).not.toHaveBeenCalled()
  })

  it('clears the interval on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const fetchMetrics = vi.fn().mockResolvedValue([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).riftview = { fetchMetrics }

    const { unmount } = render(
      <ResourceNode {...makeProps('aws:rds', { dbInstanceId: 'my-db' })} />
    )
    await act(async () => {
      await Promise.resolve()
    })

    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
  })
})
