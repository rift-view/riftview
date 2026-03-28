import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventBridgeClient } from '@aws-sdk/client-eventbridge'
import { listEventBuses } from '../../../../src/main/aws/services/eventbridge'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as EventBridgeClient

const BUS_ARN = 'arn:aws:events:us-east-1:123456789:event-bus/my-bus'
const LAMBDA_ARN = 'arn:aws:lambda:us-east-1:123456789:function:my-fn'
const SQS_ARN = 'arn:aws:sqs:us-east-1:123456789:my-queue'
const SFN_ARN = 'arn:aws:states:us-east-1:123456789:stateMachine:my-sm'
const SNS_ARN = 'arn:aws:sns:us-east-1:123456789:my-topic'
const ECS_ARN = 'arn:aws:ecs:us-east-1:123456789:cluster/my-cluster'

describe('listEventBuses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps event buses to CloudNodes', async () => {
    mockSend
      .mockResolvedValueOnce({ EventBuses: [{ Arn: BUS_ARN, Name: 'my-bus' }] }) // ListEventBusesCommand
      .mockResolvedValueOnce({ Rules: [] }) // ListRulesCommand

    const nodes = await listEventBuses(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe(BUS_ARN)
    expect(nodes[0].type).toBe('eventbridge-bus')
    expect(nodes[0].label).toBe('my-bus')
    expect(nodes[0].region).toBe('us-east-1')
  })

  it('stores ruleCount and hasDisabledRules in metadata', async () => {
    mockSend
      .mockResolvedValueOnce({ EventBuses: [{ Arn: BUS_ARN, Name: 'my-bus' }] })
      .mockResolvedValueOnce({ Rules: [
        { Name: 'rule-1', State: 'ENABLED' },
        { Name: 'rule-2', State: 'DISABLED' },
      ] })
      .mockResolvedValueOnce({ Targets: [] }) // ListTargetsByRuleCommand for rule-1
      .mockResolvedValueOnce({ Targets: [] }) // ListTargetsByRuleCommand for rule-2

    const nodes = await listEventBuses(mockClient, 'us-east-1')

    expect(nodes[0].metadata.ruleCount).toBe(2)
    expect(nodes[0].metadata.hasDisabledRules).toBe(true)
  })

  it('sets hasDisabledRules to false when all rules are ENABLED', async () => {
    mockSend
      .mockResolvedValueOnce({ EventBuses: [{ Arn: BUS_ARN, Name: 'my-bus' }] })
      .mockResolvedValueOnce({ Rules: [{ Name: 'rule-1', State: 'ENABLED' }] })
      .mockResolvedValueOnce({ Targets: [] })

    const nodes = await listEventBuses(mockClient, 'us-east-1')

    expect(nodes[0].metadata.hasDisabledRules).toBe(false)
  })

  it('produces integrations for allowed target ARN prefixes', async () => {
    mockSend
      .mockResolvedValueOnce({ EventBuses: [{ Arn: BUS_ARN, Name: 'my-bus' }] })
      .mockResolvedValueOnce({ Rules: [{ Name: 'rule-1', State: 'ENABLED' }] })
      .mockResolvedValueOnce({ Targets: [
        { Arn: LAMBDA_ARN },
        { Arn: SQS_ARN },
        { Arn: SFN_ARN },
        { Arn: SNS_ARN },
      ] })

    const nodes = await listEventBuses(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(4)
    expect(nodes[0].integrations?.every((i) => i.edgeType === 'trigger')).toBe(true)
    expect(nodes[0].integrations?.map((i) => i.targetId)).toEqual([
      LAMBDA_ARN,
      SQS_ARN,
      SFN_ARN,
      SNS_ARN,
    ])
  })

  it('filters out non-matching target ARN prefixes (e.g. ECS)', async () => {
    mockSend
      .mockResolvedValueOnce({ EventBuses: [{ Arn: BUS_ARN, Name: 'my-bus' }] })
      .mockResolvedValueOnce({ Rules: [{ Name: 'rule-1', State: 'ENABLED' }] })
      .mockResolvedValueOnce({ Targets: [
        { Arn: LAMBDA_ARN },
        { Arn: ECS_ARN },
      ] })

    const nodes = await listEventBuses(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0].targetId).toBe(LAMBDA_ARN)
  })

  it('skips targets where Arn is undefined', async () => {
    mockSend
      .mockResolvedValueOnce({ EventBuses: [{ Arn: BUS_ARN, Name: 'my-bus' }] })
      .mockResolvedValueOnce({ Rules: [{ Name: 'rule-1', State: 'ENABLED' }] })
      .mockResolvedValueOnce({ Targets: [{ Id: 'target-1' }] }) // no Arn

    const nodes = await listEventBuses(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toBeUndefined()
  })

  it('handles ListRules failure gracefully', async () => {
    mockSend
      .mockResolvedValueOnce({ EventBuses: [{ Arn: BUS_ARN, Name: 'my-bus' }] })
      .mockRejectedValueOnce(new Error('AccessDenied')) // ListRulesCommand

    const nodes = await listEventBuses(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].metadata.ruleCount).toBe(0)
    expect(nodes[0].integrations).toBeUndefined()
  })

  it('handles ListTargetsByRule failure gracefully', async () => {
    mockSend
      .mockResolvedValueOnce({ EventBuses: [{ Arn: BUS_ARN, Name: 'my-bus' }] })
      .mockResolvedValueOnce({ Rules: [{ Name: 'rule-1', State: 'ENABLED' }] })
      .mockRejectedValueOnce(new Error('ThrottlingException')) // ListTargetsByRuleCommand

    const nodes = await listEventBuses(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].integrations).toBeUndefined()
  })

  it('returns empty array on top-level ListEventBuses failure', async () => {
    mockSend.mockRejectedValueOnce(new Error('network error'))

    const nodes = await listEventBuses(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })
})
