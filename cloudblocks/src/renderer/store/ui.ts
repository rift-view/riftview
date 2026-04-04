import { create } from 'zustand'
import type { NodeType, CloudNode, CustomEdge } from '../types/cloud'
import type { NodeTypeMetadata } from '../types/plugin'

export interface NodeFilter {
  id:    string
  label: string
  test:  (node: CloudNode) => boolean
}

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
  selectedNodeIds:    Set<string>
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
  collapsedVpcs:      Set<string>
  collapsedApigws:    Set<string>
  expandedGroups:     Set<string>
  showAbout:          boolean
  showSettings:       boolean
  annotations:        Record<string, string>
  stickyNotes:        StickyNote[]
  driftFilterActive:      boolean
  driftBannerDismissed:   boolean
  activeFilters:          NodeFilter[]
  activeFilterTypes:      Set<NodeType>
  activeSidebarType:      NodeType | null
  pluginNodeTypes:        Record<string, NodeTypeMetadata>
  zoneSizes:              Record<string, { width: number; height: number }>
  customEdges:            CustomEdge[]
  isExporting:            boolean

  setView:              (view: ViewKey) => void
  selectNode:           (id: string | null) => void
  setSelectedNodeIds:   (ids: Set<string>) => void
  clearSelectedNodeIds: () => void
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
  toggleVpc:            (id: string) => void
  isVpcCollapsed:       (id: string) => boolean
  toggleApigw:          (id: string) => void
  isApigwCollapsed:     (id: string) => boolean
  toggleGroupExpand:    (id: string) => void
  isGroupExpanded:      (id: string) => boolean
  applyTidyLayout:      (view: 'topology' | 'graph', positions: Record<string, { x: number; y: number }>) => void
  setShowAbout:         (v: boolean) => void
  setShowSettings:      (v: boolean) => void
  setAnnotation:        (nodeId: string, text: string) => void
  clearAnnotation:      (nodeId: string) => void
  setAnnotations:       (data: Record<string, string>) => void
  addStickyNote:        (note: StickyNote) => void
  updateStickyNote:     (id: string, content: string) => void
  removeStickyNote:     (id: string) => void
  toggleDriftFilter:      () => void
  setDriftFilterActive:   (active: boolean) => void
  resetDriftFilter:       () => void
  dismissDriftBanner:     () => void
  resetDriftBanner:       () => void
  addFilter:              (filter: NodeFilter) => void
  removeFilter:           (id: string) => void
  clearFilters:           () => void
  toggleSidebarType:      (type: NodeType) => void
  setPluginNodeTypes:     (meta: Record<string, NodeTypeMetadata>) => void
  setZoneSize:            (id: string, size: { width: number; height: number }) => void
  addCustomEdge:          (edge: CustomEdge) => void
  setIsExporting:         (v: boolean) => void
  removeCustomEdge:       (id: string) => void
  updateCustomEdgeLabel:  (id: string, label: string) => void
  updateCustomEdgeColor:  (id: string, color: CustomEdge['color']) => void
  setCustomEdges:         (edges: CustomEdge[]) => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useUIStore = create<UIState>((set, get) => ({
  view:              'topology',
  selectedNodeId:    null,
  selectedNodeIds:   new Set<string>(),
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
  collapsedVpcs:     new Set<string>(),
  collapsedApigws:   new Set<string>(),
  expandedGroups:    new Set<string>(),
  showAbout:         false,
  showSettings:      false,
  annotations:       {},
  stickyNotes:       [],
  driftFilterActive:    false,
  driftBannerDismissed: false,
  activeFilters:        [],
  activeFilterTypes:    new Set<NodeType>(),
  activeSidebarType:    null,
  pluginNodeTypes:      {},
  zoneSizes:            {},
  customEdges:          [],
  isExporting:          false,

  setView:             (view) => set({ view }),
  selectNode:          (id)   => set({ selectedNodeId: id, selectedEdgeId: null, selectedEdgeInfo: null }),
  setSelectedNodeIds:  (ids)  => set({ selectedNodeIds: ids }),
  clearSelectedNodeIds: ()    => set({ selectedNodeIds: new Set<string>() }),
  selectEdge:          (info) => set({ selectedEdgeId: info?.id ?? null, selectedEdgeInfo: info, selectedNodeId: null }),
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
  toggleVpc: (id) =>
    set((s) => {
      const next = new Set(s.collapsedVpcs)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { collapsedVpcs: next }
    }),
  isVpcCollapsed: (id) => get().collapsedVpcs.has(id),
  toggleApigw: (id) =>
    set((s) => {
      const next = new Set(s.collapsedApigws)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { collapsedApigws: next }
    }),
  isApigwCollapsed: (id) => get().collapsedApigws.has(id),
  toggleGroupExpand: (id) =>
    set((s) => {
      const next = new Set(s.expandedGroups)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { expandedGroups: next }
    }),
  isGroupExpanded: (id) => get().expandedGroups.has(id),
  applyTidyLayout: (view, positions) =>
    set((s) => ({
      nodePositions: {
        ...s.nodePositions,
        [view]: { ...s.nodePositions[view], ...positions },
      },
    })),
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
  toggleDriftFilter:      () => set((state) => ({ driftFilterActive: !state.driftFilterActive })),
  setDriftFilterActive:   (active) => set({ driftFilterActive: active }),
  resetDriftFilter:       () => set({ driftFilterActive: false }),
  dismissDriftBanner: () => set({ driftBannerDismissed: true }),
  resetDriftBanner:   () => set({ driftBannerDismissed: false }),
  addFilter: (filter) =>
    set((s) => ({
      activeFilters: [
        ...s.activeFilters.filter((f) => f.id !== filter.id),
        filter,
      ],
    })),
  removeFilter: (id) =>
    set((s) => ({
      activeFilters:     s.activeFilters.filter((f) => f.id !== id),
      activeSidebarType: id === 'sidebar-type' ? null : s.activeSidebarType,
      // Reuse the existing Set reference when it is already empty to avoid
      // triggering a dependency-change loop in Sidebar's useEffect.
      activeFilterTypes: id === 'sidebar-type' && s.activeFilterTypes.size > 0
        ? new Set<NodeType>()
        : s.activeFilterTypes,
    })),
  clearFilters: () => set({ activeFilters: [], activeSidebarType: null, activeFilterTypes: new Set<NodeType>() }),
  setSidebarType: (type) => set({ activeSidebarType: type }),
  toggleSidebarType: (type) =>
    set((s) => {
      const next = new Set(s.activeFilterTypes)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      const firstActive = next.size > 0 ? (next.values().next().value as NodeType) : null
      return { activeFilterTypes: next, activeSidebarType: firstActive }
    }),
  setPluginNodeTypes: (meta) => set({ pluginNodeTypes: meta }),
  setZoneSize: (id, size) =>
    set((s) => ({ zoneSizes: { ...s.zoneSizes, [id]: size } })),
  addCustomEdge: (edge) => set((s) => ({ customEdges: [...s.customEdges, edge] })),
  removeCustomEdge: (id) => set((s) => ({ customEdges: s.customEdges.filter((e) => e.id !== id) })),
  updateCustomEdgeLabel: (id, label) => set((s) => ({
    customEdges: s.customEdges.map((e) => e.id === id ? { ...e, label } : e),
  })),
  updateCustomEdgeColor: (id, color) => set((s) => ({
    customEdges: s.customEdges.map((e) => e.id === id ? { ...e, color } : e),
  })),
  setCustomEdges: (edges) => set({ customEdges: edges }),
  setIsExporting: (v) => set({ isExporting: v }),
}))
