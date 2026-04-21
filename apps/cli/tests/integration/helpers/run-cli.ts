import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Resolve the built CLI bundle from the repo root regardless of cwd.
// The integration suite ALWAYS exec's the built bundle — never the
// tsx/dev entry — so we exercise the same artifact users install.
const CLI_BIN = resolve(__dirname, '..', '..', '..', 'out', 'index.js')

export function cliBinPath(): string {
  return CLI_BIN
}

export interface CliResult {
  status: number
  stdout: string
  stderr: string
}

export function runCli(args: string[], env: NodeJS.ProcessEnv = {}): CliResult {
  if (!existsSync(CLI_BIN)) {
    throw new Error(
      `CLI bundle not found at ${CLI_BIN}. Run \`npm run build:cli\` before the integration suite.`
    )
  }

  const result = spawnSync('node', [CLI_BIN, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      // LocalStack static credentials — never touch real AWS from this suite.
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
      AWS_REGION: 'us-east-1',
      AWS_ENDPOINT_URL: 'http://localhost:4566',
      ...env
    },
    timeout: 25_000
  })

  if (result.error) {
    throw result.error
  }

  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  }
}
