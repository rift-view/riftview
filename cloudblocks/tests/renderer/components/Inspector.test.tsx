import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Inspector } from '../../../src/renderer/components/Inspector'
import { useCloudStore } from '../../../src/renderer/store/cloud'
import { useUIStore } from '../../../src/renderer/store/ui'
import type { CloudNode } from '../../../src/renderer/types/cloud'

// ---- Mocks ----------------------------------------------------------------

const saveAnnotationsMock = vi.fn().mockResolvedValue(undefined)
const analyzeIamMock      = vi.fn().mockResolvedValue({ nodeId: '', findings: [], fetchedAt: 0 })

Object.defineProperty(window, 'cloudblocks', {
  value: { saveAnnotations: saveAnnotationsMock, analyzeIam: analyzeIamMock },
  writable: true,
})

vi.mock('../../../src/renderer/components/IamAdvisor', () => ({
  IamAdvisor: () => null,
}))

// ---- Helpers ---------------------------------------------------------------

const EC2_NODE: CloudNode = {
  id:       'i-001',
  type:     'ec2',
  label:    'web-server',
  status:   'running',
  region:   'us-east-1',
  metadata: {},
}

const noop = () => {}

function renderInspector(): ReturnType<typeof render> {
  return render(
    <Inspector
      onDelete={noop}
      onEdit={noop}
      onQuickAction={noop}
    />
  )
}

// ---- Tests -----------------------------------------------------------------

describe('Inspector — Notes section', () => {
  beforeEach(() => {
    saveAnnotationsMock.mockClear()
    useCloudStore.setState({ nodes: [EC2_NODE], importedNodes: [] })
    useUIStore.setState({ selectedNodeId: 'i-001', annotations: {}, selectedEdgeId: null, selectedEdgeInfo: null })
  })

  it('renders the Notes label when a node is selected', () => {
    renderInspector()
    expect(screen.getByText(/notes/i)).toBeInTheDocument()
  })

  it('renders a textarea pre-filled from the annotations store', () => {
    useUIStore.setState({ annotations: { 'i-001': 'existing note' } })
    renderInspector()
    const ta = screen.getByPlaceholderText(/add a note/i) as HTMLTextAreaElement
    expect(ta.value).toBe('existing note')
  })

  it('updates the store on change', () => {
    renderInspector()
    const ta = screen.getByPlaceholderText(/add a note/i)
    fireEvent.change(ta, { target: { value: 'typed note' } })
    expect(useUIStore.getState().annotations['i-001']).toBe('typed note')
  })

  it('calls saveAnnotations on blur', async () => {
    renderInspector()
    const ta = screen.getByPlaceholderText(/add a note/i)
    fireEvent.change(ta, { target: { value: 'blur note' } })
    fireEvent.blur(ta)
    expect(saveAnnotationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ 'i-001': 'blur note' })
    )
  })

  it('does not show Notes section when no node is selected', () => {
    useUIStore.setState({ selectedNodeId: null })
    renderInspector()
    expect(screen.queryByPlaceholderText(/add a note/i)).toBeNull()
  })
})
