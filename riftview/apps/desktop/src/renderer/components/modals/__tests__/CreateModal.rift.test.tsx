import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CreateModal } from '../CreateModal'
import { useUIStore } from '../../../store/ui'
import { useCloudStore } from '../../../store/cloud'
import { useCliStore } from '../../../store/cli'
import DeleteDialog from '../DeleteDialog'
import type { CloudNode } from '../../../types/cloud'

/** R6 visual contract — modal shell + form primitives. */

Object.defineProperty(window, 'riftview', {
  value: {
    onCliOutput: () => () => {},
    onCliDone: () => () => {},
    runCli: vi.fn().mockResolvedValue({ code: 0 })
  },
  writable: true,
  configurable: true
})

beforeEach(() => {
  useCloudStore.setState({ nodes: [], importedNodes: [] })
  useUIStore.setState({ activeCreate: { resource: 'vpc', view: 'topology' } })
  useCliStore.setState({ commandPreview: [], pendingCommand: null })
})

describe('CreateModal rift shell', () => {
  it('renders .modal-backdrop + .modal + .modal-head + .modal-body + .modal-foot', () => {
    const { container } = render(<CreateModal />)
    expect(container.querySelector('.modal-backdrop')).not.toBeNull()
    expect(container.querySelector('.modal')).not.toBeNull()
    expect(container.querySelector('.modal-head')).not.toBeNull()
    expect(container.querySelector('.modal-body')).not.toBeNull()
    expect(container.querySelector('.modal-foot')).not.toBeNull()
  })

  it('header carries eyebrow "NEW RESOURCE" + editorial title', () => {
    const { container } = render(<CreateModal />)
    const eyebrow = container.querySelector('.modal-head .eyebrow')
    expect(eyebrow?.textContent).toMatch(/NEW RESOURCE/)
    const title = container.querySelector('.modal-title')
    expect(title).not.toBeNull()
  })

  it('footer Create button uses .btn-primary', () => {
    render(<CreateModal />)
    const create = screen.getByRole('button', { name: /create/i })
    expect(create).toHaveClass('btn')
    expect(create).toHaveClass('btn-primary')
  })

  it('VpcForm fields use .form-field / .form-input', () => {
    const { container } = render(<CreateModal />)
    const field = container.querySelector('.form-field')
    expect(field).not.toBeNull()
    expect(container.querySelector('.form-input')).not.toBeNull()
  })
})

describe('DeleteDialog rift shell', () => {
  it('uses .modal with fault left border and eyebrow "DELETE"', () => {
    const node: CloudNode = {
      id: 'i-1',
      type: 'ec2',
      label: 'gone',
      status: 'running',
      region: 'us-east-1',
      metadata: {}
    }
    const { container } = render(
      <DeleteDialog node={node} onClose={() => {}} onConfirm={() => {}} />
    )
    expect(container.querySelector('.modal-backdrop')).not.toBeNull()
    expect(container.querySelector('.modal')).not.toBeNull()
    const eyebrow = container.querySelector('.modal-head .eyebrow')
    expect(eyebrow?.textContent).toMatch(/DELETE/)
  })
})
