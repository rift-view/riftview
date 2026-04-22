import { resolve } from 'node:path'
import { test, expect } from './releaseFixtures'
import type { CloudNode } from '@riftview/shared'

// Tracks RIFT-75 (sub of RIFT-41). Built-binary + LocalStack tier.
//
// Imports a drifted Terraform state from the fixtures tree, asserts the drift
// banner appears, then clicks a live (unmanaged) resource and verifies the
// remediation command preview matches the expected `aws` CLI string.
//
// Target resource is `rv-seed-assets` (S3 bucket) — seeded in LocalStack via
// seed.tf, absent from drifted.tfstate. buildRemediateCommands returns
// buildDeleteCommands for `unmanaged`, which for S3 yields `s3 rb s3://<id>`.
//
// Import path uses the RIFTVIEW_E2E=1 test hatch (`window.riftview.e2eImportTfState`
// + `window.__riftviewE2E.setImportedNodes`) instead of clicking Topbar →
// Import → Terraform. Bypasses the native file dialog, which doesn't play
// nicely with an automated harness on macOS.

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..')
const DRIFTED_TFSTATE_PATH = resolve(
  REPO_ROOT,
  'apps/cli/tests/integration/fixtures/drifted.tfstate'
)

test.describe('@release drift import + remediation preview', () => {
  test('import drifted.tfstate → banner appears → unmanaged S3 shows s3 rb remediation', async ({
    page
  }) => {
    // Wait for the canvas and the initial LocalStack scan.
    const canvas = page.getByTestId('cloud-canvas')
    await expect(canvas).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid^="resource-node-"]').first()).toBeVisible({
      timeout: 45_000
    })

    // Import drifted.tfstate via the E2E hatch. This exercises the same main-process
    // parser (parseTfState) and renderer store action (setImportedNodes → drift
    // analysis in applyDriftToState) that the Topbar "Import → Terraform" click
    // drives — only the native file dialog is skipped.
    await page.evaluate(async (tfstatePath) => {
      const nodes: CloudNode[] = await window.riftview.e2eImportTfState!(tfstatePath)
      window.__riftviewE2E!.setImportedNodes(nodes)
    }, DRIFTED_TFSTATE_PATH)

    // Drift banner should appear — drifted.tfstate declares rv-ghost-bucket
    // (missing in live) and every seed resource is unmanaged.
    const banner = page.getByTestId('drift-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })

    // Click the live rv-seed-assets S3 bucket — live but not in tfstate →
    // driftStatus='unmanaged' → Inspector renders REMEDIATE with delete command.
    const assetsNode = page
      .locator('[data-testid^="resource-node-"]')
      .filter({ hasText: 'rv-seed-assets' })
      .first()
    await expect(assetsNode).toBeVisible({ timeout: 10_000 })
    await assetsNode.click()

    const inspector = page.getByTestId('inspector')
    await expect(inspector).toBeVisible()

    // REMEDIATE section exposes the command preview block. Assert the exact
    // `aws s3 rb s3://rv-seed-assets` form emitted by buildDeleteCommands.
    const remediate = page.getByTestId('inspector-remediate-command')
    await expect(remediate).toBeVisible({ timeout: 10_000 })
    await expect(remediate).toContainText('aws s3 rb s3://rv-seed-assets')
  })
})
