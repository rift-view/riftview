import { toPng } from 'html-to-image'
import { useUIStore } from '../store/ui'
import { useCloudStore } from '../store/cloud'

/**
 * Captures the React Flow canvas as a PNG.
 * Before capture: sets isExporting flag (hides UI chrome), calls fitView, waits one frame.
 * After capture: restores isExporting flag.
 *
 * @param fitView  ReactFlow's fitView function, called before capture to frame visible nodes
 * @param format   'clipboard' copies to system clipboard; 'file' opens a save dialog via Electron IPC
 */
export async function exportCanvasToPng(
  fitView: (opts?: { duration?: number }) => void,
  format: 'clipboard' | 'file',
): Promise<void> {
  const setIsExporting = useUIStore.getState().setIsExporting
  const showToast = useUIStore.getState().showToast

  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewport) {
    showToast('Export failed: canvas not found', 'error')
    return
  }

  try {
    setIsExporting(true)
    fitView({ duration: 0 })

    // Wait two frames for fitView to apply and UI chrome to hide
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    const dataUrl = await toPng(viewport, {
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--cb-canvas-bg').trim() || '#0f1117',
      pixelRatio: 2,
      filter: (node) => {
        // Exclude React Flow controls, minimap, and any overlay panels from the capture
        if (node instanceof HTMLElement) {
          if (node.classList.contains('react-flow__controls')) return false
          if (node.classList.contains('react-flow__minimap'))  return false
          if (node.classList.contains('react-flow__panel'))    return false
        }
        return true
      },
    })

    if (format === 'clipboard') {
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      showToast('Diagram copied to clipboard', 'success')
    } else {
      // Use Electron's save dialog via IPC
      const lastScanAt = useCloudStore.getState().lastScannedAt
      const timestamp = lastScanAt ? new Date(lastScanAt).toISOString().slice(0, 16).replace('T', '-').replace(':', '') : 'export'
      const defaultName = `cloudblocks-${timestamp}.png`
      await window.cloudblocks.saveExportImage(dataUrl, defaultName)
      showToast('Diagram saved', 'success')
    }
  } catch (err) {
    showToast('Export failed', 'error')
    console.error('[exportCanvas]', err)
  } finally {
    setIsExporting(false)
  }
}
