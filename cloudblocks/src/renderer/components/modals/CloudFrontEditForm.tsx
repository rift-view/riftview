import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { CloudFrontEditParams } from '../../types/edit'
import { useCloudStore } from '../../store/cloud'

interface Props { node: CloudNode; onChange: (p: CloudFrontEditParams) => void; showErrors?: boolean }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inp = (_err: boolean): React.CSSProperties => ({
  width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)',
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
})
const sel = inp
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function CloudFrontEditForm({ node, onChange }: Props): React.JSX.Element {
  const nodes    = useCloudStore((s) => s.nodes)
  const acmNodes = nodes.filter((n) => n.type === 'acm' && n.status === 'running')

  const [form, setForm] = useState<CloudFrontEditParams>({
    resource:          'cloudfront',
    comment:           (node.metadata.comment as string | undefined) ?? node.label,
    defaultRootObject: (node.metadata.defaultRootObject as string | undefined) ?? '',
    certArn:           (node.metadata.certArn as string | undefined) ?? undefined,
    priceClass:        (node.metadata.priceClass as CloudFrontEditParams['priceClass'] | undefined) ?? 'PriceClass_All',
  })

  const update = <K extends keyof CloudFrontEditParams>(k: K, v: CloudFrontEditParams[K]): void => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange(next)
  }

  return (
    <div>
      <div style={lbl}>Comment / Name</div>
      <input
        style={inp(false)}
        value={form.comment ?? ''}
        onChange={(e) => update('comment', e.target.value)}
      />

      <div style={lbl}>Default Root Object</div>
      <input
        style={inp(false)}
        value={form.defaultRootObject ?? ''}
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
        value={form.priceClass ?? 'PriceClass_All'}
        onChange={(e) => update('priceClass', e.target.value as CloudFrontEditParams['priceClass'])}
      >
        <option value="PriceClass_All">All Edge Locations</option>
        <option value="PriceClass_100">100 — US, EU, Israel</option>
        <option value="PriceClass_200">200 — Most regions</option>
      </select>
    </div>
  )
}
