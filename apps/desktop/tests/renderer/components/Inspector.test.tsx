import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Inspector } from '../../../src/renderer/components/Inspector'
import { useCloudStore } from '../../../src/renderer/store/cloud'
import { useUIStore } from '../../../src/renderer/store/ui'
import type { CloudNode } from '@riftview/shared'

// ---- Mocks ----------------------------------------------------------------

const saveAnnotationsMock = vi.fn().mockResolvedValue(undefined)
const analyzeIamMock = vi.fn().mockResolvedValue({ nodeId: '', findings: [], fetchedAt: 0 })
const openExternalMock = vi.fn().mockResolvedValue(true)

Object.defineProperty(window, 'riftview', {
  value: {
    saveAnnotations: saveAnnotationsMock,
    analyzeIam: analyzeIamMock,
    openExternal: openExternalMock
  },
  writable: true
})

vi.mock('../../../src/renderer/components/IamAdvisor', () => ({
  IamAdvisor: () => null
}))

// ---- Helpers ---------------------------------------------------------------

const EC2_NODE: CloudNode = {
  id: 'i-001',
  type: 'aws:ec2',
  label: 'web-server',
  status: 'running',
  region: 'us-east-1',
  metadata: {}
}

const noop = (): void => {}

function renderInspector(): ReturnType<typeof render> {
  return render(<Inspector onDelete={noop} onEdit={noop} onQuickAction={noop} />)
}

// ---- Tests -----------------------------------------------------------------

describe('Inspector — Notes section', () => {
  beforeEach(() => {
    saveAnnotationsMock.mockClear()
    useCloudStore.setState({ nodes: [EC2_NODE], importedNodes: [] })
    useUIStore.setState({
      selectedNodeId: 'i-001',
      annotations: {},
      selectedEdgeId: null,
      selectedEdgeInfo: null
    })
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

describe('Inspector — AWS Console action (RIFT-146)', () => {
  beforeEach(() => {
    openExternalMock.mockClear()
    useCloudStore.setState({ nodes: [EC2_NODE], importedNodes: [] })
    useUIStore.setState({
      selectedNodeId: 'i-001',
      annotations: {},
      selectedEdgeId: null,
      selectedEdgeInfo: null
    })
  })

  it('hands the console URL to the main-process bridge instead of window.open', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderInspector()
    fireEvent.click(screen.getByRole('button', { name: /AWS Console/ }))
    expect(openExternalMock).toHaveBeenCalledTimes(1)
    expect(openExternalMock).toHaveBeenCalledWith(
      'https://console.aws.amazon.com/ec2/v2/home?region=us-east-1#Instances:instanceId=i-001'
    )
    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })
})
