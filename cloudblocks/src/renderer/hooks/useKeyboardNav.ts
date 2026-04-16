import { useEffect, useRef } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'

const CONTAINER_TYPES = new Set(['vpc', 'subnet', 'security-group', 'nat-gateway', 'globalZone', 'regionZone'])

export function useKeyboardNav(): void {
  const indexRef = useRef(-1)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      // Guard: ignore if focused in an editable element
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return

      // Guard: ignore if a modal is open
      const ui = useUIStore.getState()
      if (ui.activeCreate !== null) return

      const cloudState = useCloudStore.getState()
      const sortedNodes = cloudState.nodes
        .filter((n) => !CONTAINER_TYPES.has(n.type))
        .sort((a, b) => a.label.localeCompare(b.label))

      switch (e.key) {
        case 'j': {
          if (sortedNodes.length === 0) return
          e.preventDefault()
          indexRef.current = (indexRef.current + 1) % sortedNodes.length
          const node = sortedNodes[indexRef.current]!
          useUIStore.getState().selectNode(node.id)
          window.dispatchEvent(new CustomEvent('terminus:fitnode', { detail: { nodeId: node.id } }))
          break
        }
        case 'k': {
          if (sortedNodes.length === 0) return
          e.preventDefault()
          indexRef.current = (indexRef.current - 1 + sortedNodes.length) % sortedNodes.length
          const node = sortedNodes[indexRef.current]!
          useUIStore.getState().selectNode(node.id)
          window.dispatchEvent(new CustomEvent('terminus:fitnode', { detail: { nodeId: node.id } }))
          break
        }
        case 'Enter': {
          const selectedId = useUIStore.getState().selectedNodeId
          if (!selectedId) return
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('terminus:fitnode', { detail: { nodeId: selectedId } }))
          break
        }
        case '/': {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('terminus:open-search'))
          break
        }
        case 'Escape': {
          useUIStore.getState().selectNode(null)
          useUIStore.getState().setBlastRadiusId(null)
          useUIStore.getState().setPathTraceId(null)
          indexRef.current = -1
          break
        }
        case 'r': {
          e.preventDefault()
          window.terminus.startScan().catch(() => {})
          break
        }
        case '?': {
          e.preventDefault()
          const current = useUIStore.getState().keyboardHelpOpen
          useUIStore.getState().setKeyboardHelpOpen(!current)
          break
        }
        case '1':
        case '2':
        case '3':
        case '4': {
          e.preventDefault()
          const slot = parseInt(e.key) as 1 | 2 | 3 | 4
          const currentView = useUIStore.getState().view
          // Only topology and graph views support saved view slots
          if (currentView === 'topology' || currentView === 'graph') {
            useUIStore.getState().loadView(slot - 1, currentView, () => {})
          }
          break
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
