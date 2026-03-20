/**
 * Optimistic UI audit — failure path coverage
 *
 * The create flow in CreateModal:
 *  1. addOptimisticNode() immediately (so the canvas shows the node)
 *  2. addPendingNode()
 *  3. await window.cloudblocks.runCli(...)
 *     - success + code 0  -> leave optimistic node (next scan replaces it), close modal
 *     - success + code != 0 -> removeOptimisticNode() called
 *     - promise rejects   -> removeOptimisticNode() called
 *
 * These tests cover the store operations that back that contract.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCloudStore } from '../../../src/renderer/store/cloud'
import type { CloudNode } from '../../../src/renderer/types/cloud'

const makeOptimisticNode = (id: string): CloudNode => ({
  id,
  type: 'ec2',
  label: 'New EC2',
  status: 'creating',
  region: 'us-east-1',
  metadata: {},
})

describe('optimistic node store operations', () => {
  beforeEach(() => {
    useCloudStore.setState({ nodes: [], pendingNodes: [] })
  })

  // happy path

  it('addOptimisticNode appends node to nodes array', () => {
    const node = makeOptimisticNode('optimistic-1')
    useCloudStore.getState().addOptimisticNode(node)
    expect(useCloudStore.getState().nodes).toHaveLength(1)
    expect(useCloudStore.getState().nodes[0].id).toBe('optimistic-1')
    expect(useCloudStore.getState().nodes[0].status).toBe('creating')
  })

  it('addOptimisticNode does not add to pendingNodes', () => {
    useCloudStore.getState().addOptimisticNode(makeOptimisticNode('optimistic-2'))
    expect(useCloudStore.getState().pendingNodes).toHaveLength(0)
  })

  // failure path: non-zero CLI exit code

  it('removeOptimisticNode removes the node after non-zero CLI exit', () => {
    const id = 'optimistic-nonzero'
    useCloudStore.getState().addOptimisticNode(makeOptimisticNode(id))
    expect(useCloudStore.getState().nodes).toHaveLength(1)

    // Simulate what CreateModal does when result.code !== 0
    useCloudStore.getState().removeOptimisticNode(id)

    expect(useCloudStore.getState().nodes).toHaveLength(0)
  })

  it('removeOptimisticNode only removes the matching node', () => {
    const keepNode: CloudNode = {
      id: 'real-node', type: 'vpc', label: 'prod-vpc',
      status: 'running', region: 'us-east-1', metadata: {},
    }
    useCloudStore.setState({ nodes: [keepNode] })

    const id = 'optimistic-partial'
    useCloudStore.getState().addOptimisticNode(makeOptimisticNode(id))
    expect(useCloudStore.getState().nodes).toHaveLength(2)

    useCloudStore.getState().removeOptimisticNode(id)

    const remaining = useCloudStore.getState().nodes
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('real-node')
  })

  // failure path: promise rejection

  it('removeOptimisticNode clears node after promise rejection', async () => {
    const id = 'optimistic-reject'
    useCloudStore.getState().addOptimisticNode(makeOptimisticNode(id))
    expect(useCloudStore.getState().nodes).toHaveLength(1)

    // Simulate the .catch() branch in CreateModal
    await Promise.reject(new Error('CLI spawn failed')).catch(() => {
      useCloudStore.getState().removeOptimisticNode(id)
    })

    expect(useCloudStore.getState().nodes).toHaveLength(0)
  })

  // pending node cleanup on failure

  it('removePendingNode clears pending node alongside optimistic removal on failure', () => {
    const optimisticId = 'optimistic-combined'
    const pendingId    = 'pending:abc-123'

    const pendingNode: CloudNode = {
      id: pendingId, type: 'ec2', label: 'Creating',
      status: 'creating', region: 'us-east-1', metadata: {},
    }

    useCloudStore.getState().addOptimisticNode(makeOptimisticNode(optimisticId))
    useCloudStore.getState().addPendingNode(pendingNode)

    expect(useCloudStore.getState().nodes).toHaveLength(1)
    expect(useCloudStore.getState().pendingNodes).toHaveLength(1)

    // Simulate both cleanup calls on failure (mirrors CreateModal .catch())
    useCloudStore.getState().removePendingNode(pendingId)
    useCloudStore.getState().removeOptimisticNode(optimisticId)

    expect(useCloudStore.getState().nodes).toHaveLength(0)
    expect(useCloudStore.getState().pendingNodes).toHaveLength(0)
  })

  // success path: scan adds real node; optimistic node stays until explicitly removed

  it('on success applyDelta adds the real node alongside the optimistic node', () => {
    // The store protects nodes with status "creating" from delta removal.
    // In CreateModal the success path sets optimisticIdRef to null and lets the
    // next scan add the real node; the optimistic node is NOT removed by applyDelta.
    const optimisticId = 'optimistic-success'
    useCloudStore.getState().addOptimisticNode(makeOptimisticNode(optimisticId))
    expect(useCloudStore.getState().nodes).toHaveLength(1)

    const realNode: CloudNode = {
      id: 'i-0abc1234', type: 'ec2', label: 'New EC2',
      status: 'running', region: 'us-east-1', metadata: {},
    }
    useCloudStore.getState().applyDelta({ added: [realNode], changed: [], removed: [optimisticId] })

    const nodes = useCloudStore.getState().nodes
    // Real node is present
    expect(nodes.find((n) => n.id === 'i-0abc1234')).toBeDefined()
    expect(nodes.find((n) => n.id === 'i-0abc1234')!.status).toBe('running')
    // Optimistic node is protected — still present (will be cleaned up by removeOptimisticNode
    // or overwritten by a subsequent scan that lists it in changed[])
    expect(nodes.find((n) => n.id === optimisticId)).toBeDefined()
  })

  it('on success removeOptimisticNode explicitly clears the optimistic node', () => {
    // After CLI success the modal clears optimisticIdRef; a separate explicit call
    // to removeOptimisticNode (or the next scan's changed delta) cleans it up.
    const optimisticId = 'optimistic-explicit-clear'
    useCloudStore.getState().addOptimisticNode(makeOptimisticNode(optimisticId))
    useCloudStore.getState().removeOptimisticNode(optimisticId)
    expect(useCloudStore.getState().nodes).toHaveLength(0)
  })

  // edge: removeOptimisticNode is idempotent

  it('removeOptimisticNode is safe to call when node does not exist', () => {
    expect(() => {
      useCloudStore.getState().removeOptimisticNode('does-not-exist')
    }).not.toThrow()
    expect(useCloudStore.getState().nodes).toHaveLength(0)
  })

  // scan race: creating node is protected from accidental delta removal

  it('applyDelta does not remove an optimistic (creating) node from a stale scan', () => {
    // Scenario: CLI is in-flight and a stale scan delta arrives listing the
    // optimistic id in removed[] — the store protects creating nodes.
    const optimisticId = 'optimistic-race'
    useCloudStore.getState().addOptimisticNode(makeOptimisticNode(optimisticId))

    useCloudStore.getState().applyDelta({ added: [], changed: [], removed: [optimisticId] })

    const node = useCloudStore.getState().nodes.find((n) => n.id === optimisticId)
    expect(node).toBeDefined()
    expect(node!.status).toBe('creating')
  })

  // multiple optimistic nodes: each removed independently

  it('two concurrent optimistic nodes can be removed independently', () => {
    const id1 = 'optimistic-a'
    const id2 = 'optimistic-b'
    useCloudStore.getState().addOptimisticNode(makeOptimisticNode(id1))
    useCloudStore.getState().addOptimisticNode(makeOptimisticNode(id2))
    expect(useCloudStore.getState().nodes).toHaveLength(2)

    // First creation fails
    useCloudStore.getState().removeOptimisticNode(id1)
    expect(useCloudStore.getState().nodes).toHaveLength(1)
    expect(useCloudStore.getState().nodes[0].id).toBe(id2)

    // Second creation also fails
    useCloudStore.getState().removeOptimisticNode(id2)
    expect(useCloudStore.getState().nodes).toHaveLength(0)
  })
})
