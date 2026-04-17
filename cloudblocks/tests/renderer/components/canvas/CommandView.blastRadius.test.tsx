/**
 * Integration test for blast radius in CommandView.
 *
 * Verifies:
 *  - non-member nodes are passed to ReactFlow with opacity: 0
 *  - fitView is called with member node IDs when blastRadiusId activates
 *  - savedViewport is captured before fit and restored on exit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useUIStore } from '../../../../src/renderer/store/ui'
import { useCloudStore } from '../../../../src/renderer/store/cloud'

// ── ReactFlow mock that captures props ───────────────────────────────────────

const reactFlowNodesSpy = vi.fn()
const fitViewSpy = vi.fn()
const getViewportSpy = vi.fn(() => ({ x: 10, y: 20, zoom: 1.5 }))
const setViewportSpy = vi.fn()

vi.mock('@xyflow/react', () => ({
  ReactFlow: (props: { nodes: unknown[] }): React.JSX.Element => {
    reactFlowNodesSpy(props.nodes)
    return <div data-testid="reactflow" />
  },
  Background: (): null => null,
  MiniMap: (): null => null,
  useReactFlow: () => ({
    fitView: fitViewSpy,
    setNodes: vi.fn(),
    getViewport: getViewportSpy,
    setViewport: setViewportSpy
  })
}))

vi.mock('../../../../src/renderer/utils/commandLayout', () => ({
  buildCommandNodes: (nodes: { id: string; type: string; label: string }[]) =>
    nodes.map((n) => ({
      id: n.id,
      type: 'resource',
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        nodeType: n.type,
        status: 'running',
        region: 'us-east-1',
        metadata: {}
      }
    })),
  getTierForNode: () => 0,
  NODE_TIER: {}
}))

vi.mock('../../../../src/renderer/utils/resolveIntegrationTargetId', () => ({
  resolveIntegrationTargetId: (_nodes: unknown, targetId: string) => targetId
}))

import { CommandView } from '../../../../src/renderer/components/canvas/CommandView'
import type { CloudNode } from '../../../../src/renderer/types/cloud'

function n(
  id: string,
  type: CloudNode['type'] = 'lambda',
  integrations?: { targetId: string; edgeType: 'trigger' | 'origin' | 'subscription' }[]
): CloudNode {
  return {
    id,
    type,
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    integrations: integrations ?? []
  }
}

const noop = (): void => {
  /* noop */
}

describe('CommandView blast radius integration', () => {
  beforeEach(() => {
    reactFlowNodesSpy.mockClear()
    fitViewSpy.mockClear()
    getViewportSpy.mockClear()
    setViewportSpy.mockClear()
    useCloudStore.setState({
      nodes: [
        n('A', 'lambda', [{ targetId: 'B', edgeType: 'trigger' }]),
        n('B', 'rds'),
        n('C', 'ec2') // unrelated — should be hidden
      ]
    })
    useUIStore.setState({ blastRadiusId: null, pathTraceId: null, savedViewport: null })
  })

  afterEach(() => {
    cleanup()
    useUIStore.setState({ blastRadiusId: null, pathTraceId: null, savedViewport: null })
    useCloudStore.setState({ nodes: [] })
  })

  it('activating blast radius sets non-member opacity to 0', () => {
    render(<CommandView onNodeContextMenu={noop} />)

    // Activate blast radius with A as the source — members: A, B. C is non-member.
    useUIStore.setState({ blastRadiusId: 'A' })

    // Re-render triggered by store change — capture latest nodes prop
    render(<CommandView onNodeContextMenu={noop} />)

    // Look at the most recent call capturing nodes
    const lastCall = reactFlowNodesSpy.mock.calls[reactFlowNodesSpy.mock.calls.length - 1]
    const passedNodes = lastCall[0] as { id: string; style?: { opacity?: number } }[]

    const cNode = passedNodes.find((node) => node.id === 'C')
    expect(cNode).toBeDefined()
    expect(cNode?.style?.opacity).toBe(0)

    // A and B should not be opacity 0 (members)
    const aNode = passedNodes.find((node) => node.id === 'A')
    const bNode = passedNodes.find((node) => node.id === 'B')
    expect(aNode?.style?.opacity).not.toBe(0)
    expect(bNode?.style?.opacity).not.toBe(0)
  })

  it('activating blast radius calls fitView with member IDs', () => {
    render(<CommandView onNodeContextMenu={noop} />)
    fitViewSpy.mockClear()

    useUIStore.setState({ blastRadiusId: 'A' })
    render(<CommandView onNodeContextMenu={noop} />)

    expect(fitViewSpy).toHaveBeenCalled()
    const lastCall = fitViewSpy.mock.calls[fitViewSpy.mock.calls.length - 1]
    const arg = lastCall[0] as { nodes: { id: string }[]; duration?: number; padding?: number }
    const ids = arg.nodes.map((x) => x.id).sort()
    expect(ids).toEqual(['A', 'B'])
  })

  it('activating blast radius saves prior viewport, clearing it restores', () => {
    render(<CommandView onNodeContextMenu={noop} />)

    // Activate — saves viewport
    useUIStore.setState({ blastRadiusId: 'A' })
    render(<CommandView onNodeContextMenu={noop} />)
    expect(useUIStore.getState().savedViewport).toEqual({ x: 10, y: 20, zoom: 1.5 })

    // Deactivate — should call setViewport with the saved value and clear
    useUIStore.setState({ blastRadiusId: null })
    render(<CommandView onNodeContextMenu={noop} />)
    expect(setViewportSpy).toHaveBeenCalled()
    expect(useUIStore.getState().savedViewport).toBeNull()
  })

  it('non-members get pointerEvents: none to block clicks', () => {
    render(<CommandView onNodeContextMenu={noop} />)
    useUIStore.setState({ blastRadiusId: 'A' })
    render(<CommandView onNodeContextMenu={noop} />)

    const lastCall = reactFlowNodesSpy.mock.calls[reactFlowNodesSpy.mock.calls.length - 1]
    const passedNodes = lastCall[0] as { id: string; style?: { pointerEvents?: string } }[]
    const cNode = passedNodes.find((node) => node.id === 'C')
    expect(cNode?.style?.pointerEvents).toBe('none')
  })
})
