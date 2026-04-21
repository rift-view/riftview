import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Sidebar } from '../Sidebar'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import { useCliStore } from '../../store/cli'
import type { NodeType, CloudNode } from '@riftview/shared'

/**
 * VISUAL CONTRACT suite for the redesigned Sidebar.
 *
 * Behavior (category expand/collapse, filter toggle, drag events, count
 * computation, plugin contribution, SSM prefix grouping, view switching) is
 * covered by `Sidebar.test.tsx` — do NOT duplicate those assertions here.
 *
 * This suite enforces the Rift primitives and the markup SHAPE that the
 * Task 8 restyle must produce: class names, data attributes, the location of
 * the count badge, and the button variants on the view toggle.
 */

vi.mock('../modals/SidebarFilterDialog', () => ({ default: () => null }))

const DEFAULT_SETTINGS = {
  deleteConfirmStyle: 'type-to-confirm' as const,
  scanInterval: 30 as const,
  theme: 'dark' as const,
  showRegionIndicators: true,
  regionColors: {},
  showScanErrorBadges: true
}

function makeNode(id: string, type: NodeType, label = id, region = 'us-east-1'): CloudNode {
  return { id, type, label, region, raw: {} } as CloudNode
}

beforeEach(() => {
  useCloudStore.setState({
    nodes: [makeNode('i-1', 'ec2', 'one')],
    scanStatus: 'idle',
    previousCounts: {},
    scanErrors: [],
    settings: DEFAULT_SETTINGS
  })
  useUIStore.setState({
    view: 'topology',
    activeFilterTypes: new Set<NodeType>(),
    activeSidebarType: null,
    expandedSsmGroups: new Set<string>(),
    pluginNodeTypes: {}
  })
  useCliStore.setState({ commandPreview: [], pendingCommand: null })
})

// Helper: locate the service row whose visible label matches `label`.
// After restyle the row itself must carry the `side-item` class.
function findServiceRow(label: string): HTMLElement {
  const text = screen.getByText(new RegExp(`\\b${label}\\b`, 'i'))
  // Walk up until an ancestor whose class list contains `side-item` appears,
  // or until we run out. If nothing matches, return the nearest <div> so the
  // class assertion in the caller fails with a useful diff.
  let el: HTMLElement | null = text as HTMLElement
  while (el) {
    if (el.classList?.contains('side-item')) return el
    el = el.parentElement
  }
  return (text.closest('div') as HTMLElement) ?? (text as HTMLElement)
}

describe('Sidebar redesign — category header', () => {
  it('category header uses the Rift .label primitive (on itself or a child)', () => {
    const { container } = render(<Sidebar />)
    // Find a header by its known text (Compute is always present).
    const header = screen.getByText(/compute/i)
    // Either the matched element itself, some ancestor up to the sidebar
    // root, or a descendant must carry the `.label` class.
    let hasLabelClass = false
    let cursor: HTMLElement | null = header as HTMLElement
    while (cursor && cursor !== container) {
      if (cursor.classList?.contains('label')) {
        hasLabelClass = true
        break
      }
      cursor = cursor.parentElement
    }
    if (!hasLabelClass) {
      hasLabelClass = Boolean((header as HTMLElement).querySelector?.('.label'))
    }
    expect(hasLabelClass).toBe(true)
  })

  it('category header text is rendered visually uppercase', () => {
    render(<Sidebar />)
    const header = screen.getByText(/compute/i) as HTMLElement
    // Either the element itself or any ancestor up to <body> must declare
    // `text-transform: uppercase` — we sample computed style for simplicity.
    // jsdom only returns inline `style` unless the CSS is parsed; the Rift
    // `.label` primitive sets `text-transform: uppercase` inline via the
    // class, so we check that the class is applied somewhere reachable.
    let cursor: HTMLElement | null = header
    let found = false
    while (cursor) {
      const cls = cursor.className ?? ''
      if (/\blabel\b|\buppercase\b/.test(String(cls))) {
        found = true
        break
      }
      cursor = cursor.parentElement
    }
    expect(found).toBe(true)
  })
})

describe('Sidebar redesign — service row (side-item)', () => {
  it('every service row has class "side-item"', () => {
    render(<Sidebar />)
    const ec2Row = findServiceRow('EC2')
    expect(ec2Row).toHaveClass('side-item')
  })

  it('active service row additionally has side-item--active and data-active="true"', () => {
    useUIStore.setState({
      activeFilterTypes: new Set<NodeType>(['ec2']),
      activeSidebarType: 'ec2'
    })
    render(<Sidebar />)
    const ec2Row = findServiceRow('EC2')
    expect(ec2Row).toHaveClass('side-item')
    expect(ec2Row).toHaveClass('side-item--active')
    expect(ec2Row.getAttribute('data-active')).toBe('true')
  })

  it('non-active service rows do NOT have data-active="true"', () => {
    useUIStore.setState({
      activeFilterTypes: new Set<NodeType>(['ec2']),
      activeSidebarType: 'ec2'
    })
    render(<Sidebar />)
    const lambdaRow = findServiceRow('Lambda')
    expect(lambdaRow).not.toHaveClass('side-item--active')
    const attr = lambdaRow.getAttribute('data-active')
    expect(attr === null || attr === 'false').toBe(true)
  })
})

describe('Sidebar redesign — count badge (side-count)', () => {
  it('count badge element is a child of the service row with class "side-count"', () => {
    useCloudStore.setState({
      nodes: [
        makeNode('i-1', 'ec2', 'one'),
        makeNode('i-2', 'ec2', 'two'),
        makeNode('i-3', 'ec2', 'three')
      ]
    })
    render(<Sidebar />)
    const ec2Row = findServiceRow('EC2')
    const badge = ec2Row.querySelector('.side-count') as HTMLElement | null
    expect(badge).not.toBeNull()
    expect(badge!.textContent).toMatch(/3/)
  })
})

describe('Sidebar redesign — view toggle buttons', () => {
  it('renders two real <button>s for Topology and Graph with btn btn-sm classes', () => {
    render(<Sidebar />)
    const topoBtn = screen.getByRole('button', { name: /topology/i })
    const graphBtn = screen.getByRole('button', { name: /graph/i })
    for (const btn of [topoBtn, graphBtn]) {
      expect(btn).toHaveClass('btn')
      expect(btn).toHaveClass('btn-sm')
    }
  })

  it('with view="topology" the Topology button is btn-primary and Graph is btn-ghost', () => {
    useUIStore.setState({ view: 'topology' })
    render(<Sidebar />)
    const topoBtn = screen.getByRole('button', { name: /topology/i })
    const graphBtn = screen.getByRole('button', { name: /graph/i })
    expect(topoBtn).toHaveClass('btn-primary')
    expect(graphBtn).toHaveClass('btn-ghost')
    expect(topoBtn).not.toHaveClass('btn-ghost')
    expect(graphBtn).not.toHaveClass('btn-primary')
  })

  it('with view="graph" the Graph button is btn-primary and Topology is btn-ghost', () => {
    useUIStore.setState({ view: 'graph' })
    render(<Sidebar />)
    const topoBtn = screen.getByRole('button', { name: /topology/i })
    const graphBtn = screen.getByRole('button', { name: /graph/i })
    expect(graphBtn).toHaveClass('btn-primary')
    expect(topoBtn).toHaveClass('btn-ghost')
  })
})

describe('Sidebar redesign — drag affordance preserved', () => {
  it('EC2 row (hasCreate: true) exposes draggable="true"', () => {
    render(<Sidebar />)
    const ec2Row = findServiceRow('EC2')
    expect(ec2Row.getAttribute('draggable')).toBe('true')
  })
})

describe('Sidebar redesign — SSM group row', () => {
  it('SSM prefix group row uses .side-item and contains an expand chevron child', () => {
    // Two ssm-param nodes sharing the /app prefix → one collapsible group.
    useCloudStore.setState({
      nodes: [
        makeNode('p1', 'ssm-param', '/app/db/host'),
        makeNode('p2', 'ssm-param', '/app/db/port')
      ]
    })
    render(<Sidebar />)
    // The group header shows the shared prefix. Locate it by its visible text.
    const groupHeader = screen.getByText(/\/app\/?/)
    let row: HTMLElement | null = groupHeader as HTMLElement
    while (row && !row.classList?.contains('side-item')) {
      row = row.parentElement
    }
    expect(row).not.toBeNull()
    expect(row).toHaveClass('side-item')
    // Chevron: any descendant element explicitly marked as the expand
    // affordance. We accept either a class hook or a data attribute, since
    // Task 8 may pick either — the contract is "chevron is a distinct child".
    const chevron =
      row!.querySelector('[data-chevron]') ??
      row!.querySelector('.side-chevron') ??
      row!.querySelector('[aria-label*="expand" i]')
    expect(chevron).not.toBeNull()
  })
})
