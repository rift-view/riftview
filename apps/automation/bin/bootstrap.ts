#!/usr/bin/env node
import {
  existsSync,
  symlinkSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  lstatSync
} from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export type BootstrapOptions = {
  repoRoot: string
  /**
   * If true, skip actually writing to the filesystem; return what would be done.
   * Tests use this to exercise the logic without touching .claude/.
   */
  dryRun?: boolean
}

export type BootstrapResult = {
  skillLinkedFrom: string
  skillLinkedTo: string
  settingsMergedAt: string
  settingsHooksBefore: number
  settingsHooksAfter: number
}

type HooksShape = {
  hooks?: {
    PreToolUse?: unknown[]
  }
}

export function bootstrap(options: BootstrapOptions): BootstrapResult {
  const root = options.repoRoot
  const skillSrc = resolve(root, 'packages/automation-core/skill')
  const skillDest = resolve(root, '.claude/skills/issue-pipeline')
  const templatePath = resolve(skillSrc, 'settings-hooks.template.json')
  const settingsPath = resolve(root, '.claude/settings.local.json')

  const hooksTemplate = JSON.parse(readFileSync(templatePath, 'utf8')) as HooksShape
  const templateEntries = (hooksTemplate.hooks?.PreToolUse ?? []) as unknown[]

  // Load existing settings.local.json if any.
  const current: HooksShape = existsSync(settingsPath)
    ? (JSON.parse(readFileSync(settingsPath, 'utf8')) as HooksShape)
    : {}
  current.hooks = current.hooks ?? {}
  const existingEntries = (current.hooks.PreToolUse ?? []) as unknown[]
  const mergedEntries = [...existingEntries, ...templateEntries]
  current.hooks.PreToolUse = mergedEntries

  if (!options.dryRun) {
    mkdirSync(dirname(skillDest), { recursive: true })
    if (existsSync(skillDest) || tryLstat(skillDest) !== null) {
      rmSync(skillDest, { recursive: true, force: true })
    }
    symlinkSync(skillSrc, skillDest, 'dir')

    mkdirSync(dirname(settingsPath), { recursive: true })
    writeFileSync(settingsPath, JSON.stringify(current, null, 2) + '\n')
  }

  return {
    skillLinkedFrom: skillSrc,
    skillLinkedTo: skillDest,
    settingsMergedAt: settingsPath,
    settingsHooksBefore: existingEntries.length,
    settingsHooksAfter: mergedEntries.length
  }
}

function tryLstat(path: string): ReturnType<typeof lstatSync> | null {
  try {
    return lstatSync(path)
  } catch {
    return null
  }
}

// CLI entry
const isMain = (() => {
  try {
    return resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')
  } catch {
    return false
  }
})()

if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const result = bootstrap({ repoRoot: root })
  console.log(`Linked ${result.skillLinkedTo} → ${result.skillLinkedFrom}`)
  console.log(
    `Merged hooks into ${result.settingsMergedAt} (${result.settingsHooksBefore} → ${result.settingsHooksAfter} PreToolUse entries)`
  )
  console.log('Done. /work RIFT-N should now be available in Claude Code.')
}
