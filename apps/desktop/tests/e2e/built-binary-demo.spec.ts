import { test, expect } from './demoReleaseFixtures'

// @release-mac tag so the mac matrix entry picks this up via --grep.
// Also picks up the @release tag so Linux matrix (--grep @release)
// runs it too — Linux gets both this smoke and the LocalStack-backed
// scan-blast-radius spec.
test.describe('@release @release-mac built binary boots in demo mode', () => {
  test('packaged SQLite persists and reopens a database using the Electron ABI', async ({
    app
  }) => {
    const result = await app.evaluate(({ app }) => {
      // Inspector evaluation has no dynamic-import callback. Electron's Node
      // runtime exposes builtins without relying on a module-local require.
      const { createRequire } = process.getBuiltinModule('node:module')
      const { mkdtempSync, rmSync } = process.getBuiltinModule('node:fs')
      const { tmpdir } = process.getBuiltinModule('node:os')
      const { join } = process.getBuiltinModule('node:path')
      // Resolve from app.asar, never from the workspace's Node-ABI module.
      const requireApp = createRequire(join(app.getAppPath(), 'package.json'))
      const Database = requireApp('better-sqlite3')
      const dir = mkdtempSync(join(tmpdir(), 'rv-packaged-sqlite-'))
      const file = join(dir, 'probe.db')
      try {
        const db = new Database(file)
        try {
          db.exec('CREATE TABLE probe (value TEXT NOT NULL)')
          db.prepare('INSERT INTO probe VALUES (?)').run('persisted')
        } finally {
          db.close()
        }
        const reopened = new Database(file)
        try {
          return reopened.prepare('SELECT value FROM probe').get()
        } finally {
          reopened.close()
        }
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
    expect(result).toEqual({ value: 'persisted' })
  })

  test('canvas renders fixture nodes; Inspector opens on click', async ({ page }) => {
    const canvas = page.getByTestId('cloud-canvas')
    await expect(canvas).toBeVisible({ timeout: 20_000 })

    const anyNode = page.locator('[data-testid^="resource-node-"]').first()
    await expect(anyNode).toBeVisible({ timeout: 15_000 })

    const allNodes = page.locator('[data-testid^="resource-node-"]')
    expect(await allNodes.count()).toBeGreaterThan(0)

    await anyNode.click()

    const inspector = page.getByTestId('inspector')
    await expect(inspector).toBeVisible()

    // Demo fixture seeds three nodes (demo-web, demo-api, demo-assets);
    // whichever one was clicked should show its label in the panel.
    await expect
      .poll(async () => (await inspector.textContent()) ?? '', { timeout: 5_000 })
      .toMatch(/demo-web|demo-api|demo-assets/)
  })
})
