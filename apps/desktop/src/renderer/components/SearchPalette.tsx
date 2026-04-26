import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import type { CloudNode, NodeType } from '@riftview/shared'

const TYPE_BADGE_COLOR = {
  'aws:ec2': '#FF9900',
  'aws:vpc': '#1976D2',
  'aws:subnet': '#4CAF50',
  'aws:rds': '#4CAF50',
  'aws:s3': '#64b5f6',
  'aws:lambda': '#64b5f6',
  'aws:alb': '#FF9900',
  'aws:security-group': '#9c27b0',
  'aws:igw': '#4CAF50',
  'aws:acm': '#febc2e',
  'aws:cloudfront': '#a78bfa',
  'aws:apigw': '#8b5cf6',
  'aws:apigw-route': '#22c55e',
  'aws:sqs': '#FF9900',
  'aws:secret': '#22c55e',
  'aws:ecr-repo': '#FF9900',
  'aws:sns': '#FF9900',
  'aws:dynamo': '#64b5f6',
  'aws:ssm-param': '#22c55e',
  'aws:nat-gateway': '#4CAF50',
  'aws:r53-zone': '#FF9900',
  'aws:sfn': '#FF9900',
  'aws:eventbridge-bus': '#FF9900',
  'aws:ses': '#FF9900',
  'aws:cognito': '#FF9900',
  'aws:kinesis': '#8b5cf6',
  'aws:ecs': '#FF9900',
  'aws:elasticache': '#22c55e',
  'aws:eks': '#FF9900',
  'aws:opensearch': '#005EB8',
  'aws:msk': '#FF9900',
  unknown: '#6b7280'
} satisfies Record<NodeType, string>

const TYPE_SHORT = {
  'aws:ec2': 'EC2',
  'aws:vpc': 'VPC',
  'aws:subnet': 'SUB',
  'aws:rds': 'RDS',
  'aws:s3': 'S3',
  'aws:lambda': 'λ',
  'aws:alb': 'ALB',
  'aws:security-group': 'SG',
  'aws:igw': 'IGW',
  'aws:acm': 'ACM',
  'aws:cloudfront': 'CF',
  'aws:apigw': 'APIGW',
  'aws:apigw-route': 'ROUTE',
  'aws:sqs': 'SQS',
  'aws:secret': 'SECRET',
  'aws:ecr-repo': 'ECR',
  'aws:sns': 'SNS',
  'aws:dynamo': 'DDB',
  'aws:ssm-param': 'SSM',
  'aws:nat-gateway': 'NAT',
  'aws:r53-zone': 'R53',
  'aws:sfn': 'SFN',
  'aws:eventbridge-bus': 'EB',
  'aws:ses': 'SES',
  'aws:cognito': 'COGNITO',
  'aws:kinesis': 'KDS',
  'aws:ecs': 'ECS',
  'aws:elasticache': 'REDIS',
  'aws:eks': 'EKS',
  'aws:opensearch': 'OS',
  'aws:msk': 'MSK',
  unknown: '?'
} satisfies Record<NodeType, string>

// Metadata field keys to search and how to label them in the subtitle
const META_FIELDS: { key: string; label: string }[] = [
  { key: 'arn', label: 'ARN' },
  { key: 'region', label: 'Region' },
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'dnsName', label: 'DNS' },
  { key: 'bucketName', label: 'Bucket' },
  { key: 'privateIp', label: 'Private IP' },
  { key: 'publicIp', label: 'Public IP' },
  { key: 'uri', label: 'URI' },
  { key: 'instanceType', label: 'Type' }
]

function getMetaMatch(node: CloudNode, q: string): string | null {
  if (node.id.toLowerCase().includes(q)) return node.id
  for (const { key } of META_FIELDS) {
    const val = node.metadata[key]
    if (typeof val === 'string' && val.toLowerCase().includes(q)) return val
  }
  return null
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (nodeId: string) => void
}

interface SearchResult {
  node: CloudNode
  matchedField: string | null
}

export function SearchPalette({ open, onClose, onSelect }: Props): React.JSX.Element | null {
  const nodes = useCloudStore((s) => s.nodes)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results: SearchResult[] = useMemo(() => {
    if (query.trim() === '') return []
    const q = query.toLowerCase()
    return nodes
      .reduce<SearchResult[]>((acc, n) => {
        if (n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)) {
          acc.push({ node: n, matchedField: null })
        } else {
          const metaMatch = getMetaMatch(n, q)
          if (metaMatch !== null) {
            acc.push({ node: n, matchedField: metaMatch })
          }
        }
        return acc
      }, [])
      .slice(0, 8)
  }, [query, nodes])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        setQuery('')
        setCursor(0)
        inputRef.current?.focus()
      })
    }
  }, [open])

  useEffect(() => {
    requestAnimationFrame(() => {
      setCursor((c) => Math.min(c, Math.max(0, results.length - 1)))
    })
  }, [results.length])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(c + 1, results.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(c - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const hit = results[cursor]
        if (hit) {
          onSelect(hit.node.id)
          onClose()
        }
        return
      }
    },
    [results, cursor, onClose, onSelect]
  )

  useEffect(() => {
    if (!listRef.current) return
    const active = listRef.current.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  return (
    <div
      className="search-palette-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '25vh',
        background: 'oklch(0 0 0 / 0.5)',
        backdropFilter: 'blur(8px)'
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="search-palette"
        style={{
          width: '640px',
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--bg-elev-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden'
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="search-palette-input"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2xs)',
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)'
          }}
        >
          <span style={{ color: 'var(--fg-muted)', fontSize: 16, lineHeight: 1 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search resources…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--fg)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-base)'
            }}
          />
          <kbd className="kbd">ESC</kbd>
        </div>

        <div
          ref={listRef}
          className="search-palette-results"
          style={{ maxHeight: 360, overflowY: 'auto' }}
        >
          {query.trim() !== '' && results.length === 0 && (
            <div
              style={{
                padding: '14px 14px',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'var(--fg-muted)',
                textAlign: 'center'
              }}
            >
              No matching resources
            </div>
          )}
          {results.map(({ node, matchedField }, i) => {
            const isActive = i === cursor
            const pluginMeta = useUIStore.getState().pluginNodeTypes[node.type]
            const badgeColor =
              (TYPE_BADGE_COLOR as Record<string, string>)[node.type] ??
              pluginMeta?.badgeColor ??
              '#666'
            const typeShort =
              (TYPE_SHORT as Record<string, string>)[node.type] ??
              pluginMeta?.shortLabel ??
              node.type.toUpperCase()

            return (
              <div
                key={node.id}
                className="search-result"
                data-active={isActive}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={() => {
                  onSelect(node.id)
                  onClose()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  background: isActive ? 'var(--ink-900)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--ember-500)' : '2px solid transparent'
                }}
              >
                <span
                  className="search-result-badge"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    fontWeight: 700,
                    color: badgeColor,
                    background: `${badgeColor}18`,
                    border: `1px solid ${badgeColor}55`,
                    borderRadius: 3,
                    padding: '1px 5px',
                    minWidth: 32,
                    textAlign: 'center',
                    flexShrink: 0
                  }}
                >
                  {typeShort}
                </span>

                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--bone-100)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {node.label}
                  </span>
                  {matchedField !== null && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--fg-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {matchedField}
                    </span>
                  )}
                </span>

                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--fg-muted)',
                    flexShrink: 0
                  }}
                >
                  {node.region}
                </span>
              </div>
            )
          })}
        </div>

        <div
          className="search-palette-foot"
          style={{
            padding: '6px 14px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 14,
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--fg-muted)'
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
        </div>
      </div>
    </div>
  )
}
