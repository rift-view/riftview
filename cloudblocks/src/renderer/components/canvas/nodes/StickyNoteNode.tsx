import { useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useUIStore } from '../../../store/ui'

interface StickyNoteData {
  content:  string
  noteId:   string
  onSave:   (id: string, content: string) => void
  onDelete: (id: string) => void
}

export function StickyNoteNode({ data, selected }: NodeProps): React.JSX.Element {
  const d = data as unknown as StickyNoteData
  const [draft, setDraft] = useState(d.content)

  const handleBlur = useCallback(() => {
    d.onSave(d.noteId, draft)
  }, [d, draft])

  const handleDelete = useCallback(() => {
    d.onDelete(d.noteId)
  }, [d])

  return (
    <div
      data-selected={selected}
      style={{
        background:  '#fef08a',
        border:      `${selected ? '2px' : '1px'} solid #ca8a04`,
        borderRadius: 4,
        boxShadow:   selected ? '0 0 8px rgba(202,138,4,0.5)' : '2px 2px 6px rgba(0,0,0,0.25)',
        fontFamily:  'monospace',
        minWidth:    160,
        minHeight:   100,
        width:       180,
        position:    'relative',
        padding:     0,
      }}
    >
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0 }} />

      {/* Header bar */}
      <div
        style={{
          background:   '#fde047',
          borderBottom: '1px solid #ca8a04',
          borderRadius: '3px 3px 0 0',
          padding:      '3px 6px',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 9, color: '#92400e', fontWeight: 700, letterSpacing: '0.05em' }}>
          NOTE
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete() }}
          style={{
            background:  'none',
            border:      'none',
            cursor:      'pointer',
            color:       '#b45309',
            fontSize:    10,
            lineHeight:  1,
            padding:     '0 2px',
          }}
          title="Delete note"
        >
          ✕
        </button>
      </div>

      {/* Editable content */}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        placeholder="Type a note..."
        rows={4}
        className="nodrag"
        style={{
          width:      '100%',
          background: 'transparent',
          border:     'none',
          outline:    'none',
          resize:     'none',
          padding:    '6px 8px',
          fontFamily: 'monospace',
          fontSize:   10,
          color:      '#1c1917',
          boxSizing:  'border-box',
          minHeight:  80,
        }}
      />
    </div>
  )
}

// A standalone hook to expose sticky-note save/delete helpers
// (used by the parent views to wire the callbacks)
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
    void window.cloudblocks.saveAnnotations(next)
  }, [updateStickyNote])

  const onDelete = useCallback((id: string) => {
    removeStickyNote(id)
    const store = useUIStore.getState()
    const next  = { ...store.annotations }
    delete next[`sticky:${id}`]
    store.clearAnnotation(`sticky:${id}`)
    void window.cloudblocks.saveAnnotations(next)
  }, [removeStickyNote])

  return { onSave, onDelete }
}
