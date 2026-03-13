import { useCloudStore } from '../store/cloud'
import type { CloudNode } from '../types/cloud'

interface InspectorProps {
  onDelete: (node: CloudNode) => void
  onEdit: (node: CloudNode) => void
}

export function Inspector({ onDelete, onEdit }: InspectorProps): JSX.Element {
  const selectedId = useCloudStore((s) => s.selectedNodeId)
  const nodes      = useCloudStore((s) => s.nodes)
  const node       = nodes.find((n) => n.id === selectedId)

  const STATUS_COLORS: Record<string, string> = {
    running: '#28c840', stopped: '#ff5f57', pending: '#febc2e', error: '#ff5f57', unknown: '#666',
  }

  return (
    <div
      className="w-44 flex-shrink-0 p-2 overflow-y-auto"
      style={{ background: '#0d1117', borderLeft: '1px solid #1e2d40', fontFamily: 'monospace' }}
    >
      {!node ? (
        <div className="text-[9px] text-center mt-8" style={{ color: '#555' }}>
          Click a resource to inspect
        </div>
      ) : (
        <>
          <div className="text-[9px] font-bold mb-2 pb-1" style={{ color: '#FF9900', borderBottom: '1px solid #1e2d40' }}>
            {node.type.toUpperCase()}  ·  Selected
          </div>

          {[
            { key: 'ID',     val: node.id },
            { key: 'NAME',   val: node.label },
            { key: 'REGION', val: node.region },
          ].map(({ key, val }) => (
            <div key={key} className="mb-2">
              <div className="text-[8px] mb-0.5" style={{ color: '#555' }}>{key}</div>
              <div className="text-[9px] break-all" style={{ color: '#eee' }}>{val}</div>
            </div>
          ))}

          <div className="mb-2">
            <div className="text-[8px] mb-0.5" style={{ color: '#555' }}>STATE</div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[node.status] ?? '#666' }} />
              <span className="text-[9px]" style={{ color: STATUS_COLORS[node.status] ?? '#666' }}>{node.status}</span>
            </div>
          </div>

          {Object.entries(node.metadata).length > 0 && (
            <div>
              <div className="text-[8px] mb-1 mt-2" style={{ color: '#555', borderTop: '1px solid #1e2d40', paddingTop: '6px' }}>
                METADATA
              </div>
              {Object.entries(node.metadata).slice(0, 6).map(([k, v]) => (
                <div key={k} className="mb-1.5">
                  <div className="text-[7px]" style={{ color: '#555' }}>{k}</div>
                  <div className="text-[8px] break-all" style={{ color: '#aaa' }}>{String(v ?? '—')}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <button
              onClick={() => onEdit(node)}
              style={{ flex: 1, background: '#1a2332', border: '1px solid #64b5f6', borderRadius: 2, padding: '3px 0', color: '#64b5f6', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}
            >
              ✎ Edit
            </button>
            <button
              onClick={() => onDelete(node)}
              style={{ flex: 1, background: '#1a2332', border: '1px solid #ff5f57', borderRadius: 2, padding: '3px 0', color: '#ff5f57', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}
            >
              ✕ Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
