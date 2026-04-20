import React, { useState } from 'react'
import type { LambdaParams } from '../../types/create'
import { useCloudStore } from '../../store/cloud'

interface Props {
  onChange: (p: LambdaParams) => void
  showErrors?: boolean
}

export function LambdaForm({ onChange, showErrors }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const vpcs = nodes.filter((n) => n.type === 'vpc')
  const subnets = nodes.filter((n) => n.type === 'subnet')
  const sgs = nodes.filter((n) => n.type === 'security-group')

  const [form, setForm] = useState<Omit<LambdaParams, 'resource'>>({
    name: '',
    runtime: 'nodejs20.x',
    handler: 'index.handler',
    roleArn: '',
    memorySize: 128,
    timeout: 3
  })

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]): void => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange({ resource: 'lambda', ...next })
  }

  const err = showErrors ?? false
  const filteredSubnets = form.vpcId ? subnets.filter((s) => s.parentId === form.vpcId) : subnets

  return (
    <div className="form-group">
      <div className={'form-field' + (err && !form.name ? ' -invalid' : '')}>
        <span className="label">Function name *</span>
        <input
          className="form-input"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
        />
      </div>
      <div className="form-field">
        <span className="label">Runtime</span>
        <select
          className="form-select"
          value={form.runtime}
          onChange={(e) => update('runtime', e.target.value as LambdaParams['runtime'])}
        >
          {['nodejs20.x', 'python3.12', 'java21', 'go1.x'].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className={'form-field' + (err && !form.handler ? ' -invalid' : '')}>
        <span className="label">Handler</span>
        <input
          className="form-input"
          value={form.handler}
          onChange={(e) => update('handler', e.target.value)}
        />
      </div>
      <div className={'form-field' + (err && !form.roleArn ? ' -invalid' : '')}>
        <span className="label">Role ARN *</span>
        <input
          className="form-input"
          value={form.roleArn}
          onChange={(e) => update('roleArn', e.target.value)}
        />
      </div>
      <div className="form-grid-2">
        <div className="form-field">
          <span className="label">Memory (MB)</span>
          <input
            className="form-input"
            type="number"
            value={form.memorySize}
            onChange={(e) => update('memorySize', Number(e.target.value))}
          />
        </div>
        <div className="form-field">
          <span className="label">Timeout (s)</span>
          <input
            className="form-input"
            type="number"
            value={form.timeout}
            onChange={(e) => update('timeout', Number(e.target.value))}
          />
        </div>
      </div>
      {vpcs.length > 0 && (
        <div className="form-field">
          <span className="label">VPC (optional)</span>
          <select
            className="form-select"
            value={form.vpcId ?? ''}
            onChange={(e) => update('vpcId', e.target.value || undefined)}
          >
            <option value="">— none —</option>
            {vpcs.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} ({v.id})
              </option>
            ))}
          </select>
        </div>
      )}
      {form.vpcId && (
        <>
          <div className="form-field">
            <span className="label">Subnets *</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredSubnets.map((s) => (
                <label key={s.id} className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={(form.subnetIds ?? []).includes(s.id)}
                    onChange={(e) => {
                      const ids = form.subnetIds ?? []
                      update(
                        'subnetIds',
                        e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id)
                      )
                    }}
                  />
                  {s.label} ({s.id})
                </label>
              ))}
            </div>
          </div>
          <div className="form-field">
            <span className="label">Security groups *</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sgs.map((sg) => (
                <label key={sg.id} className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={(form.securityGroupIds ?? []).includes(sg.id)}
                    onChange={(e) => {
                      const ids = form.securityGroupIds ?? []
                      update(
                        'securityGroupIds',
                        e.target.checked ? [...ids, sg.id] : ids.filter((x) => x !== sg.id)
                      )
                    }}
                  />
                  {sg.label} ({sg.id})
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
