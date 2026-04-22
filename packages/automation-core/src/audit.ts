import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { LinearClient } from './linear'

export type Phase =
  | 'triage'
  | 'meeting-complete'
  | 'dispatch-pending-review'
  | 'executing'
  | 'pr-open'
  | 'ci-green'
  | 'awaiting-merge'
  | 'done'
  | 'halted'
  | 'stale-lock-recovered'
  | 'heartbeat'

export type Status = 'pending' | 'success' | 'error'

const EMOJI: Record<Status, string> = { pending: '🟡', success: '🟢', error: '🔴' }

export async function auditLinear(
  client: LinearClient,
  issueId: string,
  phase: Phase,
  status: Status,
  detail = ''
): Promise<void> {
  const body = `${EMOJI[status]} automation:${phase}${detail ? ' — ' + detail : ''}`
  await client.postComment(issueId, body)
}

export function auditLog(
  logPath: string,
  entry: { ts: string; phase: Phase; status: Status; data?: Record<string, unknown> }
): void {
  mkdirSync(dirname(logPath), { recursive: true })
  appendFileSync(logPath, JSON.stringify(entry) + '\n')
}

export function defaultLogPath(issueId: string, startedAt: Date = new Date()): string {
  const ts = startedAt.toISOString().replace(/[:.]/g, '-')
  return `${process.env.HOME ?? '/tmp'}/.riftview-automation/logs/${issueId}-${ts}.log`
}
