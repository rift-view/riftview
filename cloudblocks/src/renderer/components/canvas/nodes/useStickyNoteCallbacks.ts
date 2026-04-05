import { useCallback } from 'react'
import { useUIStore } from '../../../store/ui'

export function useStickyNoteCallbacks(): {
  onSave:   (id: string, content: string) => void
  onDelete: (id: string) => void
} {
  const updateStickyNote = useUIStore((s) => s.updateStickyNote)
  const removeStickyNote = useUIStore((s) => s.removeStickyNote)

  const onSave = useCallback((id: string, content: string) => {
    updateStickyNote(id, content)
    const store = useUIStore.getState()
    const next = { ...store.annotations }
    if (content) {
      next[`sticky:${id}`] = content
      store.setAnnotation(`sticky:${id}`, content)
    } else {
      delete next[`sticky:${id}`]
      store.clearAnnotation(`sticky:${id}`)
    }
    void window.terminus.saveAnnotations(next)
  }, [updateStickyNote])

  const onDelete = useCallback((id: string) => {
    removeStickyNote(id)
    const store = useUIStore.getState()
    const next  = { ...store.annotations }
    delete next[`sticky:${id}`]
    store.clearAnnotation(`sticky:${id}`)
    void window.terminus.saveAnnotations(next)
  }, [removeStickyNote])

  return { onSave, onDelete }
}
