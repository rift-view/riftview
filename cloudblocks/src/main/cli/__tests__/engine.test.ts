// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

vi.mock('child_process', () => ({ spawn: vi.fn() }))
vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))

import { spawn } from 'child_process'
import { CliEngine } from '../engine'

function makeProcess(exitCode: number, stdoutLines: string[] = [], stderrLines: string[] = []) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()

  setTimeout(() => {
    for (const line of stdoutLines) proc.stdout.emit('data', Buffer.from(line + '\n'))
    for (const line of stderrLines) proc.stderr.emit('data', Buffer.from(line + '\n'))
    proc.emit('close', exitCode)
  }, 0)

  return proc
}

describe('CliEngine', () => {
  let mockWin: any
  let mockSpawn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockWin = { webContents: { send: vi.fn() } }
    mockSpawn = vi.mocked(spawn)
    mockSpawn.mockReset()
  })

  it('executes a single command and resolves with exit code 0', async () => {
    mockSpawn.mockReturnValue(makeProcess(0, ['{"VpcId":"vpc-abc"}']))
    const engine = new CliEngine(mockWin)
    const result = await engine.execute([['ec2', 'create-vpc', '--cidr-block', '10.0.0.0/16']])
    expect(result.code).toBe(0)
    expect(mockSpawn).toHaveBeenCalledWith('aws', ['ec2', 'create-vpc', '--cidr-block', '10.0.0.0/16'], expect.any(Object))
  })

  it('sends cli:output IPC events for stdout lines', async () => {
    mockSpawn.mockReturnValue(makeProcess(0, ['line1', 'line2']))
    const engine = new CliEngine(mockWin)
    await engine.execute([['ec2', 'create-vpc']])
    const outputCalls = mockWin.webContents.send.mock.calls.filter((c: any) => c[0] === 'cli:output')
    expect(outputCalls).toHaveLength(2)
    expect(outputCalls[0][1]).toEqual({ line: 'line1', stream: 'stdout' })
    expect(outputCalls[1][1]).toEqual({ line: 'line2', stream: 'stdout' })
  })

  it('sends exactly one cli:done event per execute() call', async () => {
    mockSpawn.mockReturnValue(makeProcess(0))
    const engine = new CliEngine(mockWin)
    await engine.execute([['ec2', 'create-vpc']])
    const doneCalls = mockWin.webContents.send.mock.calls.filter((c: any) => c[0] === 'cli:done')
    expect(doneCalls).toHaveLength(1)
    expect(doneCalls[0][1]).toEqual({ code: 0 })
  })

  it('sends exactly one cli:done for a two-command success chain', async () => {
    mockSpawn
      .mockReturnValueOnce(makeProcess(0, ['{"GroupId":"sg-abc"}']))
      .mockReturnValueOnce(makeProcess(0))
    const engine = new CliEngine(mockWin)
    await engine.execute([
      ['ec2', 'create-security-group', '--group-name', 'web'],
      ['ec2', 'authorize-security-group-ingress', '--group-id', '{GroupId}'],
    ])
    const doneCalls = mockWin.webContents.send.mock.calls.filter((c: any) => c[0] === 'cli:done')
    expect(doneCalls).toHaveLength(1)
    expect(doneCalls[0][1]).toEqual({ code: 0 })
  })

  it('stops chain on first non-zero exit', async () => {
    mockSpawn.mockReturnValueOnce(makeProcess(1, [], ['error']))
    const engine = new CliEngine(mockWin)
    const result = await engine.execute([
      ['ec2', 'create-security-group'],
      ['ec2', 'authorize-security-group-ingress'],
    ])
    expect(result.code).toBe(1)
    expect(mockSpawn).toHaveBeenCalledTimes(1)
  })

  it('substitutes {GroupId} from previous command stdout', async () => {
    mockSpawn
      .mockReturnValueOnce(makeProcess(0, ['{"GroupId":"sg-abc123"}']))
      .mockReturnValueOnce(makeProcess(0))
    const engine = new CliEngine(mockWin)
    await engine.execute([
      ['ec2', 'create-security-group'],
      ['ec2', 'authorize-security-group-ingress', '--group-id', '{GroupId}'],
    ])
    // Second spawn call should have the real GroupId substituted
    expect(mockSpawn).toHaveBeenNthCalledWith(
      2,
      'aws',
      ['ec2', 'authorize-security-group-ingress', '--group-id', 'sg-abc123'],
      expect.any(Object),
    )
  })

  it('cancel() kills the in-flight process', async () => {
    const proc = makeProcess(0)
    proc.kill = vi.fn(() => proc.emit('close', -1))
    mockSpawn.mockReturnValue(proc)
    const engine = new CliEngine(mockWin)
    const p = engine.execute([['ec2', 'create-vpc']])
    engine.cancel()
    await p
    expect(proc.kill).toHaveBeenCalled()
  })
})
