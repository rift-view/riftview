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
  let docsRoot: string
  let skillSrc: string

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'rv-bs-'))
    docsRoot = mkdtempSync(join(tmpdir(), 'rv-bs-docs-'))

    // Canonical SKILL.md lives in the (private) docs repo, not the public tree.
    skillSrc = join(docsRoot, 'automation', 'skill')
    mkdirSync(skillSrc, { recursive: true })
    writeFileSync(join(skillSrc, 'SKILL.md'), '---\nname: issue-pipeline\n---\n')

    // Hook template lives in the public repo alongside the hook source.
    mkdirSync(join(repoRoot, 'packages/automation-core/src/hooks'), { recursive: true })
    writeFileSync(
      join(repoRoot, 'packages/automation-core/src/hooks/settings-hooks.template.json'),
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
    rmSync(docsRoot, { recursive: true, force: true })
  })

  it('symlinks skill into .claude/skills/issue-pipeline', () => {
    const result = bootstrap({ repoRoot, skillSrc })
    expect(result.skillLinkedFrom).toBe(skillSrc)
    expect(result.skillLinkedTo).toBe(join(repoRoot, '.claude/skills/issue-pipeline'))
    const stat = lstatSync(result.skillLinkedTo)
    expect(stat.isSymbolicLink()).toBe(true)
  })

  it('writes settings.local.json with the template hook entries when no settings file exists', () => {
    bootstrap({ repoRoot, skillSrc })
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
    const result = bootstrap({ repoRoot, skillSrc })
    const settings = JSON.parse(readFileSync(join(repoRoot, '.claude/settings.local.json'), 'utf8'))
    expect(settings.permissions).toEqual({ allow: ['Bash(ls *)'] })
    expect(settings.hooks.PreToolUse).toHaveLength(2)
    expect(result.settingsHooksBefore).toBe(1)
    expect(result.settingsHooksAfter).toBe(2)
  })

  it('replaces an existing symlink at the destination', () => {
    bootstrap({ repoRoot, skillSrc })
    const first = lstatSync(join(repoRoot, '.claude/skills/issue-pipeline'))
    expect(first.isSymbolicLink()).toBe(true)
    expect(() => bootstrap({ repoRoot, skillSrc })).not.toThrow()
  })

  it('dry-run does not touch the filesystem', () => {
    bootstrap({ repoRoot, skillSrc, dryRun: true })
    expect(existsSync(join(repoRoot, '.claude'))).toBe(false)
  })

  it('throws a clear error when SKILL.md is missing from the docs repo', () => {
    const missingSkillSrc = join(docsRoot, 'missing', 'skill')
    expect(() => bootstrap({ repoRoot, skillSrc: missingSkillSrc })).toThrow(
      /SKILL\.md not found at/
    )
  })

  it('honours RIFTVIEW_DOCS_DIR when skillSrc is not passed explicitly', () => {
    const prev = process.env.RIFTVIEW_DOCS_DIR
    process.env.RIFTVIEW_DOCS_DIR = docsRoot
    try {
      const result = bootstrap({ repoRoot })
      expect(result.skillLinkedFrom).toBe(skillSrc)
    } finally {
      if (prev === undefined) delete process.env.RIFTVIEW_DOCS_DIR
      else process.env.RIFTVIEW_DOCS_DIR = prev
    }
  })
})
