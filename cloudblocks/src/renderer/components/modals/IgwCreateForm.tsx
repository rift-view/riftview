import { useState } from 'react'
import type { CreateIgwParams } from '../../types/create'

interface Props {
  onChange: (p: CreateIgwParams) => void
  showErrors?: boolean
}

const inp: React.CSSProperties = {
  width: '100%',
  background: 'var(--cb-bg-panel)',
  border: '1px solid var(--cb-border)',
  borderRadius: 3,
  padding: '3px 6px',
  color: 'var(--cb-text-primary)',
  fontFamily: 'monospace',
  fontSize: 10,
  boxSizing: 'border-box' as const,
}

const lbl: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--cb-text-muted)',
  textTransform: 'uppercase',
  marginBottom: 2,
  marginTop: 8,
}

export function IgwCreateForm({ onChange }: Props): React.JSX.Element {
  const [name, setName] = useState('')

  const emit = (n: string): void => {
    onChange({ resource: 'igw', name: n || undefined })
  }

  return (
    <div>
      <div style={lbl}>Name Tag</div>
      <input
        style={inp}
        value={name}
        placeholder="my-igw"
        onChange={(e) => { setName(e.target.value); emit(e.target.value) }}
      />
    </div>
  )
}
