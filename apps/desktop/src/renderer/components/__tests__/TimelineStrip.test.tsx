import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TimelineStrip } from '../canvas/TimelineStrip'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'

const DEFAULT_PROFILE = { name: 'default' }

function mkVersion(
  id: string,
  ts: string,
  overrides: Partial<{
    profile: string
    region: string
    nodeCount: number
  }> = {}
): Record<string, unknown> {
  return {
    id,
    timestamp: ts,
    profile: overrides.profile ?? 'default',
    region: overrides.region ?? 'us-east-1',
    endpoint: null,
    contentHash: 'hash-' + id,
    scanMeta: {
      nodeCount: overrides.nodeCount ?? 3,
      edgeCount: 0,
      scanErrors: [],
      pluginId: 'aws',
      pluginVersion: '1',
      schemaVersion: 1
    }
  }
}

beforeEach(() => {
  useCloudStore.setState({ profile: DEFAULT_PROFILE, selectedRegions: ['us-east-1'] })
  useUIStore.setState({ canvasMode: 'live', activeSnapshotId: null, activeSnapshot: null })
})

describe('TimelineStrip (RIFT-38)', () => {
  it('renders nothing when no profile is configured', () => {
    useCloudStore.setState({ profile: { name: '' } })
    window.riftview = {
      ...window.riftview,
      listSnapshots: vi.fn().mockResolvedValue([])
    }
    const { container } = render(<TimelineStrip />)
    expect(container.firstChild).toBeNull()
  })

  it('calls listSnapshots with the current profile + region', () => {
    const listSnapshots = vi.fn().mockResolvedValue([])
    window.riftview = { ...window.riftview, listSnapshots }
    render(<TimelineStrip />)
    expect(listSnapshots).toHaveBeenCalledWith({
      profile: 'default',
      region: 'us-east-1',
      limit: 40
    })
  })

  it('renders a dot for each returned version', async () => {
    const rows = [
      mkVersion('ver-1', '2026-04-20T00:00:00Z'),
      mkVersion('ver-2', '2026-04-21T00:00:00Z')
    ]
    window.riftview = {
      ...window.riftview,
      listSnapshots: vi.fn().mockResolvedValue(rows)
    }
    render(<TimelineStrip />)
    await waitFor(() => {
      expect(screen.getByTestId('timeline-dot-ver-1')).toBeInTheDocument()
      expect(screen.getByTestId('timeline-dot-ver-2')).toBeInTheDocument()
    })
  })

  it('clicking a dot loads the snapshot and switches to timeline mode', async () => {
    const rows = [mkVersion('ver-1', '2026-04-20T00:00:00Z')]
    const snap = {
      meta: {
        id: 'ver-1',
        timestamp: '2026-04-20T00:00:00Z',
        profile: 'default',
        region: 'us-east-1',
        endpoint: null,
        scanMeta: {
          nodeCount: 0,
          edgeCount: 0,
          scanErrors: [],
          pluginId: 'aws',
          pluginVersion: '1',
          schemaVersion: 1
        },
        contentHash: 'hash-ver-1'
      },
      nodes: [
        {
          id: 'n1',
          type: 'aws:ec2',
          label: 'host-1',
          status: 'running',
          region: 'us-east-1',
          metadata: {}
        }
      ],
      edges: []
    }
    window.riftview = {
      ...window.riftview,
      listSnapshots: vi.fn().mockResolvedValue(rows),
      readSnapshot: vi.fn().mockResolvedValue(snap)
    }
    render(<TimelineStrip />)
    await waitFor(() => expect(screen.getByTestId('timeline-dot-ver-1')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('timeline-dot-ver-1'))
    await waitFor(() => {
      const s = useUIStore.getState()
      expect(s.canvasMode).toBe('timeline')
      expect(s.activeSnapshotId).toBe('ver-1')
      expect(s.activeSnapshot?.meta.id).toBe('ver-1')
      expect(s.activeSnapshot?.nodes).toHaveLength(1)
    })
  })

  it('renders nothing when list is empty (and not loading)', async () => {
    window.riftview = {
      ...window.riftview,
      listSnapshots: vi.fn().mockResolvedValue([])
    }
    const { container } = render(<TimelineStrip />)
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })
})
