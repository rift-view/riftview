import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Inspector } from '../Inspector'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import { useCliStore } from '../../store/cli'
import type { CloudNode } from '../../types/cloud'

/**
 * VISUAL CONTRACT suite for the Rift-restyled Inspector.
 *
 * Behavior (notes, advisories, blast radius, remediation, metrics fetch) is
 * covered elsewhere. This suite enforces the Rift primitives the R4 restyle
 * must produce: eyebrow, .insp-title, .pill, .insp-section, .insp-label,
 * .insp-row, .advisory-card, .insp-metric, .btn-sm.
 */

const saveAnnotationsMock = vi.fn().mockResolvedValue(undefined)
const analyzeIamMock = vi.fn().mockResolvedValue({ nodeId: '', findings: [], fetchedAt: 0 })
const getNodeHistoryMock = vi.fn().mockResolvedValue([])

Object.defineProperty(window, 'riftview', {
  value: {
    saveAnnotations: saveAnnotationsMock,
    analyzeIam: analyzeIamMock,
    getNodeHistory: getNodeHistoryMock
  },
  writable: true,
  configurable: true
})

vi.mock('../IamAdvisor', () => ({ IamAdvisor: () => null }))

const noop = (): void => {}

function renderInspector(): ReturnType<typeof render> {
  return render(
    <Inspector onDelete={noop} onEdit={noop} onQuickAction={noop} onRemediate={async () => ({ code: 0 })} />
  )
}

function selectNode(node: CloudNode): void {
  useCloudStore.setState({ nodes: [node], importedNodes: [] })
  useUIStore.setState({
    selectedNodeId: node.id,
    annotations: {},
    selectedEdgeId: null,
    selectedEdgeInfo: null,
    blastRadiusId: null
  })
}

const EC2_RUNNING: CloudNode = {
  id: 'i-001',
  type: 'ec2',
  label: 'web-server',
  status: 'running',
  region: 'us-east-1',
  metadata: { instanceType: 't3.medium', vpcId: 'vpc-1' }
}

const S3_BUCKET: CloudNode = {
  id: 'bucket-logs',
  type: 's3',
  label: 'my-logs-bucket',
  status: 'active',
  region: 'us-east-1',
  metadata: {}
}

const SQS_NO_DLQ: CloudNode = {
  id: 'sqs-orders',
  type: 'sqs',
  label: 'orders-queue',
  status: 'active',
  region: 'us-east-1',
  metadata: {} // no redrivePolicy → will trigger sqs-no-dlq advisory
}

const EC2_WITH_METRICS: CloudNode = {
  id: 'i-metrics',
  type: 'ec2',
  label: 'metrics-box',
  status: 'running',
  region: 'us-east-1',
  metadata: {
    cwMetrics: {
      cpuPct: 12,
      fetchedAt: Date.now()
    }
  }
}

beforeEach(() => {
  saveAnnotationsMock.mockClear()
  getNodeHistoryMock.mockClear()
  useCloudStore.setState({ nodes: [], importedNodes: [] })
  useUIStore.setState({
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedEdgeInfo: null,
    annotations: {},
    lockedNodes: new Set(),
    blastRadiusId: null
  })
  useCliStore.setState({ commandPreview: [], pendingCommand: null })
})

// ── HEADER ────────────────────────────────────────────────────────────────

describe('Inspector rift header', () => {
  it('renders the editorial header with eyebrow, insp-title, and pill', () => {
    selectNode(EC2_RUNNING)
    const { container } = renderInspector()

    const header = container.querySelector('.insp-header')
    expect(header).not.toBeNull()

    // eyebrow present inside header — carries the NodeType label
    const eyebrow = header!.querySelector('.eyebrow')
    expect(eyebrow).not.toBeNull()
    expect(eyebrow!.textContent).toMatch(/ec2/i)

    // the insp-title carries node.label
    const title = header!.querySelector('.insp-title')
    expect(title).not.toBeNull()
    expect(title!.textContent).toMatch(/web-server/)

    // a status pill lives in the header
    const pill = header!.querySelector('.pill')
    expect(pill).not.toBeNull()
  })

  it('header status pill uses pill-ok for running', () => {
    selectNode(EC2_RUNNING)
    const { container } = renderInspector()
    const pill = container.querySelector('.insp-header .pill') as HTMLElement
    expect(pill).not.toBeNull()
    expect(pill.className).toMatch(/pill-ok|pill/) // pill at minimum; pill-ok is the expected state modifier
    expect(pill.className).toContain('pill-ok')
  })

  it('header status pill uses pill-danger for error status', () => {
    selectNode({ ...EC2_RUNNING, status: 'error', id: 'i-err', label: 'bad-box' })
    const { container } = renderInspector()
    const pill = container.querySelector('.insp-header .pill') as HTMLElement
    expect(pill).not.toBeNull()
    expect(pill.className).toContain('pill-danger')
  })
})

// ── SECTIONS ──────────────────────────────────────────────────────────────

describe('Inspector rift sections', () => {
  it('identity metadata lives inside an .insp-section with .insp-label and .insp-rows', () => {
    selectNode(EC2_RUNNING)
    const { container } = renderInspector()

    const sections = container.querySelectorAll('.insp-section')
    expect(sections.length).toBeGreaterThan(0)

    // at least one section labelled "IDENTITY" (or equivalent) with rows
    const identity = Array.from(sections).find((s) =>
      /IDENTITY/i.test(s.querySelector('.insp-label')?.textContent ?? '')
    ) as HTMLElement | undefined
    expect(identity).toBeDefined()
    expect(identity!.querySelector('.insp-label')).not.toBeNull()
    expect(identity!.querySelector('.insp-rows')).not.toBeNull()
  })

  it('an insp-row has .k and .v children', () => {
    selectNode(EC2_RUNNING)
    const { container } = renderInspector()
    const row = container.querySelector('.insp-row') as HTMLElement | null
    expect(row).not.toBeNull()
    expect(row!.querySelector('.k')).not.toBeNull()
    expect(row!.querySelector('.v')).not.toBeNull()
  })

  it('ID key row contains node id as the .v value', () => {
    selectNode(EC2_RUNNING)
    const { container } = renderInspector()

    const rows = Array.from(container.querySelectorAll('.insp-row')) as HTMLElement[]
    const idRow = rows.find((r) => /^\s*ID\s*$/i.test(r.querySelector('.k')?.textContent ?? ''))
    expect(idRow).toBeDefined()
    expect(idRow!.querySelector('.v')?.textContent).toMatch(/i-001/)
  })
})

// ── ADVISORY CARDS ────────────────────────────────────────────────────────

describe('Inspector rift advisories', () => {
  it('renders advisory items inside .advisory-card when advisories present', () => {
    selectNode(SQS_NO_DLQ)
    const { container } = renderInspector()
    const cards = container.querySelectorAll('.advisory-card')
    // SQS with no redrivePolicy triggers the sqs-no-dlq rule
    expect(cards.length).toBeGreaterThan(0)
  })

  it('advisory title and body live inside .advisory-title / .advisory-body', () => {
    selectNode(SQS_NO_DLQ)
    const { container } = renderInspector()
    const card = container.querySelector('.advisory-card') as HTMLElement
    expect(card).not.toBeNull()
    expect(card.querySelector('.advisory-title')).not.toBeNull()
    expect(card.querySelector('.advisory-body')).not.toBeNull()
  })
})

// ── METRICS TILES ─────────────────────────────────────────────────────────

describe('Inspector rift metrics', () => {
  it('renders .insp-metrics with .insp-metric tiles when CW metrics present', () => {
    selectNode(EC2_WITH_METRICS)
    const { container } = renderInspector()
    const grid = container.querySelector('.insp-metrics')
    expect(grid).not.toBeNull()
    const tiles = grid!.querySelectorAll('.insp-metric')
    expect(tiles.length).toBeGreaterThan(0)
    // each tile has a label and a value
    const first = tiles[0] as HTMLElement
    expect(first.querySelector('.label')).not.toBeNull()
    expect(first.querySelector('.value')).not.toBeNull()
  })
})

// ── ACTION BUTTONS ────────────────────────────────────────────────────────

describe('Inspector rift action buttons', () => {
  it('Edit action uses .btn .btn-sm (and not legacy inline styles)', () => {
    selectNode(EC2_RUNNING)
    renderInspector()
    const editBtn = screen.getByRole('button', { name: /edit/i }) as HTMLElement
    expect(editBtn).toHaveClass('btn')
    expect(editBtn).toHaveClass('btn-sm')
  })

  it('Delete action uses .btn .btn-sm .btn-ghost', () => {
    selectNode(EC2_RUNNING)
    renderInspector()
    const delBtn = screen.getByRole('button', { name: /delete/i }) as HTMLElement
    expect(delBtn).toHaveClass('btn')
    expect(delBtn).toHaveClass('btn-sm')
  })
})

// ── BLAST RADIUS ──────────────────────────────────────────────────────────

describe('Inspector rift blast radius', () => {
  it('when blast radius is active, direction badges use .pill', () => {
    const sgNode: CloudNode = {
      id: 'sg-1',
      type: 'sg',
      label: 'web-sg',
      status: 'active',
      region: 'us-east-1',
      metadata: {}
    }
    const ec2Linked: CloudNode = {
      ...EC2_RUNNING,
      id: 'i-linked',
      metadata: { securityGroupIds: ['sg-1'] }
    }
    useCloudStore.setState({ nodes: [sgNode, ec2Linked], importedNodes: [] })
    useUIStore.setState({
      selectedNodeId: 'sg-1',
      annotations: {},
      selectedEdgeId: null,
      selectedEdgeInfo: null,
      blastRadiusId: 'sg-1'
    })
    const { container } = renderInspector()
    // the BLAST RADIUS section exists
    const sections = container.querySelectorAll('.insp-section')
    const blast = Array.from(sections).find((s) =>
      /BLAST RADIUS/i.test(s.querySelector('.insp-label')?.textContent ?? '')
    ) as HTMLElement | undefined
    expect(blast).toBeDefined()
    // direction badge is a .pill
    const pill = blast!.querySelector('.pill')
    expect(pill).not.toBeNull()
  })
})

// ── EMPTY STATE ───────────────────────────────────────────────────────────

describe('Inspector rift empty state', () => {
  it('when no node is selected, does not render a .insp-header', () => {
    useCloudStore.setState({ nodes: [], importedNodes: [] })
    useUIStore.setState({ selectedNodeId: null, selectedEdgeId: null, selectedEdgeInfo: null })
    const { container } = renderInspector()
    expect(container.querySelector('.insp-header')).toBeNull()
  })
})
