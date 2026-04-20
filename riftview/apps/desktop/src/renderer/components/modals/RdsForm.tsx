import React, { useState } from 'react'
import type { RdsParams } from '../../types/create'
import { useCloudStore } from '../../store/cloud'

interface Props {
  onChange: (p: RdsParams) => void
  showErrors?: boolean
}

export function RdsForm({ onChange, showErrors }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const vpcs = nodes.filter((n) => n.type === 'vpc')

  const [form, setForm] = useState<Omit<RdsParams, 'resource'>>({
    identifier: '',
    engine: 'mysql',
    instanceClass: 'db.t3.micro',
    masterUsername: '',
    masterPassword: '',
    allocatedStorage: 20,
    multiAZ: false,
    publiclyAccessible: false,
    vpcId: '',
    dbSubnetGroupName: ''
  })

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]): void => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange({ resource: 'rds', ...next })
  }

  const err = showErrors ?? false

  return (
    <div className="form-group">
      <div className={'form-field' + (err && !form.identifier ? ' -invalid' : '')}>
        <span className="label">DB instance identifier *</span>
        <input
          className="form-input"
          value={form.identifier}
          onChange={(e) => update('identifier', e.target.value)}
        />
      </div>
      <div className="form-grid-2">
        <div className="form-field">
          <span className="label">Engine</span>
          <select
            className="form-select"
            value={form.engine}
            onChange={(e) => update('engine', e.target.value as RdsParams['engine'])}
          >
            <option value="mysql">MySQL</option>
            <option value="postgres">PostgreSQL</option>
            <option value="mariadb">MariaDB</option>
          </select>
        </div>
        <div className="form-field">
          <span className="label">Instance class</span>
          <select
            className="form-select"
            value={form.instanceClass}
            onChange={(e) => update('instanceClass', e.target.value)}
          >
            {['db.t3.micro', 'db.t3.small', 'db.m5.large'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className={'form-field' + (err && !form.masterUsername ? ' -invalid' : '')}>
        <span className="label">Master username *</span>
        <input
          className="form-input"
          value={form.masterUsername}
          onChange={(e) => update('masterUsername', e.target.value)}
        />
      </div>
      <div className={'form-field' + (err && !form.masterPassword ? ' -invalid' : '')}>
        <span className="label">Master password *</span>
        <input
          className="form-input"
          type="password"
          value={form.masterPassword}
          onChange={(e) => update('masterPassword', e.target.value)}
        />
      </div>
      <div className="form-field">
        <span className="label">Allocated storage (GB)</span>
        <input
          className="form-input"
          type="number"
          value={form.allocatedStorage}
          onChange={(e) => update('allocatedStorage', Number(e.target.value))}
        />
      </div>
      {vpcs.length > 0 && (
        <div className="form-field">
          <span className="label">VPC *</span>
          <select
            className="form-select"
            value={form.vpcId}
            onChange={(e) => update('vpcId', e.target.value)}
          >
            <option value="">— select VPC —</option>
            {vpcs.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} ({v.id})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="form-field">
        <span className="label">DB Subnet Group</span>
        <input
          className="form-input"
          value={form.dbSubnetGroupName ?? ''}
          onChange={(e) => update('dbSubnetGroupName', e.target.value)}
        />
      </div>
      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={form.multiAZ}
          onChange={(e) => update('multiAZ', e.target.checked)}
        />
        Multi-AZ
      </label>
      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={form.publiclyAccessible}
          onChange={(e) => update('publiclyAccessible', e.target.checked)}
        />
        Publicly accessible
      </label>
    </div>
  )
}
