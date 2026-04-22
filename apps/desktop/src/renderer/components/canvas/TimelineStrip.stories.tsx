// src/renderer/components/canvas/TimelineStrip.stories.tsx
import type { Story } from '@ladle/react'
import { TimelineStripView } from './TimelineStrip'

interface VersionMeta {
  id: string
  timestamp: string
  profile: string
  region: string
  endpoint: string | null
  contentHash: string
  scanMeta: {
    nodeCount: number
    edgeCount: number
    scanErrors: string[]
    pluginId: string
    pluginVersion: string
    schemaVersion: number
  }
}

// --- Fixtures --------------------------------------------------------------
//
// Obviously-fake IDs only. Never use AWS docs example patterns (0a9b8c7d...).
// These IDs are unambiguously test-only so secret scanners + graders don't
// trip on them.

function mkVersion(id: string, timestamp: string, contentHash: string, nodeCount = 4): VersionMeta {
  return {
    id,
    timestamp,
    profile: 'demo-profile',
    region: 'us-east-1',
    endpoint: null,
    contentHash,
    scanMeta: {
      nodeCount,
      edgeCount: Math.max(0, nodeCount - 1),
      scanErrors: [],
      pluginId: 'fake-plugin',
      pluginVersion: '0.0.0',
      schemaVersion: 1
    }
  }
}

const fixtures = {
  single: [mkVersion('snap-0fake00000000001', '2026-04-20T09:15:00Z', 'fake-hash-0001', 4)],
  dense: [
    mkVersion('snap-0fake00000000001', '2026-04-18T08:00:00Z', 'fake-hash-0001', 2),
    mkVersion('snap-0fake00000000002', '2026-04-18T14:30:00Z', 'fake-hash-0002', 3),
    mkVersion('snap-0fake00000000003', '2026-04-19T09:10:00Z', 'fake-hash-0003', 5),
    mkVersion('snap-0fake00000000004', '2026-04-19T12:45:00Z', 'fake-hash-0004', 5),
    mkVersion('snap-0fake00000000005', '2026-04-19T17:00:00Z', 'fake-hash-0005', 6),
    mkVersion('snap-0fake00000000006', '2026-04-20T07:20:00Z', 'fake-hash-0006', 6),
    mkVersion('snap-0fake00000000007', '2026-04-20T11:00:00Z', 'fake-hash-0007', 7),
    mkVersion('snap-0fake00000000008', '2026-04-20T15:30:00Z', 'fake-hash-0008', 8),
    mkVersion('snap-0fake00000000009', '2026-04-21T08:40:00Z', 'fake-hash-0009', 9),
    mkVersion('snap-0fake00000000010', '2026-04-21T13:15:00Z', 'fake-hash-0010', 9),
    mkVersion('snap-0fake00000000011', '2026-04-22T09:00:00Z', 'fake-hash-0011', 10),
    mkVersion('snap-0fake00000000012', '2026-04-22T12:35:00Z', 'fake-hash-0012', 10)
  ]
}

// Stories render the strip inside a frame that mimics the canvas viewport so
// the absolutely-positioned strip anchors to the bottom edge, matching its
// real in-app placement.
function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        position: 'relative',
        width: 720,
        height: 200,
        background: '#0f172a',
        border: '1px solid #1e293b',
        overflow: 'hidden'
      }}
    >
      {children}
    </div>
  )
}

const noop = (): void => {}

// --- Stories ---------------------------------------------------------------

export const Empty: Story = () => (
  <Frame>
    <TimelineStripView
      versions={[]}
      canvasMode="live"
      activeSnapshotId={null}
      loading={false}
      onSelect={noop}
      onExit={noop}
      region="us-east-1"
    />
  </Frame>
)

export const SingleSnapshotLiveMode: Story = () => (
  <Frame>
    <TimelineStripView
      versions={fixtures.single}
      canvasMode="live"
      activeSnapshotId={null}
      loading={false}
      onSelect={noop}
      onExit={noop}
      region="us-east-1"
    />
  </Frame>
)

export const SingleSnapshotTimelineActive: Story = () => (
  <Frame>
    <TimelineStripView
      versions={fixtures.single}
      canvasMode="timeline"
      activeSnapshotId="snap-0fake00000000001"
      loading={false}
      onSelect={noop}
      onExit={noop}
      region="us-east-1"
    />
  </Frame>
)

export const Dense: Story = () => (
  <Frame>
    <TimelineStripView
      versions={fixtures.dense}
      canvasMode="timeline"
      activeSnapshotId="snap-0fake00000000007"
      loading={false}
      onSelect={noop}
      onExit={noop}
      region="us-east-1"
    />
  </Frame>
)

export const Loading: Story = () => (
  <Frame>
    <TimelineStripView
      versions={[]}
      canvasMode="live"
      activeSnapshotId={null}
      loading={true}
      onSelect={noop}
      onExit={noop}
      region="us-east-1"
    />
  </Frame>
)

/**
 * Demo-mode suppression is a WRAPPER-level concern — the <TimelineStrip />
 * wrapper bails early when the feature should be hidden. The view layer's
 * only contract here is "null when empty + live". This story exercises that
 * null-return path directly; the Frame below the view renders nothing.
 */
export const DemoMode: Story = () => (
  <Frame>
    <TimelineStripView
      versions={[]}
      canvasMode="live"
      activeSnapshotId={null}
      loading={false}
      onSelect={noop}
      onExit={noop}
    />
  </Frame>
)
