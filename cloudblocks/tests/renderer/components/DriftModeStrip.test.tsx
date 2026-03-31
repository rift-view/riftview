import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DriftModeStrip } from '../../../src/renderer/components/canvas/DriftModeStrip'
import { useCloudStore } from '../../../src/renderer/store/cloud'
import { useUIStore } from '../../../src/renderer/store/ui'
import type { CloudNode } from '../../../src/renderer/types/cloud'

const baseNode = (id: string, driftStatus: CloudNode['driftStatus']): CloudNode =>
  ({ id, type: 'ec2', label: id, region: 'us-east-1', metadata: {}, driftStatus } as CloudNode)

beforeEach(() => {
  window.cloudblocks = {
    ...window.cloudblocks,
    clearTfState: vi.fn().mockResolvedValue({ ok: true }),
  } as unknown as typeof window.cloudblocks
  useCloudStore.setState({
    nodes: [
      baseNode('n1', 'matched'),
      baseNode('n2', 'unmanaged'),
    ],
    importedNodes: [
      baseNode('i1', 'matched'),
      baseNode('i2', 'missing'),
    ],
  })
  useUIStore.setState({ driftFilterActive: false })
})

describe('DriftModeStrip', () => {
  it('returns null when no imported nodes', () => {
    useCloudStore.setState({ importedNodes: [] })
    const { container } = render(<DriftModeStrip />)
    expect(container.firstChild).toBeNull()
  })

  it('shows matched, unmanaged, missing counts', () => {
    render(<DriftModeStrip />)
    expect(screen.getByText(/1 matched/i)).toBeTruthy()
    expect(screen.getByText(/1 unmanaged/i)).toBeTruthy()
    expect(screen.getByText(/1 missing/i)).toBeTruthy()
  })

  it('drift only button calls toggleDriftFilter', () => {
    const toggle = vi.fn()
    useUIStore.setState({ toggleDriftFilter: toggle } as unknown as Parameters<typeof useUIStore.setState>[0])
    render(<DriftModeStrip />)
    fireEvent.click(screen.getByTitle(/show only drifted/i))
    expect(toggle).toHaveBeenCalled()
  })

  it('clear button calls clearTfState IPC', async () => {
    render(<DriftModeStrip />)
    fireEvent.click(screen.getByText(/clear tf/i))
    await vi.waitFor(() => expect(window.cloudblocks.clearTfState).toHaveBeenCalled())
  })

  it('clear button calls clearImportedNodes on success', async () => {
    const clearImportedNodes = vi.fn()
    useCloudStore.setState({ clearImportedNodes } as unknown as Parameters<typeof useCloudStore.setState>[0])
    render(<DriftModeStrip />)
    fireEvent.click(screen.getByText(/clear tf/i))
    await vi.waitFor(() => expect(clearImportedNodes).toHaveBeenCalled())
  })
})
