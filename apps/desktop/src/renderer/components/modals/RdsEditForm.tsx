import { useState } from 'react'
import type { CloudNode } from '@riftview/shared'
import type { RdsEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: RdsEditParams) => void
}

export default function RdsEditForm({ node, onChange }: Props): React.JSX.Element {
  const [cls, setCls] = useState((node.metadata.dbInstanceClass as string) ?? 'db.t3.micro')
  const [multiAZ, setMultiAZ] = useState(!!node.metadata.multiAZ)
  const [delProt, setDelProt] = useState(!!node.metadata.deletionProtection)

  const emit = (overrides: Partial<RdsEditParams>): void =>
    onChange({
      resource: 'rds',
      dbInstanceClass: cls,
      multiAZ,
      deletionProtection: delProt,
      ...overrides
    })

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">Instance class</span>
        <select
          className="form-select"
          value={cls}
          onChange={(e) => {
            setCls(e.target.value)
            emit({ dbInstanceClass: e.target.value })
          }}
        >
          {['db.t3.micro', 'db.t3.small', 'db.m5.large'].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={multiAZ}
          onChange={(e) => {
            setMultiAZ(e.target.checked)
            emit({ multiAZ: e.target.checked })
          }}
        />
        Multi-AZ
      </label>
      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={delProt}
          onChange={(e) => {
            setDelProt(e.target.checked)
            emit({ deletionProtection: e.target.checked })
          }}
        />
        Deletion protection
      </label>
    </div>
  )
}
