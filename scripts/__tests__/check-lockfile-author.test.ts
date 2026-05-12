import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const SCRIPT = resolve(__dirname, '..', 'check-lockfile-author.sh')

function run(email: string): number {
  try {
    execFileSync('bash', [SCRIPT, email], { stdio: 'pipe' })
    return 0
  } catch (err: unknown) {
    return (err as { status: number }).status
  }
}

describe('check-lockfile-author', () => {
  describe('bot emails → exit 0', () => {
    const bots = [
      '29139614+renovate[bot]@users.noreply.github.com',
      'renovate[bot]@users.noreply.github.com',
      '49699333+dependabot[bot]@users.noreply.github.com',
      'dependabot[bot]@users.noreply.github.com',
      '41898282+github-actions[bot]@users.noreply.github.com',
      'github-actions[bot]@users.noreply.github.com'
    ]

    for (const email of bots) {
      it(email, () => {
        expect(run(email)).toBe(0)
      })
    }
  })

  describe('human emails → exit 1', () => {
    const humans = [
      'dev@example.com',
      'juliusrhamm@gmail.com',
      '173939123+juliushamm@users.noreply.github.com',
      'noreply@github.com'
    ]

    for (const email of humans) {
      it(email, () => {
        expect(run(email)).toBe(1)
      })
    }
  })

  describe('edge cases → exit 1', () => {
    it('empty string', () => {
      expect(run('')).toBe(1)
    })

    it('partial match — missing [bot] suffix', () => {
      expect(run('renovate@users.noreply.github.com')).toBe(1)
    })

    it('partial match — wrong domain', () => {
      expect(run('renovate[bot]@github.com')).toBe(1)
    })

    it('injection attempt — prefix with valid bot', () => {
      expect(run('evil@example.com renovate[bot]@users.noreply.github.com')).toBe(1)
    })
  })
})
