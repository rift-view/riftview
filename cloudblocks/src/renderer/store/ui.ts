import { create } from 'zustand'
import type { NodeType } from '../types/cloud'

const TOAST_DURATION_MS = 2500

type ViewKey = 'topology' | 'graph'

export interface StickyNote {
  id:       string
  content:  string
  position: { x: number; y: number }
}

interface SavedView {
  name:      string
  positions: Record<string, { x: number; y: number }>
}

export interface SelectedEdgeInfo {
  id:     string
  source: string
  target: string
  label?: string
  data?:  Record<string, unknown>
}

interface UIState {
  view:               ViewKey
  selectedNodeId:     string | null
  selectedEdgeId:     string | null
  selectedEdgeInfo:   SelectedEdgeInfo | null
  activeCreate:       { resource: string; view: ViewKey; dropPosition?: { x: number; y: number } } | null
  toast:              { message: string; type: 'success' | 'error' } | null
  nodePositions:      { topology: Record<string, { x: number; y: number }>; graph: Record<string, { x: number; y: number }> }
  savedViews:         Array<SavedView | null>
  activeViewSlot:     number | null
  showIntegrations:   boolean
  snapToGrid:         boolean
  expandedSsmGroups:  Set<string>
  lockedNodes:        Set<string>
  collapsedSubnets:   Set<string>
  showAbout:          boolean
  showSettings:       boolean
  annotations:        Record<string, string>
  stickyNotes:        StickyNote[]
  driftFilterActive:  boolean
  sidebarFilter:      NodeType | null

  setView:              (view: ViewKey) => void
  selectNode:           (id: string | null) => void
  selectEdge:           (info: SelectedEdgeInfo | null) => void
  setActiveCreate:      (val: UIState['activeCreate']) => void
  showToast:            (message: string, type?: 'success' | 'error') => void
  clearToast:           () => void
  setNodePosition:      (view: ViewKey, id: string, pos: { x: number; y: number }) => void
  saveView:             (slot: number, name: string, view: ViewKey) => void
  loadView:             (slot: number, view: ViewKey, fitViewFn: () => void) => void
  toggleIntegrations:   () => void
  toggleSnapToGrid:     () => void
  toggleSsmGroup:       (prefix: string) => void
  toggleLockNode:       (id: string) => void
  isNodeLocked:         (id: string) => boolean
  toggleSubnet:         (id: string) => void
  isSubnetCollapsed:    (id: string) => boolean
  setShowAbout:         (v: boolean) => void
  setShowSettings:      (v: boolean) => void
  setAnnotation:        (nodeId: string, text: string) => void
  clearAnnotation:      (nodeId: string) => void
  setAnnotations:       (data: Record<string, string>) => void
  addStickyNote:        (note: StickyNote) => void
  updateStickyNote:     (id: string, content: string) => void
  removeStickyNote:     (id: string) => void
  toggleDriftFilter:    () => void
  resetDriftFilter:     () => void
  setSidebarFilter:     (type: NodeType | null) => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useUIStore = create<UIState>((set, get) => ({
  view:              'topology',
  selectedNodeId:    null,
  selectedEdgeId:    null,
  selectedEdgeInfo:  null,
  activeCreate:      null,
  toast:             null,
  nodePositions:     { topology: {}, graph: {} },
  savedViews:        [null, null, null, null],
  activeViewSlot:    null,
  showIntegrations:  true,
  snapToGrid:        false,
  expandedSsmGroups: new Set<string>(),
  lockedNodes:       new Set<string>(),
  collapsedSubnets:  new Set<string>(),
  showAbout:         false,
  showSettings:      false,
  annotations:       {},
  stickyNotes:       [],
  driftFilterActive: false,
  sidebarFilter:     null,

  setView:         (view) => set({ view }),
  selectNode:      (id)   => set({ selectedNodeId: id, selectedEdgeId: null, selectedEdgeInfo: null }),
  selectEdge:      (info) => set({ selectedEdgeId: info?.id ?? null, selectedEdgeInfo: info, selectedNodeId: null }),
  setActiveCreate: (val)  => set({ activeCreate: val }),
  showToast: (message, type = 'success') => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: { message, type } })
    toastTimer = setTimeout(() => {
      set({ toast: null })
      toastTimer = null
    }, TOAST_DURATION_MS)
  },
  clearToast: () => set({ toast: null }),

  setNodePosition: (view, id, pos) =>
    set((s) => ({
      nodePositions: {
        ...s.nodePositions,
        [view]: { ...s.nodePositions[view], [id]: pos },
      },
    })),

  saveView: (slot, name, view) => {
    if (slot < 0 || slot > 3) return
    const positions = { ...get().nodePositions[view] }
    set((s) => {
      const savedViews = [...s.savedViews] as Array<SavedView | null>
      savedViews[slot] = { name, positions }
      return { savedViews, activeViewSlot: slot }
    })
  },

  loadView: (slot, view, fitViewFn) => {
    if (slot < 0 || slot > 3) return
    const saved = get().savedViews[slot]
    if (!saved) return
    set((s) => ({
      nodePositions:  { ...s.nodePositions, [view]: { ...saved.positions } },
      activeViewSlot: slot,
    }))
    fitViewFn()
  },

  toggleIntegrations: () => set((s) => ({ showIntegrations: !s.showIntegrations })),
  toggleSnapToGrid:   () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  toggleSsmGroup: (prefix) =>
    set((s) => {
      const next = new Set(s.expandedSsmGroups)
      if (next.has(prefix)) next.delete(prefix)
      else next.add(prefix)
      return { expandedSsmGroups: next }
    }),
  toggleLockNode: (id) =>
    set((s) => {
      const next = new Set(s.lockedNodes)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { lockedNodes: next }
    }),
  isNodeLocked: (id) => get().lockedNodes.has(id),
  toggleSubnet: (id) =>
    set((s) => {
      const next = new Set(s.collapsedSubnets)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { collapsedSubnets: next }
    }),
  isSubnetCollapsed: (id) => get().collapsedSubnets.has(id),
  setShowAbout:     (v) => set({ showAbout: v }),
  setShowSettings:  (v) => set({ showSettings: v }),
  setAnnotation: (nodeId, text) =>
    set((s) => ({ annotations: { ...s.annotations, [nodeId]: text } })),
  clearAnnotation: (nodeId) =>
    set((s) => {
      const next = { ...s.annotations }
      delete next[nodeId]
      return { annotations: next }
    }),
  setAnnotations: (data) => set({ annotations: data }),
  addStickyNote:    (note)         => set((s) => ({ stickyNotes: [...s.stickyNotes, note] })),
  updateStickyNote: (id, content)  => set((s) => ({ stickyNotes: s.stickyNotes.map((n) => n.id === id ? { ...n, content } : n) })),
  removeStickyNote: (id)           => set((s) => ({ stickyNotes: s.stickyNotes.filter((n) => n.id !== id) })),
  toggleDriftFilter: () => set((state) => ({ driftFilterActive: !state.driftFilterActive })),
  resetDriftFilter:  () => set({ driftFilterActive: false }),
  setSidebarFilter:  (type) => set({ sidebarFilter: type }),
}))
