import { buildConsoleUrl } from '../../../utils/buildConsoleUrl'
import type { CloudNode } from '../../../types/cloud'

interface ActionRailProps {
  node:    CloudNode
  onToast: (msg: string, type: 'success' | 'error') => void
}

const btnStyle: React.CSSProperties = {
  background:   'var(--cb-bg-elevated)',
  border:       '1px solid var(--cb-border)',
  borderRadius: 3,
  color:        'var(--cb-text-secondary)',
  cursor:       'pointer',
  fontFamily:   'monospace',
  fontSize:     9,
  padding:      '2px 5px',
  lineHeight:   1,
}

export function ActionRail({ node, onToast }: ActionRailProps): React.JSX.Element {
  const consoleUrl = buildConsoleUrl(node)

  function handleCopyArn(e: React.MouseEvent): void {
    e.stopPropagation()
    void navigator.clipboard.writeText(node.id).then(() => {
      onToast('ARN copied', 'success')
    })
  }

  function handleOpenConsole(e: React.MouseEvent): void {
    e.stopPropagation()
    if (consoleUrl) window.open(consoleUrl, '_blank', 'noopener')
  }

  return (
    <div
      className="action-rail"
      style={{
        position:      'absolute',
        top:           -28,
        right:         0,
        display:       'flex',
        gap:           4,
        pointerEvents: 'auto',
      }}
    >
      <button style={btnStyle} title="Copy ARN" onClick={handleCopyArn}>
        ⌘
      </button>
      {consoleUrl && (
        <button style={btnStyle} title="Open in AWS Console" onClick={handleOpenConsole}>
          ↗
        </button>
      )}
    </div>
  )
}
