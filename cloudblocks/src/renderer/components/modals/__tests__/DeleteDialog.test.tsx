import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DeleteDialog from '../DeleteDialog'
import type { CloudNode } from '../../../types/cloud'

const node: CloudNode = { id: 'vpc-0abc1234', type: 'vpc', label: 'my-vpc', status: 'running', region: 'us-east-1', metadata: {} }

describe('DeleteDialog', () => {
  it('renders type-to-confirm input and disabled delete button initially', () => {
    render(<DeleteDialog node={node} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByPlaceholderText('vpc-0abc1234')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled()
  })

  it('enables Delete button only when input matches resource ID', async () => {
    render(<DeleteDialog node={node} onClose={vi.fn()} onConfirm={vi.fn()} />)
    const input = screen.getByPlaceholderText('vpc-0abc1234')
    fireEvent.change(input, { target: { value: 'vpc-0abc1234' } })
    expect(screen.getByRole('button', { name: /delete/i })).not.toBeDisabled()
  })

  it('calls onConfirm with empty options when confirmed', async () => {
    const onConfirm = vi.fn()
    render(<DeleteDialog node={node} onClose={vi.fn()} onConfirm={onConfirm} />)
    const input = screen.getByPlaceholderText('vpc-0abc1234')
    fireEvent.change(input, { target: { value: 'vpc-0abc1234' } })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onConfirm).toHaveBeenCalledWith({})
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<DeleteDialog node={node} onClose={onClose} onConfirm={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows force-delete toggle for S3 bucket', () => {
    const s3Node: CloudNode = { ...node, id: 'my-bucket', type: 's3' }
    render(<DeleteDialog node={s3Node} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText(/force delete/i)).toBeInTheDocument()
  })

  it('shows skip-final-snapshot toggle for RDS', () => {
    const rdsNode: CloudNode = { ...node, id: 'mydb', type: 'rds' }
    render(<DeleteDialog node={rdsNode} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText(/skip final snapshot/i)).toBeInTheDocument()
  })
})
