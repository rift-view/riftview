import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Sidebar } from '../Sidebar'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import { useCliStore } from '../../store/cli'

vi.mock('../modals/SidebarFilterDialog', () => ({ default: () => null }))

const DEFAULT_SETTINGS = {
  deleteConfirmStyle: 'type-to-confirm' as const,
  scanInterval: 30 as const,
  theme: 'dark' as const,
  showRegionIndicators: true,
  regionColors: {},
  showScanErrorBadges: true,
}

beforeEach(() => {
  useCloudStore.setState({ nodes: [], scanErrors: [], settings: DEFAULT_SETTINGS })
  useUIStore.setState({ view: 'topology', sidebarFilter: null, expandedSsmGroups: new Set() })
  useCliStore.setState({ commandPreview: [], pendingCommand: null })
})

describe('Sidebar scan error badges', () => {
  it('shows ⚠ on a service row when that service has a scan error', () => {
    useCloudStore.setState({
      scanErrors: [{ service: 'ecr', region: 'us-east-1', message: 'AccessDenied' }],
    })
    render(<Sidebar />)
    const badge = screen.getByTitle('[ecr] us-east-1 — AccessDenied')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toBe('⚠')
  })

  it('does not show ⚠ when scanErrors is empty', () => {
    useCloudStore.setState({ scanErrors: [] })
    render(<Sidebar />)
    expect(screen.queryByText('⚠')).not.toBeInTheDocument()
  })

  it('does not show ⚠ when showScanErrorBadges is false', () => {
    useCloudStore.setState({
      scanErrors: [{ service: 'rds', region: 'us-east-1', message: 'Forbidden' }],
      settings: { ...DEFAULT_SETTINGS, showScanErrorBadges: false },
    })
    render(<Sidebar />)
    expect(screen.queryByText('⚠')).not.toBeInTheDocument()
  })

  it('shows ⚠ on multiple service rows when multiple services failed', () => {
    useCloudStore.setState({
      scanErrors: [
        { service: 's3',    region: 'us-east-1', message: 'err1' },
        { service: 'lambda', region: 'us-east-1', message: 'err2' },
      ],
    })
    render(<Sidebar />)
    const badges = screen.getAllByText('⚠')
    expect(badges).toHaveLength(2)
  })

  it('shows ⚠ on the Parameters section header even when no SSM params exist', () => {
    useCloudStore.setState({
      nodes: [],  // no ssm-param nodes → ssmGroups will be empty
      scanErrors: [{ service: 'ssm', region: 'us-east-1', message: 'AccessDenied' }],
    })
    render(<Sidebar />)
    // Parameters header must render
    expect(screen.getByText('Parameters')).toBeInTheDocument()
    // ⚠ badge must also be present
    const badge = screen.getByTitle('[ssm] us-east-1 — AccessDenied')
    expect(badge).toBeInTheDocument()
  })

  it('tooltip contains the full error detail', () => {
    useCloudStore.setState({
      scanErrors: [{ service: 'dynamo', region: 'eu-west-1', message: 'ThrottlingException' }],
    })
    render(<Sidebar />)
    const badge = screen.getByTitle('[dynamo] eu-west-1 — ThrottlingException')
    expect(badge).toBeInTheDocument()
  })
})
