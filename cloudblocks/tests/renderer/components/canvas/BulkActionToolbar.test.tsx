import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BulkActionToolbar } from '../../../../src/renderer/components/canvas/BulkActionToolbar'
import { useUIStore } from '../../../../src/renderer/store/ui'
import { useCloudStore } from '../../../../src/renderer/store/cloud'
import type { CloudNode } from '../../../../src/renderer/types/cloud'

// ---- Mocks ----------------------------------------------------------------

const runCliMock          = vi.fn().mockResolvedValue({ code: 0 })
const exportTerraformMock = vi.fn().mockResolvedValue({ success: true })

Object.defineProperty(window, 'terminus', {
  value: { runCli: runCliMock, exportTerraform: exportTerraformMock },
  writable: true,
})

// ---- Helpers ---------------------------------------------------------------

const EC2_NODE_A: CloudNode = {
  id: 'i-001', type: 'ec2', label: 'server-a', status: 'running', region: 'us-east-1', metadata: {},
}

const EC2_NODE_B: CloudNode = {
  id: 'i-002', type: 'ec2', label: 'server-b', status: 'running', region: 'us-east-1', metadata: {},
}

const S3_NODE: CloudNode = {
  id: 'my-bucket', type: 's3', label: 'my-bucket', status: 'running', region: 'us-east-1', metadata: {},
}

// ---- Tests -----------------------------------------------------------------

describe('BulkActionToolbar', () => {
  beforeEach(() => {
    runCliMock.mockClear()
    exportTerraformMock.mockClear()
    useCloudStore.setState({ nodes: [EC2_NODE_A, EC2_NODE_B, S3_NODE], importedNodes: [] })
    useUIStore.setState({ selectedNodeIds: new Set<string>() })
  })

  it('renders nothing when selectedNodeIds.size <= 1', () => {
    useUIStore.setState({ selectedNodeIds: new Set() })
    const { container } = render(<BulkActionToolbar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when exactly 1 node selected', () => {
    useUIStore.setState({ selectedNodeIds: new Set(['i-001']) })
    const { container } = render(<BulkActionToolbar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders toolbar when 2+ nodes are selected', () => {
    useUIStore.setState({ selectedNodeIds: new Set(['i-001', 'i-002']) })
    render(<BulkActionToolbar />)
    expect(screen.getByText('2 selected')).toBeDefined()
  })

  it('shows count of selected nodes in delete button', () => {
    useUIStore.setState({ selectedNodeIds: new Set(['i-001', 'i-002', 'my-bucket']) })
    render(<BulkActionToolbar />)
    expect(screen.getByText('✕ Delete 3 nodes')).toBeDefined()
  })

  it('calls runCli with flattened delete commands when delete button clicked', async () => {
    useUIStore.setState({ selectedNodeIds: new Set(['i-001', 'i-002']) })
    render(<BulkActionToolbar />)
    fireEvent.click(screen.getByText('✕ Delete 2 nodes'))
    // Allow async to settle
    await vi.waitFor(() => expect(runCliMock).toHaveBeenCalledTimes(1))
    const [commands] = runCliMock.mock.calls[0] as [string[][]]
    // Each EC2 node produces one terminate-instances command
    expect(commands.length).toBe(2)
    expect(commands[0]).toContain('terminate-instances')
    expect(commands[1]).toContain('terminate-instances')
  })

  it('calls exportTerraform with selected nodes when export button clicked', async () => {
    useUIStore.setState({ selectedNodeIds: new Set(['i-001', 'my-bucket']) })
    render(<BulkActionToolbar />)
    fireEvent.click(screen.getByText('⬡ Export HCL'))
    await vi.waitFor(() => expect(exportTerraformMock).toHaveBeenCalledTimes(1))
    const [nodes] = exportTerraformMock.mock.calls[0] as [CloudNode[]]
    expect(nodes).toHaveLength(2)
    const ids = nodes.map((n) => n.id)
    expect(ids).toContain('i-001')
    expect(ids).toContain('my-bucket')
  })

  it('clear button calls clearSelectedNodeIds', () => {
    useUIStore.setState({ selectedNodeIds: new Set(['i-001', 'i-002']) })
    render(<BulkActionToolbar />)
    // The ✕ clear button (not the delete button)
    const buttons = screen.getAllByText('✕')
    // Last ✕ button is the clear button (vs the delete button prefix)
    const clearBtn = buttons[buttons.length - 1]
    fireEvent.click(clearBtn)
    expect(useUIStore.getState().selectedNodeIds.size).toBe(0)
  })
})
