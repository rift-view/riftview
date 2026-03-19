import { create, createStore } from 'zustand'
import type { StoreApi } from 'zustand'
import type { AwsProfile, CloudNode, NodeStatus, ScanDelta, Settings } from '../types/cloud'
import { applyTheme } from '../utils/applyTheme'

export type { Settings }

const DEFAULT_SETTINGS: Settings = {
  deleteConfirmStyle: 'type-to-confirm',
  scanInterval: 30,
  theme: 'dark',
}

interface CloudState {
  nodes:          CloudNode[]
  scanStatus:     'idle' | 'scanning' | 'error'
  lastScannedAt:  Date | null
  profile:        AwsProfile
  region:         string
  errorMessage:   string | null
  pendingNodes:   CloudNode[]
  keyPairs:       string[]
  settings:       Settings
  scanGeneration: number

  applyDelta:        (delta: ScanDelta, generation?: number) => void
  setScanStatus:     (status: 'idle' | 'scanning' | 'error') => void
  setProfile:        (profile: AwsProfile) => void
  setRegion:         (region: string) => void
  setError:          (msg: string | null) => void
  incrementGeneration: () => void
  addPendingNode:    (node: CloudNode) => void
  removePendingNode: (id: string) => void
  clearPendingNodes: () => void
  setKeyPairs:          (pairs: string[]) => void
  loadSettings:         () => Promise<void>
  saveSettings:         (s: Settings) => Promise<void>
  addOptimisticNode:    (node: CloudNode) => void
  removeOptimisticNode: (id: string) => void
}

export const useCloudStore = create<CloudState>((set) => ({
  nodes:          [],
  scanStatus:     'idle',
  lastScannedAt:  null,
  profile:        { name: 'default' },
  region:         'us-east-1',
  errorMessage:   null,
  pendingNodes:   [],
  keyPairs:       [],
  settings:       DEFAULT_SETTINGS,
  scanGeneration: 0,

  applyDelta: (delta, generation) =>
    set((state) => {
      if (generation !== undefined && generation !== state.scanGeneration) return state
      const nodeMap = new Map(state.nodes.map((n) => [n.id, n]))
      for (const n of delta.added)   nodeMap.set(n.id, n)
      for (const n of delta.changed) nodeMap.set(n.id, n)
      // Skip removal of nodes in a transitional state to avoid scan-race flicker
      const protectedStatuses: NodeStatus[] = ['creating', 'deleting']
      const safeToRemove = delta.removed.filter(id => {
        const existing = state.nodes.find(n => n.id === id)
        return !existing || !protectedStatuses.includes(existing.status)
      })
      for (const id of safeToRemove) nodeMap.delete(id)
      return { nodes: Array.from(nodeMap.values()), lastScannedAt: new Date() }
    }),

  setScanStatus:     (status)  => set({ scanStatus: status }),
  setProfile:        (profile) => set((state) => ({ profile, nodes: [], scanStatus: 'idle', lastScannedAt: null, scanGeneration: state.scanGeneration + 1 })),
  setRegion:         (region)  => set((state) => ({ region, nodes: [], scanStatus: 'idle', lastScannedAt: null, scanGeneration: state.scanGeneration + 1 })),
  setError:          (msg)     => set({ errorMessage: msg }),
  incrementGeneration:         () => set((state) => ({ scanGeneration: state.scanGeneration + 1 })),

  addPendingNode: (node) =>
    set((state) => ({ pendingNodes: [...state.pendingNodes, node] })),

  removePendingNode: (id) =>
    set((state) => ({ pendingNodes: state.pendingNodes.filter((n) => n.id !== id) })),

  clearPendingNodes: () => set({ pendingNodes: [] }),

  setKeyPairs: (pairs) => set({ keyPairs: pairs }),

  loadSettings: async () => {
    const s = await window.cloudblocks.getSettings()
    applyTheme(s.theme ?? 'dark')
    set({ settings: s })
  },
  saveSettings: async (s: Settings) => {
    await window.cloudblocks.setSettings(s)
    set({ settings: s })
  },

  addOptimisticNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node] })),

  removeOptimisticNode: (id) =>
    set((state) => ({ nodes: state.nodes.filter((n) => n.id !== id) })),
}))

// test-only factory — allows isolated store instances in unit tests
export function createCloudStore(): StoreApi<CloudState> {
  return createStore<CloudState>((set) => ({
    nodes:          [],
    scanStatus:     'idle',
    lastScannedAt:  null,
    profile:        { name: 'default' },
    region:         'us-east-1',
    errorMessage:   null,
    pendingNodes:   [],
    keyPairs:       [],
    settings:       DEFAULT_SETTINGS,
    scanGeneration: 0,

    applyDelta: (delta, generation) =>
      set((state) => {
        if (generation !== undefined && generation !== state.scanGeneration) return state
        const nodeMap = new Map(state.nodes.map((n) => [n.id, n]))
        for (const n of delta.added)   nodeMap.set(n.id, n)
        for (const n of delta.changed) nodeMap.set(n.id, n)
        // Skip removal of nodes in a transitional state to avoid scan-race flicker
        const protectedStatuses: NodeStatus[] = ['creating', 'deleting']
        const safeToRemove = delta.removed.filter(id => {
          const existing = state.nodes.find(n => n.id === id)
          return !existing || !protectedStatuses.includes(existing.status)
        })
        for (const id of safeToRemove) nodeMap.delete(id)
        return { nodes: Array.from(nodeMap.values()), lastScannedAt: new Date() }
      }),

    setScanStatus:     (status)  => set({ scanStatus: status }),
    setProfile:        (profile) => set((state) => ({ profile, scanGeneration: state.scanGeneration + 1 })),
    setRegion:         (region)  => set((state) => ({ region, scanGeneration: state.scanGeneration + 1 })),
    setError:          (msg)     => set({ errorMessage: msg }),
    incrementGeneration:         () => set((state) => ({ scanGeneration: state.scanGeneration + 1 })),

    addPendingNode: (node) =>
      set((state) => ({ pendingNodes: [...state.pendingNodes, node] })),

    removePendingNode: (id) =>
      set((state) => ({ pendingNodes: state.pendingNodes.filter((n) => n.id !== id) })),

    clearPendingNodes: () => set({ pendingNodes: [] }),

    setKeyPairs: (pairs) => set({ keyPairs: pairs }),

    loadSettings: async () => {},
    saveSettings: async () => {},

    addOptimisticNode: (node) =>
      set((state) => ({ nodes: [...state.nodes, node] })),

    removeOptimisticNode: (id) =>
      set((state) => ({ nodes: state.nodes.filter((n) => n.id !== id) })),
  }))
}
