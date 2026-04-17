import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TerminalPane } from '../../../src/renderer/components/TerminalPane'
import { useUIStore } from '../../../src/renderer/store/ui'

// ---- xterm mocks -----------------------------------------------------------
// vi.mock is hoisted — factory must not reference variables from outer scope

vi.mock('@xterm/xterm', () => ({
  Terminal: class Terminal {
    loadAddon(): void {
      /* mock */
    }
    open(): void {
      /* mock */
    }
    onData(): void {
      /* mock */
    }
    write(): void {
      /* mock */
    }
    dispose(): void {
      /* mock */
    }
  }
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class FitAddon {
    fit(): void {
      /* mock */
    }
  }
}))

// ---- Window.terminus mock --------------------------------------------------

const closeTerminalMock = vi.fn().mockResolvedValue(undefined)
const onTerminalOutputMock = vi.fn().mockReturnValue(() => {})

Object.defineProperty(window, 'terminus', {
  value: {
    closeTerminal: closeTerminalMock,
    onTerminalOutput: onTerminalOutputMock,
    sendTerminalInput: vi.fn().mockResolvedValue(undefined)
  },
  writable: true
})

// ---- Tests -----------------------------------------------------------------

describe('TerminalPane', () => {
  beforeEach(() => {
    closeTerminalMock.mockClear()
    onTerminalOutputMock.mockClear()
    useUIStore.setState({
      terminalSessionId: null,
      terminalNodeId: null
    })
  })

  it('renders nothing when terminalSessionId is null', () => {
    const { container } = render(<TerminalPane />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the terminal pane when terminalSessionId is set', () => {
    useUIStore.setState({
      terminalSessionId: 'sess-abc',
      terminalNodeId: 'i-001'
    })
    render(<TerminalPane />)
    expect(screen.getByText(/SSM › i-001/)).toBeInTheDocument()
  })

  it('calls closeTerminalPane when ✕ is clicked', () => {
    useUIStore.setState({
      terminalSessionId: 'sess-abc',
      terminalNodeId: 'i-001'
    })
    render(<TerminalPane />)
    const closeBtn = screen.getByText('✕')
    fireEvent.click(closeBtn)
    expect(useUIStore.getState().terminalSessionId).toBeNull()
    expect(useUIStore.getState().terminalNodeId).toBeNull()
  })
})
