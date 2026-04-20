import { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { AlbEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: AlbEditParams) => void
  showErrors?: boolean
}

export default function AlbEditForm({ node, onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState((node.metadata.name as string) ?? node.label)
  const update = (v: string): void => {
    setName(v)
    onChange({ resource: 'alb', name: v })
  }
  const invalid = !!(showErrors && !name.trim())
  return (
    <div className="form-group">
      <div className={'form-field' + (invalid ? ' -invalid' : '')}>
        <span className="label">Name Tag</span>
        <input className="form-input" value={name} onChange={(e) => update(e.target.value)} />
      </div>
    </div>
  )
}
