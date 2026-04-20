import { useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

interface StickyNoteData {
  content: string
  noteId: string
  onSave: (id: string, content: string) => void
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
      data-sticky-id={d.noteId}
      className="rift-sticky"
      style={{
        width: 180,
        boxShadow: selected
          ? '0 0 0 1px var(--ember-500), 0 8px 20px -10px oklch(0 0 0 / 0.4)'
          : undefined
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      {/* Header row — NOTE eyebrow + delete glyph */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6
        }}
      >
        <span className="rift-node-eye" style={{ color: 'var(--ember-400)', marginBottom: 0 }}>
          NOTE
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDelete()
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            lineHeight: 1,
            padding: '0 2px'
          }}
          title="Delete note"
        >
          ✕
        </button>
      </div>

      {/* Editable content — textarea stays to preserve existing behaviour */}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        placeholder="Note…"
        rows={4}
        className="nodrag rift-sticky-body"
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          padding: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          lineHeight: 1.5,
          color: 'var(--bone-100)',
          boxSizing: 'border-box',
          minHeight: 56
        }}
      />
    </div>
  )
}
