import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Statusbar } from '../Statusbar'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import type { CloudNode } from '../../types/cloud'

// ---- Helpers --------------------------------------------------------------

function makeNode(id: string, type: CloudNode['type'], region = 'us-east-1'): CloudNode {
  return { id, type, label: id, status: 'running', region, metadata: {} } as CloudNode
}

// ---- Global state reset ---------------------------------------------------

beforeEach(() => {
  useCloudStore.setState({
    profile: { name: 'default' },
    nodes: [],
    scanStatus: 'idle',
    selectedRegions: ['us-east-1']
  })

  useUIStore.setState({
    view: 'topology'
  })
})

// ---- Tests ----------------------------------------------------------------

describe('Statusbar — left cluster: profile', () => {
  it('renders "Profile" label with the current profile name from useCloudStore', () => {
    useCloudStore.setState({ profile: { name: 'prod' } })
    render(<Statusbar />)
    expect(screen.getByText(/profile/i)).toBeInTheDocument()
    expect(screen.getByText('prod')).toBeInTheDocument()
  })

  it('updates when profile name changes in the store', () => {
    useCloudStore.setState({ profile: { name: 'default' } })
    render(<Statusbar />)
    expect(screen.getByText('default')).toBeInTheDocument()
    useCloudStore.setState({ profile: { name: 'staging' } })
    expect(screen.getByText('staging')).toBeInTheDocument()
  })
})

describe('Statusbar — left cluster: region', () => {
  it('renders "Region" label with a CSV join of selectedRegions', () => {
    useCloudStore.setState({ selectedRegions: ['us-east-1', 'eu-west-1', 'ap-south-1'] })
    render(<Statusbar />)
    expect(screen.getByText(/region/i)).toBeInTheDocument()
    expect(screen.getByText('us-east-1, eu-west-1, ap-south-1')).toBeInTheDocument()
  })
})

describe('Statusbar — left cluster: resource count', () => {
  it('renders "N resources" with the count of nodes from the store', () => {
    useCloudStore.setState({
      nodes: [makeNode('i-1', 'ec2'), makeNode('i-2', 'ec2'), makeNode('b-1', 's3')]
    })
    render(<Statusbar />)
    expect(screen.getByText(/3\s+resources/i)).toBeInTheDocument()
  })

  it('resource dot uses moss color when scanStatus is not "scanning"', () => {
    useCloudStore.setState({
      nodes: [makeNode('i-1', 'ec2')],
      scanStatus: 'idle'
    })
    const { container } = render(<Statusbar />)
    // Look for an element with "●" whose style/class references the moss token
    const dot = Array.from(container.querySelectorAll('*')).find(
      (el) => /●/.test(el.textContent ?? '') && el.children.length === 0
    ) as HTMLElement | undefined
    expect(dot).toBeTruthy()
    const style = dot!.getAttribute('style') ?? ''
    const cls = dot!.className ?? ''
    expect(style + cls).toMatch(/moss/i)
  })

  it('resource dot uses ember color when scanStatus is "scanning"', () => {
    useCloudStore.setState({
      nodes: [makeNode('i-1', 'ec2')],
      scanStatus: 'scanning'
    })
    const { container } = render(<Statusbar />)
    const dot = Array.from(container.querySelectorAll('*')).find(
      (el) => /●/.test(el.textContent ?? '') && el.children.length === 0
    ) as HTMLElement | undefined
    expect(dot).toBeTruthy()
    const style = dot!.getAttribute('style') ?? ''
    const cls = dot!.className ?? ''
    expect(style + cls).toMatch(/ember/i)
  })
})

describe('Statusbar — right cluster: view toggle', () => {
  it('renders "View" label with "Topology" when view is "topology"', () => {
    useUIStore.setState({ view: 'topology' })
    render(<Statusbar />)
    expect(screen.getByText(/view/i)).toBeInTheDocument()
    expect(screen.getByText(/topology/i)).toBeInTheDocument()
  })

  it('renders "Graph" label when view is "graph"', () => {
    useUIStore.setState({ view: 'graph' })
    render(<Statusbar />)
    expect(screen.getByText(/graph/i)).toBeInTheDocument()
  })

  it('clicking the view button calls setView with the opposite view', () => {
    const setView = vi.fn()
    useUIStore.setState({ view: 'topology', setView })
    render(<Statusbar />)
    const btn = screen.getByRole('button', { name: /topology|view/i })
    fireEvent.click(btn)
    expect(setView).toHaveBeenCalledWith('graph')
  })
})

describe('Statusbar — right cluster: shortcut labels', () => {
  it('renders a "⌘K Search" label (visual only)', () => {
    render(<Statusbar />)
    expect(screen.getByText(/⌘K/)).toBeInTheDocument()
    expect(screen.getByText(/search/i)).toBeInTheDocument()
  })

  it('renders a "? Keys" label (visual only)', () => {
    render(<Statusbar />)
    expect(screen.getByText(/\?/)).toBeInTheDocument()
    expect(screen.getByText(/keys/i)).toBeInTheDocument()
  })
})
