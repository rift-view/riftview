import { test, expect } from './releaseFixtures'

// Tracks RIFT-74 (sub of RIFT-41). Built-binary + LocalStack tier.
//
// Exercises the full CRUD loop via the UI:
//   1. Right-click canvas → context-menu → "New SQS Queue" → CreateModal
//   2. Submit → post-create scan surfaces the new queue
//   3. Inspector Edit → EditModal → change visibility timeout → Save
//   4. Inspector Delete → DeleteDialog → CommandDrawer Run → gone
//
// Runs only against LocalStack — `releaseFixtures` pins AWS_ENDPOINT_URL to
// http://localhost:4566 and loads a throwaway profile from a temp $HOME.

const QUEUE_NAME = 'rv-crud-test'

test.describe('@release CRUD roundtrip: create + edit + delete SQS', () => {
  // Three post-* scans (create, edit, delete) plus LocalStack cold-start can
  // push this past the 30s default. 120s matches the "<90s" acceptance target
  // with headroom.
  test.setTimeout(120_000)

  test('create via CreateModal, edit, delete — node disappears on final scan', async ({ page }) => {
    // Wait for the initial scan to populate seed resources so the canvas has
    // something to measure "the queue appeared" against.
    const canvas = page.getByTestId('cloud-canvas')
    await expect(canvas).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid^="resource-node-"]').first()).toBeVisible({
      timeout: 45_000
    })

    // ── CREATE ────────────────────────────────────────────────────────────
    // Right-click an empty area of the canvas near the top-left. A safe
    // offset that rarely lands on a seeded node.
    await canvas.click({ button: 'right', position: { x: 40, y: 80 } })

    const contextMenu = page.getByTestId('canvas-context-menu')
    await expect(contextMenu).toBeVisible()
    await page.getByTestId('canvas-context-menu-item-sqs').click()
    await page.getByTestId('canvas-context-menu-view-topology').click()

    // CreateModal opens with SqsForm. Fill name, submit.
    const createModal = page.getByTestId('create-modal')
    await expect(createModal).toBeVisible()
    await page.getByTestId('sqs-form-name').fill(QUEUE_NAME)
    await page.getByTestId('create-modal-submit').click()

    // Post-create scan: the new queue surfaces as a resource node.
    // Match strictly on the real SQS ARN testid to exclude the transient
    // optimistic node (data-testid="resource-node-optimistic-<timestamp>")
    // that CreateModal inserts before the scan returns. Both can coexist
    // for a few hundred ms; strict locators on the real ARN are stable.
    const queueNode = page.getByTestId(
      new RegExp(`^resource-node-arn:aws:sqs:[^:]+:[^:]+:${QUEUE_NAME}$`)
    )
    await expect(queueNode).toBeVisible({ timeout: 45_000 })

    // ── EDIT ──────────────────────────────────────────────────────────────
    await queueNode.click()
    const inspector = page.getByTestId('inspector')
    await expect(inspector).toBeVisible()
    await page.getByTestId('inspector-edit').click()

    const editModal = page.getByTestId('edit-modal')
    await expect(editModal).toBeVisible()
    await page.getByTestId('sqs-edit-form-visibility-timeout').fill('90')
    await page.getByTestId('edit-modal-submit').click()

    // EditModal closes only after the Save CLI resolves (see EditModal.handleRun —
    // onClose is gated on `result.code === 0`). Wait for it to detach before
    // clicking back on the canvas, otherwise the backdrop intercepts pointer events.
    await expect(editModal).toBeHidden({ timeout: 30_000 })

    // Post-edit scan: the node is still present.
    await expect(queueNode).toBeVisible({ timeout: 45_000 })

    // ── DELETE ────────────────────────────────────────────────────────────
    // Re-select (the scan may have cleared the selection in the Inspector).
    await queueNode.click()
    await expect(inspector).toBeVisible()
    await page.getByTestId('inspector-delete').click()

    const deleteDialog = page.getByTestId('delete-dialog')
    await expect(deleteDialog).toBeVisible()

    // DeleteDialog requires typing the node.id verbatim. For SQS the id is the
    // LocalStack queue URL (e.g. http://localhost:4566/000000000000/rv-crud-test),
    // which varies by LocalStack version. Read it from the input placeholder
    // rather than hardcoding.
    const confirmInput = page.getByTestId('delete-dialog-confirm-input')
    const queueId = await confirmInput.getAttribute('placeholder')
    expect(queueId, 'DeleteDialog placeholder should expose node.id').toBeTruthy()
    await confirmInput.fill(queueId!)
    await page.getByTestId('delete-dialog-confirm').click()

    // The DeleteDialog closes and CommandDrawer shows the pending delete with
    // a Run button. Click Run to actually execute the delete against LocalStack.
    const runBtn = page.getByTestId('command-drawer-run')
    await expect(runBtn).toBeVisible({ timeout: 5_000 })
    await runBtn.click()

    // Post-delete scan: queue is gone.
    await expect(queueNode).toHaveCount(0, { timeout: 45_000 })
  })
})
