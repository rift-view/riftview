import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Topbar } from '../Topbar'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import type { AwsProfile, CloudNode } from '../../types/cloud'

// Stub modals so we don't have to mount their trees
vi.mock('../TemplatesModal', () => ({ default: () => null }))
vi.mock('../modals/TfModuleSelectorModal', () => ({ default: () => null }))

// ---- Helpers --------------------------------------------------------------

const DEFAULT_SETTINGS = {
  deleteConfirmStyle: 'type-to-confirm' as const,
  scanInterval: 30 as const,
  theme: 'dark' as const,
  showRegionIndicators: true,
  regionColors: {},
  showScanErrorBadges: true
}

function makeNode(id: string, type: CloudNode['type'], region = 'us-east-1'): CloudNode {
  return { id, type, label: id, status: 'running', region, metadata: {} } as CloudNode
}

interface RiftviewMock {
  listProfiles: ReturnType<typeof vi.fn>
  selectProfile: ReturnType<typeof vi.fn>
  startScan: ReturnType<typeof vi.fn>
  onConnStatus: ReturnType<typeof vi.fn>
  listTfStateModules: ReturnType<typeof vi.fn>
  importTfState: ReturnType<typeof vi.fn>
  exportTerraform: ReturnType<typeof vi.fn>
  exportPng: ReturnType<typeof vi.fn>
  saveExportImage: ReturnType<typeof vi.fn>
}

let riftviewMock: RiftviewMock
// Captures the handler passed to onConnStatus so tests can invoke it
let connStatusHandler: ((status: string) => void) | null = null

function setupRiftviewMock(overrides: Partial<RiftviewMock> = {}): void {
  connStatusHandler = null
  riftviewMock = {
    listProfiles: vi
      .fn()
      .mockResolvedValue([{ name: 'default' }, { name: 'prod' }] as AwsProfile[]),
    selectProfile: vi.fn().mockResolvedValue(undefined),
    startScan: vi.fn().mockResolvedValue(undefined),
    onConnStatus: vi.fn((cb: (s: string) => void) => {
      connStatusHandler = cb
      return () => {
        connStatusHandler = null
      }
    }),
    listTfStateModules: vi
      .fn()
      .mockResolvedValue({ modules: [] }),
    importTfState: vi.fn().mockResolvedValue({ nodes: [] }),
    exportTerraform: vi.fn().mockResolvedValue({ success: true }),
    exportPng: vi.fn().mockResolvedValue({ success: true }),
    saveExportImage: vi.fn().mockResolvedValue({ success: true }),
    ...overrides
  }
  ;(window as unknown as { riftview: RiftviewMock }).riftview = riftviewMock
}

// ---- Global state reset ---------------------------------------------------

beforeEach(() => {
  setupRiftviewMock()

  useCloudStore.setState({
    profile: { name: 'default' },
    nodes: [],
    scanStatus: 'idle',
    lastScannedAt: null,
    selectedRegions: ['us-east-1'],
    settings: DEFAULT_SETTINGS,
    importedNodes: []
  })

  useUIStore.setState({
    isExporting: false
  })
})

afterEach(() => {
  vi.useRealTimers()
})

// ---- Tests ----------------------------------------------------------------

describe('Topbar — wordmark', () => {
  it('renders a logo <img> with src containing "riftview-logo" and the RIFTVIEW text', () => {
    const { container } = render(<Topbar onScan={vi.fn()} />)
    const imgs = container.querySelectorAll('img')
    const logo = Array.from(imgs).find((img) => /riftview-logo/i.test(img.getAttribute('src') ?? ''))
    expect(logo).toBeTruthy()
    expect(screen.getByText(/RIFTVIEW/)).toBeInTheDocument()
  })
})

describe('Topbar — profile selector', () => {
  it('populates <option>s from window.riftview.listProfiles() and shows a "⬡ Local" choice', async () => {
    render(<Topbar onScan={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'prod' })).toBeInTheDocument()
    })
    expect(screen.getByRole('option', { name: 'default' })).toBeInTheDocument()
    // "⬡ Local" option
    expect(screen.getByRole('option', { name: /⬡ Local/ })).toBeInTheDocument()
  })

  it('selecting "local" sets profile {name:"local", endpoint:"http://localhost:4566"} and calls selectProfile', async () => {
    render(<Topbar onScan={vi.fn()} />)
    await waitFor(() => expect(riftviewMock.listProfiles).toHaveBeenCalled())

    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'local' } })

    const newProfile = useCloudStore.getState().profile
    expect(newProfile.name).toBe('local')
    expect(newProfile.endpoint).toBe('http://localhost:4566')
    expect(riftviewMock.selectProfile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'local', endpoint: 'http://localhost:4566' })
    )
  })
})

describe('Topbar — endpoint input', () => {
  it('does NOT render endpoint input when profile.endpoint is undefined', () => {
    useCloudStore.setState({ profile: { name: 'default' } })
    render(<Topbar onScan={vi.fn()} />)
    expect(screen.queryByPlaceholderText(/localhost:4566/i)).not.toBeInTheDocument()
  })

  it('renders endpoint input when profile.endpoint is set; Enter calls setProfile with trimmed value', () => {
    useCloudStore.setState({
      profile: { name: 'local', endpoint: 'http://localhost:4566' }
    })
    render(<Topbar onScan={vi.fn()} />)
    const input = screen.getByPlaceholderText(/localhost:4566/i) as HTMLInputElement
    expect(input).toBeInTheDocument()

    fireEvent.change(input, { target: { value: '  http://127.0.0.1:9000  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    const p = useCloudStore.getState().profile
    expect(p.endpoint).toBe('http://127.0.0.1:9000')
  })
})

describe('Topbar — connection status indicator', () => {
  function getConnLabel(): HTMLElement | null {
    // Match the trio used by the Topbar: connecting…, connected, error
    return (
      screen.queryByText(/^connected$/i) ??
      screen.queryByText(/^error$/i) ??
      screen.queryByText(/connecting/i)
    )
  }

  it('subscribes to onConnStatus on mount', () => {
    render(<Topbar onScan={vi.fn()} />)
    expect(riftviewMock.onConnStatus).toHaveBeenCalledTimes(1)
  })

  it('invoking "connected" via the mock handler yields a moss/green colored label', async () => {
    render(<Topbar onScan={vi.fn()} />)
    expect(connStatusHandler).toBeTruthy()
    connStatusHandler!('connected')

    await waitFor(() => {
      expect(screen.getByText(/^connected$/i)).toBeInTheDocument()
    })

    const label = screen.getByText(/^connected$/i)
    const color = (label.getAttribute('style') ?? '') + (label.className ?? '')
    // Moss-coloured: look for a moss/green token (moss class or a green hex)
    expect(color).toMatch(
      /moss|--ok|#28c840|#22c55e|#4ade80|rgb\(40,\s*200,\s*64\)|#16a34a/i
    )
  })

  it('invoking "error" yields a fault/red colored label', async () => {
    render(<Topbar onScan={vi.fn()} />)
    expect(connStatusHandler).toBeTruthy()
    connStatusHandler!('error')

    await waitFor(() => {
      expect(screen.getByText(/^error$/i)).toBeInTheDocument()
    })

    const label = screen.getByText(/^error$/i)
    const color = (label.getAttribute('style') ?? '') + (label.className ?? '')
    expect(color).toMatch(/fault|--danger|--fault-500|#ff5f57|#ef4444|#dc2626|#f87171/i)
    // Make sure some connection indicator is present
    expect(getConnLabel()).toBeInTheDocument()
  })
})

describe('Topbar — scan button', () => {
  it('calls onScan prop when clicked', () => {
    const onScan = vi.fn()
    render(<Topbar onScan={onScan} />)
    const btn = screen.getByRole('button', { name: /scan/i })
    fireEvent.click(btn)
    expect(onScan).toHaveBeenCalledOnce()
  })

  it('is disabled and shows a spinner glyph when scanStatus is "scanning"', () => {
    useCloudStore.setState({ scanStatus: 'scanning' })
    render(<Topbar onScan={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /scan/i }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    // Spinner glyph — Topbar uses ⟳ — accept any of the reasonable spinner chars
    expect(btn.textContent ?? '').toMatch(/⟳|⟲|↻|◌/)
  })
})

describe('Topbar — last-scanned timestamp', () => {
  it('renders "5s ago" when lastScannedAt is 5 seconds ago', () => {
    const now = new Date('2025-01-01T00:00:00Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(now)

    useCloudStore.setState({ lastScannedAt: new Date(now - 5_000) })
    render(<Topbar onScan={vi.fn()} />)
    expect(screen.getByText(/5s ago/i)).toBeInTheDocument()
  })
})

describe('Topbar — fix count chip', () => {
  it('renders "3 fixed this session" when fixCount={3}', () => {
    render(<Topbar onScan={vi.fn()} fixCount={3} />)
    expect(screen.getByText(/3 fixed this session/i)).toBeInTheDocument()
  })

  it('renders nothing for the fix chip when fixCount={0}', () => {
    render(<Topbar onScan={vi.fn()} fixCount={0} />)
    expect(screen.queryByText(/fixed this session/i)).not.toBeInTheDocument()
  })
})

describe('Topbar — cost pill & popover', () => {
  it('shows a formatted dollar total when costed nodes are present', () => {
    useCloudStore.setState({
      nodes: [
        makeNode('i-1', 'ec2'),
        makeNode('i-2', 'ec2'),
        makeNode('b-1', 's3')
      ]
    })
    render(<Topbar onScan={vi.fn()} />)
    // ec2 us-east-1 = 8.50 each, s3 = 2.30 → ~$19.30
    const pill = screen.getByText(/~\$19\.30\/mo/)
    expect(pill).toBeInTheDocument()
  })

  it('hovering the cost pill reveals a top-5 list with the "Top cost by node" header', async () => {
    useCloudStore.setState({
      nodes: [
        makeNode('i-1', 'ec2'),
        makeNode('i-2', 'ec2'),
        makeNode('b-1', 's3')
      ]
    })
    render(<Topbar onScan={vi.fn()} />)
    const pill = screen.getByText(/~\$19\.30\/mo/)
    fireEvent.mouseEnter(pill.parentElement ?? pill)
    await waitFor(() => {
      expect(screen.getByText(/Top cost by node/i)).toBeInTheDocument()
    })
    // Each costed node id should appear in the popover
    expect(screen.getAllByText(/i-1|i-2|b-1/).length).toBeGreaterThan(0)
  })
})

describe('Topbar — import dropdown', () => {
  it('clicking Terraform with a single module auto-imports and calls setImportedNodes', async () => {
    const singleModule = {
      modules: [
        {
          name: 'm1',
          resourceCount: 1,
          nodes: [makeNode('x', 'ec2')]
        }
      ]
    }
    riftviewMock.listTfStateModules.mockResolvedValue(singleModule)

    const setImportedNodes = vi.fn()
    useCloudStore.setState({ setImportedNodes })

    render(<Topbar onScan={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Import/i }))
    fireEvent.click(screen.getByRole('button', { name: /Terraform/i }))

    await waitFor(() => {
      expect(riftviewMock.listTfStateModules).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(setImportedNodes).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'x', type: 'ec2' })])
      )
    })
  })

  it('clicking Templates dispatches a riftview:show-templates custom event', () => {
    const handler = vi.fn()
    window.addEventListener('riftview:show-templates', handler)

    try {
      render(<Topbar onScan={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /Import/i }))
      fireEvent.click(screen.getByRole('button', { name: /Templates/i }))
      expect(handler).toHaveBeenCalled()
    } finally {
      window.removeEventListener('riftview:show-templates', handler)
    }
  })
})

describe('Topbar — export dropdown', () => {
  it('disables every export item when nodes is empty', () => {
    useCloudStore.setState({ nodes: [] })
    render(<Topbar onScan={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Export/i }))
    // Every button in the menu should be disabled; specifically Terraform HCL
    const tf = screen.getByRole('button', { name: /Terraform HCL/i })
    expect(tf).toBeDisabled()
  })

  it('clicking "Terraform HCL" with nodes present calls window.riftview.exportTerraform', async () => {
    const nodes = [makeNode('i-1', 'ec2')]
    useCloudStore.setState({ nodes })
    render(<Topbar onScan={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Export/i }))
    fireEvent.click(screen.getByRole('button', { name: /Terraform HCL/i }))
    await waitFor(() => {
      expect(riftviewMock.exportTerraform).toHaveBeenCalledWith(nodes)
    })
  })

  it('clicking "Copy diagram" dispatches riftview:export-canvas with detail.format="clipboard"', () => {
    useCloudStore.setState({ nodes: [makeNode('i-1', 'ec2')] })
    const handler = vi.fn()
    window.addEventListener('riftview:export-canvas', handler as EventListener)
    try {
      render(<Topbar onScan={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /Export/i }))
      fireEvent.click(screen.getByRole('button', { name: /Copy diagram/i }))
      expect(handler).toHaveBeenCalled()
      const evt = handler.mock.calls[0][0] as CustomEvent<{ format: string }>
      expect(evt.detail.format).toBe('clipboard')
    } finally {
      window.removeEventListener('riftview:export-canvas', handler as EventListener)
    }
  })
})

describe('Topbar — region chips', () => {
  it('renders one chip per selectedRegion', () => {
    useCloudStore.setState({ selectedRegions: ['us-east-1', 'us-west-2'] })
    render(<Topbar onScan={vi.fn()} />)
    expect(screen.getByText('us-east-1')).toBeInTheDocument()
    expect(screen.getByText('us-west-2')).toBeInTheDocument()
  })

  it('clicking × on a chip removes that region and triggers startScan', () => {
    useCloudStore.setState({ selectedRegions: ['us-east-1', 'us-west-2'] })
    const setSelectedRegions = vi.fn()
    useCloudStore.setState({ setSelectedRegions })

    render(<Topbar onScan={vi.fn()} />)
    const chip = screen.getByText('us-east-1').closest('span') as HTMLElement
    const removeBtn = within(chip).getByRole('button')
    fireEvent.click(removeBtn)

    expect(setSelectedRegions).toHaveBeenCalledWith(['us-west-2'])
    expect(riftviewMock.startScan).toHaveBeenCalledWith(['us-west-2'])
  })

  it('does not render × when only one region is selected', () => {
    useCloudStore.setState({ selectedRegions: ['us-east-1'] })
    render(<Topbar onScan={vi.fn()} />)
    const chip = screen.getByText('us-east-1').closest('span') as HTMLElement
    // No × (remove) button in single-region chip
    expect(within(chip).queryByRole('button')).toBeNull()
  })
})

describe('Topbar — region add menu', () => {
  it('clicking "+ add" then "eu-west-1" extends selection + scans', () => {
    useCloudStore.setState({ selectedRegions: ['us-east-1', 'us-west-2'] })
    const setSelectedRegions = vi.fn()
    useCloudStore.setState({ setSelectedRegions })

    render(<Topbar onScan={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ ?add/i }))
    fireEvent.click(screen.getByRole('button', { name: 'eu-west-1' }))

    expect(setSelectedRegions).toHaveBeenCalledWith(['us-east-1', 'us-west-2', 'eu-west-1'])
    expect(riftviewMock.startScan).toHaveBeenCalledWith(['us-east-1', 'us-west-2', 'eu-west-1'])
  })
})

describe('Topbar — settings / about buttons', () => {
  it('settings button dispatches riftview:show-settings', () => {
    const handler = vi.fn()
    window.addEventListener('riftview:show-settings', handler)
    try {
      render(<Topbar onScan={vi.fn()} />)
      const btn = screen.getByRole('button', { name: /settings/i })
      fireEvent.click(btn)
      expect(handler).toHaveBeenCalled()
    } finally {
      window.removeEventListener('riftview:show-settings', handler)
    }
  })

  it('about button dispatches riftview:show-about', () => {
    const handler = vi.fn()
    window.addEventListener('riftview:show-about', handler)
    try {
      render(<Topbar onScan={vi.fn()} />)
      // Title "About RiftView" or role/name containing "about"
      const btn = screen.getByRole('button', { name: /about/i })
      fireEvent.click(btn)
      expect(handler).toHaveBeenCalled()
    } finally {
      window.removeEventListener('riftview:show-about', handler)
    }
  })
})
