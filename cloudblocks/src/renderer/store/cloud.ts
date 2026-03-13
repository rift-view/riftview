import { create, createStore } from 'zustand'
import type { CloudNode, ScanDelta, Settings } from '../types/cloud'

export type { Settings }

const DEFAULT_SETTINGS: Settings = {
  deleteConfirmStyle: 'type-to-confirm',
  scanInterval: 30,
}

interface CloudState {
  nodes:          CloudNode[]
  selectedNodeId: string | null
  scanStatus:     'idle' | 'scanning' | 'error'
  profile:        string
  region:         string
  view:           'topology' | 'graph'
  errorMessage:   string | null
  pendingNodes:     CloudNode[]
  cliOutput:        Array<{ line: string; stream: 'stdout' | 'stderr' }>
  commandPreview:   string[]
  pendingCommand:   string[][] | null
  activeCreate:     { resource: string; view: 'topology' | 'graph' } | null
  keyPairs:         string[]
  settings:         Settings

  applyDelta:     (delta: ScanDelta) => void
  selectNode:     (id: string | null) => void
  setScanStatus:  (status: 'idle' | 'scanning' | 'error') => void
  setProfile:     (profile: string) => void
  setRegion:      (region: string) => void
  setView:        (view: 'topology' | 'graph') => void
  setError:       (msg: string | null) => void
  addPendingNode:    (node: CloudNode) => void
  removePendingNode: (id: string) => void
  clearPendingNodes: () => void
  appendCliOutput:   (entry: { line: string; stream: 'stdout' | 'stderr' }) => void
  clearCliOutput:    () => void
  setCommandPreview: (cmd: string[]) => void
  setPendingCommand: (cmds: string[][] | null) => void
  setActiveCreate:   (val: { resource: string; view: 'topology' | 'graph' } | null) => void
  setKeyPairs:       (pairs: string[]) => void
  loadSettings:      () => Promise<void>
  saveSettings:      (s: Settings) => Promise<void>
}

export const useCloudStore = create<CloudState>((set) => ({
  nodes:          [],
  selectedNodeId: null,
  scanStatus:     'idle',
  profile:        'default',
  region:         'us-east-1',
  view:           'topology',
  errorMessage:   null,
  pendingNodes:   [],
  cliOutput:      [],
  commandPreview: [],
  pendingCommand: null,
  activeCreate:   null,
  keyPairs:       [],
  settings:       DEFAULT_SETTINGS,

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

  addPendingNode: (node) =>
    set((state) => ({ pendingNodes: [...state.pendingNodes, node] })),

  removePendingNode: (id) =>
    set((state) => ({ pendingNodes: state.pendingNodes.filter((n) => n.id !== id) })),

  clearPendingNodes: () => set({ pendingNodes: [] }),

  appendCliOutput: (entry) =>
    set((state) => ({ cliOutput: [...state.cliOutput, entry] })),

  clearCliOutput: () => set({ cliOutput: [] }),

  setCommandPreview: (cmd) => set({ commandPreview: cmd }),
  setPendingCommand: (cmds) => set({ pendingCommand: cmds }),

  setActiveCreate: (val) => set({ activeCreate: val }),
  setKeyPairs: (pairs) => set({ keyPairs: pairs }),

  loadSettings: async () => {
    const s = await window.cloudblocks.getSettings()
    set({ settings: s })
  },
  saveSettings: async (s: Settings) => {
    await window.cloudblocks.setSettings(s)
    set({ settings: s })
  },
}))

export function createCloudStore() {
  return createStore<CloudState>((set) => ({
    nodes:          [],
    selectedNodeId: null,
    scanStatus:     'idle',
    profile:        'default',
    region:         'us-east-1',
    view:           'topology',
    errorMessage:   null,
    pendingNodes:   [],
    cliOutput:      [],
    commandPreview: [],
    pendingCommand: null,
    activeCreate:   null,
    keyPairs:       [],
    settings:       DEFAULT_SETTINGS,

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

    addPendingNode: (node) =>
      set((state) => ({ pendingNodes: [...state.pendingNodes, node] })),

    removePendingNode: (id) =>
      set((state) => ({ pendingNodes: state.pendingNodes.filter((n) => n.id !== id) })),

    clearPendingNodes: () => set({ pendingNodes: [] }),

    appendCliOutput: (entry) =>
      set((state) => ({ cliOutput: [...state.cliOutput, entry] })),

    clearCliOutput: () => set({ cliOutput: [] }),

    setCommandPreview: (cmd) => set({ commandPreview: cmd }),
    setPendingCommand: (cmds) => set({ pendingCommand: cmds }),

    setActiveCreate: (val) => set({ activeCreate: val }),
    setKeyPairs: (pairs) => set({ keyPairs: pairs }),

    loadSettings: async () => {},
    saveSettings: async () => {},
  }))
}
