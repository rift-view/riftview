import { spawn, ChildProcess } from 'child_process'
import type { BrowserWindow } from 'electron'
import { IPC } from '../ipc/channels'

export interface ExitResult {
  code: number
}

// Parses "GroupId" from JSON stdout of create-security-group.
// Returns null if stdout is not valid JSON or has no GroupId.
function extractGroupId(stdout: string): string | null {
  try {
    const parsed = JSON.parse(stdout.trim())
    return typeof parsed?.GroupId === 'string' ? parsed.GroupId : null
  } catch {
    return null
  }
}

export class CliEngine {
  private currentProcess: ChildProcess | null = null

  constructor(private win: BrowserWindow) {}

  /**
   * Runs commands sequentially. Stops chain on first non-zero exit.
   * After each command, extracts GroupId from stdout and substitutes
   * `{GroupId}` placeholder in subsequent argv arrays (for SG authorize).
   * Sends cli:done once when the chain ends (success or failure).
   */
  async execute(commandChain: string[][]): Promise<ExitResult> {
    let groupId: string | null = null

    for (const rawArgv of commandChain) {
      const argv = groupId
        ? rawArgv.map((arg) => (arg === '{GroupId}' ? groupId! : arg))
        : rawArgv

      const result = await this.runOne(argv)

      if (result.code !== 0) {
        this.win.webContents.send(IPC.CLI_DONE, { code: result.code })
        return { code: result.code }
      }

      // Try to parse GroupId for use in subsequent commands
      const parsed = extractGroupId(result.stdout)
      if (parsed) groupId = parsed
    }

    this.win.webContents.send(IPC.CLI_DONE, { code: 0 })
    return { code: 0 }
  }

  cancel(): void {
    this.currentProcess?.kill()
    this.currentProcess = null
  }

  private runOne(argv: string[]): Promise<{ code: number; stdout: string }> {
    return new Promise((resolve) => {
      const proc = spawn('aws', argv, { shell: false })
      this.currentProcess = proc
      let stdoutBuffer = ''

      proc.stdout.on('data', (chunk: Buffer) => {
        const str = chunk.toString()
        stdoutBuffer += str
        for (const line of str.split('\n').filter(Boolean)) {
          this.win.webContents.send(IPC.CLI_OUTPUT, { line, stream: 'stdout' })
        }
      })

      proc.stderr.on('data', (chunk: Buffer) => {
        for (const line of chunk.toString().split('\n').filter(Boolean)) {
          this.win.webContents.send(IPC.CLI_OUTPUT, { line, stream: 'stderr' })
        }
      })

      proc.on('error', () => {
        this.currentProcess = null
        resolve({ code: 1, stdout: stdoutBuffer })
      })

      proc.on('close', (code) => {
        this.currentProcess = null
        resolve({ code: code ?? 1, stdout: stdoutBuffer })
      })
    })
  }
}
