import { describe, it, expect, beforeEach } from 'vitest'
import { useCloudStore, createCloudStore } from '../cloud'

beforeEach(() => {
  useCloudStore.setState({
    pendingNodes:   [],
    cliOutput:      [],
    commandPreview: [],
    activeCreate:   null,
    pendingCommand: null,
  })
})

describe('pendingNodes', () => {
  it('addPendingNode adds a ghost node', () => {
    const ghost = { id: 'pending:abc', type: 'vpc' as const, label: 'New VPC',
      status: 'creating' as const, region: 'us-east-1', metadata: {} }
    useCloudStore.getState().addPendingNode(ghost)
    expect(useCloudStore.getState().pendingNodes).toHaveLength(1)
    expect(useCloudStore.getState().pendingNodes[0].id).toBe('pending:abc')
  })

  it('removePendingNode removes by id', () => {
    const ghost = { id: 'pending:abc', type: 'vpc' as const, label: 'New VPC',
      status: 'creating' as const, region: 'us-east-1', metadata: {} }
    useCloudStore.getState().addPendingNode(ghost)
    useCloudStore.getState().removePendingNode('pending:abc')
    expect(useCloudStore.getState().pendingNodes).toHaveLength(0)
  })

  it('clearPendingNodes empties all', () => {
    const ghost = { id: 'pending:abc', type: 'vpc' as const, label: 'New VPC',
      status: 'creating' as const, region: 'us-east-1', metadata: {} }
    useCloudStore.getState().addPendingNode(ghost)
    useCloudStore.getState().clearPendingNodes()
    expect(useCloudStore.getState().pendingNodes).toHaveLength(0)
  })
})

describe('cliOutput', () => {
  it('appendCliOutput appends a line', () => {
    useCloudStore.getState().appendCliOutput({ line: 'hello', stream: 'stdout' })
    expect(useCloudStore.getState().cliOutput).toHaveLength(1)
    expect(useCloudStore.getState().cliOutput[0].line).toBe('hello')
  })

  it('clearCliOutput empties the log', () => {
    useCloudStore.getState().appendCliOutput({ line: 'hello', stream: 'stdout' })
    useCloudStore.getState().clearCliOutput()
    expect(useCloudStore.getState().cliOutput).toHaveLength(0)
  })
})

describe('commandPreview', () => {
  it('setCommandPreview stores the array', () => {
    useCloudStore.getState().setCommandPreview(['aws ec2 create-vpc --cidr-block 10.0.0.0/16'])
    expect(useCloudStore.getState().commandPreview).toEqual(['aws ec2 create-vpc --cidr-block 10.0.0.0/16'])
  })

  it('setCommandPreview with empty array clears it', () => {
    useCloudStore.getState().setCommandPreview(['some command'])
    useCloudStore.getState().setCommandPreview([])
    expect(useCloudStore.getState().commandPreview).toEqual([])
  })

  it('setCommandPreview accepts string array', () => {
    const store = createCloudStore()
    store.getState().setCommandPreview(['aws ec2 stop-instances --instance-ids i-123', 'aws ec2 start-instances --instance-ids i-123'])
    expect(store.getState().commandPreview).toEqual([
      'aws ec2 stop-instances --instance-ids i-123',
      'aws ec2 start-instances --instance-ids i-123',
    ])
  })

  it('setPendingCommand stores command chain', () => {
    const store = createCloudStore()
    store.getState().setPendingCommand([['ec2', 'stop-instances', '--instance-ids', 'i-123']])
    expect(store.getState().pendingCommand).toEqual([['ec2', 'stop-instances', '--instance-ids', 'i-123']])
    store.getState().setPendingCommand(null)
    expect(store.getState().pendingCommand).toBeNull()
  })
})

describe('keyPairs', () => {
  it('setKeyPairs stores key pair names', () => {
    const store = createCloudStore()
    store.getState().setKeyPairs(['my-key', 'dev-key'])
    expect(store.getState().keyPairs).toEqual(['my-key', 'dev-key'])
  })
})

describe('activeCreate', () => {
  it('setActiveCreate stores the value', () => {
    useCloudStore.getState().setActiveCreate({ resource: 'vpc', view: 'topology' })
    expect(useCloudStore.getState().activeCreate?.resource).toBe('vpc')
  })

  it('setActiveCreate(null) clears it', () => {
    useCloudStore.getState().setActiveCreate({ resource: 'vpc', view: 'topology' })
    useCloudStore.getState().setActiveCreate(null)
    expect(useCloudStore.getState().activeCreate).toBeNull()
  })
})
