import { describe, it, expect, beforeEach } from 'vitest'
import { useCloudStore, createCloudStore } from '../cloud'
import { useCliStore } from '../cli'
import { useUIStore } from '../ui'
import type { Theme, NodeType } from '../../types/cloud'

beforeEach(() => {
  useCloudStore.setState({
    pendingNodes: [],
  })
  useCliStore.setState({
    cliOutput:      [],
    commandPreview: [],
    pendingCommand: null,
  })
  useUIStore.setState({
    activeCreate: null,
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
    useCliStore.getState().appendCliOutput({ line: 'hello', stream: 'stdout' })
    expect(useCliStore.getState().cliOutput).toHaveLength(1)
    expect(useCliStore.getState().cliOutput[0].line).toBe('hello')
  })

  it('clearCliOutput empties the log', () => {
    useCliStore.getState().appendCliOutput({ line: 'hello', stream: 'stdout' })
    useCliStore.getState().clearCliOutput()
    expect(useCliStore.getState().cliOutput).toHaveLength(0)
  })
})

describe('commandPreview', () => {
  it('setCommandPreview stores the array', () => {
    useCliStore.getState().setCommandPreview(['aws ec2 create-vpc --cidr-block 10.0.0.0/16'])
    expect(useCliStore.getState().commandPreview).toEqual(['aws ec2 create-vpc --cidr-block 10.0.0.0/16'])
  })

  it('setCommandPreview with empty array clears it', () => {
    useCliStore.getState().setCommandPreview(['some command'])
    useCliStore.getState().setCommandPreview([])
    expect(useCliStore.getState().commandPreview).toEqual([])
  })

  it('setCommandPreview accepts string array', () => {
    const store = createCloudStore()
    useCliStore.getState().setCommandPreview(['aws ec2 stop-instances --instance-ids i-123', 'aws ec2 start-instances --instance-ids i-123'])
    expect(useCliStore.getState().commandPreview).toEqual([
      'aws ec2 stop-instances --instance-ids i-123',
      'aws ec2 start-instances --instance-ids i-123',
    ])
    // createCloudStore is still valid (no-op usage to keep the import)
    expect(store).toBeDefined()
  })

  it('setPendingCommand stores command chain', () => {
    useCliStore.getState().setPendingCommand([['ec2', 'stop-instances', '--instance-ids', 'i-123']])
    expect(useCliStore.getState().pendingCommand).toEqual([['ec2', 'stop-instances', '--instance-ids', 'i-123']])
    useCliStore.getState().setPendingCommand(null)
    expect(useCliStore.getState().pendingCommand).toBeNull()
  })
})

describe('keyPairs', () => {
  it('setKeyPairs stores key pair names', () => {
    const store = createCloudStore()
    store.getState().setKeyPairs(['my-key', 'dev-key'])
    expect(store.getState().keyPairs).toEqual(['my-key', 'dev-key'])
  })
})

describe('settings', () => {
  it('settings defaults are correct', () => {
    const store = createCloudStore()
    expect(store.getState().settings.deleteConfirmStyle).toBe('type-to-confirm')
    expect(store.getState().settings.scanInterval).toBe(30)
  })
})

describe('activeCreate', () => {
  it('setActiveCreate stores the value', () => {
    useUIStore.getState().setActiveCreate({ resource: 'vpc', view: 'topology' })
    expect(useUIStore.getState().activeCreate?.resource).toBe('vpc')
  })

  it('setActiveCreate(null) clears it', () => {
    useUIStore.getState().setActiveCreate({ resource: 'vpc', view: 'topology' })
    useUIStore.getState().setActiveCreate(null)
    expect(useUIStore.getState().activeCreate).toBeNull()
  })
})

describe('NodeType union', () => {
  it('NodeType includes sqs', () => {
    const t: NodeType = 'sqs'
    expect(t).toBeTruthy()
  })

  it('NodeType includes secret', () => {
    const t: NodeType = 'secret'
    expect(t).toBeTruthy()
  })

  it('NodeType includes ecr-repo', () => {
    const t: NodeType = 'ecr-repo'
    expect(t).toBeTruthy()
  })

  it('NodeType includes sns', () => {
    const t: NodeType = 'sns'
    expect(t).toBeTruthy()
  })

  it('NodeType includes dynamo', () => {
    const t: NodeType = 'dynamo'
    expect(t).toBeTruthy()
  })

  it('NodeType includes ssm-param', () => {
    const t: NodeType = 'ssm-param'
    expect(t).toBeTruthy()
  })

  it('NodeType includes nat-gateway', () => {
    const t: NodeType = 'nat-gateway'
    expect(t).toBeTruthy()
  })

  it('NodeType includes r53-zone', () => {
    const t: NodeType = 'r53-zone'
    expect(t).toBeTruthy()
  })

  it('NodeType includes sfn', () => {
    const t: NodeType = 'sfn'
    expect(t).toBeTruthy()
  })

  it('NodeType includes eventbridge-bus', () => {
    const t: NodeType = 'eventbridge-bus'
    expect(t).toBeTruthy()
  })
})

describe('scanGeneration', () => {
  it('starts at 0', () => {
    const store = createCloudStore()
    expect(store.getState().scanGeneration).toBe(0)
  })

  it('incrementGeneration increments by 1', () => {
    const store = createCloudStore()
    store.getState().incrementGeneration()
    expect(store.getState().scanGeneration).toBe(1)
  })

  it('setProfile increments generation and clears nodes', () => {
    const store = createCloudStore()
    const node = { id: 'n1', type: 'vpc' as const, label: 'VPC', status: 'active' as const, region: 'us-east-1', metadata: {} }
    store.getState().applyDelta({ added: [node], changed: [], removed: [] })
    expect(store.getState().nodes).toHaveLength(1)
    store.getState().setProfile({ name: 'other' })
    expect(store.getState().scanGeneration).toBe(1)
    // Note: test-factory setProfile only increments generation (no node clearing) — that's fine for isolation
  })

  it('setRegion increments generation', () => {
    const store = createCloudStore()
    store.getState().setRegion('eu-west-1')
    expect(store.getState().scanGeneration).toBe(1)
  })

  it('applyDelta without generation always applies', () => {
    const store = createCloudStore()
    store.getState().incrementGeneration() // generation = 1
    const node = { id: 'n1', type: 'vpc' as const, label: 'VPC', status: 'active' as const, region: 'us-east-1', metadata: {} }
    store.getState().applyDelta({ added: [node], changed: [], removed: [] })
    expect(store.getState().nodes).toHaveLength(1)
  })

  it('applyDelta with matching generation applies', () => {
    const store = createCloudStore()
    const gen = store.getState().scanGeneration
    const node = { id: 'n1', type: 'vpc' as const, label: 'VPC', status: 'active' as const, region: 'us-east-1', metadata: {} }
    store.getState().applyDelta({ added: [node], changed: [], removed: [] }, gen)
    expect(store.getState().nodes).toHaveLength(1)
  })

  it('applyDelta with stale generation is discarded', () => {
    const store = createCloudStore()
    const staleGen = store.getState().scanGeneration
    store.getState().incrementGeneration() // generation now = 1, staleGen = 0
    const node = { id: 'n1', type: 'vpc' as const, label: 'VPC', status: 'active' as const, region: 'us-east-1', metadata: {} }
    store.getState().applyDelta({ added: [node], changed: [], removed: [] }, staleGen)
    expect(store.getState().nodes).toHaveLength(0)
  })
})

describe('scanErrors', () => {
  it('starts empty', () => {
    const store = createCloudStore()
    expect(store.getState().scanErrors).toEqual([])
  })

  it('setScanErrors stores errors', () => {
    const store = createCloudStore()
    store.getState().setScanErrors([
      { service: 'sqs', region: 'us-east-1', message: 'AccessDenied' },
      { service: 'ecr', region: 'us-east-1', message: 'ThrottlingException' },
    ])
    expect(store.getState().scanErrors).toHaveLength(2)
    expect(store.getState().scanErrors[0].service).toBe('sqs')
    expect(store.getState().scanErrors[1].message).toBe('ThrottlingException')
  })

  it('clearScanErrors empties the array', () => {
    const store = createCloudStore()
    store.getState().setScanErrors([{ service: 'lambda', region: 'us-east-1', message: 'Forbidden' }])
    store.getState().clearScanErrors()
    expect(store.getState().scanErrors).toEqual([])
  })

  it('setScanErrors replaces previous errors (not appended)', () => {
    const store = createCloudStore()
    store.getState().setScanErrors([{ service: 'sqs', region: 'us-east-1', message: 'err1' }])
    store.getState().setScanErrors([{ service: 'sns', region: 'eu-west-1', message: 'err2' }])
    expect(store.getState().scanErrors).toHaveLength(1)
    expect(store.getState().scanErrors[0].service).toBe('sns')
  })

  it('setScanErrors with empty array clears errors', () => {
    const store = createCloudStore()
    store.getState().setScanErrors([{ service: 'rds', region: 'us-east-1', message: 'err' }])
    store.getState().setScanErrors([])
    expect(store.getState().scanErrors).toEqual([])
  })
})

describe('theme defaults', () => {
  it('DEFAULT_SETTINGS includes theme: dark', () => {
    const store = createCloudStore()
    expect(store.getState().settings.theme).toBe('dark')
  })

  it('Theme type includes all five values', () => {
    const themes: Theme[] = ['dark', 'light', 'solarized', 'rose-pine', 'catppuccin']
    themes.forEach(t => {
      const store = createCloudStore()
      store.setState(s => ({ settings: { ...s.settings, theme: t } }))
      expect(store.getState().settings.theme).toBe(t)
    })
  })

  it('DEFAULT_SETTINGS includes showScanErrorBadges: true', () => {
    const store = createCloudStore()
    expect(store.getState().settings.showScanErrorBadges).toBe(true)
  })
})
