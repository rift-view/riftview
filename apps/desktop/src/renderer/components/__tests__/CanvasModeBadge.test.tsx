import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { CanvasModeBadge } from '../CanvasModeBadge'
import { useUIStore } from '../../store/ui'

beforeEach(() => {
  useUIStore.setState({ canvasMode: 'live', activeSnapshotId: null, activeSnapshot: null })
})

describe('CanvasModeBadge (RIFT-38)', () => {
  it('shows LIVE label by default with no return button', () => {
    render(<CanvasModeBadge />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
    expect(screen.queryByTestId('canvas-mode-return-to-live')).toBeNull()
  })

  it('shows TIMELINE label + return button when in timeline mode', () => {
    useUIStore.setState({ canvasMode: 'timeline', activeSnapshotId: 'ver-1' })
    render(<CanvasModeBadge />)
    expect(screen.getByText('TIMELINE')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-mode-return-to-live')).toBeInTheDocument()
  })

  it('clicking return button switches back to live and clears snapshot state', () => {
    useUIStore.setState({
      canvasMode: 'timeline',
      activeSnapshotId: 'ver-1',
      activeSnapshot: {
        meta: {
          id: 'ver-1',
          timestamp: '2026-04-21T00:00:00Z',
          profile: 'p',
          region: 'us-east-1',
          endpoint: null,
          contentHash: 'abc'
        },
        nodes: []
      }
    })
    render(<CanvasModeBadge />)
    fireEvent.click(screen.getByTestId('canvas-mode-return-to-live'))
    const s = useUIStore.getState()
    expect(s.canvasMode).toBe('live')
    expect(s.activeSnapshotId).toBeNull()
    expect(s.activeSnapshot).toBeNull()
  })

  it('shows RESTORE label in restore mode', () => {
    useUIStore.setState({ canvasMode: 'restore', activeSnapshotId: 'ver-9' })
    render(<CanvasModeBadge />)
    expect(screen.getByText('RESTORE')).toBeInTheDocument()
  })
})
