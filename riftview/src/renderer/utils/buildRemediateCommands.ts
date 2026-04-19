import type { CloudNode } from '../types/cloud'
import { buildDeleteCommands } from './buildDeleteCommands'

export function buildRemediateCommands(node: CloudNode): string[][] {
  if (node.driftStatus === 'unmanaged') {
    return buildDeleteCommands(node)
  }

  if (node.driftStatus === 'matched') {
    if (!node.tfMetadata) return []
    return buildMatchedCommands(node)
  }

  // 'missing' nodes require re-creation (out of scope for Phase 2)
  return []
}

function buildMatchedCommands(node: CloudNode): string[][] {
  const live = node.metadata
  const tf = node.tfMetadata!

  function diffed(key: string): string | null {
    const liveVal = String(live[key] ?? '')
    const tfVal = String(tf[key] ?? '')
    return liveVal !== tfVal && tf[key] !== undefined ? tfVal : null
  }

  if (node.type === 'lambda') {
    const runtimeVal = diffed('runtime')
    const memoryVal = diffed('memorySize')
    const timeoutVal = diffed('timeout')

    if (!runtimeVal && !memoryVal && !timeoutVal) return []

    const cmd = ['lambda', 'update-function-configuration', '--function-name', node.id]
    if (runtimeVal) cmd.push('--runtime', runtimeVal)
    if (memoryVal) cmd.push('--memory-size', memoryVal)
    if (timeoutVal) cmd.push('--timeout', timeoutVal)
    return [cmd]
  }

  if (node.type === 'ec2') {
    const instanceTypeVal = diffed('instanceType')
    if (!instanceTypeVal) return []

    const modify = [
      'ec2',
      'modify-instance-attribute',
      '--instance-id',
      node.id,
      '--instance-type',
      `Value=${instanceTypeVal}`
    ]

    if (node.status === 'running') {
      return [
        ['ec2', 'stop-instances', '--instance-ids', node.id],
        modify,
        ['ec2', 'start-instances', '--instance-ids', node.id]
      ]
    }
    return [modify]
  }

  if (node.type === 'rds') {
    const instanceClassVal = diffed('instanceClass')
    if (!instanceClassVal) return []
    return [
      [
        'rds',
        'modify-db-instance',
        '--db-instance-identifier',
        node.id,
        '--db-instance-class',
        instanceClassVal,
        '--apply-immediately'
      ]
    ]
  }

  return []
}
