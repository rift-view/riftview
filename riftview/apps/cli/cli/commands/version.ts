import type { Command } from 'commander'
import { PKG_VERSION, PKG_COMMIT, PKG_BUILD_DATE } from '../version-constant'

export interface VersionOutput {
  schemaVersion: 1
  command: 'version'
  version: string
  commit: string
  buildDate: string
  node: string
}

function buildOutput(): VersionOutput {
  return {
    schemaVersion: 1,
    command: 'version',
    version: PKG_VERSION,
    commit: PKG_COMMIT,
    buildDate: PKG_BUILD_DATE,
    node: process.version
  }
}

// commander's configureOutput is the only public hook for routing writes;
// read it off the program instance through a minimal structural cast.
function writeOut(program: Command, text: string): void {
  const cfg = (
    program as unknown as {
      _outputConfiguration: { writeOut: (s: string) => void }
    }
  )._outputConfiguration
  cfg.writeOut(text)
}

export function registerVersion(program: Command): void {
  program
    .command('version')
    .description('print version info')
    .action(() => {
      const output = buildOutput()
      const format = (program.opts().output as string) ?? 'pretty'
      if (format === 'json') {
        writeOut(program, JSON.stringify(output, null, 2))
      } else {
        const lines = [
          `riftview ${output.version}`,
          `  commit:     ${output.commit}`,
          `  built:      ${output.buildDate}`,
          `  node:       ${output.node}`
        ]
        writeOut(program, lines.join('\n') + '\n')
      }
    })
}
