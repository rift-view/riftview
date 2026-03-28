import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SFNClient } from '@aws-sdk/client-sfn'
import { listStateMachines } from '../../../../src/main/aws/services/sfn'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as SFNClient

const MACHINE_ARN = 'arn:aws:states:us-east-1:123456789:stateMachine:my-machine'
const LAMBDA_ARN  = 'arn:aws:lambda:us-east-1:123456789:function:my-fn'
const LAMBDA_ARN2 = 'arn:aws:lambda:us-east-1:123456789:function:other-fn'

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

  it('ignores non-Lambda Resources such as SQS, SNS, and states::: SDK integrations', async () => {
    const definition = JSON.stringify({
      States: {
        SendSqs: { Type: 'Task', Resource: 'arn:aws:states:::sqs:sendMessage' },
        PublishSns: { Type: 'Task', Resource: 'arn:aws:sns:us-east-1:123456789:my-topic' },
        SdkIntegration: { Type: 'Task', Resource: 'arn:aws:states:::dynamodb:putItem' },
      },
    })
    mockSend
      .mockResolvedValueOnce(listResponse([{ stateMachineArn: MACHINE_ARN, name: 'my-machine' }]))
      .mockResolvedValueOnce(describeResponse(definition))

    const nodes = await listStateMachines(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toBeUndefined()
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
