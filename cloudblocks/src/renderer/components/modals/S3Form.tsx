import { useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import type { S3Params } from '../../types/create'

interface Props {
  onChange: (params: S3Params) => void
}

export function S3Form({ onChange }: Props): JSX.Element {
  const currentRegion       = useCloudStore((s) => s.region)
  const [bucketName,        setBucketName]        = useState('')
  const [region,            setRegion]            = useState(currentRegion)
  const [blockPublicAccess, setBlockPublicAccess] = useState(true)

  function update(partial: Partial<{ bucketName: string; region: string; blockPublicAccess: boolean }>): void {
    const next = { bucketName, region, blockPublicAccess, ...partial }
    setBucketName(next.bucketName); setRegion(next.region); setBlockPublicAccess(next.blockPublicAccess)
    onChange({ resource: 's3', ...next })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#060d14', border: '1px solid #30363d',
    borderRadius: '3px', padding: '4px 6px', color: '#eee',
    fontFamily: 'monospace', fontSize: '11px', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { color: '#555', fontSize: '9px', marginBottom: '3px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label><span style={labelStyle}>Bucket Name</span>
        <input style={inputStyle} value={bucketName} onChange={(e) => update({ bucketName: e.target.value })} placeholder="my-unique-bucket-name" /></label>
      <label><span style={labelStyle}>Region</span>
        <input style={inputStyle} value={region} onChange={(e) => update({ region: e.target.value })} /></label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input type="checkbox" checked={blockPublicAccess} onChange={(e) => update({ blockPublicAccess: e.target.checked })} />
        <span style={{ color: '#aaa', fontSize: '11px', fontFamily: 'monospace' }}>Block all public access</span>
      </label>
    </div>
  )
}
