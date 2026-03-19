import { create } from 'zustand'

const TOAST_DURATION_MS = 2500

type ViewKey = 'topology' | 'graph'

interface SavedView {
  name:      string
  positions: Record<string, { x: number; y: number }>
}

interface UIState {
  view:             ViewKey
  selectedNodeId:   string | null
  activeCreate:     { resource: string; view: ViewKey; dropPosition?: { x: number; y: number } } | null
  toast:            { message: string; type: 'success' | 'error' } | null
  nodePositions:    { topology: Record<string, { x: number; y: number }>; graph: Record<string, { x: number; y: number }> }
  savedViews:       Array<SavedView | null>
  activeViewSlot:   number | null
  showIntegrations: boolean

  setView:              (view: ViewKey) => void
  selectNode:           (id: string | null) => void
  setActiveCreate:      (val: UIState['activeCreate']) => void
  showToast:            (message: string, type?: 'success' | 'error') => void
  clearToast:           () => void
  setNodePosition:      (view: ViewKey, id: string, pos: { x: number; y: number }) => void
  saveView:             (slot: number, name: string, view: ViewKey) => void
  loadView:             (slot: number, view: ViewKey, fitViewFn: () => void) => void
  toggleIntegrations:   () => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useUIStore = create<UIState>((set, get) => ({
  view:             'topology',
  selectedNodeId:   null,
  activeCreate:     null,
  toast:            null,
  nodePositions:    { topology: {}, graph: {} },
  savedViews:       [null, null, null, null],
  activeViewSlot:   null,
  showIntegrations: true,

  setView:         (view) => set({ view }),
  selectNode:      (id)   => set({ selectedNodeId: id }),
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
}))
