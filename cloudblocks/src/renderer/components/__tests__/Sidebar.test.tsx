import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Sidebar } from '../Sidebar'
import { SCAN_KEY_TO_TYPE } from '../../utils/scanKeyMap'
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
  useUIStore.setState({ view: 'topology', activeFilterTypes: new Set(), activeSidebarType: null, expandedSsmGroups: new Set(), pluginNodeTypes: {} })
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

  it('shows ⚠ SSM error inside Management category even when no SSM params exist', () => {
    useCloudStore.setState({
      nodes: [],  // no ssm-param nodes → ssmGroups will be empty
      scanErrors: [{ service: 'ssm', region: 'us-east-1', message: 'AccessDenied' }],
    })
    render(<Sidebar />)
    // SSM is now grouped under the Management category header
    expect(screen.getByText(/⊟ Management/i)).toBeInTheDocument()
    // ⚠ badge inside Management must still be present (with full error as title)
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

describe('Plugin node types in Sidebar', () => {
  it('shows plugin service type in sidebar when pluginNodeTypes has hasCreate: true entry', () => {
    useUIStore.setState({
      pluginNodeTypes: {
        'azure-vm': {
          label: 'VM',
          borderColor: '#0078D4',
          badgeColor: '#0078D4',
          shortLabel: 'VM',
          displayName: 'Azure VM',
          hasCreate: true,
        },
      },
    })
    render(<Sidebar />)
    expect(screen.getByText('⬡ Azure VM')).toBeInTheDocument()
  })

  it('does not show plugin service type when hasCreate is false', () => {
    useUIStore.setState({
      pluginNodeTypes: {
        'azure-readonly': {
          label: 'RO',
          borderColor: '#ccc',
          badgeColor: '#ccc',
          shortLabel: 'RO',
          displayName: 'Azure Read Only',
          hasCreate: false,
        },
      },
    })
    render(<Sidebar />)
    expect(screen.queryByText('⬡ Azure Read Only')).not.toBeInTheDocument()
  })
})

describe('Sidebar instant multi-select filter', () => {
  it('toggles a type active immediately on click without a dialog', () => {
    render(<Sidebar />)
    const ec2Row = screen.getByText('⬡ EC2').closest('div')!
    fireEvent.click(ec2Row)
    expect(useUIStore.getState().activeFilterTypes.has('ec2')).toBe(true)
  })

  it('clicking a second type adds it to the active set', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByText('⬡ EC2').closest('div')!)
    fireEvent.click(screen.getByText('⬡ Lambda').closest('div')!)
    const { activeFilterTypes } = useUIStore.getState()
    expect(activeFilterTypes.has('ec2')).toBe(true)
    expect(activeFilterTypes.has('lambda')).toBe(true)
  })

  it('clicking an active type deactivates it instantly', () => {
    useUIStore.setState({ activeFilterTypes: new Set(['ec2']), activeSidebarType: 'ec2' })
    render(<Sidebar />)
    fireEvent.click(screen.getByText('⬡ EC2').closest('div')!)
    expect(useUIStore.getState().activeFilterTypes.has('ec2')).toBe(false)
  })

  it('sets command preview to include all active type labels when filter applied', () => {
    useCloudStore.setState({
      nodes: [
        { id: '1', type: 'ec2', label: 'i-1', region: 'us-east-1', raw: {} },
        { id: '2', type: 'lambda', label: 'fn-1', region: 'us-east-1', raw: {} },
      ],
    })
    render(<Sidebar />)
    fireEvent.click(screen.getByText('⬡ EC2').closest('div')!)
    fireEvent.click(screen.getByText('⬡ Lambda').closest('div')!)
    const preview = useCliStore.getState().commandPreview
    expect(preview.length).toBeGreaterThan(0)
    expect(preview[0]).toMatch(/\[Filter\]/)
    expect(preview[0]).toMatch(/EC2/)
    expect(preview[0]).toMatch(/Lambda/)
  })

  it('clears command preview and filter when all types deselected', () => {
    useCloudStore.setState({
      nodes: [{ id: '1', type: 'ec2', label: 'i-1', region: 'us-east-1', raw: {} }],
    })
    render(<Sidebar />)
    const ec2Row = screen.getByText('⬡ EC2').closest('div')!
    fireEvent.click(ec2Row)
    fireEvent.click(ec2Row)
    expect(useUIStore.getState().activeFilterTypes.size).toBe(0)
    expect(useCliStore.getState().commandPreview).toEqual([])
  })
})

describe('Sidebar category accordion', () => {
  it('all categories start expanded', () => {
    render(<Sidebar />)
    // Check that multiple category headers are visible with the expanded icon
    expect(screen.getByText(/⊟ Compute/i)).toBeInTheDocument()
    expect(screen.getByText(/⊟ Networking/i)).toBeInTheDocument()
    expect(screen.getByText(/⊟ Storage/i)).toBeInTheDocument()
    // Service rows from those categories should be visible
    expect(screen.getByText('⬡ EC2')).toBeInTheDocument()
    expect(screen.getByText('⬡ S3')).toBeInTheDocument()
  })

  it('clicking a category header collapses it', () => {
    render(<Sidebar />)
    // EC2 is in the Compute category — it should be visible before collapse
    expect(screen.getByText('⬡ EC2')).toBeInTheDocument()

    // Click the Compute category header to collapse it
    const computeHeader = screen.getByText(/⊟ Compute/i).closest('div')!
    fireEvent.click(computeHeader)

    // After collapse, the header shows the collapsed icon and EC2 row is gone
    expect(screen.getByText(/⊞ Compute/i)).toBeInTheDocument()
    expect(screen.queryByText('⬡ EC2')).not.toBeInTheDocument()
  })

  it('clicking a collapsed header expands it again', () => {
    render(<Sidebar />)

    // Collapse the Compute category
    const computeHeader = screen.getByText(/⊟ Compute/i).closest('div')!
    fireEvent.click(computeHeader)
    expect(screen.queryByText('⬡ EC2')).not.toBeInTheDocument()

    // Click again to expand
    const collapsedHeader = screen.getByText(/⊞ Compute/i).closest('div')!
    fireEvent.click(collapsedHeader)

    // EC2 row should be visible again
    expect(screen.getByText('⬡ EC2')).toBeInTheDocument()
  })
})

describe('SCAN_KEY_TO_TYPE contract', () => {
  it('contains exactly the service keys used by awsProvider.scan()', () => {
    const expectedKeys = new Set([
      'ec2:instances',
      'ec2:vpcs',
      'ec2:subnets',
      'ec2:security-groups',
      'rds',
      's3',
      'lambda',
      'alb',
      'acm',
      'cloudfront',
      'apigw',
      'igw',
      'sqs',
      'secrets',
      'ecr',
      'sns',
      'dynamo',
      'ssm',
      'nat',
      'r53',
      'sfn',
      'eventbridge',
      'ses',
      'cognito',
      'kinesis',
      'ecs',
      'elasticache',
    ])
    const actualKeys = new Set(Object.keys(SCAN_KEY_TO_TYPE))
    expect(actualKeys).toEqual(expectedKeys)
  })
})
