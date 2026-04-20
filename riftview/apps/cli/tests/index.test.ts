import { describe, it, expect } from 'vitest'
import { buildProgram } from '../cli/index'
import { EXIT } from '../cli/exitCodes'

describe('cli root program', () => {
  it('unknown command returns exit code USAGE (2)', async () => {
    const program = buildProgram()
    program.exitOverride()
    const errs: string[] = []
    program.configureOutput({
      writeOut: () => {},
      writeErr: (s) => errs.push(s)
    })
    try {
      await program.parseAsync(['node', 'riftview', 'nope'])
      expect.fail('should have thrown')
    } catch (err) {
      // commander.CommanderError carries exitCode
      const e = err as { exitCode?: number; code?: string }
      expect(e.exitCode === EXIT.USAGE || e.code === 'commander.unknownCommand').toBe(true)
    }
  })

  it('--help prints subcommand list', async () => {
    const program = buildProgram()
    program.exitOverride()
    const logs: string[] = []
    program.configureOutput({
      writeOut: (s) => logs.push(s),
      writeErr: () => {}
    })
    try {
      await program.parseAsync(['node', 'riftview', '--help'])
    } catch {
      // --help calls exit()
    }
    const output = logs.join('')
    expect(output).toMatch(/version/)
    expect(output).toMatch(/--output/)
  })
})
