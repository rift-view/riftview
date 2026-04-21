import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { parse } from 'ini'
import type { AwsProfile } from '../types/cloud'

function credentialsPath(): string {
  return path.join(os.homedir(), '.aws', 'credentials')
}

function configPath(): string {
  return path.join(os.homedir(), '.aws', 'config')
}

export function listProfiles(): AwsProfile[] {
  const credPath = credentialsPath()
  if (!fs.existsSync(credPath)) return []

  const raw = fs.readFileSync(credPath, 'utf-8')
  const parsed = parse(raw)
  return Object.keys(parsed).map((name) => ({ name }))
}

export function getDefaultRegion(profileName: string): string {
  const cfgPath = configPath()
  if (!fs.existsSync(cfgPath)) return 'us-east-1'

  const raw = fs.readFileSync(cfgPath, 'utf-8')
  const parsed = parse(raw)

  // config file uses [default] for the default profile, [profile name] for others
  const key = profileName === 'default' ? 'default' : `profile ${profileName}`
  return (parsed[key]?.region as string) ?? 'us-east-1'
}
