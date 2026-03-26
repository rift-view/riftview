import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EditModal from '../EditModal'
import type { CloudNode } from '../../../types/cloud'

const vpcNode: CloudNode = { id: 'vpc-123', type: 'vpc', label: 'my-vpc', status: 'running', region: 'us-east-1', metadata: { name: 'my-vpc' } }

const acmNode: CloudNode = {
  id: 'arn:aws:acm:us-east-1:123456789:certificate/abc',
  type: 'acm',
  label: 'example.com',
  status: 'running',
  region: 'us-east-1',
  metadata: { domainName: 'example.com', validationMethod: 'DNS', inUseBy: [], cnameRecords: [] },
}

const eventBridgeNode: CloudNode = {
  id: 'arn:aws:events:us-east-1:123456789:event-bus/my-bus',
  type: 'eventbridge-bus',
  label: 'my-bus',
  status: 'running',
  region: 'us-east-1',
  metadata: { description: 'My existing description', policy: 'default' },
}

beforeEach(() => {
  window.cloudblocks = {
    runCli: vi.fn().mockResolvedValue({ code: 0 }),
    cancelCli: vi.fn(),
    onCliOutput: vi.fn().mockReturnValue(() => {}),
    onCliDone: vi.fn().mockReturnValue(() => {}),
    startScan: vi.fn().mockResolvedValue(undefined),
  } as unknown as typeof window.cloudblocks
})

describe('EditModal', () => {
  it('renders nothing when node is null', () => {
    const { container } = render(<EditModal node={null} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders edit title for VPC', () => {
    render(<EditModal node={vpcNode} onClose={vi.fn()} />)
    expect(screen.getByText(/edit vpc/i)).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<EditModal node={vpcNode} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  describe('ACM edit affordance suppressed', () => {
    it('renders nothing for an ACM node', () => {
      const { container } = render(<EditModal node={acmNode} onClose={vi.fn()} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('SQS edit form', () => {
    const sqsNode: CloudNode = {
      id: 'https://sqs.us-east-1.amazonaws.com/123/my-queue',
      type: 'sqs',
      label: 'my-queue',
      status: 'running',
      region: 'us-east-1',
      metadata: { visibilityTimeout: 60, messageRetentionPeriod: 86400 },
    }

    it('renders the SQS edit modal with queue URL', () => {
      render(<EditModal node={sqsNode} onClose={vi.fn()} />)
      expect(screen.getByText(/edit sqs queue/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('https://sqs.us-east-1.amazonaws.com/123/my-queue')).toBeInTheDocument()
    })

    it('pre-fills visibility timeout and retention period from metadata', () => {
      render(<EditModal node={sqsNode} onClose={vi.fn()} />)
      expect(screen.getByDisplayValue('60')).toBeInTheDocument()
      expect(screen.getByDisplayValue('86400')).toBeInTheDocument()
    })

    it('uses defaults when metadata fields are absent', () => {
      const nodeNoMeta: CloudNode = { ...sqsNode, metadata: {} }
      render(<EditModal node={nodeNoMeta} onClose={vi.fn()} />)
      expect(screen.getByDisplayValue('30')).toBeInTheDocument()
      expect(screen.getByDisplayValue('345600')).toBeInTheDocument()
    })
  })

  describe('SNS edit form', () => {
    const snsNode: CloudNode = {
      id: 'arn:aws:sns:us-east-1:123:my-topic',
      type: 'sns',
      label: 'my-topic',
      status: 'running',
      region: 'us-east-1',
      metadata: { displayName: 'MySender' },
    }

    it('renders the SNS edit modal with topic ARN', () => {
      render(<EditModal node={snsNode} onClose={vi.fn()} />)
      expect(screen.getByText(/edit sns topic/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('arn:aws:sns:us-east-1:123:my-topic')).toBeInTheDocument()
    })

    it('pre-fills display name from metadata', () => {
      render(<EditModal node={snsNode} onClose={vi.fn()} />)
      expect(screen.getByDisplayValue('MySender')).toBeInTheDocument()
    })

    it('renders empty display name when metadata has no displayName', () => {
      const nodeNoDisplay: CloudNode = { ...snsNode, metadata: {} }
      render(<EditModal node={nodeNoDisplay} onClose={vi.fn()} />)
      const input = screen.getByPlaceholderText(/max 11 characters/i)
      expect((input as HTMLInputElement).value).toBe('')
    })
  })

  describe('ECR edit form', () => {
    const ecrNode: CloudNode = {
      id: 'arn:aws:ecr:us-east-1:123:repository/my-repo',
      type: 'ecr-repo',
      label: 'my-repo',
      status: 'running',
      region: 'us-east-1',
      metadata: { uri: 'https://123.dkr.ecr.us-east-1.amazonaws.com/my-repo', imageTagMutability: 'IMMUTABLE', scanOnPush: true },
    }

    it('renders the ECR edit modal with repository name', () => {
      render(<EditModal node={ecrNode} onClose={vi.fn()} />)
      expect(screen.getByText(/edit ecr repository/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('my-repo')).toBeInTheDocument()
    })

    it('pre-fills imageTagMutability from metadata', () => {
      render(<EditModal node={ecrNode} onClose={vi.fn()} />)
      const select = screen.getByDisplayValue('IMMUTABLE')
      expect(select).toBeInTheDocument()
    })

    it('pre-fills scanOnPush checkbox from metadata', () => {
      render(<EditModal node={ecrNode} onClose={vi.fn()} />)
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })
  })

  describe('Secret edit form', () => {
    const secretNode: CloudNode = {
      id: 'arn:aws:secretsmanager:us-east-1:123:secret/my-secret',
      type: 'secret',
      label: 'my-secret',
      status: 'running',
      region: 'us-east-1',
      metadata: { description: 'My secret description' },
    }

    it('renders the Secret edit modal with secret ID', () => {
      render(<EditModal node={secretNode} onClose={vi.fn()} />)
      expect(screen.getByText(/edit secret/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('arn:aws:secretsmanager:us-east-1:123:secret/my-secret')).toBeInTheDocument()
    })

    it('pre-fills description from metadata', () => {
      render(<EditModal node={secretNode} onClose={vi.fn()} />)
      expect(screen.getByDisplayValue('My secret description')).toBeInTheDocument()
    })

    it('renders empty description when metadata has no description', () => {
      const nodeNoDesc: CloudNode = { ...secretNode, metadata: {} }
      render(<EditModal node={nodeNoDesc} onClose={vi.fn()} />)
      const textarea = screen.getByPlaceholderText(/optional description/i)
      expect((textarea as HTMLTextAreaElement).value).toBe('')
    })
  })

  describe('DynamoDB edit form', () => {
    const dynamoNode: CloudNode = {
      id: 'my-table',
      type: 'dynamo',
      label: 'my-table',
      status: 'running',
      region: 'us-east-1',
      metadata: { billingMode: 'PROVISIONED', readCapacity: 10, writeCapacity: 5 },
    }

    it('renders the DynamoDB edit modal with table name', () => {
      render(<EditModal node={dynamoNode} onClose={vi.fn()} />)
      expect(screen.getByText(/edit dynamodb table/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('my-table')).toBeInTheDocument()
    })

    it('pre-fills billing mode from metadata', () => {
      render(<EditModal node={dynamoNode} onClose={vi.fn()} />)
      const select = screen.getByDisplayValue('PROVISIONED')
      expect(select).toBeInTheDocument()
    })

    it('shows capacity inputs when billing mode is PROVISIONED', () => {
      render(<EditModal node={dynamoNode} onClose={vi.fn()} />)
      expect(screen.getByDisplayValue('10')).toBeInTheDocument()
      expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    })

    it('hides capacity inputs when billing mode is PAY_PER_REQUEST', () => {
      const nodePayPerRequest: CloudNode = { ...dynamoNode, metadata: { billingMode: 'PAY_PER_REQUEST' } }
      render(<EditModal node={nodePayPerRequest} onClose={vi.fn()} />)
      expect(screen.queryByText(/read capacity units/i)).toBeNull()
      expect(screen.queryByText(/write capacity units/i)).toBeNull()
    })

    it('hides capacity inputs after switching from PROVISIONED to PAY_PER_REQUEST', () => {
      render(<EditModal node={dynamoNode} onClose={vi.fn()} />)
      const select = screen.getByDisplayValue('PROVISIONED')
      fireEvent.change(select, { target: { value: 'PAY_PER_REQUEST' } })
      expect(screen.queryByText(/read capacity units/i)).toBeNull()
      expect(screen.queryByText(/write capacity units/i)).toBeNull()
    })
  })

  describe('EventBridge edit form', () => {
    it('renders the EventBridge edit modal with bus name and pre-filled description', () => {
      render(<EditModal node={eventBridgeNode} onClose={vi.fn()} />)
      expect(screen.getByText(/edit eventbridge bus/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('my-bus')).toBeInTheDocument()
      expect(screen.getByDisplayValue('My existing description')).toBeInTheDocument()
    })

    it('renders with empty description when metadata has no description', () => {
      const nodeNoDesc: CloudNode = { ...eventBridgeNode, metadata: { policy: 'default' } }
      render(<EditModal node={nodeNoDesc} onClose={vi.fn()} />)
      const textarea = screen.getByPlaceholderText(/optional description/i)
      expect(textarea).toBeInTheDocument()
      expect((textarea as HTMLTextAreaElement).value).toBe('')
    })
  })

  describe('SSM Parameter edit form', () => {
    const ssmStringNode: CloudNode = {
      id: 'arn:aws:ssm:us-east-1:123:parameter/my/key',
      type: 'ssm-param',
      label: '/my/key',
      status: 'running',
      region: 'us-east-1',
      metadata: { type: 'String', tier: 'Standard' },
    }

    const ssmSecureNode: CloudNode = {
      id: 'arn:aws:ssm:us-east-1:123:parameter/my/secret',
      type: 'ssm-param',
      label: '/my/secret',
      status: 'running',
      region: 'us-east-1',
      metadata: { type: 'SecureString', tier: 'Standard' },
    }

    it('renders the SSM edit modal title', () => {
      render(<EditModal node={ssmStringNode} onClose={vi.fn()} />)
      expect(screen.getByText(/edit ssm parameter/i)).toBeInTheDocument()
    })

    it('shows the parameter name as read-only', () => {
      render(<EditModal node={ssmStringNode} onClose={vi.fn()} />)
      expect(screen.getByDisplayValue('/my/key')).toBeInTheDocument()
    })

    it('disables the value field for SecureString and shows security notice', () => {
      render(<EditModal node={ssmSecureNode} onClose={vi.fn()} />)
      const valueInput = screen.getByPlaceholderText(/SecureString — cannot display/i) as HTMLInputElement
      expect(valueInput.disabled).toBe(true)
      expect(screen.getByText(/SecureString values cannot be edited here/i)).toBeInTheDocument()
    })

    it('allows editing the value field for a String param', () => {
      render(<EditModal node={ssmStringNode} onClose={vi.fn()} />)
      const valueInput = screen.getByPlaceholderText(/parameter value/i) as HTMLInputElement
      expect(valueInput.disabled).toBe(false)
    })
  })

})
