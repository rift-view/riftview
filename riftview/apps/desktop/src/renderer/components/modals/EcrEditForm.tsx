import { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { EcrEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: EcrEditParams) => void
}

export default function EcrEditForm({ node, onChange }: Props): React.JSX.Element {
  const repositoryName = (node.metadata.repositoryName as string) ?? node.label
  const [imageTagMutability, setImageTagMutability] = useState<'MUTABLE' | 'IMMUTABLE'>(
    (node.metadata.imageTagMutability as 'MUTABLE' | 'IMMUTABLE') ?? 'MUTABLE'
  )
  const [scanOnPush, setScanOnPush] = useState<boolean>(
    (node.metadata.scanOnPush as boolean) ?? false
  )

  const emit = (mut: 'MUTABLE' | 'IMMUTABLE', sop: boolean): void =>
    onChange({ resource: 'ecr-repo', repositoryName, imageTagMutability: mut, scanOnPush: sop })

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">Repository Name</span>
        <input className="form-input" style={{ opacity: 0.6 }} value={repositoryName} readOnly />
      </div>
      <div className="form-field">
        <span className="label">Image Tag Mutability</span>
        <select
          className="form-select"
          value={imageTagMutability}
          onChange={(e) => {
            const v = e.target.value as 'MUTABLE' | 'IMMUTABLE'
            setImageTagMutability(v)
            emit(v, scanOnPush)
          }}
        >
          <option value="MUTABLE">MUTABLE</option>
          <option value="IMMUTABLE">IMMUTABLE</option>
        </select>
      </div>
      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={scanOnPush}
          onChange={(e) => {
            setScanOnPush(e.target.checked)
            emit(imageTagMutability, e.target.checked)
          }}
        />
        Scan on Push
      </label>
    </div>
  )
}
