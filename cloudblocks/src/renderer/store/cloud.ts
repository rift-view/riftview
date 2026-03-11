import { create } from 'zustand'
import type { CloudNode, ScanDelta } from '../types/cloud'

interface CloudState {
  nodes:          CloudNode[]
  selectedNodeId: string | null
  scanStatus:     'idle' | 'scanning' | 'error'
  profile:        string
  region:         string
  view:           'topology' | 'graph'
  errorMessage:   string | null

  applyDelta:     (delta: ScanDelta) => void
  selectNode:     (id: string | null) => void
  setScanStatus:  (status: 'idle' | 'scanning' | 'error') => void
  setProfile:     (profile: string) => void
  setRegion:      (region: string) => void
  setView:        (view: 'topology' | 'graph') => void
  setError:       (msg: string | null) => void
}

export const useCloudStore = create<CloudState>((set) => ({
  nodes:          [],
  selectedNodeId: null,
  scanStatus:     'idle',
  profile:        'default',
  region:         'us-east-1',
  view:           'topology',
  errorMessage:   null,

  applyDelta: (delta) =>
    set((state) => {
      const nodeMap = new Map(state.nodes.map((n) => [n.id, n]))
      for (const n of delta.added)   nodeMap.set(n.id, n)
      for (const n of delta.changed) nodeMap.set(n.id, n)
      for (const id of delta.removed) nodeMap.delete(id)
      return { nodes: Array.from(nodeMap.values()) }
    }),

  selectNode:    (id)      => set({ selectedNodeId: id }),
  setScanStatus: (status)  => set({ scanStatus: status }),
  setProfile:    (profile) => set({ profile }),
  setRegion:     (region)  => set({ region }),
  setView:       (view)    => set({ view }),
  setError:      (msg)     => set({ errorMessage: msg }),
}))
