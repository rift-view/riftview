// One-shot boot hook: when VITE_DEMO_MODE=1 and the store has no nodes,
// seed it from DEMO_FIXTURE_NODES. Intentional null-op in normal mode
// and on subsequent renders — the ref guard + node-count check keep
// live scans from being clobbered.
import { useEffect, useRef } from 'react'
import { useCloudStore } from '../store/cloud'
import { isDemoMode } from '../utils/demoMode'
import { DEMO_FIXTURE_NODES } from '../utils/demoFixture'

export function useDemoFixture(): void {
  const didHydrate = useRef(false)

  useEffect(() => {
    if (didHydrate.current) return
    if (!isDemoMode()) return
    const { nodes } = useCloudStore.getState()
    if (nodes.length > 0) return
    useCloudStore.setState({ nodes: DEMO_FIXTURE_NODES, lastScannedAt: new Date() })
    didHydrate.current = true
  }, [])
}
