import { test, expect } from './fixtures'

// Boot Electron with VITE_DEMO_MODE=1 so useDemoFixture seeds the store
// with 3 CloudNodes (i-demo-web, demo-api, demo-assets). App.tsx's
// Onboarding early-return is bypassed in demo mode, so the main canvas
// renders even when no AWS profile is present.
test.use({ appLaunchOptions: { demoMode: true } })

test.describe('demo-mode scan', () => {
  test('canvas renders fixture nodes; Inspector opens on node click', async ({ page }) => {
    // The canvas mount is up.
    const canvas = page.getByTestId('cloud-canvas')
    await expect(canvas).toBeVisible({ timeout: 10_000 })

    // At least one resource-node-* testid is rendered (3 seeded by fixture).
    const anyNode = page.locator('[data-testid^="resource-node-"]').first()
    await expect(anyNode).toBeVisible({ timeout: 10_000 })

    const allNodes = page.locator('[data-testid^="resource-node-"]')
    expect(await allNodes.count()).toBeGreaterThan(0)

    // Click the first node.
    await anyNode.click()

    // Inspector panel is visible.
    const inspector = page.getByTestId('inspector')
    await expect(inspector).toBeVisible()

    // Positive assertion: the clicked node's label appears somewhere in the
    // Inspector content. This confirms the Inspector rendered the selection,
    // not just that the panel is mounted.
    //
    // We don't know which node was clicked (Playwright's .first() may pick
    // any depending on DOM order), so we assert that AT LEAST ONE of the
    // three fixture labels is present in the Inspector.
    await expect
      .poll(
        async () => {
          const text = await inspector.textContent()
          return text ?? ''
        },
        { timeout: 5_000 }
      )
      .toMatch(/demo-web|demo-api|demo-assets/)
  })
})
