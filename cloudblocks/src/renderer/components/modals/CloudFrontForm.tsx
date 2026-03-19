import React, { useState } from 'react'
import type { CloudFrontParams } from '../../types/create'
import { useCloudStore } from '../../store/cloud'

interface Props { onChange: (p: CloudFrontParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%', background: 'var(--cb-bg-panel)', border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`,
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
})
const sel = inp
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }
const btnSm: React.CSSProperties = { background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', borderRadius: 2, padding: '2px 6px', color: 'var(--cb-text-muted)', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }

export function CloudFrontForm({ onChange, showErrors }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const acmNodes = nodes.filter((n) => n.type === 'acm' && n.status === 'running')
  const s3Nodes  = nodes.filter((n) => n.type === 's3')
  const albNodes = nodes.filter((n) => n.type === 'alb')

  const [form, setForm] = useState<Omit<CloudFrontParams, 'resource'>>({
    comment: '',
    origins: [{ id: 'origin-1', domainName: '' }],
    defaultRootObject: 'index.html',
    certArn: undefined,
    priceClass: 'PriceClass_All',
  })

  const err = showErrors ?? false

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]): void => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange({ resource: 'cloudfront', ...next })
  }

  const updateOrigin = (i: number, field: 'id' | 'domainName', value: string): void => {
    const next = form.origins.map((o, j) => j === i ? { ...o, [field]: value } : o)
    update('origins', next)
  }

  const originOptions = [
    ...s3Nodes.map((n) => ({ label: `S3: ${n.label}`, value: `${n.id}.s3.amazonaws.com` })),
    ...albNodes.map((n) => ({ label: `ALB: ${n.label}`, value: (n.metadata.dnsName as string) ?? '' })),
  ]

  return (
    <div>
      <div style={lbl}>Comment / Name *</div>
      <input
        style={inp(err && !form.comment.trim())}
        value={form.comment}
        placeholder="My CloudFront distribution"
        onChange={(e) => update('comment', e.target.value)}
      />

      <div style={lbl}>Origins</div>
      {form.origins.map((origin, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <input
              style={{ ...inp(false), marginBottom: 2 }}
              value={origin.id}
              placeholder="origin-id"
              onChange={(e) => updateOrigin(i, 'id', e.target.value)}
            />
            {originOptions.length > 0 ? (
              <select
                style={sel(false)}
                value={origin.domainName}
                onChange={(e) => updateOrigin(i, 'domainName', e.target.value)}
              >
                <option value="">— select or type below —</option>
                {originOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input
                style={inp(false)}
                value={origin.domainName}
                placeholder="bucket.s3.amazonaws.com"
                onChange={(e) => updateOrigin(i, 'domainName', e.target.value)}
              />
            )}
          </div>
          <button
            style={{ ...btnSm, marginTop: 2 }}
            onClick={() => {
              const next = form.origins.filter((_, j) => j !== i)
              update('origins', next.length > 0 ? next : [{ id: 'origin-1', domainName: '' }])
            }}
          >✕</button>
        </div>
      ))}
      <button
        style={{ ...btnSm, marginTop: 6 }}
        onClick={() => update('origins', [...form.origins, { id: `origin-${form.origins.length + 1}`, domainName: '' }])}
      >+ Add Origin</button>

      <div style={lbl}>Default Root Object</div>
      <input
        style={inp(false)}
        value={form.defaultRootObject}
        placeholder="index.html"
        onChange={(e) => update('defaultRootObject', e.target.value)}
      />

      <div style={lbl}>ACM Certificate</div>
      <select
        style={sel(false)}
        value={form.certArn ?? ''}
        onChange={(e) => update('certArn', e.target.value || undefined)}
      >
        <option value="">Use default CloudFront certificate</option>
        {acmNodes.map((n) => (
          <option key={n.id} value={n.id}>{n.label} ({n.id.slice(-8)})</option>
        ))}
      </select>

      <div style={lbl}>Price Class</div>
      <select
        style={sel(false)}
        value={form.priceClass}
        onChange={(e) => update('priceClass', e.target.value as CloudFrontParams['priceClass'])}
      >
        <option value="PriceClass_All">All Edge Locations</option>
        <option value="PriceClass_100">100 — US, EU, Israel</option>
        <option value="PriceClass_200">200 — Most regions</option>
      </select>
    </div>
  )
}
