import { useState } from 'react'
import type { CloudNode } from '@riftview/shared'
import type { ApigwEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: ApigwEditParams) => void
  showErrors?: boolean
}

export default function ApigwEditForm({ node, onChange, showErrors }: Props): React.JSX.Element {
  const initialCors = (node.metadata.corsOrigins as string[]) ?? []
  const [name, setName] = useState(node.label)
  const [corsInputs, setCorsInputs] = useState<string[]>(
    initialCors.length > 0 ? initialCors : ['']
  )

  const err = showErrors ?? false
  const nameInvalid = err && !name.trim()

  const emit = (nextName: string, nextCors: string[]): void => {
    const corsOrigins = nextCors.filter((s) => s.trim() !== '')
    onChange({ resource: 'apigw', apiId: node.id, name: nextName, corsOrigins })
  }

  const updateCors = (newInputs: string[]): void => {
    setCorsInputs(newInputs)
    emit(name, newInputs)
  }

  return (
    <div className="form-group">
      <div className={'form-field' + (nameInvalid ? ' -invalid' : '')}>
        <span className="label">API Name</span>
        <input
          className="form-input"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            emit(e.target.value, corsInputs)
          }}
        />
      </div>

      <div className="form-field">
        <span className="label">CORS Origins</span>
        {corsInputs.map((origin, i) => (
          <div key={i} style={{ display: 'flex', gap: 4, marginTop: i === 0 ? 0 : 4 }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={origin}
              placeholder="https://example.com"
              onChange={(e) => {
                const next = [...corsInputs]
                next[i] = e.target.value
                updateCors(next)
              }}
            />
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                const next = corsInputs.filter((_, j) => j !== i)
                updateCors(next.length > 0 ? next : [''])
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          style={{ marginTop: 6, alignSelf: 'flex-start' }}
          onClick={() => updateCors([...corsInputs, ''])}
        >
          + Add Origin
        </button>
      </div>
    </div>
  )
}
