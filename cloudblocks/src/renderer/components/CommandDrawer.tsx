import { useCloudStore } from '../store/cloud'
import { buildDescribeCommand } from '../utils/describeCommand'

// M1: read-only. Drawer shows the describe command for the selected resource.
// M2: will expand to full write command preview + Run/Cancel.
export function CommandDrawer(): JSX.Element {
  const selectedId = useCloudStore((s) => s.selectedNodeId)
  const nodes      = useCloudStore((s) => s.nodes)
  const node       = nodes.find((n) => n.id === selectedId)

  const command = node ? buildDescribeCommand(node.type, node.id, node.region) : null

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
      style={{ background: '#0d1117', borderTop: '1px solid #FF9900', fontFamily: 'monospace' }}
    >
      <span className="text-[9px]" style={{ color: '#FF9900' }}>$</span>
      <code className="text-[9px] flex-1 truncate" style={{ color: command ? '#eee' : '#444' }}>
        {command ?? 'Select a resource to see its CLI command'}
      </code>
      {command && (
        <button
          onClick={() => navigator.clipboard.writeText(command)}
          className="px-2 py-0.5 rounded text-[8px] font-bold"
          style={{ background: '#1a2332', border: '1px solid #FF9900', color: '#FF9900' }}
        >
          Copy
        </button>
      )}
    </div>
  )
}
