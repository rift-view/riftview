import { useState } from 'react'
import type { AlbParams } from '../../types/create'
import { useCloudStore } from '../../store/cloud'

interface Props {
  onChange: (p: AlbParams) => void
  showErrors?: boolean
}

export function AlbForm({ onChange, showErrors }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const vpcs = nodes.filter((n) => n.type === 'vpc')
  const subnets = nodes.filter((n) => n.type === 'subnet')
  const sgs = nodes.filter((n) => n.type === 'security-group')

  const [form, setForm] = useState<Omit<AlbParams, 'resource'>>({
    name: '',
    scheme: 'internet-facing',
    subnetIds: [],
    securityGroupIds: [],
    vpcId: ''
  })

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]): void => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange({ resource: 'alb', ...next })
  }

  const err = showErrors ?? false
  const filteredSubnets = form.vpcId ? subnets.filter((s) => s.parentId === form.vpcId) : subnets
  const filteredSgs = form.vpcId ? sgs.filter((s) => s.parentId === form.vpcId) : sgs

  const nameInvalid = err && !form.name
  const subnetsInvalid = err && form.subnetIds.length < 2
  const sgsInvalid = err && form.securityGroupIds.length < 1

  return (
    <div className="form-group">
      <div className={'form-field' + (nameInvalid ? ' -invalid' : '')}>
        <span className="label">Name</span>
        <input
          className="form-input"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
        />
      </div>
      <div className="form-field">
        <span className="label">Scheme</span>
        <select
          className="form-select"
          value={form.scheme}
          onChange={(e) => update('scheme', e.target.value as AlbParams['scheme'])}
        >
          <option value="internet-facing">Internet-facing</option>
          <option value="internal">Internal</option>
        </select>
      </div>
      {vpcs.length > 0 && (
        <div className="form-field">
          <span className="label">VPC</span>
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
      <div className={'form-field' + (subnetsInvalid ? ' -invalid' : '')}>
        <span className="label">Subnets (select ≥2)</span>
        {filteredSubnets.length === 0 ? (
          <div className="form-helper">No subnets available</div>
        ) : (
          filteredSubnets.map((s) => (
            <label key={s.id} className="form-checkbox">
              <input
                type="checkbox"
                checked={form.subnetIds.includes(s.id)}
                onChange={(e) => {
                  const ids = form.subnetIds
                  update(
                    'subnetIds',
                    e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id)
                  )
                }}
              />
              {s.label} ({s.id})
            </label>
          ))
        )}
      </div>
      <div className={'form-field' + (sgsInvalid ? ' -invalid' : '')}>
        <span className="label">Security Groups</span>
        {filteredSgs.length === 0 ? (
          <div className="form-helper">No security groups available</div>
        ) : (
          filteredSgs.map((sg) => (
            <label key={sg.id} className="form-checkbox">
              <input
                type="checkbox"
                checked={form.securityGroupIds.includes(sg.id)}
                onChange={(e) => {
                  const ids = form.securityGroupIds
                  update(
                    'securityGroupIds',
                    e.target.checked ? [...ids, sg.id] : ids.filter((x) => x !== sg.id)
                  )
                }}
              />
              {sg.label} ({sg.id})
            </label>
          ))
        )}
      </div>
    </div>
  )
}
