import { useState } from 'react'
import type { CloudFrontParams } from '../../types/create'
import { useCloudStore } from '../../store/cloud'

interface Props {
  onChange: (p: CloudFrontParams) => void
  showErrors?: boolean
}

export function CloudFrontForm({ onChange, showErrors }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const acmNodes = nodes.filter((n) => n.type === 'acm' && n.status === 'running')
  const s3Nodes = nodes.filter((n) => n.type === 's3')
  const albNodes = nodes.filter((n) => n.type === 'alb')

  const [form, setForm] = useState<Omit<CloudFrontParams, 'resource'>>({
    comment: '',
    origins: [{ id: 'origin-1', domainName: '' }],
    defaultRootObject: 'index.html',
    certArn: undefined,
    priceClass: 'PriceClass_All'
  })

  const err = showErrors ?? false

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]): void => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange({ resource: 'cloudfront', ...next })
  }

  const updateOrigin = (i: number, field: 'id' | 'domainName', value: string): void => {
    const next = form.origins.map((o, j) => (j === i ? { ...o, [field]: value } : o))
    update('origins', next)
  }

  const originOptions = [
    ...s3Nodes.map((n) => ({ label: `S3: ${n.label}`, value: `${n.id}.s3.amazonaws.com` })),
    ...albNodes.map((n) => ({
      label: `ALB: ${n.label}`,
      value: (n.metadata.dnsName as string) ?? ''
    }))
  ]

  const commentInvalid = err && !form.comment.trim()

  return (
    <div className="form-group">
      <div className={'form-field' + (commentInvalid ? ' -invalid' : '')}>
        <span className="label">Comment / Name</span>
        <input
          className="form-input"
          value={form.comment}
          placeholder="My CloudFront distribution"
          onChange={(e) => update('comment', e.target.value)}
        />
      </div>

      <div className="form-field">
        <span className="label">Origins</span>
        {form.origins.map((origin, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 4,
              marginTop: i === 0 ? 0 : 8,
              alignItems: 'flex-start'
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                className="form-input"
                value={origin.id}
                placeholder="origin-id"
                onChange={(e) => updateOrigin(i, 'id', e.target.value)}
              />
              {originOptions.length > 0 ? (
                <select
                  className="form-select"
                  value={origin.domainName}
                  onChange={(e) => updateOrigin(i, 'domainName', e.target.value)}
                >
                  <option value="">— select or type below —</option>
                  {originOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-input"
                  value={origin.domainName}
                  placeholder="bucket.s3.amazonaws.com"
                  onChange={(e) => updateOrigin(i, 'domainName', e.target.value)}
                />
              )}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                const next = form.origins.filter((_, j) => j !== i)
                update('origins', next.length > 0 ? next : [{ id: 'origin-1', domainName: '' }])
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          style={{ marginTop: 6, alignSelf: 'flex-start' }}
          onClick={() =>
            update('origins', [
              ...form.origins,
              { id: `origin-${form.origins.length + 1}`, domainName: '' }
            ])
          }
        >
          + Add Origin
        </button>
      </div>

      <div className="form-field">
        <span className="label">Default Root Object</span>
        <input
          className="form-input"
          value={form.defaultRootObject}
          placeholder="index.html"
          onChange={(e) => update('defaultRootObject', e.target.value)}
        />
      </div>

      <div className="form-field">
        <span className="label">ACM Certificate</span>
        <select
          className="form-select"
          value={form.certArn ?? ''}
          onChange={(e) => update('certArn', e.target.value || undefined)}
        >
          <option value="">Use default CloudFront certificate</option>
          {acmNodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label} ({n.id.slice(-8)})
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <span className="label">Price Class</span>
        <select
          className="form-select"
          value={form.priceClass}
          onChange={(e) => update('priceClass', e.target.value as CloudFrontParams['priceClass'])}
        >
          <option value="PriceClass_All">All Edge Locations</option>
          <option value="PriceClass_100">100 — US, EU, Israel</option>
          <option value="PriceClass_200">200 — Most regions</option>
        </select>
      </div>
    </div>
  )
}
