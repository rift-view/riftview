import { useState, useEffect, useRef, useCallback } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import type { CloudNode, NodeType } from '../types/cloud'

const TYPE_BADGE_COLOR = {
  ec2: '#FF9900',
  vpc: '#1976D2',
  subnet: '#4CAF50',
  rds: '#4CAF50',
  s3: '#64b5f6',
  lambda: '#64b5f6',
  alb: '#FF9900',
  'security-group': '#9c27b0',
  igw: '#4CAF50',
  acm: '#febc2e',
  cloudfront: '#a78bfa',
  apigw: '#8b5cf6',
  'apigw-route': '#22c55e',
  sqs: '#FF9900',
  secret: '#22c55e',
  'ecr-repo': '#FF9900',
  sns: '#FF9900',
  dynamo: '#64b5f6',
  'ssm-param': '#22c55e',
  'nat-gateway': '#4CAF50',
  'r53-zone': '#FF9900',
  sfn: '#FF9900',
  'eventbridge-bus': '#FF9900',
  ses: '#FF9900',
  cognito: '#FF9900',
  kinesis: '#8b5cf6',
  ecs: '#FF9900',
  elasticache: '#22c55e',
  eks: '#FF9900',
  opensearch: '#005EB8',
  msk: '#FF9900',
  unknown: '#6b7280'
} satisfies Record<NodeType, string>

const TYPE_SHORT = {
  ec2: 'EC2',
  vpc: 'VPC',
  subnet: 'SUB',
  rds: 'RDS',
  s3: 'S3',
  lambda: 'λ',
  alb: 'ALB',
  'security-group': 'SG',
  igw: 'IGW',
  acm: 'ACM',
  cloudfront: 'CF',
  apigw: 'APIGW',
  'apigw-route': 'ROUTE',
  sqs: 'SQS',
  secret: 'SECRET',
  'ecr-repo': 'ECR',
  sns: 'SNS',
  dynamo: 'DDB',
  'ssm-param': 'SSM',
  'nat-gateway': 'NAT',
  'r53-zone': 'R53',
  sfn: 'SFN',
  'eventbridge-bus': 'EB',
  ses: 'SES',
  cognito: 'COGNITO',
  kinesis: 'KDS',
  ecs: 'ECS',
  elasticache: 'REDIS',
  eks: 'EKS',
  opensearch: 'OS',
  msk: 'MSK',
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

  const results: SearchResult[] =
    query.trim() === ''
      ? []
      : nodes
          .reduce<SearchResult[]>((acc, n) => {
            const q = query.toLowerCase()
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
