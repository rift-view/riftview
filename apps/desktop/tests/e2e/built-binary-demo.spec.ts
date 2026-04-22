import { test, expect } from './demoReleaseFixtures'

// @release-mac tag so the mac matrix entry picks this up via --grep.
// Also picks up the @release tag so Linux matrix (--grep @release)
// runs it too — Linux gets both this smoke and the LocalStack-backed
// scan-blast-radius spec.
test.describe('@release @release-mac built binary boots in demo mode', () => {
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
