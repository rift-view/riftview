import { render } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CommandDrawer } from '../CommandDrawer'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import { useCliStore } from '../../store/cli'

/**
 * Visual contract for the R5 CommandDrawer restyle.
 * - Drawer root uses `.term` primitive.
 * - Run button uses `.btn .btn-sm .btn-primary`.
 * - stderr lines carry `.c-err`.
 * - `$` prompt carries `.c-prompt`.
 */

Object.defineProperty(window, 'riftview', {
  value: {
    onCliOutput: () => () => {},
    onCliDone: () => () => {},
    runCli: vi.fn().mockResolvedValue({ code: 0 }),
    cancelCli: vi.fn(),
    startScan: vi.fn().mockResolvedValue(undefined)
  },
  writable: true,
  configurable: true
})

beforeEach(() => {
  useCloudStore.setState({ nodes: [], importedNodes: [] })
  useUIStore.setState({
    activeCreate: null,
    activeFilters: []
  })
  useCliStore.setState({
    cliOutput: [],
    commandPreview: [],
    pendingCommand: null,
    logHistory: []
  })
})

describe('CommandDrawer rift shell', () => {
  it('drawer root carries the .term primitive class', () => {
    const { container } = render(<CommandDrawer />)
    const term = container.querySelector('.term')
    expect(term).not.toBeNull()
  })

  it('status bar renders the $ prompt with .c-prompt', () => {
    const { container } = render(<CommandDrawer />)
    const prompt = container.querySelector('.c-prompt')
    expect(prompt).not.toBeNull()
    expect(prompt!.textContent).toContain('$')
  })

  it('Run button uses .btn-primary when a command is queued', () => {
    useUIStore.setState({ activeCreate: { resource: 'ec2', view: 'topology' } })
    useCliStore.setState({ commandPreview: ['aws ec2 run-instances …'] })
    const { container } = render(<CommandDrawer />)
    const run = container.querySelector('button.btn-primary') as HTMLButtonElement | null
    expect(run).not.toBeNull()
    expect(run!.textContent).toMatch(/run/i)
    expect(run).toHaveClass('btn-sm')
  })

  it('stderr lines in the expanded log carry .c-err', () => {
    useCliStore.setState({
      cliOutput: [
        { stream: 'stderr', line: 'boom' },
        { stream: 'stdout', line: 'ok' }
      ]
    })
    // Force expanded state by directly clicking the up-arrow button
    const { container, rerender } = render(<CommandDrawer />)
    // Expand by clicking arrow button (▲) — it renders when cliOutput > 0 and !expanded
    const arrow = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === '▲'
    )
    if (arrow) (arrow as HTMLButtonElement).click()
    rerender(<CommandDrawer />)
    const errLines = container.querySelectorAll('.c-err')
    expect(errLines.length).toBeGreaterThan(0)
  })
})
