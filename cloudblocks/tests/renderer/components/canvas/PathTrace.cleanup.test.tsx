/**
 * PathTrace.cleanup.test.tsx
 *
 * Verifies that the setInterval used for the path trace staggered reveal
 * animation in CommandView is properly cleared when the component unmounts.
 *
 * Because CommandView depends on ReactFlow context (useReactFlow), we mock
 * @xyflow/react and the utility modules to allow a lightweight render.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { useUIStore } from '../../../../src/renderer/store/ui'
import { useCloudStore } from '../../../../src/renderer/store/cloud'

// ── Mock @xyflow/react ────────────────────────────────────────────────────────

vi.mock('@xyflow/react', () => ({
  ReactFlow:   ({ children }: { children?: React.ReactNode }) => <div data-testid="reactflow">{children}</div>,
  Background:  () => null,
  MiniMap:     () => null,
  useReactFlow: () => ({ fitView: vi.fn(), setNodes: vi.fn() }),
}))

// ── Mock commandLayout (avoids heavy computation in test) ────────────────────

vi.mock('../../../../src/renderer/utils/commandLayout', () => ({
  buildCommandNodes: () => [],
  getTierForNode:    () => 0,
  NODE_TIER:         {},
}))

// ── Mock resolveIntegrationTargetId ───────────────────────────────────────────

vi.mock('../../../../src/renderer/utils/resolveIntegrationTargetId', () => ({
  resolveIntegrationTargetId: (_nodes: unknown, targetId: string) => targetId,
}))

// ── Import component after mocks are established ─────────────────────────────

import { CommandView } from '../../../../src/renderer/components/canvas/CommandView'
import type { CloudNode } from '../../../../src/renderer/types/cloud'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNode(type: CloudNode['type'], id = `id-${type}`): CloudNode {
  return { id, type, label: type, status: 'running', region: 'us-east-1', metadata: {} }
}

const noop = (): void => { /* noop */ }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CommandView — path trace setInterval cleanup on unmount', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    // Seed the store with nodes that have integration edges so path trace
    // has something to walk.
    const apigw  = makeNode('apigw',  'apigw-1')
    const lambda = makeNode('lambda', 'lambda-1')
    const rds    = makeNode('rds',    'rds-1')

    // apigw → lambda → rds
    apigw.integrations  = [{ targetId: 'lambda-1', edgeType: 'trigger' }]
    lambda.integrations = [{ targetId: 'rds-1',    edgeType: 'trigger' }]

    useCloudStore.setState({ nodes: [apigw, lambda, rds] })
    // Set pathTraceId so the staggered-reveal useEffect fires an interval
    useUIStore.setState({ pathTraceId: 'rds-1', blastRadiusId: null })
  })

  afterEach(() => {
    vi.useRealTimers()
    useUIStore.setState({ pathTraceId: null, blastRadiusId: null })
    useCloudStore.setState({ nodes: [] })
  })

  it('does not fire setState after unmount when interval ticks post-unmount', () => {
    const consoleError = vi.spyOn(console, 'error')

    const { unmount } = render(<CommandView onNodeContextMenu={noop} />)

    // Unmount before the interval ticks — cleanup should cancel the timer
    unmount()

    // Advance fake timers well past the 150ms reveal interval × node count
    // If the cleanup did NOT run, this would trigger setState on an unmounted
    // component, causing a React warning via console.error.
    vi.advanceTimersByTime(2000)

    // No React "setState on unmounted component" or act() warnings should have fired
    const reactWarnings = consoleError.mock.calls.filter((args) =>
      typeof args[0] === 'string' && (
        args[0].includes('unmounted component') ||
        args[0].includes('act(') ||
        args[0].includes('memory leak')
      )
    )
    expect(reactWarnings).toHaveLength(0)

    consoleError.mockRestore()
  })

  it('interval ticks are observable while component is mounted', () => {
    // Spy on setInterval to confirm it was called
    const intervalSpy = vi.spyOn(globalThis, 'setInterval')

    const { unmount } = render(<CommandView onNodeContextMenu={noop} />)

    // At least one interval should have been registered for the reveal animation
    expect(intervalSpy.mock.calls.length).toBeGreaterThan(0)

    unmount()
    intervalSpy.mockRestore()
  })
})
