import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EmptyCanvasState } from '../canvas/EmptyCanvasState'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'

const DEFAULT_PROFILE = { name: 'default' }

beforeEach(() => {
  useCloudStore.setState({
    profile: DEFAULT_PROFILE,
    nodes: [],
    scanStatus: 'idle',
    selectedRegions: ['us-east-1']
  })
  useUIStore.setState({ showSettings: false })
})

describe('EmptyCanvasState', () => {
  it('renders "Connect your AWS profile" when profile name is empty', () => {
    useCloudStore.setState({ profile: { name: '' } })
    render(<EmptyCanvasState />)
    expect(screen.getByText(/Connect your AWS profile to get started/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open settings/i })).toBeInTheDocument()
  })

  it('opens settings modal when "Open Settings" is clicked', () => {
    useCloudStore.setState({ profile: { name: '' } })
    render(<EmptyCanvasState />)
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }))
    expect(useUIStore.getState().showSettings).toBe(true)
  })

  it('renders "Scan your infrastructure" when profile is set, not scanning, and no nodes', () => {
    render(<EmptyCanvasState />)
    expect(screen.getByText(/Scan your infrastructure to get started/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start scan/i })).toBeInTheDocument()
  })

  it('calls startScan with selectedRegions when "Start Scan" is clicked', () => {
    const startScan = vi.fn().mockResolvedValue(undefined)
    window.riftview = { ...window.riftview, startScan }
    useCloudStore.setState({ selectedRegions: ['us-east-1', 'eu-west-1'] })
    render(<EmptyCanvasState />)
    fireEvent.click(screen.getByRole('button', { name: /start scan/i }))
    expect(startScan).toHaveBeenCalledWith(['us-east-1', 'eu-west-1'])
  })

  it('renders "Scanning" message when scanStatus is scanning and no nodes', () => {
    useCloudStore.setState({ scanStatus: 'scanning' })
    render(<EmptyCanvasState />)
    expect(screen.getByText(/SCANNING INFRASTRUCTURE/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders nothing when nodes exist', () => {
    useCloudStore.setState({
      nodes: [
        {
          id: 'i-1',
          type: 'aws:ec2',
          label: 'web',
          region: 'us-east-1',
          status: 'running',
          raw: {}
        }
      ]
    })
    const { container } = render(<EmptyCanvasState />)
    expect(container.firstChild).toBeNull()
  })
})
