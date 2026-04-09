import React, { useState } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import type { CloudNode, NodeType } from '../types/cloud'
import { fieldLabel } from '../utils/fieldLabels'
import { edgeTypeLabel } from '../utils/edgeTypeLabel'
import { getMonthlyEstimate, formatPrice } from '../utils/pricing'
import { IamAdvisor } from './IamAdvisor'
import { buildConsoleUrl } from '../utils/buildConsoleUrl'
import { flag } from '../utils/flags'
import { buildRemediateCommands } from '../utils/buildRemediateCommands'
import { analyzeNode } from '../utils/analyzeNode'
import type { Advisory } from '../types/cloud'
import { resolveIntegrationTargetId } from '../utils/resolveIntegrationTargetId'
import { buildAdvisoryRemediation } from '../utils/buildAdvisoryRemediations'

function DriftDiffTable({ metadata, tfMetadata }: { metadata: Record<string, unknown>; tfMetadata: Record<string, unknown> }): React.JSX.Element {
  const allKeys = Array.from(new Set([...Object.keys(metadata), ...Object.keys(tfMetadata)]))
  const diffs = allKeys.filter((k) => String(metadata[k] ?? '') !== String(tfMetadata[k] ?? '') && (metadata[k] !== undefined || tfMetadata[k] !== undefined))

  return (
    <>
      <div style={{ fontWeight: 700, color: '#22c55e', marginBottom: diffs.length > 0 ? 6 : 0 }}>
        ✓ MATCHED{diffs.length > 0 ? ` — ${diffs.length} difference${diffs.length === 1 ? '' : 's'}` : ''}
      </div>
      {diffs.length === 0 ? (
        <div style={{ color: '#4ade80', fontSize: 10 }}>No differences detected</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'rgba(0,0,0,0.3)', borderRadius: 3, overflow: 'hidden', fontSize: 9 }}>
          <div style={{ padding: '3px 6px', color: '#6b7280', fontWeight: 700, fontSize: 8, background: 'rgba(0,0,0,0.2)' }}>LIVE</div>
          <div style={{ padding: '3px 6px', color: '#7c3aed', fontWeight: 700, fontSize: 8, background: 'rgba(0,0,0,0.2)' }}>TERRAFORM</div>
          {diffs.map((k) => (
            <React.Fragment key={k}>
              <div style={{ padding: '3px 6px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#6b7280', fontSize: 7, marginBottom: 1 }}>{k}</div>
                <div style={{ color: '#fca5a5' }}>{String(metadata[k] ?? '—')}</div>
              </div>
              <div style={{ padding: '3px 6px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#6b7280', fontSize: 7, marginBottom: 1 }}>{k}</div>
                <div style={{ color: '#86efac' }}>{String(tfMetadata[k] ?? '—')}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  )
}

type RemediateState = 'idle' | 'running' | 'done-ok' | `done-err:${number}`

interface InspectorProps {
  onDelete: (node: CloudNode) => void
  onEdit: (node: CloudNode) => void
  onQuickAction: (node: CloudNode, action: 'stop' | 'start' | 'reboot' | 'invalidate', meta?: { path?: string }) => void
  onAddRoute?: (apiId: string) => void
  onRemediate?: (node: CloudNode, commands: string[][]) => Promise<{ code: number }>
}

export function Inspector({ onDelete, onEdit, onQuickAction, onAddRoute, onRemediate }: InspectorProps): React.JSX.Element {
  const selectedId      = useUIStore((s) => s.selectedNodeId)
  const selectedEdgeInfo = useUIStore((s) => s.selectedEdgeInfo)
  const setActiveCreate = useUIStore((s) => s.setActiveCreate)
  const lockedNodes     = useUIStore((s) => s.lockedNodes)
  const toggleLockNode  = useUIStore((s) => s.toggleLockNode)
  const annotations     = useUIStore((s) => s.annotations)
  const setAnnotation   = useUIStore((s) => s.setAnnotation)
  const clearAnnotation = useUIStore((s) => s.clearAnnotation)
  const nodes           = useCloudStore((s) => s.nodes)
  const importedNodes   = useCloudStore((s) => s.importedNodes)
  const node          = nodes.find((n) => n.id === selectedId) ?? importedNodes.find((n) => n.id === selectedId)

  const isImported = node?.status === 'imported'

  const [invalidatePath, setInvalidatePath] = useState('/*')
  const [acmDeleteError, setAcmDeleteError] = useState<string | null>(null)

  const [remediateState, setRemediateState] = useState<RemediateState>('idle')
  const [advisoriesExpanded, setAdvisoriesExpanded] = useState(true)

  React.useEffect(() => {
    setRemediateState('idle')
  }, [selectedId])

  const IAM_SUPPORTED_TYPES: NodeType[] = ['ec2', 'lambda', 's3']

  const STATUS_COLORS: Record<string, string> = {
    running: '#28c840', stopped: '#ff5f57', pending: '#febc2e', error: '#ff5f57', unknown: '#666',
  }

  const btnBase: React.CSSProperties = {
    flex: 1, background: 'var(--cb-bg-elevated)', borderRadius: 2,
    padding: '3px 0', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer',
  }

  return (
    <div
      className="p-3 overflow-y-auto h-full"
      style={{ background: 'var(--cb-bg-panel)', borderLeft: '1px solid var(--cb-border-strong)', fontFamily: 'monospace' }}
    >
      {!node && selectedEdgeInfo ? (
        <>
          <div className="text-[9px] font-bold mb-2 pb-1" style={{ color: 'var(--cb-accent)', borderBottom: '1px solid var(--cb-border-strong)' }}>
            EDGE  ·  Selected
          </div>
          <div className="mb-3">
            <div className="text-[8px] mb-0.5" style={{ color: 'var(--cb-text-muted)' }}>TYPE</div>
            <div className="text-[9px] break-all" style={{ color: 'var(--cb-text-primary)' }}>
              {edgeTypeLabel(selectedEdgeInfo.id, selectedEdgeInfo.data)}
            </div>
          </div>
          {(() => {
            const srcNode = nodes.find((n) => n.id === selectedEdgeInfo.source) ?? importedNodes.find((n) => n.id === selectedEdgeInfo.source)
            const tgtNode = nodes.find((n) => n.id === selectedEdgeInfo.target) ?? importedNodes.find((n) => n.id === selectedEdgeInfo.target)
            return (
              <>
                <div className="mb-3">
                  <div className="text-[8px] mb-0.5" style={{ color: 'var(--cb-text-muted)' }}>SOURCE</div>
                  <div className="text-[9px] break-all" style={{ color: 'var(--cb-text-primary)' }}>
                    {srcNode ? srcNode.label : selectedEdgeInfo.source}
                  </div>
                  {srcNode && (
                    <div className="text-[8px]" style={{ color: 'var(--cb-text-muted)' }}>{srcNode.type.toUpperCase()}</div>
                  )}
                </div>
                <div className="mb-3">
                  <div className="text-[8px] mb-0.5" style={{ color: 'var(--cb-text-muted)' }}>TARGET</div>
                  <div className="text-[9px] break-all" style={{ color: 'var(--cb-text-primary)' }}>
                    {tgtNode ? tgtNode.label : selectedEdgeInfo.target}
                  </div>
                  {tgtNode && (
                    <div className="text-[8px]" style={{ color: 'var(--cb-text-muted)' }}>{tgtNode.type.toUpperCase()}</div>
                  )}
                </div>
              </>
            )
          })()}
          {(selectedEdgeInfo.data as { isCustom?: boolean } | undefined)?.isCustom ? (
            <div className="mt-3">
              <div className="text-[8px] mb-2" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                CUSTOM EDGE
              </div>
              <div className="mb-2">
                <div className="text-[7px] mb-0.5" style={{ color: 'var(--cb-text-muted)' }}>LABEL</div>
                <input
                  value={(selectedEdgeInfo.data as { label?: string } | undefined)?.label ?? ''}
                  onChange={(e) => {
                    useUIStore.getState().updateCustomEdgeLabel(selectedEdgeInfo.id, e.target.value)
                    void window.terminus.saveCustomEdges(useUIStore.getState().customEdges)
                  }}
                  placeholder="add label…"
                  style={{
                    fontSize: 9, fontFamily: 'monospace', width: '100%',
                    background: 'var(--cb-bg-elevated)',
                    border: '1px solid var(--cb-border)',
                    color: 'var(--cb-text-primary)',
                    borderRadius: 3, padding: '2px 5px', outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={() => {
                  useUIStore.getState().removeCustomEdge(selectedEdgeInfo.id)
                  void window.terminus.saveCustomEdges(useUIStore.getState().customEdges)
                  useUIStore.getState().selectEdge(null)
                }}
                style={{
                  fontSize: 9, fontFamily: 'monospace', cursor: 'pointer',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)',
                  color: '#ef4444', borderRadius: 3, padding: '2px 8px', width: '100%',
                }}
              >
                Delete edge
              </button>
            </div>
          ) : (
            <>
              {selectedEdgeInfo.data && Object.keys(selectedEdgeInfo.data).filter((k) => k !== 'isIntegration').length > 0 && (
                <div>
                  <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                    METADATA
                  </div>
                  {Object.entries(selectedEdgeInfo.data)
                    .filter(([k]) => k !== 'isIntegration')
                    .map(([k, v]) => (
                      <div key={k} className="mb-1.5">
                        <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>{fieldLabel(k)}</div>
                        <div className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)' }}>{String(v ?? '—')}</div>
                      </div>
                    ))}
                </div>
              )}
              {selectedEdgeInfo.label && (
                <div className="mb-3">
                  <div className="text-[8px] mb-0.5" style={{ color: 'var(--cb-text-muted)' }}>LABEL</div>
                  <div className="text-[9px]" style={{ color: 'var(--cb-text-primary)' }}>{selectedEdgeInfo.label}</div>
                </div>
              )}
            </>
          )}
        </>
      ) : !node ? (
        <div className="text-[9px] text-center mt-8" style={{ color: 'var(--cb-text-muted)' }}>
          Click a resource to inspect
        </div>
      ) : (
        <>
          {/* drift banners float to top when driftStatus is set */}
          {node.driftStatus === 'unmanaged' && (
            <div style={{ padding: '8px 10px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', fontSize: 11, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 3 }}>! UNMANAGED</div>
              <div style={{ color: '#d97706', lineHeight: 1.5 }}>Not tracked in Terraform. Consider adding to your tfstate.</div>
            </div>
          )}

          {node.driftStatus === 'missing' && (
            <div style={{ padding: '8px 10px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', fontSize: 11, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>✕ MISSING — read-only</div>
              <div style={{ color: '#dc2626', lineHeight: 1.5 }}>Declared in Terraform but not found in live AWS.</div>
            </div>
          )}

          {node.driftStatus === 'matched' && (
            <div style={{ padding: '8px 10px', borderRadius: 4, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', fontSize: 11, marginBottom: 8 }}>
              <DriftDiffTable metadata={node.metadata} tfMetadata={node.tfMetadata ?? {}} />
            </div>
          )}

          {/* REMEDIATE section — flag-gated, unmanaged + matched only */}
          {flag('EXECUTION_ENGINE') && (node.driftStatus === 'unmanaged' || node.driftStatus === 'matched') && (() => {
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
              <div style={{
                padding: '8px 10px',
                borderRadius: 4,
                background: 'rgba(167,139,250,0.07)',
                border: '1px solid rgba(167,139,250,0.3)',
                fontSize: 10,
                marginBottom: 8,
              }}>
                <div style={{ fontWeight: 700, color: '#a78bfa', marginBottom: 6, fontSize: 9 }}>REMEDIATE</div>

                {safeNode.driftStatus === 'unmanaged' && (
                  <div style={{ color: '#f59e0b', marginBottom: 6, fontSize: 9 }}>⚠ Unmanaged — not in baseline.</div>
                )}
                {safeNode.driftStatus === 'matched' && hasCommands && (
                  <div style={{ color: '#86efac', marginBottom: 6, fontSize: 9 }}>↺ Apply baseline values.</div>
                )}

                {hasCommands ? (
                  <>
                    <div style={{ marginBottom: 6 }}>
                      {commands.map((argv, i) => {
                        const full = 'aws ' + argv.join(' ')
                        const display = full.length > 200 ? full.slice(0, 200) + '…' : full
                        return (
                          <div key={i} title={full} style={{
                            fontFamily: 'monospace', fontSize: 8,
                            color: 'var(--cb-text-secondary)',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: 2, padding: '2px 5px', marginBottom: 2,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {display}
                          </div>
                        )
                      })}
                    </div>

                    <div style={{ color: '#f59e0b', fontSize: 8, marginBottom: 6 }}>
                      ⚠ This will modify live AWS infrastructure.
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => void handleRemediate()}
                        disabled={remediateState === 'running' || !onRemediate}
                        style={{
                          background: remediateState === 'running' ? 'rgba(107,114,128,0.3)' : 'rgba(167,139,250,0.15)',
                          border: '1px solid rgba(167,139,250,0.5)',
                          borderRadius: 3, padding: '3px 10px',
                          color: remediateState === 'running' ? '#6b7280' : '#a78bfa',
                          fontFamily: 'monospace', fontSize: 9, cursor: remediateState === 'running' || !onRemediate ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {remediateState === 'running' ? 'Executing…' : 'Execute'}
                      </button>
                      {remediateState === 'done-ok' && (
                        <span style={{ color: '#4ade80', fontSize: 9 }}>✓ Done</span>
                      )}
                      {(remediateState as string).startsWith('done-err') && (
                        <span style={{ color: '#f87171', fontSize: 9 }}>
                          ✗ Failed (exit {remediateState.split(':')[1]})
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--cb-text-muted)', fontSize: 9, fontStyle: 'italic' }}>
                    Manual remediation required — diff contains unsupported field types.
                  </div>
                )}
              </div>
            )
          })()}

          {/* ADVISORIES section — flag-gated OP_INTELLIGENCE */}
          {flag('OP_INTELLIGENCE') && (() => {
            const rawAdvisories = analyzeNode(node as CloudNode)
            const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
            const advisories: Advisory[] = [...rawAdvisories].sort(
              (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
            )
            const severityColor = (s: string): string =>
              s === 'critical' ? '#ef4444' : s === 'warning' ? '#f59e0b' : '#60a5fa'

            return (
              <div style={{
                padding: '8px 10px',
                borderRadius: 4,
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
                fontSize: 10,
                marginBottom: 8,
              }}>
                <div
                  onClick={() => setAdvisoriesExpanded((e) => !e)}
                  style={{ fontWeight: 700, color: '#ef4444', marginBottom: advisoriesExpanded ? 6 : 0, fontSize: 9, cursor: 'pointer', userSelect: 'none' }}
                >
                  ADVISORIES {advisoriesExpanded ? '▾' : '▸'}
                </div>

                {advisoriesExpanded && (
                  advisories.length === 0 ? (
                    <div style={{ color: 'var(--cb-text-muted)', fontSize: 9, fontStyle: 'italic' }}>
                      No issues detected
                    </div>
                  ) : (
                    <div>
                      {advisories.map((a) => {
                        const fixCmds = buildAdvisoryRemediation(a, node.id)
                        return (
                          <div key={a.ruleId} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                                  <span style={{
                                    fontSize: 8, fontWeight: 700, color: severityColor(a.severity),
                                    textTransform: 'uppercase', letterSpacing: '0.05em',
                                  }}>
                                    {a.severity}
                                  </span>
                                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--cb-text-primary)' }}>
                                    {a.title}
                                  </span>
                                </div>
                                <div style={{ fontSize: 8, color: 'var(--cb-text-secondary)', lineHeight: 1.5 }}>
                                  {a.detail}
                                </div>
                              </div>
                              {fixCmds && onRemediate && (
                                <button
                                  onClick={() => void onRemediate(node as CloudNode, fixCmds)}
                                  style={{
                                    background:   'rgba(239,68,68,0.1)',
                                    border:       '1px solid rgba(239,68,68,0.4)',
                                    borderRadius: 3,
                                    color:        '#ef4444',
                                    cursor:       'pointer',
                                    fontFamily:   'monospace',
                                    fontSize:     8,
                                    padding:      '2px 6px',
                                    flexShrink:   0,
                                    whiteSpace:   'nowrap',
                                  }}
                                  title={`Fix: aws ${fixCmds[0].join(' ')}`}
                                >
                                  Fix
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                )}
              </div>
            )
          })()}

          {/* node type header */}
          <div className="text-[9px] font-bold mb-2 pb-1" style={{ color: 'var(--cb-accent)', borderBottom: '1px solid var(--cb-border-strong)' }}>
            {node.type.toUpperCase()}  ·  Selected
          </div>

          {/* fallback imported banner (only when no driftStatus) */}
          {!node.driftStatus && isImported && (
            <div style={{ padding: '6px 10px', borderRadius: 4, background: 'var(--cb-bg-secondary)', border: '1px solid var(--cb-border)', fontSize: 11, color: 'var(--cb-text-muted)', marginBottom: 8 }}>
              Imported from Terraform — read-only
            </div>
          )}

          {isImported && node.type === 'unknown' && (
            <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 8 }}>
              Unsupported Terraform resource type: {String(node.metadata?.unsupportedTfType ?? 'unknown')}
            </div>
          )}

          <button
            onClick={() => toggleLockNode(node.id)}
            style={{
              width: '100%',
              marginBottom: 8,
              background: 'var(--cb-bg-elevated)',
              border: `1px solid ${lockedNodes.has(node.id) ? '#febc2e' : 'var(--cb-border)'}`,
              borderRadius: 2,
              padding: '3px 0',
              color: lockedNodes.has(node.id) ? '#febc2e' : 'var(--cb-text-muted)',
              fontFamily: 'monospace',
              fontSize: 9,
              cursor: 'pointer',
            }}
          >
            {lockedNodes.has(node.id) ? '⊠ Locked' : '◈ Lock'}
          </button>

          {/* AWS Console deep link */}
          {(() => {
            const consoleUrl = buildConsoleUrl(node)
            if (!consoleUrl) return null
            return (
              <button
                onClick={() => window.open(consoleUrl, '_blank')}
                style={{
                  width: '100%',
                  background: 'var(--cb-bg-elevated)',
                  border: '1px solid var(--cb-border)',
                  borderRadius: 3,
                  color: 'var(--cb-text-muted)',
                  fontFamily: 'monospace',
                  fontSize: 9,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  textAlign: 'left',
                  marginBottom: 8,
                  letterSpacing: '0.03em',
                }}
              >
                ⎋ Open in AWS Console ↗
              </button>
            )
          })()}

          {[
            { key: 'ID',     val: node.id },
            { key: 'NAME',   val: node.label },
            { key: 'REGION', val: node.region },
          ].map(({ key, val }) => (
            <div key={key} className="mb-3">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[8px]" style={{ color: 'var(--cb-text-muted)' }}>{key}</span>
                {key === 'ID' && (
                  <button
                    onClick={() => void navigator.clipboard.writeText(val)}
                    title="Copy to clipboard"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--cb-text-muted)', fontSize: 8, padding: '0 1px', lineHeight: 1,
                    }}
                  >
                    ⧉
                  </button>
                )}
              </div>
              <div className="text-[9px] break-all" style={{ color: 'var(--cb-text-primary)' }}>{val}</div>
            </div>
          ))}

          <div className="mb-3">
            <div className="text-[8px] mb-0.5" style={{ color: 'var(--cb-text-muted)' }}>STATE</div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[node.status] ?? '#666' }} />
              <span className="text-[9px]" style={{ color: STATUS_COLORS[node.status] ?? '#666' }}>{node.status}</span>
            </div>
          </div>

          <div className="mb-3">
            <div className="text-[8px] mb-0.5" style={{ color: 'var(--cb-text-muted)' }}>EST. COST</div>
            <div style={{ fontSize: 9, color: 'var(--cb-text-muted)', marginTop: 2 }}>
              {formatPrice(getMonthlyEstimate(node.type, node.region ?? 'us-east-1'))}
            </div>
          </div>

          {/* ACM-specific metadata */}
          {node.type === 'acm' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                METADATA
              </div>
              {[
                { k: 'domainName',        v: node.metadata.domainName as string },
                { k: 'validationMethod',  v: node.metadata.validationMethod as string },
                { k: 'inUseBy',           v: `${(node.metadata.inUseBy as string[]).length} resource(s)` },
              ].map(({ k, v }) => (
                <div key={k} className="mb-1.5">
                  <div className="text-[7px]" title={k} style={{ color: 'var(--cb-text-muted)' }}>{fieldLabel(k)}</div>
                  <div className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)' }}>{v ?? '—'}</div>
                </div>
              ))}

              {/* CNAME records for pending DNS validation */}
              {node.status === 'pending' && (node.metadata.cnameRecords as Array<{ name: string; value: string }>).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div className="text-[8px] mb-1" style={{ color: 'var(--cb-text-muted)', textTransform: 'uppercase' }}>DNS Validation CNAMEs</div>
                  {(node.metadata.cnameRecords as Array<{ name: string; value: string }>).map((rec, i) => (
                    <div key={i} style={{ marginBottom: 6, fontSize: 8 }}>
                      <div style={{ color: 'var(--cb-text-muted)', marginBottom: 1 }}>Name</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: 'var(--cb-text-secondary)', wordBreak: 'break-all', flex: 1 }}>{rec.name}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(rec.name)}
                          style={{ ...btnBase, flex: 'none', padding: '1px 4px', border: '1px solid var(--cb-border)', color: 'var(--cb-text-muted)', fontSize: 8 }}
                        >⎘</button>
                      </div>
                      <div style={{ color: 'var(--cb-text-muted)', marginBottom: 1, marginTop: 3 }}>Value</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: 'var(--cb-text-secondary)', wordBreak: 'break-all', flex: 1 }}>{rec.value}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(rec.value)}
                          style={{ ...btnBase, flex: 'none', padding: '1px 4px', border: '1px solid var(--cb-border)', color: 'var(--cb-text-muted)', fontSize: 8 }}
                        >⎘</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {acmDeleteError && (
                <div style={{ marginTop: 6, fontSize: 8, color: '#ff5f57' }}>{acmDeleteError}</div>
              )}

              {!isImported && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      const inUseBy = node.metadata.inUseBy as string[]
                      if (inUseBy.length > 0) {
                        setAcmDeleteError(`Cannot delete: in use by ${inUseBy.length} resource(s)`)
                        return
                      }
                      setAcmDeleteError(null)
                      onDelete(node)
                    }}
                    style={{ ...btnBase, border: '1px solid #ff5f57', color: '#ff5f57' }}
                  >
                    ✕ Delete
                  </button>
                </div>
              )}
            </div>
          )}

          {/* CloudFront-specific metadata */}
          {node.type === 'cloudfront' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                METADATA
              </div>
              {[
                { k: 'domainName',        v: node.metadata.domainName as string },
                { k: 'origins',           v: `${(node.metadata.origins as unknown[]).length} origin(s)` },
                { k: 'priceClass',        v: node.metadata.priceClass as string },
                { k: 'certArn',           v: (node.metadata.certArn as string | undefined) ?? 'default' },
                { k: 'defaultRootObject', v: (node.metadata.defaultRootObject as string) || '—' },
              ].map(({ k, v }) => (
                <div key={k} className="mb-1.5">
                  <div className="text-[7px]" title={k} style={{ color: 'var(--cb-text-muted)' }}>{fieldLabel(k)}</div>
                  <div className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)' }}>{v}</div>
                </div>
              ))}

              {!isImported && (
                <>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    <button
                      onClick={() => onEdit(node)}
                      style={{ ...btnBase, border: '1px solid #64b5f6', color: '#64b5f6' }}
                    >
                      ✎ Edit
                    </button>
                    <button
                      onClick={() => onDelete(node)}
                      style={{ ...btnBase, border: '1px solid #ff5f57', color: '#ff5f57' }}
                    >
                      ✕ Delete
                    </button>
                  </div>

                  {/* Invalidate cache quick action */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 8, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Invalidate Cache</div>
                    <input
                      value={invalidatePath}
                      onChange={(e) => setInvalidatePath(e.target.value)}
                      style={{
                        width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)',
                        borderRadius: 2, padding: '2px 5px', color: 'var(--cb-text-primary)',
                        fontFamily: 'monospace', fontSize: 9, boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={() => onQuickAction(node, 'invalidate', { path: invalidatePath })}
                      style={{ ...btnBase, border: '1px solid #a78bfa', color: '#a78bfa', width: '100%', marginTop: 4 }}
                    >
                      Invalidate
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* API Gateway specific metadata */}
          {node.type === 'apigw' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                METADATA
              </div>
              <div className="mb-1.5">
                <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>ENDPOINT</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)', flex: 1 }}>{node.metadata.endpoint as string || '—'}</span>
                  {!!node.metadata.endpoint && (
                    <button
                      onClick={() => navigator.clipboard.writeText(node.metadata.endpoint as string)}
                      style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', borderRadius: 2, padding: '1px 4px', color: 'var(--cb-text-muted)', fontFamily: 'monospace', fontSize: 8, cursor: 'pointer', flexShrink: 0 }}
                    >⎘</button>
                  )}
                </div>
              </div>
              <div className="mb-1.5">
                <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>PROTOCOL</div>
                <div className="text-[8px]" style={{ color: 'var(--cb-text-secondary)' }}>HTTP</div>
              </div>
              <div className="mb-1.5">
                <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>CORS ORIGINS</div>
                <div className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)' }}>
                  {((node.metadata.corsOrigins as string[]) ?? []).join(', ') || '(none)'}
                </div>
              </div>
              <div className="mb-1.5">
                <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>ROUTES</div>
                <div className="text-[8px]" style={{ color: 'var(--cb-text-secondary)' }}>
                  {nodes.filter((n) => n.type === 'apigw-route' && n.parentId === node.id).length}
                </div>
              </div>
              {!isImported && (
                <>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    <button
                      onClick={() => onEdit(node)}
                      style={{ flex: 1, background: 'var(--cb-bg-elevated)', border: '1px solid #64b5f6', borderRadius: 2, padding: '3px 0', color: '#64b5f6', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}
                    >✎ Edit</button>
                    <button
                      onClick={() => onDelete(node)}
                      style={{ flex: 1, background: 'var(--cb-bg-elevated)', border: '1px solid #ff5f57', borderRadius: 2, padding: '3px 0', color: '#ff5f57', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}
                    >✕ Delete</button>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 8, color: 'var(--cb-text-muted)' }}>Deletes all routes in this API.</div>
                  <button
                    onClick={() => {
                      setActiveCreate({ resource: 'apigw-route', view: 'topology' })
                      if (onAddRoute) onAddRoute(node.id)
                    }}
                    style={{ width: '100%', marginTop: 8, background: 'var(--cb-bg-elevated)', border: '1px solid #8b5cf6', borderRadius: 2, padding: '3px 0', color: '#8b5cf6', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}
                  >+ Add Route</button>
                </>
              )}
            </div>
          )}

          {/* API Gateway Route specific metadata */}
          {node.type === 'apigw-route' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                METADATA
              </div>
              {[
                { k: 'METHOD', v: node.metadata.method as string },
                { k: 'PATH',   v: node.metadata.path   as string },
                { k: 'API',    v: (() => { const api = nodes.find((n) => n.id === node.metadata.apiId); return api ? api.label : node.metadata.apiId as string })() },
                { k: 'TARGET', v: (node.metadata.lambdaArn as string | undefined) ?? '(no integration)' },
              ].map(({ k, v }) => (
                <div key={k} className="mb-1.5">
                  <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>{k}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)', flex: 1 }}>{v || '—'}</span>
                    {k === 'TARGET' && !!node.metadata.lambdaArn && (
                      <button
                        onClick={() => navigator.clipboard.writeText(node.metadata.lambdaArn as string)}
                        style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', borderRadius: 2, padding: '1px 4px', color: 'var(--cb-text-muted)', fontFamily: 'monospace', fontSize: 8, cursor: 'pointer', flexShrink: 0 }}
                      >⎘</button>
                    )}
                  </div>
                </div>
              ))}
              {!isImported && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button
                    onClick={() => onDelete(node)}
                    style={{ flex: 1, background: 'var(--cb-bg-elevated)', border: '1px solid #ff5f57', borderRadius: 2, padding: '3px 0', color: '#ff5f57', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}
                  >✕ Delete</button>
                </div>
              )}
            </div>
          )}

          {/* Lambda-specific metadata */}
          {node.type === 'lambda' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                METADATA
              </div>
              {[
                { k: 'RUNTIME',  v: node.metadata.runtime    as string | undefined },
                { k: 'HANDLER',  v: node.metadata.handler    as string | undefined },
                { k: 'TIMEOUT',  v: node.metadata.timeout    != null ? `${String(node.metadata.timeout)}s` : undefined },
                { k: 'MEMORY',   v: node.metadata.memorySize != null ? `${String(node.metadata.memorySize)} MB` : undefined },
              ].filter(({ v }) => v).map(({ k, v }) => (
                <div key={k} className="mb-1.5">
                  <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>{k}</div>
                  <div className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)' }}>{v}</div>
                </div>
              ))}
              {!isImported && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button onClick={() => onEdit(node)} style={{ ...btnBase, border: '1px solid #64b5f6', color: '#64b5f6' }}>✎ Edit</button>
                  <button onClick={() => onDelete(node)} style={{ ...btnBase, border: '1px solid #ff5f57', color: '#ff5f57' }}>✕ Delete</button>
                </div>
              )}
            </div>
          )}

          {/* ECS-specific metadata */}
          {node.type === 'ecs' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                METADATA
              </div>
              {[
                { k: 'CLUSTER',      v: node.metadata.clusterName as string | undefined },
                { k: 'LAUNCH TYPE',  v: node.metadata.launchType  as string | undefined },
                { k: 'DESIRED',      v: String(node.metadata.desiredCount ?? '—') },
                { k: 'RUNNING',      v: String(node.metadata.runningCount  ?? '—') },
              ].map(({ k, v }) => (
                <div key={k} className="mb-1.5">
                  <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>{k}</div>
                  <div className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)' }}>{v || '—'}</div>
                </div>
              ))}
            </div>
          )}

          {/* RDS-specific metadata */}
          {node.type === 'rds' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                METADATA
              </div>
              {[
                { k: 'ENGINE',    v: node.metadata.engine        as string | undefined },
                { k: 'INSTANCE',  v: node.metadata.instanceClass as string | undefined },
              ].filter(({ v }) => v).map(({ k, v }) => (
                <div key={k} className="mb-1.5">
                  <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>{k}</div>
                  <div className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)' }}>{v}</div>
                </div>
              ))}
              {typeof node.metadata.endpoint === 'string' && node.metadata.endpoint && (
                <div className="mb-1.5">
                  <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>ENDPOINT</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)', flex: 1 }}>{node.metadata.endpoint}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(node.metadata.endpoint as string)}
                      style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', borderRadius: 2, padding: '1px 4px', color: 'var(--cb-text-muted)', fontFamily: 'monospace', fontSize: 8, cursor: 'pointer', flexShrink: 0 }}
                    >⎘</button>
                  </div>
                </div>
              )}
              {!isImported && (
                <>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    <button onClick={() => onEdit(node)} style={{ ...btnBase, border: '1px solid #64b5f6', color: '#64b5f6' }}>✎ Edit</button>
                    <button onClick={() => onDelete(node)} style={{ ...btnBase, border: '1px solid #ff5f57', color: '#ff5f57' }}>✕ Delete</button>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 8, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Quick actions</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {node.status !== 'stopped' && (
                        <button onClick={() => onQuickAction(node, 'stop')}
                          style={{ background: 'var(--cb-bg-elevated)', border: '1px solid #febc2e', borderRadius: 2, padding: '2px 8px', color: '#febc2e', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}>
                          Stop
                        </button>
                      )}
                      {node.status === 'stopped' && (
                        <button onClick={() => onQuickAction(node, 'start')}
                          style={{ background: 'var(--cb-bg-elevated)', border: '1px solid #28c840', borderRadius: 2, padding: '2px 8px', color: '#28c840', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}>
                          Start
                        </button>
                      )}
                      <button onClick={() => onQuickAction(node, 'reboot')}
                        style={{ background: 'var(--cb-bg-elevated)', border: '1px solid #64b5f6', borderRadius: 2, padding: '2px 8px', color: '#64b5f6', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}>
                        Reboot
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SQS-specific metadata */}
          {node.type === 'sqs' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                QUEUE STATS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                {[
                  { k: 'MESSAGES',  v: node.metadata.messages  != null ? String(node.metadata.messages)  : '—' },
                  { k: 'IN FLIGHT', v: node.metadata.inFlight   != null ? String(node.metadata.inFlight)  : '—' },
                ].map(({ k, v }) => (
                  <div key={k} style={{ background: 'var(--cb-bg-elevated)', borderRadius: 3, padding: '4px 6px', border: '1px solid var(--cb-border)' }}>
                    <div style={{ fontSize: 7, color: 'var(--cb-text-muted)', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cb-text-primary)', fontFamily: 'monospace' }}>{v}</div>
                  </div>
                ))}
              </div>
              {node.label.endsWith('.fifo') && (
                <div style={{ fontSize: 8, color: '#a78bfa', marginBottom: 6 }}>FIFO queue</div>
              )}
              {!isImported && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => onEdit(node)} style={{ ...btnBase, border: '1px solid #64b5f6', color: '#64b5f6' }}>✎ Edit</button>
                  <button onClick={() => onDelete(node)} style={{ ...btnBase, border: '1px solid #ff5f57', color: '#ff5f57' }}>✕ Delete</button>
                </div>
              )}
            </div>
          )}

          {/* DynamoDB-specific metadata */}
          {node.type === 'dynamo' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                TABLE STATS
              </div>
              {[
                { k: 'BILLING',    v: node.metadata.billingMode as string | undefined },
                { k: 'ITEMS',      v: node.metadata.itemCount != null ? Number(node.metadata.itemCount).toLocaleString() : undefined },
                { k: 'SIZE',       v: node.metadata.sizeBytes  != null ? `${(Number(node.metadata.sizeBytes) / 1024 / 1024).toFixed(1)} MB` : undefined },
              ].filter(({ v }) => v).map(({ k, v }) => (
                <div key={k} className="mb-1.5">
                  <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>{k}</div>
                  <div className="text-[8px]" style={{ color: 'var(--cb-text-secondary)' }}>{v}</div>
                </div>
              ))}
              {!isImported && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button onClick={() => onEdit(node)} style={{ ...btnBase, border: '1px solid #64b5f6', color: '#64b5f6' }}>✎ Edit</button>
                  <button onClick={() => onDelete(node)} style={{ ...btnBase, border: '1px solid #ff5f57', color: '#ff5f57' }}>✕ Delete</button>
                </div>
              )}
            </div>
          )}

          {/* EC2-specific metadata */}
          {node.type === 'ec2' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                INSTANCE
              </div>
              {[
                { k: 'TYPE',       v: node.metadata.instanceType as string | undefined },
                { k: 'AMI',        v: node.metadata.ami          as string | undefined },
                { k: 'PRIVATE IP', v: node.metadata.privateIp    as string | undefined },
                { k: 'PUBLIC IP',  v: node.metadata.publicIp     as string | undefined },
              ].filter(({ v }) => v).map(({ k, v }) => (
                <div key={k} className="mb-1.5">
                  <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>{k}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="text-[8px]" style={{ color: 'var(--cb-text-secondary)', flex: 1 }}>{v}</span>
                    {(k === 'PRIVATE IP' || k === 'PUBLIC IP') && (
                      <button onClick={() => navigator.clipboard.writeText(v!)}
                        title="Copy" style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', borderRadius: 2, padding: '1px 4px', color: 'var(--cb-text-muted)', fontFamily: 'monospace', fontSize: 8, cursor: 'pointer', flexShrink: 0 }}>⎘</button>
                    )}
                  </div>
                </div>
              ))}
              {Array.isArray(node.metadata.securityGroupIds) && (node.metadata.securityGroupIds as string[]).length > 0 && (
                <div className="mb-1.5">
                  <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)', marginBottom: 3 }}>SECURITY GROUPS</div>
                  {(node.metadata.securityGroupIds as string[]).map((sgId) => {
                    const sgNode = [...nodes, ...importedNodes].find(n => n.id === sgId)
                    return (
                      <div key={sgId}
                        style={{ fontSize: 8, color: '#c084fc', cursor: 'pointer', marginBottom: 2 }}
                        onClick={() => {
                          useUIStore.getState().selectNode(sgId)
                          window.dispatchEvent(new CustomEvent('terminus:fitnode', { detail: { nodeId: sgId } }))
                        }}
                        title={`Go to ${sgNode?.label ?? sgId}`}
                      >
                        ↗ {sgNode?.label ?? sgId}
                      </div>
                    )
                  })}
                </div>
              )}
              {!isImported && (
                <>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    <button onClick={() => onEdit(node)} style={{ ...btnBase, border: '1px solid #64b5f6', color: '#64b5f6' }}>✎ Edit</button>
                    <button onClick={() => onDelete(node)} style={{ ...btnBase, border: '1px solid #ff5f57', color: '#ff5f57' }}>✕ Delete</button>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 8, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Quick actions</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {node.status !== 'stopped' && (
                        <button onClick={() => onQuickAction(node, 'stop')}
                          style={{ background: 'var(--cb-bg-elevated)', border: '1px solid #febc2e', borderRadius: 2, padding: '2px 8px', color: '#febc2e', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}>
                          Stop
                        </button>
                      )}
                      {node.status === 'stopped' && (
                        <button onClick={() => onQuickAction(node, 'start')}
                          style={{ background: 'var(--cb-bg-elevated)', border: '1px solid #28c840', borderRadius: 2, padding: '2px 8px', color: '#28c840', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}>
                          Start
                        </button>
                      )}
                      <button onClick={() => onQuickAction(node, 'reboot')}
                        style={{ background: 'var(--cb-bg-elevated)', border: '1px solid #64b5f6', borderRadius: 2, padding: '2px 8px', color: '#64b5f6', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}>
                        Reboot
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SNS-specific metadata */}
          {node.type === 'sns' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                TOPIC
              </div>
              <div className="mb-1.5">
                <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>SUBSCRIBERS</div>
                <div className="text-[8px]" style={{ color: 'var(--cb-text-secondary)' }}>
                  {node.metadata.subscriptionCount != null ? String(node.metadata.subscriptionCount) : '—'}
                </div>
              </div>
              {!isImported && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button onClick={() => onEdit(node)} style={{ ...btnBase, border: '1px solid #64b5f6', color: '#64b5f6' }}>✎ Edit</button>
                  <button onClick={() => onDelete(node)} style={{ ...btnBase, border: '1px solid #ff5f57', color: '#ff5f57' }}>✕ Delete</button>
                </div>
              )}
            </div>
          )}

          {/* ECR-specific metadata */}
          {node.type === 'ecr-repo' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                REPOSITORY
              </div>
              {typeof node.metadata.uri === 'string' && node.metadata.uri && (
                <div className="mb-1.5">
                  <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>URI</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)', flex: 1 }}>{node.metadata.uri as string}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(node.metadata.uri as string)}
                      title="Copy URI"
                      style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', borderRadius: 2, padding: '1px 4px', color: 'var(--cb-text-muted)', fontFamily: 'monospace', fontSize: 8, cursor: 'pointer', flexShrink: 0 }}
                    >⎘</button>
                  </div>
                </div>
              )}
              {!isImported && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button onClick={() => onEdit(node)} style={{ ...btnBase, border: '1px solid #64b5f6', color: '#64b5f6' }}>✎ Edit</button>
                  <button onClick={() => onDelete(node)} style={{ ...btnBase, border: '1px solid #ff5f57', color: '#ff5f57' }}>✕ Delete</button>
                </div>
              )}
            </div>
          )}

          {/* ElastiCache-specific metadata */}
          {node.type === 'elasticache' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                CACHE
              </div>
              {[
                { k: 'ENGINE',    v: node.metadata.engine    as string | undefined },
                { k: 'NODE TYPE', v: node.metadata.nodeType  as string | undefined },
                { k: 'CLUSTERS',  v: node.metadata.numCaches != null ? String(node.metadata.numCaches) : undefined },
              ].filter(({ v }) => v).map(({ k, v }) => (
                <div key={k} className="mb-1.5">
                  <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>{k}</div>
                  <div className="text-[8px]" style={{ color: 'var(--cb-text-secondary)' }}>{v}</div>
                </div>
              ))}
              {typeof node.metadata.endpoint === 'string' && node.metadata.endpoint && (
                <div className="mb-1.5">
                  <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>ENDPOINT</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)', flex: 1 }}>{node.metadata.endpoint as string}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(node.metadata.endpoint as string)}
                      title="Copy endpoint"
                      style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', borderRadius: 2, padding: '1px 4px', color: 'var(--cb-text-muted)', fontFamily: 'monospace', fontSize: 8, cursor: 'pointer', flexShrink: 0 }}
                    >⎘</button>
                  </div>
                </div>
              )}
              {!isImported && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button onClick={() => onEdit(node)} style={{ ...btnBase, border: '1px solid #64b5f6', color: '#64b5f6' }}>✎ Edit</button>
                  <button onClick={() => onDelete(node)} style={{ ...btnBase, border: '1px solid #ff5f57', color: '#ff5f57' }}>✕ Delete</button>
                </div>
              )}
            </div>
          )}

          {/* EKS-specific metadata */}
          {node.type === 'eks' && (
            <div>
              <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                CLUSTER
              </div>
              {[
                { k: 'VERSION',  v: node.metadata.version as string | undefined },
                { k: 'ENDPOINT', v: node.metadata.endpoint as string | undefined },
              ].filter(({ v }) => v).map(({ k, v }) => (
                <div key={k} className="mb-1.5">
                  <div className="text-[7px]" style={{ color: 'var(--cb-text-muted)' }}>{k}</div>
                  <div className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)' }}>{v}</div>
                </div>
              ))}
            </div>
          )}

          {/* Default metadata + buttons for all other node types */}
          {node.type !== 'acm' && node.type !== 'cloudfront' && node.type !== 'apigw' && node.type !== 'apigw-route'
            && node.type !== 'lambda' && node.type !== 'ecs' && node.type !== 'rds'
            && node.type !== 'sqs' && node.type !== 'dynamo' && node.type !== 'sns'
            && node.type !== 'ecr-repo' && node.type !== 'elasticache' && node.type !== 'eks'
            && node.type !== 'ec2' && (
            <>
              {Object.entries(node.metadata).length > 0 && (
                <div>
                  <div className="text-[8px] mb-2 mt-3" style={{ color: 'var(--cb-text-muted)', borderTop: '1px solid var(--cb-border-strong)', paddingTop: '6px' }}>
                    METADATA
                  </div>
                  {Object.entries(node.metadata).slice(0, 6).map(([k, v]) => (
                    <div key={k} className="mb-1.5">
                      <div className="text-[7px]" title={k} style={{ color: 'var(--cb-text-muted)' }}>{fieldLabel(k)}</div>
                      <div className="text-[8px] break-all" style={{ color: 'var(--cb-text-secondary)' }}>{String(v ?? '—')}</div>
                    </div>
                  ))}
                </div>
              )}

              {!isImported && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button onClick={() => onEdit(node)} style={{ ...btnBase, border: '1px solid #64b5f6', color: '#64b5f6' }}>✎ Edit</button>
                  <button onClick={() => onDelete(node)} style={{ ...btnBase, border: '1px solid #ff5f57', color: '#ff5f57' }}>✕ Delete</button>
                </div>
              )}
            </>
          )}

          {/* Connections panel — outgoing + incoming integration edges */}
          {(() => {
            const allNodes = [...nodes, ...importedNodes]
            const outgoing = (node.integrations ?? []).map((integ) => {
              const resolvedId = resolveIntegrationTargetId(allNodes, integ.targetId)
              const target = allNodes.find((n) => n.id === resolvedId)
              return { integ, target }
            })
            const incoming = allNodes.filter((n) =>
              n.id !== node.id &&
              (n.integrations ?? []).some((e) => resolveIntegrationTargetId(allNodes, e.targetId) === node.id)
            )
            if (outgoing.length === 0 && incoming.length === 0) return null
            const edgeColor = (t: string): string => t === 'trigger' ? '#a78bfa' : t === 'subscription' ? '#34d399' : '#60a5fa'
            const ConnRow = ({ src, label, label2, edgeType, onClick }: { src?: CloudNode; label: string; label2?: string; edgeType: string; onClick: () => void }): React.JSX.Element => (
              <div
                style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 4, cursor: 'pointer' }}
                onClick={onClick}
                title={`Select ${label}`}
              >
                <span style={{ fontSize: 6, color: edgeColor(edgeType), fontWeight: 700, minWidth: 40, textTransform: 'uppercase', flexShrink: 0 }}>
                  {edgeType}
                </span>
                <span style={{ fontSize: 9, color: src ? 'var(--cb-text-primary)' : 'var(--cb-text-muted)', wordBreak: 'break-all', flex: 1 }}>
                  {label}
                </span>
                {label2 && (
                  <span style={{ fontSize: 7, color: 'var(--cb-text-muted)', flexShrink: 0 }}>{label2}</span>
                )}
              </div>
            )
            return (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--cb-border-strong)', paddingTop: 8 }}>
                {outgoing.length > 0 && (
                  <>
                    <div style={{ fontSize: 8, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Outgoing ({outgoing.length})
                    </div>
                    {outgoing.map(({ integ, target }, i) => (
                      <ConnRow
                        key={i}
                        src={target}
                        label={target ? target.label : (integ.targetId.split('/').pop() ?? integ.targetId)}
                        label2={target?.type}
                        edgeType={integ.edgeType}
                        onClick={() => {
                        if (!target) return
                        useUIStore.getState().selectNode(target.id)
                        window.dispatchEvent(new CustomEvent('terminus:fitnode', { detail: { nodeId: target.id } }))
                      }}
                      />
                    ))}
                  </>
                )}
                {incoming.length > 0 && (
                  <>
                    <div style={{ fontSize: 8, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 6, marginTop: outgoing.length > 0 ? 8 : 0 }}>
                      Incoming ({incoming.length})
                    </div>
                    {incoming.map((src, i) => {
                      const e = (src.integrations ?? []).find((edge) => resolveIntegrationTargetId(allNodes, edge.targetId) === node.id)!
                      return (
                        <ConnRow
                          key={i}
                          src={src}
                          label={src.label}
                          label2={src.type}
                          edgeType={e.edgeType}
                          onClick={() => {
                            useUIStore.getState().selectNode(src.id)
                            window.dispatchEvent(new CustomEvent('terminus:fitnode', { detail: { nodeId: src.id } }))
                          }}
                        />
                      )
                    })}
                  </>
                )}
              </div>
            )
          })()}

          {/* IAM Permissions — EC2, Lambda, S3 only, hidden for imported nodes */}
          {node && IAM_SUPPORTED_TYPES.includes(node.type as NodeType) && !isImported && (
            <IamAdvisor node={node} />
          )}

          {/* Notes section — always shown for any selected node */}
          <div style={{ marginTop: 12, borderTop: '1px solid var(--cb-border-strong)', paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div className="text-[8px]" style={{ color: 'var(--cb-text-muted)', textTransform: 'uppercase' }}>Notes</div>
              {annotations[node.id] && (
                <button
                  onClick={() => {
                    clearAnnotation(node.id)
                    const next = { ...useUIStore.getState().annotations }
                    delete next[node.id]
                    void window.terminus.saveAnnotations(next)
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--cb-text-muted)', cursor: 'pointer', fontSize: 9, padding: 0, lineHeight: 1 }}
                  title="Clear note"
                >✕</button>
              )}
            </div>
            <textarea
              value={annotations[node.id] ?? ''}
              onChange={(e) => setAnnotation(node.id, e.target.value)}
              onBlur={(e) => {
                const next = { ...useUIStore.getState().annotations, [node.id]: e.target.value }
                if (!e.target.value) delete next[node.id]
                void window.terminus.saveAnnotations(next)
              }}
              placeholder="Add a note about this resource..."
              rows={4}
              style={{
                width: '100%',
                background: 'var(--cb-bg-elevated)',
                border: '1px solid var(--cb-border)',
                borderRadius: 2,
                padding: '4px 6px',
                color: 'var(--cb-text-primary)',
                fontFamily: 'monospace',
                fontSize: 9,
                resize: 'vertical',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
