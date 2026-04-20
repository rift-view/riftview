import { describe, it, expect } from 'vitest'
import { buildProgram } from '../../cli/index'

describe('version command', () => {
  it('emits JSON with schemaVersion=1 when --output json', async () => {
    const program = buildProgram()
    const logs: string[] = []
    program.configureOutput({
      writeOut: (s) => logs.push(s),
      writeErr: () => {}
    })
    await program.parseAsync(['node', 'riftview', 'version', '--output', 'json'])
    const payload = JSON.parse(logs.join(''))
    expect(payload).toMatchObject({
      schemaVersion: 1,
      command: 'version'
    })
    expect(typeof payload.version).toBe('string')
    expect(typeof payload.node).toBe('string')
  })

  it('emits human-readable text when --output pretty (default)', async () => {
    const program = buildProgram()
    const logs: string[] = []
    program.configureOutput({
      writeOut: (s) => logs.push(s),
      writeErr: () => {}
    })
    await program.parseAsync(['node', 'riftview', 'version'])
    const output = logs.join('')
    expect(output).toMatch(/riftview/i)
    expect(output).not.toMatch(/^\{/) // not JSON
  })

  it('--version flag emits same data as version subcommand', async () => {
    const flagProgram = buildProgram()
    const subProgram = buildProgram()
    const flagLogs: string[] = []
    const subLogs: string[] = []
    flagProgram.configureOutput({
      writeOut: (s) => flagLogs.push(s),
      writeErr: () => {}
    })
    subProgram.configureOutput({
      writeOut: (s) => subLogs.push(s),
      writeErr: () => {}
    })
    // commander's --version exits via process.exit; suppress by overriding exitOverride
    flagProgram.exitOverride(() => {
      throw new Error('__version_exit__')
    })
    try {
      await flagProgram.parseAsync(['node', 'riftview', '--version'])
    } catch (e) {
      if ((e as Error).message !== '__version_exit__') throw e
    }
    await subProgram.parseAsync(['node', 'riftview', 'version'])

    const flagVersion = flagLogs.join('').trim()
    const subOutput = subLogs.join('')
    // Both should contain the same version string
    expect(subOutput).toContain(flagVersion)
  })
})
