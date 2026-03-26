import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EditModal from '../EditModal'
import type { CloudNode } from '../../../types/cloud'

const vpcNode: CloudNode = { id: 'vpc-123', type: 'vpc', label: 'my-vpc', status: 'running', region: 'us-east-1', metadata: { name: 'my-vpc' } }

const acmNode: CloudNode = {
  id: 'arn:aws:acm:us-east-1:123456789:certificate/abc',
  type: 'acm',
  label: 'example.com',
  status: 'running',
  region: 'us-east-1',
  metadata: { domainName: 'example.com', validationMethod: 'DNS', inUseBy: [], cnameRecords: [] },
}

const eventBridgeNode: CloudNode = {
  id: 'arn:aws:events:us-east-1:123456789:event-bus/my-bus',
  type: 'eventbridge-bus',
  label: 'my-bus',
  status: 'running',
  region: 'us-east-1',
  metadata: { description: 'My existing description', policy: 'default' },
}

beforeEach(() => {
  window.cloudblocks = {
    runCli: vi.fn().mockResolvedValue({ code: 0 }),
    cancelCli: vi.fn(),
    onCliOutput: vi.fn().mockReturnValue(() => {}),
    onCliDone: vi.fn().mockReturnValue(() => {}),
    startScan: vi.fn().mockResolvedValue(undefined),
  } as unknown as typeof window.cloudblocks
})

describe('EditModal', () => {
  it('renders nothing when node is null', () => {
    const { container } = render(<EditModal node={null} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders edit title for VPC', () => {
    render(<EditModal node={vpcNode} onClose={vi.fn()} />)
    expect(screen.getByText(/edit vpc/i)).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<EditModal node={vpcNode} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  describe('ACM edit affordance suppressed', () => {
    it('renders nothing for an ACM node', () => {
      const { container } = render(<EditModal node={acmNode} onClose={vi.fn()} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('EventBridge edit form', () => {
    it('renders the EventBridge edit modal with bus name and pre-filled description', () => {
      render(<EditModal node={eventBridgeNode} onClose={vi.fn()} />)
      expect(screen.getByText(/edit eventbridge bus/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('my-bus')).toBeInTheDocument()
      expect(screen.getByDisplayValue('My existing description')).toBeInTheDocument()
    })

    it('renders with empty description when metadata has no description', () => {
      const nodeNoDesc: CloudNode = { ...eventBridgeNode, metadata: { policy: 'default' } }
      render(<EditModal node={nodeNoDesc} onClose={vi.fn()} />)
      const textarea = screen.getByPlaceholderText(/optional description/i)
      expect(textarea).toBeInTheDocument()
      expect((textarea as HTMLTextAreaElement).value).toBe('')
    })
  })

})
