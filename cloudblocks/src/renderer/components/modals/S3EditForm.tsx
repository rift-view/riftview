import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { S3EditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: S3EditParams) => void }

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }

export default function S3EditForm({ node, onChange }: Props): React.JSX.Element {
  const [versioning, setVersioning] = useState(!!(node.metadata.versioning))
  const [blockPublic, setBlockPublic] = useState(!!(node.metadata.blockPublicAccess))

  const emit = (overrides: Partial<S3EditParams>): void =>
    onChange({ resource: 's3', versioning, blockPublicAccess: blockPublic, ...overrides })

  return (
    <div>
      <label style={row}><input type="checkbox" checked={versioning} onChange={e => { setVersioning(e.target.checked); emit({ versioning: e.target.checked }) }} /><span style={{ fontSize: 10, color: 'var(--cb-text-secondary)' }}>Versioning</span></label>
      <label style={row}><input type="checkbox" checked={blockPublic} onChange={e => { setBlockPublic(e.target.checked); emit({ blockPublicAccess: e.target.checked }) }} /><span style={{ fontSize: 10, color: 'var(--cb-text-secondary)' }}>Block public access</span></label>
    </div>
  )
}
