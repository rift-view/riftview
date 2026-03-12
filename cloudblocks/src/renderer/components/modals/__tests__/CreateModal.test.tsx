import { it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateModal } from '../CreateModal'
import { useCloudStore } from '../../../store/cloud'

Object.defineProperty(window, 'cloudblocks', {
  value: {
    runCli:      vi.fn().mockResolvedValue({ code: 0 }),
    cancelCli:   vi.fn(),
    onCliOutput: vi.fn().mockReturnValue(() => {}),
    onCliDone:   vi.fn().mockReturnValue(() => {}),
    startScan:   vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
})

beforeEach(() => {
  useCloudStore.setState({ activeCreate: null, pendingNodes: [], cliOutput: [], commandPreview: '' })
  vi.clearAllMocks()
})

it('renders nothing when activeCreate is null', () => {
  const { container } = render(<CreateModal />)
  expect(container.firstChild).toBeNull()
})

it('renders VPC form title when activeCreate is vpc', () => {
  useCloudStore.setState({ activeCreate: { resource: 'vpc', view: 'topology' } })
  render(<CreateModal />)
  expect(screen.getByText(/new vpc/i)).toBeInTheDocument()
})

it('renders S3 form title when activeCreate is s3', () => {
  useCloudStore.setState({ activeCreate: { resource: 's3', view: 'topology' } })
  render(<CreateModal />)
  expect(screen.getByText(/new s3 bucket/i)).toBeInTheDocument()
})

it('closes when Cancel is clicked', async () => {
  useCloudStore.setState({ activeCreate: { resource: 'vpc', view: 'topology' } })
  render(<CreateModal />)
  await userEvent.click(screen.getByText(/cancel/i))
  expect(useCloudStore.getState().activeCreate).toBeNull()
})
