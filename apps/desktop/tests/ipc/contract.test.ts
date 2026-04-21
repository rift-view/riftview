import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { IPC } from '../../src/main/ipc/channels'

// Roots scanned for IPC.X references.
const REPO_DESKTOP = path.resolve(__dirname, '..', '..')
const MAIN_SRC = path.join(REPO_DESKTOP, 'src', 'main')
const PRELOAD_SRC = path.join(REPO_DESKTOP, 'src', 'preload', 'index.ts')

// Recursively collect .ts and .tsx files under a directory.
function walkTsFiles(dir: string): string[] {
  const out: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full))
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      out.push(full)
    }
  }
  return out
}

// Extract every `IPC.CHANNEL_NAME` reference from a chunk of source text.
// Matches `IPC.PROFILES_LIST` and `IPC.TERMINAL_OUTPUT` but not `WPIPC.FOO`.
function extractIpcRefs(source: string): Set<string> {
  const refs = new Set<string>()
  for (const match of source.matchAll(/(?<![A-Za-z0-9_$])IPC\.([A-Z_][A-Z0-9_]*)/g)) {
    refs.add(match[1])
  }
  return refs
}

function collectIpcRefsInTree(rootDir: string): Set<string> {
  const refs = new Set<string>()
  for (const file of walkTsFiles(rootDir)) {
    // Don't self-reference — channels.ts defines IPC, it doesn't "use" it.
    if (file.endsWith(path.join('main', 'ipc', 'channels.ts'))) continue
    const source = fs.readFileSync(file, 'utf8')
    for (const ref of extractIpcRefs(source)) refs.add(ref)
  }
  return refs
}

function collectIpcRefsInFile(filePath: string): Set<string> {
  return extractIpcRefs(fs.readFileSync(filePath, 'utf8'))
}

const DECLARED = new Set(Object.keys(IPC))
const MAIN_REFS = collectIpcRefsInTree(MAIN_SRC)
const PRELOAD_REFS = collectIpcRefsInFile(PRELOAD_SRC)

function sortedDiff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => !b.has(x)).sort()
}

describe('IPC contract', () => {
  it('every channel constant is referenced somewhere in src/main/', () => {
    const orphaned = sortedDiff(DECLARED, MAIN_REFS)
    expect(
      orphaned,
      `Channels declared in channels.ts but unused in src/main/ (dead constants): ${orphaned.join(', ')}`
    ).toEqual([])
  })

  it('every channel constant is referenced in src/preload/index.ts', () => {
    const orphaned = sortedDiff(DECLARED, PRELOAD_REFS)
    expect(
      orphaned,
      `Channels declared in channels.ts but unused in preload/index.ts (renderer surface missing): ${orphaned.join(', ')}`
    ).toEqual([])
  })

  it('every IPC reference in src/main/ exists in channels.ts', () => {
    const undeclared = sortedDiff(MAIN_REFS, DECLARED)
    expect(
      undeclared,
      `src/main/ references IPC constants not in channels.ts: ${undeclared.join(', ')}`
    ).toEqual([])
  })

  it('every IPC reference in preload/index.ts exists in channels.ts', () => {
    const undeclared = sortedDiff(PRELOAD_REFS, DECLARED)
    expect(
      undeclared,
      `preload/index.ts references IPC constants not in channels.ts: ${undeclared.join(', ')}`
    ).toEqual([])
  })
})
