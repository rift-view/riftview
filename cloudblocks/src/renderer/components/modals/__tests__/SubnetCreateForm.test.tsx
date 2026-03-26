import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SubnetCreateForm } from '../SubnetCreateForm'
import { useCloudStore } from '../../../store/cloud'
import type { CloudNode } from '../../../types/cloud'

const VPC_NODE: CloudNode = {
  id: 'vpc-0abc1234',
  type: 'vpc',
  label: 'main-vpc',
  status: 'running',
  region: 'us-east-1',
  metadata: {},
}

describe('SubnetCreateForm', () => {
  it('renders VPC selector, CIDR, and AZ inputs', () => {
    useCloudStore.setState({ nodes: [VPC_NODE], importedNodes: [] })
    render(<SubnetCreateForm onChange={vi.fn()} />)
    expect(screen.getByText(/vpc \*/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('10.0.1.0/24')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('us-east-1a')).toBeInTheDocument()
  })

  it('populates VPC select with nodes of type vpc', () => {
    useCloudStore.setState({ nodes: [VPC_NODE], importedNodes: [] })
    render(<SubnetCreateForm onChange={vi.fn()} />)
    expect(screen.getByText('main-vpc')).toBeInTheDocument()
  })

  it('calls onChange with correct params when fields are filled', () => {
    useCloudStore.setState({ nodes: [VPC_NODE], importedNodes: [] })
    const onChange = vi.fn()
    render(<SubnetCreateForm onChange={onChange} />)

    fireEvent.change(screen.getByPlaceholderText('10.0.1.0/24'), { target: { value: '10.0.1.0/24' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'subnet',
      cidrBlock: '10.0.1.0/24',
    }))
  })

  it('does not include availabilityZone when AZ field is empty', () => {
    useCloudStore.setState({ nodes: [VPC_NODE], importedNodes: [] })
    const onChange = vi.fn()
    render(<SubnetCreateForm onChange={onChange} />)

    fireEvent.change(screen.getByPlaceholderText('10.0.1.0/24'), { target: { value: '10.0.2.0/24' } })
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.availabilityZone).toBeUndefined()
  })
})
