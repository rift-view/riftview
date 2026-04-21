import { buildConsoleUrl } from '../../../utils/buildConsoleUrl'
import type { CloudNode } from '@riftview/shared'

interface ActionRailProps {
  node: CloudNode
  onToast: (msg: string, type: 'success' | 'error') => void
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
    <div className="action-rail" role="toolbar" aria-label="node actions">
      <button className="btn-glyph" title="Copy ARN" onClick={handleCopyArn}>
        ⎘
      </button>
      {consoleUrl && (
        <button className="btn-glyph" title="Open in AWS Console" onClick={handleOpenConsole}>
          ↗
        </button>
      )}
    </div>
  )
}
