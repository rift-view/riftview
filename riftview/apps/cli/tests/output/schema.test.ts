import { describe, it, expect, expectTypeOf } from 'vitest'
import { SCHEMA_VERSION, type ScanOutput } from '../../cli/output/schema'

describe('output schema', () => {
  it('freezes SCHEMA_VERSION at 1', () => {
    expect(SCHEMA_VERSION).toBe(1)
  })

  it('types ScanOutput.schemaVersion as the literal 1', () => {
    expectTypeOf<ScanOutput['schemaVersion']>().toEqualTypeOf<1>()
  })

  it('types ScanOutput.command as the literal "scan"', () => {
    expectTypeOf<ScanOutput['command']>().toEqualTypeOf<'scan'>()
  })
})
