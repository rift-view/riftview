import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DeleteDialog from '../modals/DeleteDialog'
import type { CloudNode } from '../../types/cloud'

function makeRdsNode(deletionProtection: boolean): CloudNode {
  return {
    id: 'db-instance-1',
    type: 'rds',
    label: 'My RDS',
    status: 'running',
    region: 'us-east-1',
    metadata: { deletionProtection },
  }
}

function makeEc2Node(): CloudNode {
  return {
    id: 'i-0abc12345',
    type: 'ec2',
    label: 'My EC2',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
  }
}

describe('DeleteDialog — RDS deletion protection', () => {
  it('shows deletion protection checkbox when RDS node has deletionProtection true', () => {
    render(
      <DeleteDialog
        node={makeRdsNode(true)}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(
      screen.getByText(/disable deletion protection first/i)
    ).toBeInTheDocument()
  })

  it('does not show deletion protection checkbox when deletionProtection is false', () => {
    render(
      <DeleteDialog
        node={makeRdsNode(false)}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(
      screen.queryByText(/disable deletion protection first/i)
    ).not.toBeInTheDocument()
  })

  it('does not show deletion protection checkbox for non-RDS node', () => {
    render(
      <DeleteDialog
        node={makeEc2Node()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(
      screen.queryByText(/disable deletion protection first/i)
    ).not.toBeInTheDocument()
  })

  it('onConfirm receives disableProtectionFirst: true when checkbox is checked', () => {
    const onConfirm = vi.fn()
    const node = makeRdsNode(true)

    render(
      <DeleteDialog
        node={node}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    // Check the "Disable deletion protection first" checkbox
    const protectionCheckbox = screen.getByRole('checkbox', {
      name: /disable deletion protection first/i,
    })
    fireEvent.click(protectionCheckbox)

    // Type the node ID to enable the Delete button
    const input = screen.getByPlaceholderText(node.id)
    fireEvent.change(input, { target: { value: node.id } })

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ disableProtectionFirst: true })
    )
  })
})
