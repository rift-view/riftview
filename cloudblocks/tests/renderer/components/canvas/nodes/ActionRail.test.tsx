import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActionRail } from '../../../../../src/renderer/components/canvas/nodes/ActionRail'
import type { CloudNode } from '../../../../../src/renderer/types/cloud'

// Mock buildConsoleUrl
vi.mock('../../../../../src/renderer/utils/buildConsoleUrl', () => ({
  buildConsoleUrl: vi.fn(),
}))
// Mock useUIStore.getState().showToast
vi.mock('../../../../../src/renderer/store/ui', () => ({
  useUIStore: { getState: () => ({ showToast: vi.fn() }) },
}))

import { buildConsoleUrl } from '../../../../../src/renderer/utils/buildConsoleUrl'

const mockBuildConsoleUrl = vi.mocked(buildConsoleUrl)

const baseNode: CloudNode = {
  id:     'arn:aws:lambda:us-east-1:123:function:my-fn',
  type:   'lambda',
  label:  'my-fn',
  status: 'running',
  region: 'us-east-1',
  metadata: {},
}

describe('ActionRail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock clipboard — configurable: true required so beforeEach can redefine on each run
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders Copy ARN button always', () => {
    mockBuildConsoleUrl.mockReturnValue(null)
    render(<ActionRail node={baseNode} onToast={vi.fn()} />)
    expect(screen.getByTitle('Copy ARN')).toBeTruthy()
  })

  it('copy ARN button calls clipboard.writeText with node.id', async () => {
    mockBuildConsoleUrl.mockReturnValue(null)
    const onToast = vi.fn()
    render(<ActionRail node={baseNode} onToast={onToast} />)
    fireEvent.click(screen.getByTitle('Copy ARN'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(baseNode.id)
  })

  it('copy ARN button calls onToast with success', async () => {
    mockBuildConsoleUrl.mockReturnValue(null)
    const onToast = vi.fn()
    render(<ActionRail node={baseNode} onToast={onToast} />)
    fireEvent.click(screen.getByTitle('Copy ARN'))
    await vi.waitFor(() => expect(onToast).toHaveBeenCalledWith('ARN copied', 'success'))
  })

  it('shows Open Console button when buildConsoleUrl returns a URL', () => {
    mockBuildConsoleUrl.mockReturnValue('https://console.aws.amazon.com/lambda')
    render(<ActionRail node={baseNode} onToast={vi.fn()} />)
    expect(screen.getByTitle('Open in AWS Console')).toBeTruthy()
  })

  it('does not show Open Console button when buildConsoleUrl returns null', () => {
    mockBuildConsoleUrl.mockReturnValue(null)
    render(<ActionRail node={baseNode} onToast={vi.fn()} />)
    expect(screen.queryByTitle('Open in AWS Console')).toBeNull()
  })

  it('copy ARN click stops propagation', () => {
    mockBuildConsoleUrl.mockReturnValue(null)
    const parentHandler = vi.fn()
    const { container } = render(
      <div onClick={parentHandler}>
        <ActionRail node={baseNode} onToast={vi.fn()} />
      </div>
    )
    fireEvent.click(container.querySelector('[title="Copy ARN"]')!)
    expect(parentHandler).not.toHaveBeenCalled()
  })
})
