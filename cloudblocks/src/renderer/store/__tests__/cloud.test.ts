import { describe, it, expect, beforeEach } from 'vitest'
import { useCloudStore } from '../cloud'

beforeEach(() => {
  useCloudStore.setState({
    pendingNodes:   [],
    cliOutput:      [],
    commandPreview: '',
    activeCreate:   null,
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
  it('setCommandPreview stores the string', () => {
    useCloudStore.getState().setCommandPreview('aws ec2 create-vpc --cidr-block 10.0.0.0/16')
    expect(useCloudStore.getState().commandPreview).toBe('aws ec2 create-vpc --cidr-block 10.0.0.0/16')
  })

  it('setCommandPreview with empty string clears it', () => {
    useCloudStore.getState().setCommandPreview('some command')
    useCloudStore.getState().setCommandPreview('')
    expect(useCloudStore.getState().commandPreview).toBe('')
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
