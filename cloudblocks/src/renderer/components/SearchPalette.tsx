import { useState, useEffect, useRef, useCallback } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import type { CloudNode, NodeType } from '../types/cloud'

const TYPE_BADGE_COLOR = {
  ec2:              '#FF9900',
  vpc:              '#1976D2',
  subnet:           '#4CAF50',
  rds:              '#4CAF50',
  s3:               '#64b5f6',
  lambda:           '#64b5f6',
  alb:              '#FF9900',
  'security-group': '#9c27b0',
  igw:              '#4CAF50',
  acm:              '#febc2e',
  cloudfront:       '#a78bfa',
  apigw:            '#8b5cf6',
  'apigw-route':    '#22c55e',
  sqs:              '#FF9900',
  secret:           '#22c55e',
  'ecr-repo':       '#FF9900',
  sns:              '#FF9900',
  dynamo:           '#64b5f6',
  'ssm-param':      '#22c55e',
  'nat-gateway':    '#4CAF50',
  'r53-zone':       '#FF9900',
  sfn:              '#FF9900',
  'eventbridge-bus': '#FF9900',
  ses:               '#FF9900',
  cognito:           '#FF9900',
  kinesis:           '#8b5cf6',
  ecs:               '#FF9900',
  elasticache:       '#22c55e',
  eks:               '#FF9900',
  opensearch:        '#005EB8',
  msk:               '#FF9900',
  'unknown':         '#6b7280',
} satisfies Record<NodeType, string>

const TYPE_SHORT = {
  ec2:              'EC2',
  vpc:              'VPC',
  subnet:           'SUB',
  rds:              'RDS',
  s3:               'S3',
  lambda:           'λ',
  alb:              'ALB',
  'security-group': 'SG',
  igw:              'IGW',
  acm:              'ACM',
  cloudfront:       'CF',
  apigw:            'APIGW',
  'apigw-route':    'ROUTE',
  sqs:              'SQS',
  secret:           'SECRET',
  'ecr-repo':       'ECR',
  sns:              'SNS',
  dynamo:           'DDB',
  'ssm-param':      'SSM',
  'nat-gateway':    'NAT',
  'r53-zone':       'R53',
  sfn:              'SFN',
  'eventbridge-bus': 'EB',
  ses:               'SES',
  cognito:           'COGNITO',
  kinesis:           'KDS',
  ecs:               'ECS',
  elasticache:       'REDIS',
  eks:               'EKS',
  opensearch:        'OS',
  msk:               'MSK',
  'unknown':         '?',
} satisfies Record<NodeType, string>

// Metadata field keys to search and how to label them in the subtitle
const META_FIELDS: { key: string; label: string }[] = [
  { key: 'arn',         label: 'ARN' },
  { key: 'region',      label: 'Region' },
  { key: 'endpoint',    label: 'Endpoint' },
  { key: 'dnsName',     label: 'DNS' },
  { key: 'bucketName',  label: 'Bucket' },
  { key: 'privateIp',   label: 'Private IP' },
  { key: 'publicIp',    label: 'Public IP' },
  { key: 'uri',         label: 'URI' },
  { key: 'instanceType', label: 'Type' },
]

function getMetaMatch(node: CloudNode, q: string): string | null {
  // node.id is often the ARN
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
  matchedField: string | null // null = label/type matched
}

export function SearchPalette({ open, onClose, onSelect }: Props): React.JSX.Element | null {
  const nodes = useCloudStore((s) => s.nodes)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results: SearchResult[] = query.trim() === ''
    ? []
    : nodes
        .reduce<SearchResult[]>((acc, n) => {
          const q = query.toLowerCase()
          if (
            n.label.toLowerCase().includes(q) ||
            n.type.toLowerCase().includes(q)
          ) {
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

  // Reset on open
  useEffect(() => {
    if (open) {
      // Use requestAnimationFrame to avoid synchronous setState in effect
      requestAnimationFrame(() => {
        setQuery('')
        setCursor(0)
        inputRef.current?.focus()
      })
    }
  }, [open])

  // Clamp cursor
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
    [results, cursor, onClose, onSelect],
  )

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const active = listRef.current.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  return (
    // Overlay — click outside closes
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          50,
        display:         'flex',
        justifyContent:  'center',
        alignItems:      'flex-start',
        paddingTop:      '25vh',
      }}
      onMouseDown={(e) => {
        // Close only when clicking the backdrop itself
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background:   'var(--cb-bg-elevated)',
          border:       '1px solid var(--cb-border)',
          borderRadius: '6px',
          boxShadow:    '0 16px 40px rgba(0,0,0,0.6)',
          width:        '420px',
          maxWidth:     'calc(100vw - 32px)',
          fontFamily:   'monospace',
          overflow:     'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--cb-border)' }}>
          <span style={{ color: 'var(--cb-text-muted)', fontSize: 13, marginRight: 8 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search resources…"
            style={{
              flex:        1,
              background:  'transparent',
              border:      'none',
              outline:     'none',
              color:       'var(--cb-text-primary)',
              fontSize:    12,
              fontFamily:  'monospace',
            }}
          />
          <kbd
            style={{
              fontSize:     9,
              color:        'var(--cb-text-muted)',
              background:   'var(--cb-bg-panel)',
              border:       '1px solid var(--cb-border)',
              borderRadius: 3,
              padding:      '1px 5px',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} style={{ maxHeight: 320, overflowY: 'auto' }}>
          {query.trim() !== '' && results.length === 0 && (
            <div style={{ padding: '12px 12px', fontSize: 11, color: 'var(--cb-text-muted)', textAlign: 'center' }}>
              No matching resources
            </div>
          )}
          {results.map(({ node, matchedField }, i) => {
            const isActive   = i === cursor
            const pluginMeta = useUIStore.getState().pluginNodeTypes[node.type]
            const badgeColor = (TYPE_BADGE_COLOR as Record<string, string>)[node.type] ?? pluginMeta?.badgeColor ?? '#666'
            const typeShort  = (TYPE_SHORT as Record<string, string>)[node.type] ?? pluginMeta?.shortLabel ?? node.type.toUpperCase()

            return (
              <div
                key={node.id}
                data-active={isActive}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={() => {
                  onSelect(node.id)
                  onClose()
                }}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  gap:             8,
                  padding:         '7px 10px',
                  cursor:          'pointer',
                  background:      isActive ? 'var(--cb-bg-panel)' : 'transparent',
                  borderLeft:      isActive ? `2px solid ${badgeColor}` : '2px solid transparent',
                }}
              >
                {/* Type badge */}
                <span
                  style={{
                    fontSize:     8,
                    fontWeight:   700,
                    color:        badgeColor,
                    background:   `${badgeColor}18`,
                    border:       `1px solid ${badgeColor}55`,
                    borderRadius: 3,
                    padding:      '1px 5px',
                    minWidth:     28,
                    textAlign:    'center',
                    flexShrink:   0,
                  }}
                >
                  {typeShort}
                </span>

                {/* Label + optional metadata subtitle */}
                <span
                  style={{
                    flex:     1,
                    minWidth: 0,
                    display:  'flex',
                    flexDirection: 'column',
                    gap:      1,
                  }}
                >
                  <span
                    style={{
                      fontSize:     11,
                      color:        'var(--cb-text-primary)',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}
                  >
                    {node.label}
                  </span>
                  {matchedField !== null && (
                    <span
                      style={{
                        fontSize:     9,
                        color:        'var(--cb-text-muted)',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace:   'nowrap',
                      }}
                    >
                      {matchedField}
                    </span>
                  )}
                </span>

                {/* Region */}
                <span style={{ fontSize: 9, color: 'var(--cb-text-muted)', flexShrink: 0 }}>
                  {node.region}
                </span>
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div
            style={{
              padding:      '4px 10px',
              borderTop:    '1px solid var(--cb-border)',
              fontSize:     9,
              color:        'var(--cb-text-muted)',
              display:      'flex',
              gap:          10,
            }}
          >
            <span>↑↓ navigate</span>
            <span>↵ select</span>
          </div>
        )}
      </div>
    </div>
  )
}
