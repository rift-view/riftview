import { test, expect } from './releaseFixtures'

// Tracks RIFT-76 (sub of RIFT-41). Built-binary + LocalStack tier.
//
// After the initial seed scan, Inspector renders FirstScanSummary → TOP RISKS.
// seed.tf's `rv-seed-web` SG opens port 80 to 0.0.0.0/0, which our advisor
// analyzer reports as a critical risk. Clicking the first top-risk row should
// select the underlying resource node; the Inspector transitions from the
// TopRisks panel to the per-node panel (label appears).

test.describe('@release Top Risks panel', () => {
  test('risks populate after scan; clicking a risk selects its node', async ({ page }) => {
    // Wait for the canvas and at least one resource node to land.
    const canvas = page.getByTestId('cloud-canvas')
    await expect(canvas).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid^="resource-node-"]').first()).toBeVisible({
      timeout: 45_000
    })

    // With no selection, Inspector renders FirstScanSummary → Top Risks.
    const inspector = page.getByTestId('inspector')
    await expect(inspector).toBeVisible()

    const topRisksPanel = page.getByTestId('top-risks-panel')
    await expect(topRisksPanel).toBeVisible({ timeout: 15_000 })

    // At least one risk item. Seed SG ingress 0.0.0.0/0 reliably triggers one.
    const firstRisk = page.getByTestId('top-risks-item-0')
    await expect(firstRisk).toBeVisible({ timeout: 10_000 })

    // Snapshot the risks-panel state so we can assert it goes away after click.
    expect(await page.getByTestId('top-risks-panel').count()).toBeGreaterThan(0)

    // Click the risk → selectNode(advisory.nodeId) → Inspector re-renders for
    // the selected node. The TopRisks panel is gone, and a node label is now
    // visible in the Inspector (we don't know which node exactly, so assert
    // against the set of seed labels that can back an advisory).
    await firstRisk.click()

    await expect(page.getByTestId('top-risks-panel')).toHaveCount(0, { timeout: 5_000 })

    // Positive: some seed node label appears in the Inspector text. The seed
    // advisors run against named resources; one of these labels must surface.
    await expect
      .poll(async () => (await inspector.textContent()) ?? '', { timeout: 5_000 })
      .toMatch(/rv-seed-/)
  })
})
