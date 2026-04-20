import { useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import type { S3Params } from '../../types/create'

interface Props {
  onChange: (params: S3Params) => void
  showErrors?: boolean
}

export function S3Form({ onChange, showErrors = false }: Props): React.JSX.Element {
  const currentRegion = useCloudStore((s) => s.region)
  const [bucketName, setBucketName] = useState('')
  const [region, setRegion] = useState(currentRegion)
  const [blockPublicAccess, setBlockPublicAccess] = useState(true)

  function update(
    partial: Partial<{ bucketName: string; region: string; blockPublicAccess: boolean }>
  ): void {
    const next = { bucketName, region, blockPublicAccess, ...partial }
    setBucketName(next.bucketName)
    setRegion(next.region)
    setBlockPublicAccess(next.blockPublicAccess)
    onChange({ resource: 's3', ...next })
  }

  const nameInvalid = showErrors && !bucketName.trim()

  return (
    <div className="form-group">
      <div className={'form-field' + (nameInvalid ? ' -invalid' : '')}>
        <span className="label">Bucket Name</span>
        <input
          className="form-input"
          value={bucketName}
          onChange={(e) => update({ bucketName: e.target.value })}
          placeholder="my-unique-bucket-name"
        />
      </div>
      <div className="form-field">
        <span className="label">Region</span>
        <input
          className="form-input"
          value={region}
          onChange={(e) => update({ region: e.target.value })}
        />
      </div>
      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={blockPublicAccess}
          onChange={(e) => update({ blockPublicAccess: e.target.checked })}
        />
        Block all public access
      </label>
    </div>
  )
}
