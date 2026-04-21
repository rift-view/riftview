import type { CloudNode } from '@riftview/shared'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'

/**
 * RIFT-38: returns the node set the canvas should render. In 'live' mode
 * (the default), this is useCloudStore.nodes. In 'timeline' or 'restore'
 * mode, this is the loaded snapshot's nodes — frozen, read-only.
 *
 * Kept as a single source of truth so TopologyView, GraphView, and
 * CommandView all flip in lockstep when the operator scrubs the timeline.
 */
export function useDisplayedNodes(): CloudNode[] {
  const liveNodes = useCloudStore((s) => s.nodes)
  const canvasMode = useUIStore((s) => s.canvasMode)
  const activeSnapshot = useUIStore((s) => s.activeSnapshot)
  if (canvasMode !== 'live' && activeSnapshot) return activeSnapshot.nodes
  return liveNodes
}
