import { it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateModal } from '../CreateModal'
import { useCloudStore } from '../../../store/cloud'
import { useUIStore } from '../../../store/ui'
import { useCliStore } from '../../../store/cli'

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
  useUIStore.setState({ activeCreate: null })
  useCloudStore.setState({ pendingNodes: [] })
  useCliStore.setState({ cliOutput: [], commandPreview: [] })
  vi.clearAllMocks()
})

it('renders nothing when activeCreate is null', () => {
  const { container } = render(<CreateModal />)
  expect(container.firstChild).toBeNull()
})

it('renders VPC form title when activeCreate is vpc', () => {
  useUIStore.setState({ activeCreate: { resource: 'vpc', view: 'topology' } })
  render(<CreateModal />)
  expect(screen.getByText(/new vpc/i)).toBeInTheDocument()
})

it('renders S3 form title when activeCreate is s3', () => {
  useUIStore.setState({ activeCreate: { resource: 's3', view: 'topology' } })
  render(<CreateModal />)
  expect(screen.getByText(/new s3 bucket/i)).toBeInTheDocument()
})

it('closes when Cancel is clicked', async () => {
  useUIStore.setState({ activeCreate: { resource: 'vpc', view: 'topology' } })
  render(<CreateModal />)
  await userEvent.click(screen.getByText(/cancel/i))
  expect(useUIStore.getState().activeCreate).toBeNull()
})

it('renders RDS form title when activeCreate is rds', () => {
  useUIStore.setState({ activeCreate: { resource: 'rds', view: 'topology' } })
  render(<CreateModal />)
  expect(screen.getByText(/new rds instance/i)).toBeInTheDocument()
})

it('renders Lambda form title when activeCreate is lambda', () => {
  useUIStore.setState({ activeCreate: { resource: 'lambda', view: 'topology' } })
  render(<CreateModal />)
  expect(screen.getByText(/new lambda function/i)).toBeInTheDocument()
})

it('renders ALB form title when activeCreate is alb', () => {
  useUIStore.setState({ activeCreate: { resource: 'alb', view: 'topology' } })
  render(<CreateModal />)
  expect(screen.getByText(/new alb/i)).toBeInTheDocument()
})

it('blocks submission and does not call runCli when required ALB fields are empty', async () => {
  useUIStore.getState().setActiveCreate({ resource: 'alb', view: 'topology' })
  const runCli = vi.fn().mockResolvedValue({ code: 0 })
  window.cloudblocks = { ...window.cloudblocks, runCli }

  render(<CreateModal />)
  window.dispatchEvent(new CustomEvent('commanddrawer:run'))
  await new Promise(r => setTimeout(r, 10))
  expect(runCli).not.toHaveBeenCalled()
})

it('blocks submission and does not call runCli when required VPC fields are empty', async () => {
  // Set activeCreate to 'vpc' with empty form (name='', cidr='')
  useUIStore.getState().setActiveCreate({ resource: 'vpc', view: 'topology' })
  const runCli = vi.fn().mockResolvedValue({ code: 0 })
  // Override the runCli mock (use same mock pattern as existing tests in this file)
  window.cloudblocks = { ...window.cloudblocks, runCli }

  render(<CreateModal />)
  // Trigger Run without filling fields
  window.dispatchEvent(new CustomEvent('commanddrawer:run'))
  await new Promise(r => setTimeout(r, 10))
  expect(runCli).not.toHaveBeenCalled()
})
