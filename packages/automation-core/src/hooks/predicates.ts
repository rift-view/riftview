import { relative, isAbsolute } from 'node:path'

const BLOCKED_PATH_GLOBS: readonly RegExp[] = [
  /^\.github\/workflows\//,
  /^\.claude\/skills\//,
  /(^|\/)CLAUDE\.md$/,
  /^package-lock\.json$/,
  /^\.env(\..+)?$/,
  /\.pem$/,
  /\.key$/,
  /(^|\/)credentials(\..+)?$/,
  /^apps\/desktop\/src\/main\/capability\.ts$/,
  /^apps\/desktop\/src\/main\/security\//,
  /^build\//,
  /^dist\//,
  /^node_modules\//
]

export function checkPath({
  filePath,
  projectDir = process.cwd()
}: {
  filePath: string
  projectDir?: string
}): { ok: boolean; reason?: string } {
  const p = normalize(filePath, projectDir)
  for (const rx of BLOCKED_PATH_GLOBS) {
    if (rx.test(p)) return { ok: false, reason: `Tier 1 blocked path: ${p} matches ${rx}` }
  }
  return { ok: true }
}

function normalize(filePath: string, projectDir: string): string {
  if (isAbsolute(filePath)) {
    const rel = relative(projectDir, filePath)
    return rel.startsWith('..') ? filePath : rel
  }
  return filePath.replace(/^\.\//, '')
}

const BLOCKED_BASH_RULES: Array<{ rx: RegExp; why: string }> = [
  { rx: /\bgit\s+push\s+origin\s+main\b/, why: 'push to main forbidden' },
  { rx: /\bgit\s+push\s+[^&|;]*--force/, why: '--force/--force-with-lease forbidden on push' },
  { rx: /\bgit\s+reset\s+--hard\b/, why: 'git reset --hard forbidden on published branches' },
  { rx: /\bgit\s+commit\s+[^&|;]*--amend\b/, why: 'git commit --amend after first push forbidden' },
  {
    rx: /\bgit\s+branch\s+-D\s+(main|master|develop)\b/,
    why: 'deleting protected branches forbidden'
  },
  { rx: /--no-verify\b/, why: '--no-verify forbidden (hooks are mandatory)' },
  {
    rx: /\brm\s+-rf\s+(?!dist|build|node_modules|out|\.cache|\.tmp|\.terraform|graphify-out)/,
    why: 'rm -rf restricted to generated/temp paths'
  },
  { rx: /\|\s*(sh|bash)\b/, why: 'piping remote content to a shell forbidden' },
  { rx: />\s*~\/\.ssh\//, why: 'writing to ~/.ssh forbidden' },
  { rx: />\s*~\/\.aws\//, why: 'writing to ~/.aws forbidden' },
  { rx: />\s*~\/\.claude\//, why: 'writing to ~/.claude forbidden' },
  { rx: /~\/\.aws\/credentials/, why: 'touching ~/.aws/credentials forbidden' }
]

export function checkBash({ command }: { command: string }): { ok: boolean; reason?: string } {
  for (const rule of BLOCKED_BASH_RULES) {
    if (rule.rx.test(command))
      return { ok: false, reason: `Tier 1 bash block: ${rule.why} (matched ${rule.rx})` }
  }
  return { ok: true }
}
