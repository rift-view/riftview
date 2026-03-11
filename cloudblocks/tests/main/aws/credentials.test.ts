import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('node:os', () => ({
  homedir: vi.fn(),
}))

import * as fs from 'node:fs'
import * as os from 'node:os'
import { listProfiles, getDefaultRegion } from '../../../src/main/aws/credentials'

describe('listProfiles', () => {
  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue('/home/testuser')
  })

  it('returns profiles parsed from credentials file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(`
[default]
aws_access_key_id = AKIA...
aws_secret_access_key = secret

[staging]
aws_access_key_id = AKIA...
aws_secret_access_key = secret
`)
    const profiles = listProfiles()
    expect(profiles.map((p) => p.name)).toEqual(['default', 'staging'])
  })

  it('returns empty array when credentials file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const profiles = listProfiles()
    expect(profiles).toEqual([])
  })
})

describe('getDefaultRegion', () => {
  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue('/home/testuser')
  })

  it('reads region for the default profile', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(`
[default]
region = us-east-1
`)
    expect(getDefaultRegion('default')).toBe('us-east-1')
  })

  it('reads region for a named profile using [profile <name>] key', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(`
[profile staging]
region = eu-west-1
`)
    expect(getDefaultRegion('staging')).toBe('eu-west-1')
  })

  it('returns us-east-1 as fallback when config missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    expect(getDefaultRegion('default')).toBe('us-east-1')
  })
})
