import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  lstatSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootstrap } from '../bin/bootstrap'

describe('bootstrap', () => {
  let repoRoot: string

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'rv-bs-'))
    // Set up a fake skill dir with a template
    mkdirSync(join(repoRoot, 'packages/automation-core/skill'), { recursive: true })
    writeFileSync(
      join(repoRoot, 'packages/automation-core/skill/SKILL.md'),
      '---\nname: issue-pipeline\n---\n'
    )
    writeFileSync(
      join(repoRoot, 'packages/automation-core/skill/settings-hooks.template.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Write|Edit',
              hooks: [{ type: 'command', command: 'node check-path.js' }]
            }
          ]
        }
      })
    )
  })

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true })
  })

  it('symlinks skill into .claude/skills/issue-pipeline', () => {
    const result = bootstrap({ repoRoot })
    expect(result.skillLinkedTo).toBe(join(repoRoot, '.claude/skills/issue-pipeline'))
    const stat = lstatSync(result.skillLinkedTo)
    expect(stat.isSymbolicLink()).toBe(true)
  })

  it('writes settings.local.json with the template hook entries when no settings file exists', () => {
    bootstrap({ repoRoot })
    const settings = JSON.parse(readFileSync(join(repoRoot, '.claude/settings.local.json'), 'utf8'))
    expect(settings.hooks.PreToolUse).toHaveLength(1)
    expect(settings.hooks.PreToolUse[0].matcher).toBe('Write|Edit')
  })

  it('merges template hook entries into an existing settings.local.json without clobbering', () => {
    mkdirSync(join(repoRoot, '.claude'), { recursive: true })
    writeFileSync(
      join(repoRoot, '.claude/settings.local.json'),
      JSON.stringify({
        permissions: { allow: ['Bash(ls *)'] },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'node check-bash.js' }]
            }
          ]
        }
      })
    )
    const result = bootstrap({ repoRoot })
    const settings = JSON.parse(readFileSync(join(repoRoot, '.claude/settings.local.json'), 'utf8'))
    expect(settings.permissions).toEqual({ allow: ['Bash(ls *)'] })
    expect(settings.hooks.PreToolUse).toHaveLength(2)
    expect(result.settingsHooksBefore).toBe(1)
    expect(result.settingsHooksAfter).toBe(2)
  })

  it('replaces an existing symlink at the destination', () => {
    // Simulate a prior bootstrap run
    bootstrap({ repoRoot })
    const first = lstatSync(join(repoRoot, '.claude/skills/issue-pipeline'))
    expect(first.isSymbolicLink()).toBe(true)
    // Second run should not throw
    expect(() => bootstrap({ repoRoot })).not.toThrow()
  })

  it('dry-run does not touch the filesystem', () => {
    bootstrap({ repoRoot, dryRun: true })
    expect(existsSync(join(repoRoot, '.claude'))).toBe(false)
  })
})
