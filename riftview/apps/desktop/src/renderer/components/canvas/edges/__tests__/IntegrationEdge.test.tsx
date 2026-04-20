import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import IntegrationEdge, { EDGE_TYPE_STYLES } from '../IntegrationEdge'
import { Position } from '@xyflow/react'
import type { EdgeType } from '@riftview/shared'

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>()
  return {
    ...actual,
    BaseEdge: ({ id, path, style }: { id: string; path: string; style?: React.CSSProperties }) => (
      <path id={id} d={path} style={style} data-testid="base-edge" />
    ),
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="edge-label-renderer">{children}</div>
    ),
    getBezierPath: () => ['M 0 0 C 50 0 50 100 100 100', 50, 50] as [string, number, number]
  }
})

const defaultProps = {
  id: 'test-edge',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  source: 'node-a',
  target: 'node-b',
  selected: false,
  animated: false,
  markerStart: undefined,
  markerEnd: undefined,
  interactionWidth: 20
}

describe('IntegrationEdge', () => {
  it('renders without crashing for trigger edge type', () => {
    const { getByTestId } = render(
      <IntegrationEdge {...defaultProps} data={{ isIntegration: true, edgeType: 'trigger' }} />
    )
    expect(getByTestId('base-edge')).toBeTruthy()
  })

  it('renders without crashing for subscription edge type', () => {
    const { getByTestId } = render(
      <IntegrationEdge {...defaultProps} data={{ isIntegration: true, edgeType: 'subscription' }} />
    )
    expect(getByTestId('base-edge')).toBeTruthy()
  })

  it('renders without crashing for origin edge type', () => {
    const { getByTestId } = render(
      <IntegrationEdge {...defaultProps} data={{ isIntegration: true, edgeType: 'origin' }} />
    )
    expect(getByTestId('base-edge')).toBeTruthy()
  })

  it('renders edge label renderer with label text', () => {
    const { getByTestId, getByText } = render(
      <IntegrationEdge {...defaultProps} data={{ isIntegration: true, edgeType: 'trigger' }} />
    )
    expect(getByTestId('edge-label-renderer')).toBeTruthy()
    expect(getByText('triggers')).toBeTruthy()
  })

  it('renders correct label for subscription', () => {
    const { getByText } = render(
      <IntegrationEdge {...defaultProps} data={{ isIntegration: true, edgeType: 'subscription' }} />
    )
    expect(getByText('subscribes to')).toBeTruthy()
  })

  it('renders correct label for origin', () => {
    const { getByText } = render(
      <IntegrationEdge {...defaultProps} data={{ isIntegration: true, edgeType: 'origin' }} />
    )
    expect(getByText('serves')).toBeTruthy()
  })

  it('applies correct stroke color for trigger', () => {
    const { getByTestId } = render(
      <IntegrationEdge {...defaultProps} data={{ isIntegration: true, edgeType: 'trigger' }} />
    )
    const edge = getByTestId('base-edge')
    // Browser normalizes hex to rgb
    expect(edge.style.stroke).toMatch(/rgb\(245,\s*158,\s*11\)|#f59e0b/)
  })

  it('applies correct stroke color for subscription', () => {
    const { getByTestId } = render(
      <IntegrationEdge {...defaultProps} data={{ isIntegration: true, edgeType: 'subscription' }} />
    )
    const edge = getByTestId('base-edge')
    expect(edge.style.stroke).toMatch(/rgb\(20,\s*184,\s*166\)|#14b8a6/)
  })

  it('applies correct stroke color for origin', () => {
    const { getByTestId } = render(
      <IntegrationEdge {...defaultProps} data={{ isIntegration: true, edgeType: 'origin' }} />
    )
    const edge = getByTestId('base-edge')
    expect(edge.style.stroke).toMatch(/rgb\(99,\s*102,\s*241\)|#6366f1/)
  })

  it('falls back to trigger when data is undefined', () => {
    const { getByTestId } = render(<IntegrationEdge {...defaultProps} data={undefined} />)
    const edge = getByTestId('base-edge')
    expect(edge.style.stroke).toMatch(/rgb\(245,\s*158,\s*11\)|#f59e0b/)
  })
})

describe('EDGE_TYPE_STYLES', () => {
  const edgeTypes: EdgeType[] = ['trigger', 'subscription', 'origin']

  it('has entries for all three edge types', () => {
    expect(Object.keys(EDGE_TYPE_STYLES)).toHaveLength(3)
    edgeTypes.forEach((t) => {
      expect(EDGE_TYPE_STYLES[t]).toBeDefined()
    })
  })

  it('has correct color for trigger', () => {
    expect(EDGE_TYPE_STYLES.trigger.color).toBe('#f59e0b')
  })

  it('has correct color for subscription', () => {
    expect(EDGE_TYPE_STYLES.subscription.color).toBe('#14b8a6')
  })

  it('has correct color for origin', () => {
    expect(EDGE_TYPE_STYLES.origin.color).toBe('#6366f1')
  })

  it('has correct label for trigger', () => {
    expect(EDGE_TYPE_STYLES.trigger.label).toBe('triggers')
  })

  it('has correct label for subscription', () => {
    expect(EDGE_TYPE_STYLES.subscription.label).toBe('subscribes to')
  })

  it('has correct label for origin', () => {
    expect(EDGE_TYPE_STYLES.origin.label).toBe('serves')
  })
})
