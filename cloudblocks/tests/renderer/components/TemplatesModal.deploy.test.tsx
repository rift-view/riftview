import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TemplatesModal from '../../../src/renderer/components/TemplatesModal'
import { useCloudStore } from '../../../src/renderer/store/cloud'

// ---- Helpers ---------------------------------------------------------------

function makeCloudblocks(overrides: Partial<typeof window.cloudblocks> = {}): typeof window.cloudblocks {
  return {
    listProfiles:         vi.fn().mockResolvedValue([{ name: 'default' }]),
    selectProfile:        vi.fn().mockResolvedValue(undefined),
    selectRegion:         vi.fn().mockResolvedValue(undefined),
    startScan:            vi.fn().mockResolvedValue(undefined),
    onScanDelta:          vi.fn().mockReturnValue(vi.fn()),
    onScanStatus:         vi.fn().mockReturnValue(vi.fn()),
    onConnStatus:         vi.fn().mockReturnValue(vi.fn()),
    onScanKeypairs:       vi.fn().mockReturnValue(vi.fn()),
    runCli:               vi.fn().mockResolvedValue({ code: 0 }),
    cancelCli:            vi.fn(),
    onCliOutput:          vi.fn().mockReturnValue(vi.fn()),
    onCliDone:            vi.fn().mockReturnValue(vi.fn()),
    getSettings:          vi.fn().mockResolvedValue({ deleteConfirmStyle: 'type-to-confirm', scanInterval: 30 }),
    setSettings:          vi.fn().mockResolvedValue(undefined),
    getThemeOverrides:    vi.fn().mockResolvedValue({}),
    createCloudFront:     vi.fn().mockResolvedValue({ code: 0 }),
    updateCloudFront:     vi.fn().mockResolvedValue({ code: 0 }),
    deleteCloudFront:     vi.fn().mockResolvedValue({ code: 0 }),
    invalidateCloudFront: vi.fn().mockResolvedValue({ code: 0 }),
    deleteAcm:            vi.fn().mockResolvedValue({ code: 0 }),
    exportTerraform:      vi.fn().mockResolvedValue({ success: true }),
    exportPng:            vi.fn().mockResolvedValue({ success: true }),
    listAwsProfiles:      vi.fn().mockResolvedValue(['default']),
    onUpdateAvailable:    vi.fn().mockReturnValue(vi.fn()),
    loadAnnotations:      vi.fn().mockResolvedValue({}),
    saveAnnotations:      vi.fn().mockResolvedValue(undefined),
    importTfState:        vi.fn().mockResolvedValue({ nodes: [] }),
    clearTfState:         vi.fn().mockResolvedValue({ ok: true }),
    analyzeIam:           vi.fn().mockResolvedValue({ nodeId: '', findings: [], fetchedAt: 0 }),
    notifyDrift:          vi.fn().mockResolvedValue(undefined),
    onPluginMetadata:     vi.fn().mockReturnValue(vi.fn()),
    terraformDeploy:      vi.fn().mockResolvedValue({ status: 'not_found' }),
    loadCustomEdges:      vi.fn().mockResolvedValue([]),
    saveCustomEdges:      vi.fn().mockResolvedValue(undefined),
    listTfStateModules:   vi.fn().mockResolvedValue({ modules: [] }),
    saveBaseline:         vi.fn().mockResolvedValue({ ok: true }),
    retryScanService:     vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  } as typeof window.cloudblocks
}

const noop = (): void => {}

// Set isLocal = true so the Deploy button is rendered
function setLocalProfile(): void {
  useCloudStore.setState({
    profile: { name: 'localstack', endpoint: 'http://localhost:4566', region: 'us-east-1' },
    region: 'us-east-1',
  })
}

// ---- Tests -----------------------------------------------------------------

describe('TemplatesModal — terraformDeploy', () => {
  beforeEach(() => {
    window.cloudblocks = makeCloudblocks()
    setLocalProfile()
  })

  it('shows "Terraform not installed" message when status is not_found', async () => {
    window.cloudblocks = makeCloudblocks({
      terraformDeploy: vi.fn().mockResolvedValue({ status: 'not_found' }),
    })

    render(<TemplatesModal onClose={noop} />)

    fireEvent.click(screen.getByRole('button', { name: /deploy to localstack/i }))

    await waitFor(() => {
      expect(screen.getByText(/terraform not installed/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/terraform\.io/i)).toBeInTheDocument()
  })

  it('shows error output when status is error', async () => {
    const errorMsg = 'Error: Failed to download provider'
    window.cloudblocks = makeCloudblocks({
      terraformDeploy: vi.fn().mockResolvedValue({ status: 'error', output: errorMsg }),
    })

    render(<TemplatesModal onClose={noop} />)

    fireEvent.click(screen.getByRole('button', { name: /deploy to localstack/i }))

    await waitFor(() => {
      expect(screen.getByText(errorMsg)).toBeInTheDocument()
    })
  })

  it('shows success output when status is success', async () => {
    const successMsg = 'Apply complete! Resources: 3 added, 0 changed, 0 destroyed.'
    window.cloudblocks = makeCloudblocks({
      terraformDeploy: vi.fn().mockResolvedValue({ status: 'success', output: successMsg }),
      startScan:       vi.fn().mockResolvedValue(undefined),
    })

    render(<TemplatesModal onClose={noop} />)

    fireEvent.click(screen.getByRole('button', { name: /deploy to localstack/i }))

    await waitFor(() => {
      expect(screen.getByText(successMsg)).toBeInTheDocument()
    })
  })

  it('shows a deploying state while the promise is pending', async () => {
    let resolve!: (v: { status: string; output?: string }) => void
    const pending = new Promise<{ status: string; output?: string }>((res) => { resolve = res })

    window.cloudblocks = makeCloudblocks({
      terraformDeploy: vi.fn().mockReturnValue(pending),
    })

    render(<TemplatesModal onClose={noop} />)

    fireEvent.click(screen.getByRole('button', { name: /deploy to localstack/i }))

    // While promise is unresolved, the button should show deploying text and be disabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deploying/i })).toBeDisabled()
    })

    // Resolve to clean up
    resolve({ status: 'success', output: 'done' })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deployed/i })).toBeInTheDocument()
    })
  })
})
