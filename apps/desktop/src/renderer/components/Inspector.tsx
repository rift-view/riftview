import React, { useState, useMemo, useEffect } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import type { CloudNode, NodeType } from '@riftview/shared'
import { fieldLabel } from '../utils/fieldLabels'
import { edgeTypeLabel } from '../utils/edgeTypeLabel'
import { getMonthlyEstimate, formatPrice } from '../utils/pricing'
import { IamAdvisor } from './IamAdvisor'
import { buildConsoleUrl } from '../utils/buildConsoleUrl'
import { buildRemediateCommands } from '../utils/buildRemediateCommands'
import { analyzeNode } from '@riftview/shared'
import type { Advisory } from '@riftview/shared'
import { resolveIntegrationTargetId } from '@riftview/shared'
import { buildAdvisoryRemediation } from '../utils/buildAdvisoryRemediations'
import { buildBlastRadius } from '@riftview/shared'
import { directionSymbol } from '../utils/blastRadiusEdges'
import { redact } from '../utils/demoMode'

interface CloudMetric {
  name: string
  value: number
  unit: string
}
const METRIC_TYPES = new Set<NodeType>(['lambda', 'rds', 'ecs'])

function statusPillClass(status: string): string {
  if (status === 'running' || status === 'active') return 'pill pill-ok'
  if (status === 'error') return 'pill pill-danger'
  if (status === 'unknown' || status === 'imported' || status === 'stopped')
    return 'pill pill-neutral'
  // pending, creating, deleting → default (ember pulse)
  return 'pill'
}

function typeEyebrow(type: string): string {
  return type.replace(/-/g, ' ').toUpperCase()
}

function DriftDiffTable({
  metadata,
  tfMetadata
}: {
  metadata: Record<string, unknown>
  tfMetadata: Record<string, unknown>
}): React.JSX.Element {
  const allKeys = Array.from(new Set([...Object.keys(metadata), ...Object.keys(tfMetadata)]))
  const diffs = allKeys.filter(
    (k) =>
      String(metadata[k] ?? '') !== String(tfMetadata[k] ?? '') &&
      (metadata[k] !== undefined || tfMetadata[k] !== undefined)
  )

  return (
    <>
      <div
        style={{
          fontWeight: 700,
          color: 'var(--moss-500)',
          marginBottom: diffs.length > 0 ? 6 : 0
        }}
      >
        ✓ MATCHED
        {diffs.length > 0 ? ` — ${diffs.length} difference${diffs.length === 1 ? '' : 's'}` : ''}
      </div>
      {diffs.length === 0 ? (
        <div style={{ color: 'var(--moss-500)', fontSize: 10 }}>No differences detected</div>
      ) : (
        <div className="diff" style={{ fontSize: 9 }}>
          <div className="diff-head">
            <span>LIVE</span>
            <span>TERRAFORM</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {diffs.map((k) => (
              <React.Fragment key={k}>
                <div
                  style={{
                    padding: '3px 6px',
                    background: 'oklch(0 0 0 / 0.15)',
                    borderTop: '1px solid oklch(1 0 0 / 0.05)'
                  }}
                >
                  <div className="label" style={{ fontSize: 7 }}>
                    {k}
                  </div>
                  <div style={{ color: 'oklch(0.80 0.15 28)' }}>
                    {redact(String(metadata[k] ?? '—'))}
                  </div>
                </div>
                <div
                  style={{
                    padding: '3px 6px',
                    background: 'oklch(0 0 0 / 0.15)',
                    borderTop: '1px solid oklch(1 0 0 / 0.05)'
                  }}
                >
                  <div className="label" style={{ fontSize: 7 }}>
                    {k}
                  </div>
                  <div style={{ color: 'var(--moss-500)' }}>
                    {redact(String(tfMetadata[k] ?? '—'))}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── FirstScanSummary ──────────────────────────────────────────────────────────

function FirstScanSummary({ nodes }: { nodes: CloudNode[] }): React.JSX.Element {
  const scanStatus = useCloudStore((s) => s.scanStatus)
  const lastScannedAt = useCloudStore((s) => s.lastScannedAt)
  const selectNode = useUIStore((s) => s.selectNode)
  const [groupByRule, setGroupByRule] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const allAdvisories = useMemo(() => nodes.flatMap((n) => analyzeNode(n)), [nodes])

  const ruleGroups = useMemo(() => {
    const map = new Map<
      string,
      { ruleId: string; title: string; severity: Advisory['severity']; count: number }
    >()
    const severityRank: Record<Advisory['severity'], number> = { critical: 0, warning: 1, info: 2 }
    for (const a of allAdvisories) {
      const existing = map.get(a.ruleId)
      if (existing) {
        existing.count++
        if (severityRank[a.severity] < severityRank[existing.severity])
          existing.severity = a.severity
      } else {
        map.set(a.ruleId, { ruleId: a.ruleId, title: a.title, severity: a.severity, count: 1 })
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => severityRank[a.severity] - severityRank[b.severity]
    )
  }, [allAdvisories])

  if (nodes.length === 0 || !lastScannedAt) {
    return (
      <div
        data-testid="inspector-empty"
        className="label"
        style={{ textAlign: 'center', marginTop: 32, padding: 16 }}
      >
        {scanStatus === 'scanning' ? 'Scanning…' : 'Click a resource to inspect'}
      </div>
    )
  }

  const criticals = allAdvisories.filter((a) => a.severity === 'critical')
  const warnings = allAdvisories.filter((a) => a.severity === 'warning')

  const sortedAdvisories = [
    ...criticals,
    ...warnings,
    ...allAdvisories.filter((a) => a.severity === 'info')
  ]

  const severityDotColor = (severity: Advisory['severity']): string => {
    if (severity === 'critical') return 'var(--fault-500)'
    if (severity === 'warning') return 'var(--ember-500)'
    return 'oklch(0.72 0.15 240)'
  }

  const severityLabel = (severity: Advisory['severity']): string => {
    if (severity === 'critical') return 'CRITICAL'
    if (severity === 'warning') return 'WARNING'
    return 'INFO'
  }

  const topRisks = sortedAdvisories.slice(0, 3)

  return (
    <div style={{ padding: '12px 10px', fontFamily: 'var(--font-mono)' }}>
      {showAll ? (
        <>
          <div
            className="insp-label"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border)',
              marginBottom: 8,
              paddingBottom: 6
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setShowAll(false)}
                style={{ padding: '1px 6px', fontSize: 9 }}
              >
                ← Top risks
              </button>
              <span>ADVISORIES</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {allAdvisories.length > 0 && (
                <>
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 8,
                      background:
                        criticals.length > 0
                          ? 'oklch(0.60 0.20 28 / 0.15)'
                          : 'oklch(0.73 0.17 50 / 0.15)',
                      color: criticals.length > 0 ? 'var(--fault-500)' : 'var(--ember-500)'
                    }}
                  >
                    {allAdvisories.length}
                  </span>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setGroupByRule((v) => !v)}
                    style={{ padding: '1px 6px', fontSize: 10 }}
                  >
                    {groupByRule ? 'By Rule' : 'By Node'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={{ fontSize: 9, color: 'var(--fg-muted)', marginBottom: 10 }}>
            {nodes.length} resource{nodes.length !== 1 ? 's' : ''} scanned
          </div>

          {allAdvisories.length === 0 ? (
            <div
              style={{ fontSize: 11, color: 'var(--moss-500)', fontWeight: 700, marginBottom: 12 }}
            >
              ✓ All clear
            </div>
          ) : groupByRule ? (
            <div
              style={{
                overflowY: 'auto',
                maxHeight: 320,
                border: '1px solid var(--border)',
                borderRadius: 3,
                marginBottom: 10
              }}
            >
              {ruleGroups.map((group) => (
                <div
                  key={group.ruleId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 28,
                    padding: '0 8px',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: severityDotColor(group.severity),
                      display: 'inline-block',
                      ...(group.severity === 'critical'
                        ? { boxShadow: '0 0 5px var(--fault-500)' }
                        : {})
                    }}
                  />
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--fg)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1
                    }}
                    title={group.title}
                  >
                    {group.title}
                  </span>
                  <span
                    style={{
                      fontSize: 8,
                      color: 'var(--fg-muted)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {group.count} node{group.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                overflowY: 'auto',
                maxHeight: 320,
                border: '1px solid var(--border)',
                borderRadius: 3,
                marginBottom: 10
              }}
            >
              {sortedAdvisories.map((advisory, idx) => {
                const resourceNode = nodes.find((n) => n.id === advisory.nodeId)
                const remediation = buildAdvisoryRemediation(advisory, advisory.nodeId)
                const dotColor = severityDotColor(advisory.severity)

                return (
                  <div
                    key={`${advisory.nodeId}-${advisory.ruleId}-${idx}`}
                    onClick={() => selectNode(advisory.nodeId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 28,
                      padding: '0 8px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLDivElement).style.background = 'var(--ink-850)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: dotColor,
                        display: 'inline-block',
                        ...(advisory.severity === 'critical'
                          ? { boxShadow: '0 0 5px var(--fault-500)' }
                          : {})
                      }}
                    />
                    <span
                      style={{
                        fontSize: 8,
                        color: 'var(--fg-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 60,
                        flexShrink: 0
                      }}
                      title={resourceNode?.label ?? advisory.nodeId}
                    >
                      {resourceNode?.label ?? advisory.nodeId}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: 'var(--fg)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1
                      }}
                      title={advisory.title}
                    >
                      {advisory.title}
                    </span>
                    {remediation && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          selectNode(advisory.nodeId)
                        }}
                        className="btn-link"
                        style={{ fontSize: 8 }}
                      >
                        Fix
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ fontSize: 8, color: 'var(--fg-muted)', textAlign: 'center' }}>
            Click a resource to inspect
          </div>
        </>
      ) : (
        <>
          <div
            className="insp-label"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border)',
              marginBottom: 8,
              paddingBottom: 6
            }}
          >
            <span>TOP RISKS</span>
            {allAdvisories.length > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="btn btn-sm btn-ghost"
                style={{ fontSize: 9, padding: '1px 6px' }}
              >
                View all →
              </button>
            )}
          </div>

          <div
            key={lastScannedAt?.getTime()}
            style={{ animation: 'cb-top-risks-fade 300ms ease-out both' }}
          >
            {allAdvisories.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--moss-500)',
                  fontWeight: 700,
                  marginBottom: 12
                }}
              >
                ✓ All clear
              </div>
            ) : (
              <>
                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    marginBottom: 8,
                    overflow: 'hidden'
                  }}
                >
                  {topRisks.map((advisory, idx) => {
                    const remediation = buildAdvisoryRemediation(advisory, advisory.nodeId)
                    const dotColor = severityDotColor(advisory.severity)
                    const sevLabel = severityLabel(advisory.severity)
                    const isLast = idx === topRisks.length - 1

                    return (
                      <div
                        key={`${advisory.nodeId}-${advisory.ruleId}-${idx}`}
                        onClick={() => selectNode(advisory.nodeId)}
                        style={{
                          padding: '7px 8px',
                          borderBottom: isLast ? 'none' : '1px solid var(--border)',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          ;(e.currentTarget as HTMLDivElement).style.background = 'var(--ink-850)'
                        }}
                        onMouseLeave={(e) => {
                          ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 3
                          }}
                        >
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                background: dotColor,
                                display: 'inline-block',
                                flexShrink: 0,
                                ...(advisory.severity === 'critical'
                                  ? { boxShadow: '0 0 5px var(--fault-500)' }
                                  : {})
                              }}
                            />
                            <span
                              style={{
                                fontSize: 8,
                                fontWeight: 700,
                                letterSpacing: '0.08em',
                                color: dotColor,
                                flexShrink: 0
                              }}
                            >
                              {sevLabel}
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: 'var(--fg)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title={advisory.title}
                            >
                              {advisory.title}
                            </span>
                          </div>
                          {remediation && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                selectNode(advisory.nodeId)
                              }}
                              className="btn-link"
                              style={{ fontSize: 8 }}
                            >
                              Fix
                            </button>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 8,
                            color: 'var(--fg-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            paddingLeft: 11
                          }}
                          title={advisory.detail}
                        >
                          {advisory.detail}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ fontSize: 8, color: 'var(--fg-muted)', textAlign: 'center' }}>
                  {topRisks.length} of {allAdvisories.length} advisor
                  {allAdvisories.length !== 1 ? 'ies' : 'y'} shown · {nodes.length} resource
                  {nodes.length !== 1 ? 's' : ''} scanned
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

type RemediateState = 'idle' | 'running' | 'done-ok' | `done-err:${number}`

interface HistoryEntry {
  timestamp: string
  changes: Array<{ field: string; before: string; after: string }>
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay === 1) return 'yesterday'
  if (diffDay < 7) return `${diffDay} days ago`
  return new Date(iso).toLocaleDateString()
}

function truncate(s: string, max = 40): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

// ── helpers: row rendering primitives ─────────────────────────────────────

function Row({
  k,
  v,
  copyable
}: {
  k: string
  v: string | React.ReactNode
  copyable?: string
}): React.JSX.Element {
  return (
    <div className="insp-row">
      <span className="k">{k}</span>
      <span className="v" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ wordBreak: 'break-all' }}>{v}</span>
        {copyable && (
          <button
            onClick={() => void navigator.clipboard.writeText(copyable)}
            title="Copy"
            className="btn btn-sm btn-ghost"
            style={{ padding: '0 4px', fontSize: 8, lineHeight: 1 }}
          >
            ⎘
          </button>
        )}
      </span>
    </div>
  )
}

function Section({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="insp-section">
      <div className="insp-label">{label}</div>
      <div className="insp-rows">{children}</div>
      <hr className="hairline" />
    </div>
  )
}

// ── Inspector ─────────────────────────────────────────────────────────────

interface InspectorProps {
  onDelete: (node: CloudNode) => void
  onEdit: (node: CloudNode) => void
  onQuickAction: (
    node: CloudNode,
    action: 'stop' | 'start' | 'reboot' | 'invalidate',
    meta?: { path?: string }
  ) => void
  onAddRoute?: (apiId: string) => void
  onRemediate?: (node: CloudNode, commands: string[][]) => Promise<{ code: number }>
}

export function Inspector({
  onDelete,
  onEdit,
  onQuickAction,
  onAddRoute,
  onRemediate
}: InspectorProps): React.JSX.Element {
  const selectedId = useUIStore((s) => s.selectedNodeId)
  const selectedEdgeInfo = useUIStore((s) => s.selectedEdgeInfo)
  const setActiveCreate = useUIStore((s) => s.setActiveCreate)
  const selectNode = useUIStore((s) => s.selectNode)
  const blastRadiusId = useUIStore((s) => s.blastRadiusId)
  const setBlastRadiusId = useUIStore((s) => s.setBlastRadiusId)
  const lockedNodes = useUIStore((s) => s.lockedNodes)
  const toggleLockNode = useUIStore((s) => s.toggleLockNode)
  const annotations = useUIStore((s) => s.annotations)
  const setAnnotation = useUIStore((s) => s.setAnnotation)
  const clearAnnotation = useUIStore((s) => s.clearAnnotation)
  const nodes = useCloudStore((s) => s.nodes)
  const importedNodes = useCloudStore((s) => s.importedNodes)
  const node =
    nodes.find((n) => n.id === selectedId) ?? importedNodes.find((n) => n.id === selectedId)

  const isImported = node?.status === 'imported'

  const [invalidatePath, setInvalidatePath] = useState('/*')
  const [acmDeleteError, setAcmDeleteError] = useState<string | null>(null)

  const [remediateState, setRemediateState] = useState<RemediateState>('idle')
  const [advisoriesExpanded, setAdvisoriesExpanded] = useState(true)
  const [nodeHistory, setNodeHistory] = useState<HistoryEntry[]>([])
  const [cwMetrics, setCwMetrics] = useState<CloudMetric[]>([])

  // Navigation between nodes that have advisories (OP_INTELLIGENCE)
  const advisoryNavigation = useMemo(() => {
    const withIssues = nodes.filter((n) => analyzeNode(n).length > 0)
    const sorted = [...withIssues].sort((a, b) => {
      const aHasCritical = analyzeNode(a).some((x) => x.severity === 'critical') ? 0 : 1
      const bHasCritical = analyzeNode(b).some((x) => x.severity === 'critical') ? 0 : 1
      return aHasCritical - bHasCritical
    })
    const currentIdx = sorted.findIndex((n) => n.id === selectedId)
    return { sorted, currentIdx }
  }, [nodes, selectedId])

  React.useEffect(() => {
    setRemediateState('idle')
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNodeHistory([])
      return
    }
    window.riftview
      ?.getNodeHistory?.(selectedId)
      .then(setNodeHistory)
      .catch(() => {
        setNodeHistory([])
      })
  }, [selectedId])

  // CloudWatch metrics — lambda, rds, ecs only
  useEffect(() => {
    if (!node) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCwMetrics([])
      return
    }
    if (!METRIC_TYPES.has(node.type as NodeType)) {
      setCwMetrics([])
      return
    }
    if (!window.riftview?.fetchMetrics) return
    const m = node.metadata ?? {}
    const resourceId: string = (() => {
      if (node.type === 'lambda') return (m.functionName as string | undefined) ?? node.label
      if (node.type === 'rds') return (m.dbInstanceId as string | undefined) ?? node.label
      return (
        ((m.clusterName as string | undefined) ?? '') +
        '/' +
        ((m.serviceName as string | undefined) ?? '')
      )
    })()
    const profile = useCloudStore.getState().profile
    const region = node.region ?? useCloudStore.getState().region
    window.riftview
      .fetchMetrics({ nodeId: node.id, nodeType: node.type, resourceId, region, profile })
      .then(setCwMetrics)
      .catch(() => setCwMetrics([]))
  }, [node])

  const IAM_SUPPORTED_TYPES: NodeType[] = ['ec2', 'lambda', 's3']

  return (
    <div
      data-testid="inspector"
      className="overflow-y-auto h-full"
      style={{
        background: 'var(--ink-900)',
        borderLeft: '1px solid var(--border-strong)'
      }}
    >
      {!node && selectedEdgeInfo ? (
        <EdgeView info={selectedEdgeInfo} nodes={nodes} importedNodes={importedNodes} />
      ) : !node ? (
        <FirstScanSummary nodes={nodes} />
      ) : (
        <>
          {/* Header: eyebrow → title → pill → hairline */}
          <div className="insp-header">
            <div className="eyebrow">{typeEyebrow(node.type)}</div>
            <div className="insp-title">{redact(node.label)}</div>
            <span className={statusPillClass(node.status)}>
              <span className="dot" />
              {node.status}
            </span>
          </div>
          <hr className="hairline" />

          {/* Drift banners */}
          {node.driftStatus === 'unmanaged' && (
            <div className="advisory-card" style={{ margin: '0 var(--space-md) var(--space-sm)' }}>
              <div className="advisory-title">! UNMANAGED</div>
              <div className="advisory-body">
                Not tracked in Terraform. Consider adding to your tfstate.
              </div>
            </div>
          )}

          {node.driftStatus === 'missing' && (
            <div
              className="advisory-card advisory-card--critical"
              style={{ margin: '0 var(--space-md) var(--space-sm)' }}
            >
              <div className="advisory-title">✕ MISSING — read-only</div>
              <div className="advisory-body">Declared in Terraform but not found in live AWS.</div>
            </div>
          )}

          {node.driftStatus === 'matched' && (
            <div
              style={{
                margin: '0 var(--space-md) var(--space-sm)',
                padding: '8px 10px',
                borderRadius: 4,
                background: 'oklch(0.68 0.10 145 / 0.08)',
                border: '1px solid oklch(0.68 0.10 145 / 0.30)',
                fontSize: 11
              }}
            >
              <DriftDiffTable metadata={node.metadata} tfMetadata={node.tfMetadata ?? {}} />
            </div>
          )}

          {/* BLAST RADIUS section */}
          {blastRadiusId === node.id &&
            (() => {
              const result = buildBlastRadius(nodes, node.id)
              const grouped: Record<
                'upstream' | 'downstream' | 'both',
                { id: string; hop: number; edgeTypes: string[] }[]
              > = {
                upstream: [],
                downstream: [],
                both: []
              }
              for (const [id, m] of result.members.entries()) {
                if (m.direction === 'source') continue
                grouped[m.direction].push({ id, hop: m.hopDistance, edgeTypes: m.edgeTypes })
              }
              for (const k of Object.keys(grouped) as (keyof typeof grouped)[]) {
                grouped[k].sort((a, b) => a.hop - b.hop)
              }

              const copyMarkdown = (): void => {
                const lines: string[] = [`# Blast Radius — ${node.label}`, '']
                lines.push(`- Source: \`${node.label}\` (${node.type})`)
                lines.push(
                  `- Reach: ${result.upstreamCount} upstream · ${result.downstreamCount} downstream · max ${result.maxHops} hop${result.maxHops === 1 ? '' : 's'}`
                )
                lines.push('')
                for (const dir of ['upstream', 'both', 'downstream'] as const) {
                  if (grouped[dir].length === 0) continue
                  lines.push(`## ${dir.toUpperCase()}`)
                  for (const m of grouped[dir]) {
                    const n = nodes.find((x) => x.id === m.id)
                    const edges = m.edgeTypes.length > 0 ? ` — ${m.edgeTypes.join(', ')}` : ''
                    lines.push(
                      `- \`${n?.label ?? m.id}\` (${n?.type ?? '?'}) · hop ${m.hop}${edges}`
                    )
                  }
                  lines.push('')
                }
                void navigator.clipboard.writeText(lines.join('\n'))
              }

              const renderDir = (
                dir: 'upstream' | 'both' | 'downstream',
                label: string
              ): React.JSX.Element | null => {
                if (grouped[dir].length === 0) return null
                return (
                  <React.Fragment key={dir}>
                    <div className="insp-row">
                      <span className="k">
                        <span className="pill pill-neutral" style={{ padding: '1px 6px' }}>
                          {directionSymbol(dir === 'both' ? 'both' : dir)} {label}
                        </span>
                      </span>
                      <span className="v">{grouped[dir].length}</span>
                    </div>
                    {grouped[dir].map((m) => {
                      const n = nodes.find((x) => x.id === m.id)
                      return (
                        <div
                          key={m.id}
                          onClick={() => selectNode(m.id)}
                          className="insp-row"
                          style={{
                            cursor: 'pointer',
                            background: m.id === selectedId ? 'var(--ink-800)' : undefined
                          }}
                        >
                          <span className="k">h{m.hop}</span>
                          <span className="v" style={{ textAlign: 'right' }}>
                            {n?.label ?? m.id}
                            <span style={{ color: 'var(--fg-muted)', marginLeft: 6 }}>
                              {n?.type ?? ''}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </React.Fragment>
                )
              }

              return (
                <div className="insp-section">
                  <div
                    className="insp-label"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>BLAST RADIUS</span>
                    <span className="insp-actions" style={{ margin: 0 }}>
                      <button
                        onClick={copyMarkdown}
                        className="btn btn-sm btn-ghost"
                        title="Copy as Markdown (Slack-ready)"
                      >
                        COPY
                      </button>
                      <button
                        onClick={() => setBlastRadiusId(null)}
                        className="btn btn-sm btn-ghost"
                        title="Clear blast radius"
                      >
                        CLEAR
                      </button>
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--bone-200)', marginBottom: 6 }}>
                    ↑{result.upstreamCount} upstream · ↓{result.downstreamCount} downstream · max{' '}
                    {result.maxHops} hop{result.maxHops === 1 ? '' : 's'}
                  </div>
                  {result.members.size === 1 ? (
                    <div style={{ fontSize: 9, color: 'var(--fg-muted)', fontStyle: 'italic' }}>
                      No known dependencies. This node has no integration edges.
                    </div>
                  ) : (
                    <>
                      <div className="insp-rows">
                        {renderDir('upstream', 'UPSTREAM')}
                        {renderDir('both', 'BIDIRECTIONAL')}
                        {renderDir('downstream', 'DOWNSTREAM')}
                      </div>
                      <div
                        style={{
                          fontSize: 8,
                          color: 'var(--fg-muted)',
                          marginTop: 4,
                          fontStyle: 'italic'
                        }}
                      >
                        Shift-click a node to re-root from there.
                      </div>
                    </>
                  )}
                  <hr className="hairline" />
                </div>
              )
            })()}

          {/* REMEDIATE section */}
          {(node.driftStatus === 'unmanaged' || node.driftStatus === 'matched') &&
            (() => {
              const safeNode = node as CloudNode
              const commands = buildRemediateCommands(safeNode)
              const hasCommands = commands.length > 0

              async function handleRemediate(): Promise<void> {
                if (!onRemediate) return
                setRemediateState('running')
                try {
                  const result = await onRemediate(safeNode, commands)
                  setRemediateState(result.code === 0 ? 'done-ok' : `done-err:${result.code}`)
                } catch {
                  setRemediateState('done-err:1')
                }
              }

              return (
                <div className="insp-section">
                  <div className="insp-label">REMEDIATE</div>

                  {safeNode.driftStatus === 'unmanaged' && (
                    <div style={{ color: 'var(--ember-500)', marginBottom: 6, fontSize: 9 }}>
                      ⚠ Unmanaged — not in baseline.
                    </div>
                  )}
                  {safeNode.driftStatus === 'matched' && hasCommands && (
                    <div style={{ color: 'var(--moss-500)', marginBottom: 6, fontSize: 9 }}>
                      ↺ Apply baseline values.
                    </div>
                  )}

                  {hasCommands ? (
                    <>
                      <div style={{ marginBottom: 6 }}>
                        {commands.map((argv, i) => {
                          const full = 'aws ' + argv.join(' ')
                          const display = full.length > 200 ? full.slice(0, 200) + '…' : full
                          return (
                            <div
                              key={i}
                              title={full}
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 8,
                                color: 'var(--bone-200)',
                                background: 'oklch(0 0 0 / 0.3)',
                                borderRadius: 2,
                                padding: '2px 5px',
                                marginBottom: 2,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {display}
                            </div>
                          )
                        })}
                      </div>

                      <div style={{ color: 'var(--ember-500)', fontSize: 8, marginBottom: 6 }}>
                        ⚠ This will modify live AWS infrastructure.
                      </div>

                      <div className="insp-actions">
                        <button
                          onClick={() => void handleRemediate()}
                          disabled={remediateState === 'running' || !onRemediate}
                          className="btn btn-sm btn-primary"
                        >
                          {remediateState === 'running' ? 'Executing…' : 'Execute'}
                        </button>
                        {remediateState === 'done-ok' && (
                          <span style={{ color: 'var(--moss-500)', fontSize: 9 }}>✓ Done</span>
                        )}
                        {(remediateState as string).startsWith('done-err') && (
                          <span style={{ color: 'var(--fault-500)', fontSize: 9 }}>
                            ✗ Failed (exit {remediateState.split(':')[1]})
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--fg-muted)', fontSize: 9, fontStyle: 'italic' }}>
                      Manual remediation required — diff contains unsupported field types.
                    </div>
                  )}
                  <hr className="hairline" />
                </div>
              )
            })()}

          {/* ADVISORIES section */}
          {(() => {
            const rawAdvisories = analyzeNode(node as CloudNode)
            const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
            const advisories: Advisory[] = [...rawAdvisories].sort(
              (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
            )

            return (
              <div className="insp-section">
                <div
                  className="insp-label"
                  onClick={() => setAdvisoriesExpanded((e) => !e)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  ADVISORIES {advisoriesExpanded ? '▾' : '▸'}
                </div>

                {advisoriesExpanded &&
                  (advisories.length === 0 ? (
                    <div style={{ color: 'var(--fg-muted)', fontSize: 9, fontStyle: 'italic' }}>
                      No issues detected
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {advisories.map((a) => {
                        const fixCmds = buildAdvisoryRemediation(a, node.id)
                        const isCritical = a.severity === 'critical'
                        return (
                          <div
                            key={a.ruleId}
                            className={
                              'advisory-card' + (isCritical ? ' advisory-card--critical' : '')
                            }
                          >
                            <div className="advisory-title">
                              <span
                                className="label"
                                style={{
                                  color: isCritical
                                    ? 'var(--fault-500)'
                                    : a.severity === 'warning'
                                      ? 'var(--ember-500)'
                                      : 'oklch(0.72 0.15 240)',
                                  marginRight: 6,
                                  textTransform: 'none'
                                }}
                              >
                                {a.severity}
                              </span>
                              {a.title}
                            </div>
                            <div className="advisory-body">{a.detail}</div>
                            {fixCmds && onRemediate && (
                              <button
                                onClick={() => void onRemediate(node as CloudNode, fixCmds)}
                                className="advisory-fix"
                                title={`Fix: aws ${fixCmds[0].join(' ')}`}
                              >
                                Fix with CLI
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                <hr className="hairline" />
              </div>
            )
          })()}

          {/* Advisory next/prev navigation strip */}
          {advisoryNavigation &&
            advisoryNavigation.sorted.length > 1 &&
            advisoryNavigation.currentIdx !== -1 &&
            (() => {
              const { sorted, currentIdx } = advisoryNavigation
              const prevNode = currentIdx > 0 ? sorted[currentIdx - 1] : null
              const nextNode = currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null
              return (
                <div
                  className="insp-section"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 8,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--fg-muted)'
                  }}
                >
                  <button
                    disabled={!prevNode}
                    onClick={() => prevNode && selectNode(prevNode.id)}
                    className="btn btn-sm btn-ghost"
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: 8, color: 'var(--fg-muted)' }}>
                    {currentIdx + 1} / {sorted.length} nodes with issues
                  </span>
                  <button
                    disabled={!nextNode}
                    onClick={() => nextNode && selectNode(nextNode.id)}
                    className="btn btn-sm btn-ghost"
                  >
                    Next →
                  </button>
                </div>
              )
            })()}

          {/* fallback imported banner (only when no driftStatus) */}
          {!node.driftStatus && isImported && (
            <div style={{ margin: '0 var(--space-md) var(--space-sm)' }}>
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 4,
                  background: 'var(--bg-elev-2)',
                  border: '1px solid var(--border)',
                  fontSize: 11,
                  color: 'var(--fg-muted)'
                }}
              >
                Imported from Terraform — read-only
              </div>
            </div>
          )}

          {isImported && node.type === 'unknown' && (
            <div
              style={{
                margin: '0 var(--space-md) var(--space-sm)',
                fontSize: 11,
                color: 'var(--ember-500)'
              }}
            >
              Unsupported Terraform resource type:{' '}
              {String(node.metadata?.unsupportedTfType ?? 'unknown')}
            </div>
          )}

          {/* IDENTITY section */}
          <Section label="IDENTITY">
            <Row k="ID" v={redact(node.id)} copyable={node.id} />
            <Row k="NAME" v={redact(node.label)} />
            <Row k="REGION" v={node.region} />
            <Row
              k="STATE"
              v={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span
                    className={
                      node.status === 'error'
                        ? 'dot -err'
                        : node.status === 'stopped'
                          ? 'dot -neutral'
                          : node.status === 'pending' || node.status === 'deleting'
                            ? 'dot -pending'
                            : 'dot -ok'
                    }
                  />
                  {node.status}
                </span>
              }
            />
            <Row
              k="EST. COST"
              v={formatPrice(getMonthlyEstimate(node.type, node.region ?? 'us-east-1'))}
            />
          </Section>

          {/* METRICS section — lambda/rds/ecs only, when CW data fetched */}
          {cwMetrics.length > 0 && (
            <div className="insp-section">
              <div className="insp-label">METRICS</div>
              <div className="insp-metrics">
                {cwMetrics.map((m) => (
                  <div key={m.name} className="insp-metric">
                    <div className="label">{m.name}</div>
                    <div className="value">
                      {m.value}
                      <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>{m.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <hr className="hairline" />
            </div>
          )}

          {/* ACTIONS section */}
          <div className="insp-section">
            <div className="insp-label">ACTIONS</div>
            <div className="insp-actions">
              <button
                onClick={() => toggleLockNode(node.id)}
                className={'btn btn-sm ' + (lockedNodes.has(node.id) ? 'btn-primary' : 'btn-ghost')}
              >
                {lockedNodes.has(node.id) ? '⊠ Locked' : '◈ Lock'}
              </button>
              {(() => {
                const consoleUrl = buildConsoleUrl(node)
                if (!consoleUrl) return null
                return (
                  <button
                    onClick={() => window.open(consoleUrl, '_blank')}
                    className="btn btn-sm btn-ghost"
                  >
                    ⎋ AWS Console ↗
                  </button>
                )
              })()}
            </div>
            <hr className="hairline" />
          </div>

          {/* Per-type METADATA section */}
          {renderMetadataSection({
            node: node as CloudNode,
            nodes,
            importedNodes,
            isImported,
            invalidatePath,
            setInvalidatePath,
            acmDeleteError,
            setAcmDeleteError,
            onEdit,
            onDelete,
            onQuickAction,
            onAddRoute,
            setActiveCreate
          })}

          {/* Connections */}
          {(() => {
            const allNodes = [...nodes, ...importedNodes]
            const outgoing = (node.integrations ?? []).map((integ) => {
              const resolvedId = resolveIntegrationTargetId(allNodes, integ.targetId)
              const target = allNodes.find((n) => n.id === resolvedId)
              return { integ, target }
            })
            const incoming = allNodes.filter(
              (n) =>
                n.id !== node.id &&
                (n.integrations ?? []).some(
                  (e) => resolveIntegrationTargetId(allNodes, e.targetId) === node.id
                )
            )
            if (outgoing.length === 0 && incoming.length === 0) return null
            return (
              <div className="insp-section">
                <div className="insp-label">CONNECTIONS</div>
                <div className="insp-rows">
                  {outgoing.map(({ integ, target }, i) => (
                    <div
                      key={`out-${i}`}
                      className="insp-row"
                      style={{ cursor: target ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (!target) return
                        useUIStore.getState().selectNode(target.id)
                        window.dispatchEvent(
                          new CustomEvent('riftview:fitnode', {
                            detail: { nodeId: target.id }
                          })
                        )
                      }}
                    >
                      <span className="k">→ {integ.edgeType}</span>
                      <span className="v">
                        {target
                          ? target.label
                          : (integ.targetId.split('/').pop() ?? integ.targetId)}
                        {target?.type && (
                          <span style={{ color: 'var(--fg-muted)', marginLeft: 6 }}>
                            {target.type}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                  {incoming.map((src, i) => {
                    const e = (src.integrations ?? []).find(
                      (edge) => resolveIntegrationTargetId(allNodes, edge.targetId) === node.id
                    )!
                    return (
                      <div
                        key={`in-${i}`}
                        className="insp-row"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          useUIStore.getState().selectNode(src.id)
                          window.dispatchEvent(
                            new CustomEvent('riftview:fitnode', { detail: { nodeId: src.id } })
                          )
                        }}
                      >
                        <span className="k">← {e.edgeType}</span>
                        <span className="v">
                          {src.label}
                          <span style={{ color: 'var(--fg-muted)', marginLeft: 6 }}>
                            {src.type}
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
                <hr className="hairline" />
              </div>
            )
          })()}

          {/* IAM Permissions — EC2, Lambda, S3 only */}
          {node && IAM_SUPPORTED_TYPES.includes(node.type as NodeType) && !isImported && (
            <div className="insp-section">
              <IamAdvisor node={node} />
            </div>
          )}

          {/* NOTES section */}
          <div className="insp-section">
            <div
              className="insp-label"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>NOTES</span>
              {annotations[node.id] && (
                <button
                  onClick={() => {
                    clearAnnotation(node.id)
                    const next = { ...useUIStore.getState().annotations }
                    delete next[node.id]
                    void window.riftview.saveAnnotations(next)
                  }}
                  className="btn btn-sm btn-ghost"
                  title="Clear note"
                  style={{ padding: '0 4px' }}
                >
                  ✕
                </button>
              )}
            </div>
            <textarea
              value={annotations[node.id] ?? ''}
              onChange={(e) => setAnnotation(node.id, e.target.value)}
              onBlur={(e) => {
                const next = { ...useUIStore.getState().annotations, [node.id]: e.target.value }
                if (!e.target.value) delete next[node.id]
                void window.riftview.saveAnnotations(next)
              }}
              placeholder="Add a note about this resource..."
              rows={4}
              style={{
                width: '100%',
                background: 'var(--ink-850)',
                border: '1px solid var(--border)',
                borderRadius: 2,
                padding: '4px 6px',
                color: 'var(--fg)',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                resize: 'vertical',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
            <hr className="hairline" />
          </div>

          {/* HISTORY section */}
          <div className="insp-section">
            <div className="insp-label">HISTORY</div>
            {nodeHistory.length === 0 ? (
              <div style={{ fontSize: 9, color: 'var(--fg-muted)', fontStyle: 'italic' }}>
                No changes recorded yet
              </div>
            ) : (
              <div className="insp-rows">
                {nodeHistory.slice(0, 10).map((entry, i) => (
                  <div
                    key={i}
                    className="insp-row"
                    style={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gridTemplateColumns: '1fr'
                    }}
                  >
                    <span className="k">↳ {relativeTime(entry.timestamp)}</span>
                    <div style={{ paddingLeft: 10, marginTop: 2, width: '100%' }}>
                      {entry.changes.map((c, j) => (
                        <div
                          key={j}
                          style={{
                            fontSize: 8,
                            color: 'var(--bone-200)',
                            marginBottom: 1
                          }}
                        >
                          <span style={{ color: 'var(--fg-muted)' }}>{c.field}:</span>{' '}
                          <span style={{ color: 'oklch(0.80 0.15 28)' }}>{truncate(c.before)}</span>
                          {' → '}
                          <span style={{ color: 'var(--moss-500)' }}>{truncate(c.after)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <hr className="hairline" />
          </div>
        </>
      )}
    </div>
  )
}

// ── Edge view ─────────────────────────────────────────────────────────────

function EdgeView({
  info,
  nodes,
  importedNodes
}: {
  info: NonNullable<ReturnType<typeof useUIStore.getState>['selectedEdgeInfo']>
  nodes: CloudNode[]
  importedNodes: CloudNode[]
}): React.JSX.Element {
  const srcNode =
    nodes.find((n) => n.id === info.source) ?? importedNodes.find((n) => n.id === info.source)
  const tgtNode =
    nodes.find((n) => n.id === info.target) ?? importedNodes.find((n) => n.id === info.target)
  const isCustom = (info.data as { isCustom?: boolean } | undefined)?.isCustom

  return (
    <>
      <div className="insp-header">
        <div className="eyebrow">EDGE</div>
        <div className="insp-title">{edgeTypeLabel(info.id, info.data)}</div>
      </div>
      <hr className="hairline" />
      <Section label="ENDPOINTS">
        <Row k="SOURCE" v={srcNode ? srcNode.label : info.source} />
        {srcNode && <Row k="SRC TYPE" v={srcNode.type.toUpperCase()} />}
        <Row k="TARGET" v={tgtNode ? tgtNode.label : info.target} />
        {tgtNode && <Row k="TGT TYPE" v={tgtNode.type.toUpperCase()} />}
      </Section>

      {isCustom ? (
        <div className="insp-section">
          <div className="insp-label">CUSTOM EDGE</div>
          <div style={{ marginBottom: 8 }}>
            <div className="k" style={{ fontSize: 7, marginBottom: 2 }}>
              LABEL
            </div>
            <input
              value={(info.data as { label?: string } | undefined)?.label ?? ''}
              onChange={(e) => {
                useUIStore.getState().updateCustomEdgeLabel(info.id, e.target.value)
                void window.riftview.saveCustomEdges(useUIStore.getState().customEdges)
              }}
              placeholder="add label…"
              style={{
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                width: '100%',
                background: 'var(--ink-850)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
                borderRadius: 3,
                padding: '2px 5px',
                outline: 'none'
              }}
            />
          </div>
          <button
            onClick={() => {
              useUIStore.getState().removeCustomEdge(info.id)
              void window.riftview.saveCustomEdges(useUIStore.getState().customEdges)
              useUIStore.getState().selectEdge(null)
            }}
            className="btn btn-sm btn-ghost"
            style={{ color: 'var(--fault-500)', borderColor: 'var(--fault-500)' }}
          >
            Delete edge
          </button>
          <hr className="hairline" />
        </div>
      ) : (
        <>
          {info.data && Object.keys(info.data).filter((k) => k !== 'isIntegration').length > 0 && (
            <div className="insp-section">
              <div className="insp-label">METADATA</div>
              <div className="insp-rows">
                {Object.entries(info.data)
                  .filter(([k]) => k !== 'isIntegration')
                  .map(([k, v]) => (
                    <Row key={k} k={fieldLabel(k)} v={String(v ?? '—')} />
                  ))}
              </div>
              <hr className="hairline" />
            </div>
          )}
          {info.label && (
            <Section label="LABEL">
              <Row k="LABEL" v={info.label} />
            </Section>
          )}
        </>
      )}
    </>
  )
}

// ── Per-type metadata rendering ───────────────────────────────────────────

interface RenderMetadataArgs {
  node: CloudNode
  nodes: CloudNode[]
  importedNodes: CloudNode[]
  isImported: boolean
  invalidatePath: string
  setInvalidatePath: (v: string) => void
  acmDeleteError: string | null
  setAcmDeleteError: (v: string | null) => void
  onEdit: (n: CloudNode) => void
  onDelete: (n: CloudNode) => void
  onQuickAction: (
    n: CloudNode,
    action: 'stop' | 'start' | 'reboot' | 'invalidate',
    meta?: { path?: string }
  ) => void
  onAddRoute?: (apiId: string) => void
  setActiveCreate: ReturnType<typeof useUIStore.getState>['setActiveCreate']
}

function renderMetadataSection(args: RenderMetadataArgs): React.JSX.Element {
  const {
    node,
    nodes,
    importedNodes,
    isImported,
    invalidatePath,
    setInvalidatePath,
    acmDeleteError,
    setAcmDeleteError,
    onEdit,
    onDelete,
    onQuickAction,
    onAddRoute,
    setActiveCreate
  } = args

  const editDelete = !isImported && (
    <div className="insp-actions">
      <button onClick={() => onEdit(node)} className="btn btn-sm btn-ghost">
        ✎ Edit
      </button>
      <button onClick={() => onDelete(node)} className="btn btn-sm btn-ghost">
        ✕ Delete
      </button>
    </div>
  )

  // ACM
  if (node.type === 'acm') {
    return (
      <div className="insp-section">
        <div className="insp-label">CERTIFICATE</div>
        <div className="insp-rows">
          <Row k="DOMAIN" v={(node.metadata.domainName as string) ?? '—'} />
          <Row k="VALIDATION" v={(node.metadata.validationMethod as string) ?? '—'} />
          <Row
            k="IN USE BY"
            v={`${((node.metadata.inUseBy as string[] | undefined) ?? []).length} resource(s)`}
          />
        </div>
        {node.status === 'pending' &&
          ((node.metadata.cnameRecords as Array<{ name: string; value: string }> | undefined)
            ?.length ?? 0) > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="label" style={{ marginBottom: 4 }}>
                DNS Validation CNAMEs
              </div>
              {(node.metadata.cnameRecords as Array<{ name: string; value: string }>).map(
                (rec, i) => (
                  <div key={i} style={{ marginBottom: 6, fontSize: 8 }}>
                    <Row k="NAME" v={rec.name} copyable={rec.name} />
                    <Row k="VALUE" v={rec.value} copyable={rec.value} />
                  </div>
                )
              )}
            </div>
          )}
        {acmDeleteError && (
          <div style={{ marginTop: 6, fontSize: 8, color: 'var(--fault-500)' }}>
            {acmDeleteError}
          </div>
        )}
        {!isImported && (
          <div className="insp-actions">
            <button
              onClick={() => {
                const inUseBy = (node.metadata.inUseBy as string[] | undefined) ?? []
                if (inUseBy.length > 0) {
                  setAcmDeleteError(`Cannot delete: in use by ${inUseBy.length} resource(s)`)
                  return
                }
                setAcmDeleteError(null)
                onDelete(node)
              }}
              className="btn btn-sm btn-ghost"
            >
              ✕ Delete
            </button>
          </div>
        )}
        <hr className="hairline" />
      </div>
    )
  }

  // CloudFront
  if (node.type === 'cloudfront') {
    return (
      <div className="insp-section">
        <div className="insp-label">DISTRIBUTION</div>
        <div className="insp-rows">
          <Row k="DOMAIN" v={(node.metadata.domainName as string) ?? '—'} />
          <Row
            k="ORIGINS"
            v={`${((node.metadata.origins as unknown[] | undefined) ?? []).length} origin(s)`}
          />
          <Row k="PRICE CLASS" v={(node.metadata.priceClass as string) ?? '—'} />
          <Row k="CERT ARN" v={(node.metadata.certArn as string | undefined) ?? 'default'} />
          <Row k="ROOT OBJECT" v={(node.metadata.defaultRootObject as string) || '—'} />
        </div>
        {!isImported && (
          <>
            {editDelete}
            <div style={{ marginTop: 10 }}>
              <div className="label" style={{ marginBottom: 4 }}>
                Invalidate Cache
              </div>
              <input
                value={invalidatePath}
                onChange={(e) => setInvalidatePath(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--ink-900)',
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                  padding: '2px 5px',
                  color: 'var(--fg)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  boxSizing: 'border-box'
                }}
              />
              <div className="insp-actions" style={{ marginTop: 4 }}>
                <button
                  onClick={() => onQuickAction(node, 'invalidate', { path: invalidatePath })}
                  className="btn btn-sm btn-primary"
                >
                  Invalidate
                </button>
              </div>
            </div>
          </>
        )}
        <hr className="hairline" />
      </div>
    )
  }

  // API Gateway
  if (node.type === 'apigw') {
    const routeCount = nodes.filter(
      (n) => n.type === 'apigw-route' && n.parentId === node.id
    ).length
    return (
      <div className="insp-section">
        <div className="insp-label">API</div>
        <div className="insp-rows">
          <Row
            k="ENDPOINT"
            v={(node.metadata.endpoint as string) || '—'}
            copyable={node.metadata.endpoint ? (node.metadata.endpoint as string) : undefined}
          />
          <Row k="PROTOCOL" v="HTTP" />
          <Row
            k="CORS"
            v={((node.metadata.corsOrigins as string[] | undefined) ?? []).join(', ') || '(none)'}
          />
          <Row k="ROUTES" v={String(routeCount)} />
        </div>
        {!isImported && (
          <>
            {editDelete}
            <div style={{ marginTop: 4, fontSize: 8, color: 'var(--fg-muted)' }}>
              Deletes all routes in this API.
            </div>
            <div className="insp-actions">
              <button
                onClick={() => {
                  setActiveCreate({ resource: 'apigw-route', view: 'topology' })
                  if (onAddRoute) onAddRoute(node.id)
                }}
                className="btn btn-sm btn-primary"
              >
                + Add Route
              </button>
            </div>
          </>
        )}
        <hr className="hairline" />
      </div>
    )
  }

  // API Gateway Route
  if (node.type === 'apigw-route') {
    const api = nodes.find((n) => n.id === node.metadata.apiId)
    return (
      <div className="insp-section">
        <div className="insp-label">ROUTE</div>
        <div className="insp-rows">
          <Row k="METHOD" v={(node.metadata.method as string) ?? '—'} />
          <Row k="PATH" v={(node.metadata.path as string) ?? '—'} />
          <Row k="API" v={api ? api.label : (node.metadata.apiId as string)} />
          <Row
            k="TARGET"
            v={(node.metadata.lambdaArn as string | undefined) ?? '(no integration)'}
            copyable={node.metadata.lambdaArn ? (node.metadata.lambdaArn as string) : undefined}
          />
        </div>
        {!isImported && (
          <div className="insp-actions">
            <button onClick={() => onDelete(node)} className="btn btn-sm btn-ghost">
              ✕ Delete
            </button>
          </div>
        )}
        <hr className="hairline" />
      </div>
    )
  }

  // Lambda
  if (node.type === 'lambda') {
    const rows = [
      { k: 'RUNTIME', v: node.metadata.runtime as string | undefined },
      { k: 'HANDLER', v: node.metadata.handler as string | undefined },
      {
        k: 'TIMEOUT',
        v: node.metadata.timeout != null ? `${String(node.metadata.timeout)}s` : undefined
      },
      {
        k: 'MEMORY',
        v: node.metadata.memorySize != null ? `${String(node.metadata.memorySize)} MB` : undefined
      }
    ].filter((r) => r.v)
    return (
      <div className="insp-section">
        <div className="insp-label">FUNCTION</div>
        <div className="insp-rows">
          {rows.map((r) => (
            <Row key={r.k} k={r.k} v={r.v!} />
          ))}
        </div>
        {editDelete}
        <hr className="hairline" />
      </div>
    )
  }

  // ECS
  if (node.type === 'ecs') {
    return (
      <div className="insp-section">
        <div className="insp-label">SERVICE</div>
        <div className="insp-rows">
          <Row k="CLUSTER" v={(node.metadata.clusterName as string) ?? '—'} />
          <Row k="LAUNCH TYPE" v={(node.metadata.launchType as string) ?? '—'} />
          <Row k="DESIRED" v={String(node.metadata.desiredCount ?? '—')} />
          <Row k="RUNNING" v={String(node.metadata.runningCount ?? '—')} />
        </div>
        {!isImported && (
          <>
            <div className="insp-actions">
              <button
                onClick={async () => {
                  const instanceId = (node.metadata?.taskArn as string) ?? node.id
                  const profile = useCloudStore.getState().profile
                  const result = await window.riftview.startTerminal({
                    instanceId,
                    region: node.region,
                    profile
                  })
                  if (result.ok) {
                    useUIStore.getState().openTerminal(node.id, result.sessionId)
                  } else {
                    useUIStore.getState().showToast(`Terminal failed: ${result.error}`, 'error')
                  }
                }}
                className="btn btn-sm btn-ghost"
              >
                ⬚ Open Terminal
              </button>
            </div>
          </>
        )}
        <hr className="hairline" />
      </div>
    )
  }

  // RDS
  if (node.type === 'rds') {
    return (
      <div className="insp-section">
        <div className="insp-label">DATABASE</div>
        <div className="insp-rows">
          {typeof node.metadata.engine === 'string' && node.metadata.engine !== '' && (
            <Row k="ENGINE" v={node.metadata.engine} />
          )}
          {typeof node.metadata.instanceClass === 'string' &&
            node.metadata.instanceClass !== '' && (
              <Row k="INSTANCE" v={node.metadata.instanceClass} />
            )}
          {typeof node.metadata.endpoint === 'string' && node.metadata.endpoint && (
            <Row k="ENDPOINT" v={node.metadata.endpoint} copyable={node.metadata.endpoint} />
          )}
        </div>
        {!isImported && (
          <>
            {editDelete}
            <div className="insp-actions" style={{ marginTop: 8 }}>
              {node.status !== 'stopped' && (
                <button
                  onClick={() => onQuickAction(node, 'stop')}
                  className="btn btn-sm btn-ghost"
                >
                  Stop
                </button>
              )}
              {node.status === 'stopped' && (
                <button
                  onClick={() => onQuickAction(node, 'start')}
                  className="btn btn-sm btn-primary"
                >
                  Start
                </button>
              )}
              <button
                onClick={() => onQuickAction(node, 'reboot')}
                className="btn btn-sm btn-ghost"
              >
                Reboot
              </button>
            </div>
          </>
        )}
        <hr className="hairline" />
      </div>
    )
  }

  // SQS
  if (node.type === 'sqs') {
    return (
      <div className="insp-section">
        <div className="insp-label">QUEUE STATS</div>
        <div className="insp-metrics">
          <div className="insp-metric">
            <div className="label">MESSAGES</div>
            <div className="value">
              {node.metadata.messages != null ? String(node.metadata.messages) : '—'}
            </div>
          </div>
          <div className="insp-metric">
            <div className="label">IN FLIGHT</div>
            <div className="value">
              {node.metadata.inFlight != null ? String(node.metadata.inFlight) : '—'}
            </div>
          </div>
        </div>
        {node.label.endsWith('.fifo') && (
          <div style={{ fontSize: 8, color: 'var(--oxide-400)', marginTop: 6 }}>FIFO queue</div>
        )}
        {editDelete}
        <hr className="hairline" />
      </div>
    )
  }

  // DynamoDB
  if (node.type === 'dynamo') {
    const rows = [
      { k: 'BILLING', v: node.metadata.billingMode as string | undefined },
      {
        k: 'ITEMS',
        v:
          node.metadata.itemCount != null
            ? Number(node.metadata.itemCount).toLocaleString()
            : undefined
      },
      {
        k: 'SIZE',
        v:
          node.metadata.sizeBytes != null
            ? `${(Number(node.metadata.sizeBytes) / 1024 / 1024).toFixed(1)} MB`
            : undefined
      }
    ].filter((r) => r.v)
    return (
      <div className="insp-section">
        <div className="insp-label">TABLE</div>
        <div className="insp-rows">
          {rows.map((r) => (
            <Row key={r.k} k={r.k} v={r.v!} />
          ))}
        </div>
        {editDelete}
        <hr className="hairline" />
      </div>
    )
  }

  // EC2
  if (node.type === 'ec2') {
    const rows = [
      { k: 'TYPE', v: node.metadata.instanceType as string | undefined },
      { k: 'AMI', v: node.metadata.ami as string | undefined },
      { k: 'PRIVATE IP', v: node.metadata.privateIp as string | undefined },
      { k: 'PUBLIC IP', v: node.metadata.publicIp as string | undefined }
    ].filter((r) => r.v)
    const sgIds = (node.metadata.securityGroupIds as string[] | undefined) ?? []
    return (
      <div className="insp-section">
        <div className="insp-label">INSTANCE</div>
        <div className="insp-rows">
          {rows.map((r) => {
            const copyable = r.k === 'PRIVATE IP' || r.k === 'PUBLIC IP' ? r.v! : undefined
            return <Row key={r.k} k={r.k} v={r.v!} copyable={copyable} />
          })}
        </div>
        {sgIds.length > 0 && (
          <>
            <div className="label" style={{ marginTop: 8, marginBottom: 4 }}>
              SECURITY GROUPS
            </div>
            <div className="insp-rows">
              {sgIds.map((sgId) => {
                const sgNode = [...nodes, ...importedNodes].find((n) => n.id === sgId)
                return (
                  <div
                    key={sgId}
                    className="insp-row"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      useUIStore.getState().selectNode(sgId)
                      window.dispatchEvent(
                        new CustomEvent('riftview:fitnode', { detail: { nodeId: sgId } })
                      )
                    }}
                    title={`Go to ${sgNode?.label ?? sgId}`}
                  >
                    <span className="k">↗</span>
                    <span className="v">{sgNode?.label ?? sgId}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
        {!isImported && (
          <>
            {editDelete}
            <div className="insp-actions" style={{ marginTop: 8 }}>
              {node.status !== 'stopped' && (
                <button
                  onClick={() => onQuickAction(node, 'stop')}
                  className="btn btn-sm btn-ghost"
                >
                  Stop
                </button>
              )}
              {node.status === 'stopped' && (
                <button
                  onClick={() => onQuickAction(node, 'start')}
                  className="btn btn-sm btn-primary"
                >
                  Start
                </button>
              )}
              <button
                onClick={() => onQuickAction(node, 'reboot')}
                className="btn btn-sm btn-ghost"
              >
                Reboot
              </button>
              <button
                onClick={async () => {
                  const instanceId = (node.metadata?.instanceId as string) ?? node.id
                  const profile = useCloudStore.getState().profile
                  const result = await window.riftview.startTerminal({
                    instanceId,
                    region: node.region,
                    profile
                  })
                  if (result.ok) {
                    useUIStore.getState().openTerminal(node.id, result.sessionId)
                  } else {
                    useUIStore.getState().showToast(`Terminal failed: ${result.error}`, 'error')
                  }
                }}
                className="btn btn-sm btn-ghost"
              >
                ⬚ Open Terminal
              </button>
            </div>
          </>
        )}
        <hr className="hairline" />
      </div>
    )
  }

  // SNS
  if (node.type === 'sns') {
    return (
      <div className="insp-section">
        <div className="insp-label">TOPIC</div>
        <div className="insp-rows">
          <Row
            k="SUBSCRIBERS"
            v={
              node.metadata.subscriptionCount != null
                ? String(node.metadata.subscriptionCount)
                : '—'
            }
          />
        </div>
        {editDelete}
        <hr className="hairline" />
      </div>
    )
  }

  // ECR
  if (node.type === 'ecr-repo') {
    return (
      <div className="insp-section">
        <div className="insp-label">REPOSITORY</div>
        <div className="insp-rows">
          {typeof node.metadata.uri === 'string' && node.metadata.uri && (
            <Row k="URI" v={node.metadata.uri} copyable={node.metadata.uri} />
          )}
        </div>
        {editDelete}
        <hr className="hairline" />
      </div>
    )
  }

  // ElastiCache
  if (node.type === 'elasticache') {
    const rows = [
      { k: 'ENGINE', v: node.metadata.engine as string | undefined },
      { k: 'NODE TYPE', v: node.metadata.nodeType as string | undefined },
      {
        k: 'CLUSTERS',
        v: node.metadata.numCaches != null ? String(node.metadata.numCaches) : undefined
      }
    ].filter((r) => r.v)
    return (
      <div className="insp-section">
        <div className="insp-label">CACHE</div>
        <div className="insp-rows">
          {rows.map((r) => (
            <Row key={r.k} k={r.k} v={r.v!} />
          ))}
          {typeof node.metadata.endpoint === 'string' && node.metadata.endpoint && (
            <Row k="ENDPOINT" v={node.metadata.endpoint} copyable={node.metadata.endpoint} />
          )}
        </div>
        {editDelete}
        <hr className="hairline" />
      </div>
    )
  }

  // EKS
  if (node.type === 'eks') {
    const rows = [
      { k: 'VERSION', v: node.metadata.version as string | undefined },
      { k: 'ENDPOINT', v: node.metadata.endpoint as string | undefined }
    ].filter((r) => r.v)
    return (
      <div className="insp-section">
        <div className="insp-label">CLUSTER</div>
        <div className="insp-rows">
          {rows.map((r) => (
            <Row key={r.k} k={r.k} v={r.v!} />
          ))}
        </div>
        <hr className="hairline" />
      </div>
    )
  }

  // Default fallback
  const entries = Object.entries(node.metadata).slice(0, 6)
  return (
    <>
      {entries.length > 0 && (
        <div className="insp-section">
          <div className="insp-label">METADATA</div>
          <div className="insp-rows">
            {entries.map(([k, v]) => (
              <Row key={k} k={fieldLabel(k)} v={String(v ?? '—')} />
            ))}
          </div>
          <hr className="hairline" />
        </div>
      )}
      {editDelete && (
        <div className="insp-section">
          {editDelete}
          <hr className="hairline" />
        </div>
      )}
    </>
  )
}
