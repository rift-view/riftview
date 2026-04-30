import { test, expect } from './fixtures'

// RIFT-78: Sidebar service chips set draggable={s.hasCreate} but never wired
// onDragStart, so HTML5 default left dataTransfer empty and the drop receivers
// in GraphView / TopologyView silently no-op'd. This spec exercises the drag
// path end-to-end against a service that the right-click context menu does
// NOT cover (SQS), so any regression of the dataTransfer wiring fails the test
// even though the context-menu route happens to work.
//
// Demo mode is sufficient — we only need the Sidebar + canvas mounted and the
// SQS chip rendered. We never actually create the resource; the assertion is
// CreateModal opening with the SQS form, then we cancel.

test.use({ appLaunchOptions: { demoMode: true } })

test.describe('sidebar drag-create', () => {
  test('drag SQS chip onto canvas opens CreateModal with the SQS form', async ({ page }) => {
    const canvas = page.getByTestId('cloud-canvas')
    await expect(canvas).toBeVisible({ timeout: 10_000 })

    // Sidebar categories start expanded — the SQS chip is reachable directly.
    const sqsChip = page.getByTestId('sidebar-service-aws:sqs')
    await expect(sqsChip).toBeVisible({ timeout: 5_000 })

    // Drag the chip onto the canvas. Playwright's locator.dragTo dispatches
    // dragstart on the source and drop on the target with the same
    // dataTransfer object — exactly the path the receiver reads from.
    await sqsChip.dragTo(canvas, {
      targetPosition: { x: 400, y: 300 }
    })

    // CreateModal opens. The SQS form's name input is the load-bearing assert
    // — it's what proves activeCreate.resource resolved to 'sqs' (and not
    // an unrelated form because of a regression in the dataTransfer string).
    const createModal = page.getByTestId('create-modal')
    await expect(createModal).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('sqs-form-name')).toBeVisible()

    // Cancel out — no actual create needed. Demo mode has no AWS endpoint
    // configured anyway; submitting would fail at CLI dispatch.
    await createModal.getByRole('button', { name: 'Cancel' }).click()
    await expect(createModal).toBeHidden({ timeout: 2_000 })
  })
})
