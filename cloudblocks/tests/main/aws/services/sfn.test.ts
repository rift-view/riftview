import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SFNClient } from '@aws-sdk/client-sfn'
import { listStateMachines } from '../../../../src/main/aws/services/sfn'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as SFNClient

const MACHINE_ARN = 'arn:aws:states:us-east-1:123456789:stateMachine:my-machine'
const LAMBDA_ARN  = 'arn:aws:lambda:us-east-1:123456789:function:my-fn'
const LAMBDA_ARN2 = 'arn:aws:lambda:us-east-1:123456789:function:other-fn'
const SQS_ARN     = 'arn:aws:sqs:us-east-1:123456789:my-queue'
const SNS_ARN     = 'arn:aws:sns:us-east-1:123456789:my-topic'
const CHILD_SFN_ARN = 'arn:aws:states:us-east-1:123456789:stateMachine:child-machine'

function listResponse(machines: { stateMachineArn: string; name: string }[]): { stateMachines: { stateMachineArn: string; name: string }[] } {
  return { stateMachines: machines }
}

function describeResponse(definition: string): { definition: string } {
  return { definition }
}

describe('listStateMachines', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps state machines to CloudNodes with basic shape', async () => {
    mockSend
      .mockResolvedValueOnce(listResponse([{ stateMachineArn: MACHINE_ARN, name: 'my-machine' }]))
      .mockResolvedValueOnce(describeResponse('{"States":{}}'))

    const nodes = await listStateMachines(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('sfn')
    expect(nodes[0].id).toBe(MACHINE_ARN)
    expect(nodes[0].label).toBe('my-machine')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].region).toBe('us-east-1')
  })

  it('emits trigger integrations for Lambda Resource in Task states', async () => {
    const definition = JSON.stringify({
      States: {
        InvokeLambda: {
          Type: 'Task',
          Resource: LAMBDA_ARN,
        },
      },
    })
    mockSend
      .mockResolvedValueOnce(listResponse([{ stateMachineArn: MACHINE_ARN, name: 'my-machine' }]))
      .mockResolvedValueOnce(describeResponse(definition))

    const nodes = await listStateMachines(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0]).toEqual({ targetId: LAMBDA_ARN, edgeType: 'trigger' })
  })

  it('emits trigger integrations for SDK integration FunctionName parameter', async () => {
    const definition = JSON.stringify({
      States: {
        InvokeSdk: {
          Type: 'Task',
          Resource: 'arn:aws:states:::lambda:invoke',
          Parameters: { FunctionName: LAMBDA_ARN },
        },
      },
    })
    mockSend
      .mockResolvedValueOnce(listResponse([{ stateMachineArn: MACHINE_ARN, name: 'my-machine' }]))
      .mockResolvedValueOnce(describeResponse(definition))

    const nodes = await listStateMachines(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0]).toEqual({ targetId: LAMBDA_ARN, edgeType: 'trigger' })
  })

  it('de-duplicates when the same Lambda appears in multiple states', async () => {
    const definition = JSON.stringify({
      States: {
        Step1: { Type: 'Task', Resource: LAMBDA_ARN },
        Step2: { Type: 'Task', Resource: LAMBDA_ARN },
        Step3: { Type: 'Task', Resource: LAMBDA_ARN2 },
      },
    })
    mockSend
      .mockResolvedValueOnce(listResponse([{ stateMachineArn: MACHINE_ARN, name: 'my-machine' }]))
      .mockResolvedValueOnce(describeResponse(definition))

    const nodes = await listStateMachines(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(2)
    const targets = nodes[0].integrations?.map((i) => i.targetId)
    expect(targets).toContain(LAMBDA_ARN)
    expect(targets).toContain(LAMBDA_ARN2)
  })

  it('ignores Resources that do not match any known target prefix', async () => {
    const definition = JSON.stringify({
      States: {
        SdkDynamo: { Type: 'Task', Resource: 'arn:aws:dynamodb:us-east-1:123:table/my-table' },
        Wait: { Type: 'Wait', Seconds: 10 },
      },
    })
    mockSend
      .mockResolvedValueOnce(listResponse([{ stateMachineArn: MACHINE_ARN, name: 'my-machine' }]))
      .mockResolvedValueOnce(describeResponse(definition))

    const nodes = await listStateMachines(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toBeUndefined()
  })

  it('emits trigger integrations for SQS and SNS target ARNs in Task states', async () => {
    const definition = JSON.stringify({
      States: {
        SendMessage: { Type: 'Task', Resource: SQS_ARN },
        PublishTopic: { Type: 'Task', Resource: SNS_ARN },
      },
    })
    mockSend
      .mockResolvedValueOnce(listResponse([{ stateMachineArn: MACHINE_ARN, name: 'my-machine' }]))
      .mockResolvedValueOnce(describeResponse(definition))

    const nodes = await listStateMachines(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(2)
    const targets = nodes[0].integrations?.map((i) => i.targetId)
    expect(targets).toContain(SQS_ARN)
    expect(targets).toContain(SNS_ARN)
    expect(nodes[0].integrations?.every((i) => i.edgeType === 'trigger')).toBe(true)
  })

  it('emits trigger integration for nested SFN execution target', async () => {
    const definition = JSON.stringify({
      States: {
        RunChild: { Type: 'Task', Resource: CHILD_SFN_ARN },
      },
    })
    mockSend
      .mockResolvedValueOnce(listResponse([{ stateMachineArn: MACHINE_ARN, name: 'my-machine' }]))
      .mockResolvedValueOnce(describeResponse(definition))

    const nodes = await listStateMachines(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0]).toEqual({ targetId: CHILD_SFN_ARN, edgeType: 'trigger' })
  })

  it('de-duplicates when the same SQS queue appears in multiple states', async () => {
    const definition = JSON.stringify({
      States: {
        Step1: { Type: 'Task', Resource: SQS_ARN },
        Step2: { Type: 'Task', Resource: SQS_ARN },
        Step3: { Type: 'Task', Resource: LAMBDA_ARN },
      },
    })
    mockSend
      .mockResolvedValueOnce(listResponse([{ stateMachineArn: MACHINE_ARN, name: 'my-machine' }]))
      .mockResolvedValueOnce(describeResponse(definition))

    const nodes = await listStateMachines(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(2)
    const targets = nodes[0].integrations?.map((i) => i.targetId)
    expect(targets).toContain(SQS_ARN)
    expect(targets).toContain(LAMBDA_ARN)
  })

  it('returns node without integrations when DescribeStateMachine fails', async () => {
    mockSend
      .mockResolvedValueOnce(listResponse([{ stateMachineArn: MACHINE_ARN, name: 'my-machine' }]))
      .mockRejectedValueOnce(new Error('AccessDenied'))

    const nodes = await listStateMachines(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe(MACHINE_ARN)
    expect(nodes[0].integrations).toBeUndefined()
  })

  it('returns [] when ListStateMachines fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('network error'))

    const nodes = await listStateMachines(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })

  it('returns node without integrations on malformed JSON definition', async () => {
    mockSend
      .mockResolvedValueOnce(listResponse([{ stateMachineArn: MACHINE_ARN, name: 'my-machine' }]))
      .mockResolvedValueOnce(describeResponse('not valid json {'))

    const nodes = await listStateMachines(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].integrations).toBeUndefined()
  })
})
