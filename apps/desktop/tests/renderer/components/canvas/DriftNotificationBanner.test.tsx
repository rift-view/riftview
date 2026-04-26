import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DriftNotificationBanner } from '../../../../src/renderer/components/canvas/DriftNotificationBanner'
import { useCloudStore } from '../../../../src/renderer/store/cloud'
import { useUIStore } from '../../../../src/renderer/store/ui'
import type { CloudNode } from '@riftview/shared'

// ---- Helpers ---------------------------------------------------------------

const makeImportedNode = (id: string, driftStatus: CloudNode['driftStatus']): CloudNode => ({
  id,
  type: 'aws:ec2',
  label: id,
  status: 'running',
  region: 'us-east-1',
  metadata: {},
  driftStatus
})

// ---- Tests -----------------------------------------------------------------

describe('DriftNotificationBanner', () => {
  beforeEach(() => {
    useCloudStore.setState({
      importedNodes: [],
      scanErrors: [],
      settings: {
        deleteConfirmStyle: 'type-to-confirm',
        scanInterval: 30,
        showRegionIndicators: true,
        regionColors: {},
        showScanErrorBadges: true,
        notifyOnDrift: true
      }
    })
    useUIStore.setState({ driftBannerDismissed: false })
  })

  it('does not render when importedNodes is empty', () => {
    const { container } = render(<DriftNotificationBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('does not render when driftedCount is 0 (all matched)', () => {
    useCloudStore.setState({
      importedNodes: [makeImportedNode('i-001', 'matched')]
    })
    const { container } = render(<DriftNotificationBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders when driftedCount > 0', () => {
    useCloudStore.setState({
      importedNodes: [makeImportedNode('i-001', 'unmanaged'), makeImportedNode('i-002', 'matched')]
    })
    render(<DriftNotificationBanner />)
    expect(screen.getByText(/1 resource drifted from Terraform state/)).toBeTruthy()
  })

  it('renders plural form for multiple drifted resources', () => {
    useCloudStore.setState({
      importedNodes: [makeImportedNode('i-001', 'unmanaged'), makeImportedNode('i-002', 'missing')]
    })
    render(<DriftNotificationBanner />)
    expect(screen.getByText(/2 resources drifted from Terraform state/)).toBeTruthy()
  })

  it('is hidden when driftBannerDismissed is true', () => {
    useCloudStore.setState({
      importedNodes: [makeImportedNode('i-001', 'unmanaged')]
    })
    useUIStore.setState({ driftBannerDismissed: true })
    const { container } = render(<DriftNotificationBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('dismiss button sets driftBannerDismissed to true', () => {
    useCloudStore.setState({
      importedNodes: [makeImportedNode('i-001', 'missing')]
    })
    render(<DriftNotificationBanner />)
    const dismissBtn = screen.getByTitle('Dismiss')
    fireEvent.click(dismissBtn)
    expect(useUIStore.getState().driftBannerDismissed).toBe(true)
  })

  it('does not render when notifyOnDrift is false', () => {
    useCloudStore.setState({
      importedNodes: [makeImportedNode('i-001', 'unmanaged')],
      settings: {
        deleteConfirmStyle: 'type-to-confirm',
        scanInterval: 30,
        showRegionIndicators: true,
        regionColors: {},
        showScanErrorBadges: true,
        notifyOnDrift: false
      }
    })
    const { container } = render(<DriftNotificationBanner />)
    expect(container.firstChild).toBeNull()
  })
})
