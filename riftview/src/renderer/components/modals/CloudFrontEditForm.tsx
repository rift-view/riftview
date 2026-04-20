import { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { CloudFrontEditParams } from '../../types/edit'
import { useCloudStore } from '../../store/cloud'

interface Props {
  node: CloudNode
  onChange: (p: CloudFrontEditParams) => void
  showErrors?: boolean
}

export default function CloudFrontEditForm({ node, onChange }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const acmNodes = nodes.filter((n) => n.type === 'acm' && n.status === 'running')

  const [form, setForm] = useState<CloudFrontEditParams>({
    resource: 'cloudfront',
    comment: (node.metadata.comment as string | undefined) ?? node.label,
    defaultRootObject: (node.metadata.defaultRootObject as string | undefined) ?? '',
    certArn: (node.metadata.certArn as string | undefined) ?? undefined,
    priceClass:
      (node.metadata.priceClass as CloudFrontEditParams['priceClass'] | undefined) ??
      'PriceClass_All'
  })

  const update = <K extends keyof CloudFrontEditParams>(k: K, v: CloudFrontEditParams[K]): void => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange(next)
  }

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">Comment / Name</span>
        <input
          className="form-input"
          value={form.comment ?? ''}
          onChange={(e) => update('comment', e.target.value)}
        />
      </div>

      <div className="form-field">
        <span className="label">Default Root Object</span>
        <input
          className="form-input"
          value={form.defaultRootObject ?? ''}
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
          value={form.priceClass ?? 'PriceClass_All'}
          onChange={(e) =>
            update('priceClass', e.target.value as CloudFrontEditParams['priceClass'])
          }
        >
          <option value="PriceClass_All">All Edge Locations</option>
          <option value="PriceClass_100">100 — US, EU, Israel</option>
          <option value="PriceClass_200">200 — Most regions</option>
        </select>
      </div>
    </div>
  )
}
