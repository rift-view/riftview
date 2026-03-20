import { useState } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import type { CloudNode } from '../types/cloud'
import { fieldLabel } from '../utils/fieldLabels'
import { edgeTypeLabel } from '../utils/edgeTypeLabel'

interface InspectorProps {
  onDelete: (node: CloudNode) => void
  onEdit: (node: CloudNode) => void
  onQuickAction: (node: CloudNode, action: 'stop' | 'start' | 'reboot' | 'invalidate', meta?: { path?: string }) => void
  onAddRoute?: (apiId: string) => void
}

export function Inspector({ onDelete, onEdit, onQuickAction, onAddRoute }: InspectorProps): React.JSX.Element {
  const selectedId      = useUIStore((s) => s.selectedNodeId)
  const selectedEdgeInfo = useUIStore((s) => s.selectedEdgeInfo)
  const setActiveCreate = useUIStore((s) => s.setActiveCreate)
  const lockedNodes     = useUIStore((s) => s.lockedNodes)
  const toggleLockNode  = useUIStore((s) => s.toggleLockNode)
  const annotations     = useUIStore((s) => s.annotations)
  const setAnnotation   = useUIStore((s) => s.setAnnotation)
  const clearAnnotation = useUIStore((s) => s.clearAnnotation)
  const nodes           = useCloudStore((s) => s.nodes)
  const node          = nodes.find((n) => n.id === selectedId)

  const [invalidatePath, setInvalidatePath] = useState('/*')
  const [acmDeleteError, setAcmDeleteError] = useState<string | null>(null)

  const STATUS_COLORS: Record<string, string> = {
    running: '#28c840', stopped: '#ff5f57', pending: '#febc2e', error: '#ff5f57', unknown: '#666',
  }

  const btnBase: React.CSSProperties = {
    flex: 1, background: 'var(--cb-bg-elevated)', borderRadius: 2,
    padding: '3px 0', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer',
  }

  return (
    <div
      className="w-48 flex-shrink-0 p-3 overflow-y-auto"
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
            const srcNode = nodes.find((n) => n.id === selectedEdgeInfo.source)
            const tgtNode = nodes.find((n) => n.id === selectedEdgeInfo.target)
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
      ) : !node ? (
        <div className="text-[9px] text-center mt-8" style={{ color: 'var(--cb-text-muted)' }}>
          Click a resource to inspect
        </div>
      ) : (
        <>
          <div className="text-[9px] font-bold mb-2 pb-1" style={{ color: 'var(--cb-accent)', borderBottom: '1px solid var(--cb-border-strong)' }}>
            {node.type.toUpperCase()}  ·  Selected
          </div>

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

          {[
            { key: 'ID',     val: node.id },
            { key: 'NAME',   val: node.label },
            { key: 'REGION', val: node.region },
          ].map(({ key, val }) => (
            <div key={key} className="mb-3">
              <div className="text-[8px] mb-0.5" style={{ color: 'var(--cb-text-muted)' }}>{key}</div>
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
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                <button
                  onClick={() => onDelete(node)}
                  style={{ flex: 1, background: 'var(--cb-bg-elevated)', border: '1px solid #ff5f57', borderRadius: 2, padding: '3px 0', color: '#ff5f57', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}
                >✕ Delete</button>
              </div>
            </div>
          )}

          {/* Default metadata + buttons for all other node types */}
          {node.type !== 'acm' && node.type !== 'cloudfront' && node.type !== 'apigw' && node.type !== 'apigw-route' && (
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

              {(node.type === 'ec2' || node.type === 'rds') && (
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
              )}
            </>
          )}

          {/* Notes section — always shown for any selected node */}
          <div style={{ marginTop: 12, borderTop: '1px solid var(--cb-border-strong)', paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div className="text-[8px]" style={{ color: 'var(--cb-text-muted)', textTransform: 'uppercase' }}>Notes</div>
              {annotations[node.id] && (
                <button
                  onClick={() => clearAnnotation(node.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--cb-text-muted)', cursor: 'pointer', fontSize: 9, padding: 0, lineHeight: 1 }}
                  title="Clear note"
                >✕</button>
              )}
            </div>
            <textarea
              value={annotations[node.id] ?? ''}
              onChange={(e) => setAnnotation(node.id, e.target.value)}
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
