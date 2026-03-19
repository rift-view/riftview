import { useState } from 'react'

interface Props {
  slot:        number
  initialName: string
  onSave:      (name: string) => void
  onCancel:    () => void
}

export function SaveViewModal({ slot, initialName, onSave, onCancel }: Props): React.JSX.Element {
  const [name, setName] = useState(initialName)

  const btnBase: React.CSSProperties = {
    fontFamily:   'monospace',
    fontSize:     '11px',
    borderRadius: '4px',
    padding:      '4px 16px',
    cursor:       'pointer',
  }

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.55)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         100,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background:   'var(--cb-bg-elevated)',
          border:       '1px solid var(--cb-border-strong)',
          borderRadius: '6px',
          padding:      '20px 24px',
          minWidth:     '280px',
          fontFamily:   'monospace',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, color: 'var(--cb-text)', marginBottom: 12 }}>
          Save View — Slot {slot + 1}
        </div>
        <input
          type="text"
          value={name}
          maxLength={24}
          placeholder="View name"
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  onSave(name)
            if (e.key === 'Escape') onCancel()
          }}
          style={{
            width:        '100%',
            boxSizing:    'border-box',
            background:   'var(--cb-bg)',
            border:       '1px solid var(--cb-border-strong)',
            borderRadius: '3px',
            color:        'var(--cb-text)',
            fontFamily:   'monospace',
            fontSize:     '12px',
            padding:      '5px 8px',
            marginBottom: 14,
            outline:      'none',
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ ...btnBase, background: 'transparent', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(name)}
            style={{ ...btnBase, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-accent)', color: 'var(--cb-accent)' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
