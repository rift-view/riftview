import { useState } from 'react'
import type { CloudNode } from '@riftview/shared'
import type { S3EditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: S3EditParams) => void
}

export default function S3EditForm({ node, onChange }: Props): React.JSX.Element {
  const [versioning, setVersioning] = useState(!!node.metadata.versioning)
  const [blockPublic, setBlockPublic] = useState(!!node.metadata.blockPublicAccess)

  const emit = (overrides: Partial<S3EditParams>): void =>
    onChange({ resource: 's3', versioning, blockPublicAccess: blockPublic, ...overrides })

  return (
    <div className="form-group">
      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={versioning}
          onChange={(e) => {
            setVersioning(e.target.checked)
            emit({ versioning: e.target.checked })
          }}
        />
        Versioning
      </label>
      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={blockPublic}
          onChange={(e) => {
            setBlockPublic(e.target.checked)
            emit({ blockPublicAccess: e.target.checked })
          }}
        />
        Block public access
      </label>
    </div>
  )
}
