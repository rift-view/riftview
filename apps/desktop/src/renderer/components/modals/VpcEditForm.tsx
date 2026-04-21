import { useState } from 'react'
import type { CloudNode } from '@riftview/shared'
import type { VpcEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: VpcEditParams) => void
  showErrors?: boolean
}

export default function VpcEditForm({ node, onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState((node.metadata.name as string) ?? node.label)

  const update = (v: string): void => {
    setName(v)
    onChange({ resource: 'vpc', name: v })
  }

  const invalid = !!(showErrors && !name.trim())

  return (
    <div className="form-group">
      <div className={'form-field' + (invalid ? ' -invalid' : '')}>
        <span className="label">Name</span>
        <input className="form-input" value={name} onChange={(e) => update(e.target.value)} />
      </div>
    </div>
  )
}
