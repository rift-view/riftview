import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { IamAdvisor } from '../../../src/renderer/components/IamAdvisor'
import type { CloudNode } from '@riftview/shared'
import type { IamAnalysisResult } from '../../../src/renderer/types/iam'

// ---- Fixtures ---------------------------------------------------------------

const EC2_NODE: CloudNode = {
  id: 'i-001',
  type: 'aws:ec2',
  label: 'web-server',
  status: 'running',
  region: 'us-east-1',
  metadata: {}
}

const CLEAN_RESULT: IamAnalysisResult = {
  nodeId: 'i-001',
  findings: [],
  fetchedAt: 1000
}

const FINDING_RESULT: IamAnalysisResult = {
  nodeId: 'i-001',
  findings: [
    {
      severity: 'critical',
      title: 'Wildcard action on all resources',
      detail: 'Action: * with Resource: *'
    },
    { severity: 'warning', title: 'S3 wildcard on all buckets', detail: 's3:* with Resource: *' }
  ],
  fetchedAt: 2000
}

const ERROR_RESULT: IamAnalysisResult = {
  nodeId: 'i-001',
  findings: [],
  error: 'AccessDenied',
  fetchedAt: 3000
}

// ---- Helpers ----------------------------------------------------------------

let analyzeIamMock: ReturnType<typeof vi.fn>

function renderAdvisor(node: CloudNode = EC2_NODE): ReturnType<typeof render> {
  return render(<IamAdvisor node={node} />)
}

// ---- Tests ------------------------------------------------------------------

describe('IamAdvisor', () => {
  beforeEach(() => {
    analyzeIamMock = vi.fn()
    Object.defineProperty(window, 'riftview', {
      value: { analyzeIam: analyzeIamMock },
      writable: true,
      configurable: true
    })
  })

  it('renders the section header and is collapsed by default', () => {
    renderAdvisor()
    expect(screen.getByText(/IAM Permissions/i)).toBeInTheDocument()
    // Section body not visible — Analyze button absent
    expect(screen.queryByRole('button', { name: /analyze/i })).toBeNull()
  })

  it('shows the ▶ toggle indicator when collapsed', () => {
    renderAdvisor()
    expect(screen.getByText('▶')).toBeInTheDocument()
  })

  it('shows the ▼ toggle indicator and Analyze button after expanding', () => {
    renderAdvisor()
    fireEvent.click(screen.getByRole('button', { name: /IAM Permissions/i }))
    expect(screen.getByText('▼')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument()
  })

  it('shows loading state while analysis is in flight', async () => {
    // Never resolves — stays loading
    analyzeIamMock.mockReturnValue(new Promise(() => {}))
    renderAdvisor()
    fireEvent.click(screen.getByRole('button', { name: /IAM Permissions/i }))
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    expect(screen.getByText(/Analyzing IAM policies/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /analyze/i })).toBeNull()
  })

  it('shows "No issues found" when analysis returns empty findings', async () => {
    analyzeIamMock.mockResolvedValue(CLEAN_RESULT)
    renderAdvisor()
    fireEvent.click(screen.getByRole('button', { name: /IAM Permissions/i }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    })
    expect(screen.getByText(/No issues found/i)).toBeInTheDocument()
  })

  it('displays findings grouped by severity', async () => {
    analyzeIamMock.mockResolvedValue(FINDING_RESULT)
    renderAdvisor()
    fireEvent.click(screen.getByRole('button', { name: /IAM Permissions/i }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    })
    expect(screen.getByText('Wildcard action on all resources')).toBeInTheDocument()
    expect(screen.getByText('S3 wildcard on all buckets')).toBeInTheDocument()
    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
    expect(screen.getByText('WARNING')).toBeInTheDocument()
  })

  it('shows error message when analysis fails', async () => {
    analyzeIamMock.mockResolvedValue(ERROR_RESULT)
    renderAdvisor()
    fireEvent.click(screen.getByRole('button', { name: /IAM Permissions/i }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    })
    expect(screen.getByText(/Analysis failed — check permissions/i)).toBeInTheDocument()
  })

  it('shows error message when analyzeIam promise rejects', async () => {
    analyzeIamMock.mockRejectedValue(new Error('Network error'))
    renderAdvisor()
    fireEvent.click(screen.getByRole('button', { name: /IAM Permissions/i }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    })
    expect(screen.getByText(/Analysis failed — check permissions/i)).toBeInTheDocument()
  })

  it('shows Re-analyze button after first run completes', async () => {
    analyzeIamMock.mockResolvedValue(CLEAN_RESULT)
    renderAdvisor()
    fireEvent.click(screen.getByRole('button', { name: /IAM Permissions/i }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    })
    expect(screen.getByRole('button', { name: /Re-analyze/i })).toBeInTheDocument()
  })

  it('calls analyzeIam with correct node params', async () => {
    analyzeIamMock.mockResolvedValue(CLEAN_RESULT)
    const nodeWithMeta: CloudNode = {
      ...EC2_NODE,
      metadata: { role: 'arn:aws:iam::123:role/MyRole' }
    }
    renderAdvisor(nodeWithMeta)
    fireEvent.click(screen.getByRole('button', { name: /IAM Permissions/i }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    })
    expect(analyzeIamMock).toHaveBeenCalledWith('i-001', 'aws:ec2', {
      role: 'arn:aws:iam::123:role/MyRole'
    })
  })
})
