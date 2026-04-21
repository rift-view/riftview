import { useState } from 'react'
import type { CloudNode } from '@riftview/shared'
import type { LambdaEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: LambdaEditParams) => void
}

export default function LambdaEditForm({ node, onChange }: Props): React.JSX.Element {
  const [memory, setMemory] = useState(Number(node.metadata.memorySize) || 128)
  const [timeout, setTimeout] = useState(Number(node.metadata.timeout) || 3)
  const [envStr, setEnvStr] = useState(() => {
    const env = node.metadata.environment as Record<string, string> | undefined
    return env
      ? Object.entries(env)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n')
      : ''
  })

  const parseEnv = (s: string): Record<string, string> =>
    Object.fromEntries(
      s
        .split('\n')
        .filter((l) => l.includes('='))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i), l.slice(i + 1)]
        })
    )

  const emit = (overrides: Partial<LambdaEditParams>): void =>
    onChange({
      resource: 'lambda',
      memorySize: memory,
      timeout,
      environment: parseEnv(envStr),
      ...overrides
    })

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">Memory (MB)</span>
        <input
          className="form-input"
          type="number"
          value={memory}
          onChange={(e) => {
            setMemory(Number(e.target.value))
            emit({ memorySize: Number(e.target.value) })
          }}
        />
      </div>
      <div className="form-field">
        <span className="label">Timeout (s)</span>
        <input
          className="form-input"
          type="number"
          value={timeout}
          onChange={(e) => {
            setTimeout(Number(e.target.value))
            emit({ timeout: Number(e.target.value) })
          }}
        />
      </div>
      <div className="form-field">
        <span className="label">Environment variables (KEY=value, one per line)</span>
        <textarea
          className="form-textarea"
          style={{ minHeight: 60 }}
          value={envStr}
          onChange={(e) => {
            setEnvStr(e.target.value)
            emit({ environment: parseEnv(e.target.value) })
          }}
        />
      </div>
    </div>
  )
}
