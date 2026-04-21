import { test, expect } from './releaseFixtures'

test.describe('@release scan against LocalStack', () => {
  test('built binary scans seeded LocalStack; Inspector opens on node click', async ({ page }) => {
    // LocalStack was seeded by the e2e job before this test ran (terraform
    // apply against .../integration/fixtures/seed.tf from M3). We expect
    // to see the seeded resources as scan nodes: rv-seed-web (ec2),
    // rv-seed-api (lambda), rv-seed-assets (s3), rv-seed-vpc (vpc), etc.

    // Wait for the canvas mount.
    const canvas = page.getByTestId('cloud-canvas')
    await expect(canvas).toBeVisible({ timeout: 15_000 })

    // Wait for the first scan to populate the graph. LocalStack can take
    // a few seconds to answer the SDK calls; give it a generous window.
    const anyNode = page.locator('[data-testid^="resource-node-"]').first()
    await expect(anyNode).toBeVisible({ timeout: 45_000 })

    // Verify multiple nodes rendered (the seed has ec2, lambda, s3, etc.).
    const allNodes = page.locator('[data-testid^="resource-node-"]')
    const count = await allNodes.count()
    expect(count).toBeGreaterThan(2)

    // Find the Lambda node specifically — seed.tf creates rv-seed-api.
    const lambdaNode = page
      .locator('[data-testid^="resource-node-"]')
      .filter({ hasText: 'rv-seed-api' })
      .first()

    await expect(lambdaNode).toBeVisible({ timeout: 10_000 })

    // Click the Lambda node.
    await lambdaNode.click()

    // Inspector opens.
    const inspector = page.getByTestId('inspector')
    await expect(inspector).toBeVisible()

    // Positive assertion: Inspector content mentions the lambda's label
    // (proves the Inspector rendered this specific node, not just mounted).
    await expect
      .poll(async () => (await inspector.textContent()) ?? '', { timeout: 5_000 })
      .toMatch(/rv-seed-api/)
  })
})
