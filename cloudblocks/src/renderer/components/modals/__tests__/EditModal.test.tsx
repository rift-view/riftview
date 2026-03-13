import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EditModal from '../EditModal'
import type { CloudNode } from '../../../types/cloud'

const vpcNode: CloudNode = { id: 'vpc-123', type: 'vpc', label: 'my-vpc', status: 'running', region: 'us-east-1', metadata: { name: 'my-vpc' } }

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
})
