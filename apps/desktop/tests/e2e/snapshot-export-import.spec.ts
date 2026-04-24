import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from './releaseFixtures'
import type { SnapshotFileV1 } from '../../src/main/history/snapshotFile'
import type { CloudNode } from '@riftview/shared'

// RIFT-35 closer. Built-binary + LocalStack tier.
//
// Exercises the full CLI ↔ desktop snapshot bridge (RIFT-40) through the real
// Topbar UI and real IPC surface:
//   1. Initial scan → capture the fingerprint of the just-written snapshot
//      (the set of node ids the scanner persisted to SQLite).
//   2. Stub `dialog.showSaveDialog` in main → click Export → Snapshot.
//      Assert the written file parses as SnapshotFileV1 and its node id set
//      equals the pre-export snapshot fingerprint (proves export marshalled
//      the stored snapshot into the on-disk schema losslessly).
//   3. Wipe the snapshot history DB via deleteSnapshot(IPC) so the import
//      has a clean slate to repopulate.
//   4. Stub `dialog.showOpenDialog` in main → click Import → Snapshot.
//      Assert history now contains a snapshot whose nodes reproduce the
//      pre-export fingerprint (proves import round-trips the file back into
//      the store).
//
// We fingerprint the SQLite-backed snapshot rather than the canvas DOM
// because TopologyView renders VPC / Subnet nodes as React Flow group
// containers, not as `resource-node-*` testids — a DOM fingerprint would be
// lossy and the roundtrip assertion would fail against the full node set
// that actually lives in the snapshot payload.
//
// Native file dialogs block the main process and do not resolve headless, so
// `electronApp.evaluate(...)` monkey-patches `dialog.showSaveDialog` /
// `dialog.showOpenDialog` for the duration of the test. Export/import still
// flow through the real IPC path; only the user-interaction surface is swapped.

test.describe('@release snapshot export + import roundtrip', () => {
  // Initial scan (cold-start LocalStack) + two IPC-driven file ops fit
  // comfortably under 90s in practice; 120s matches the sibling @release
  // specs' headroom budget.
  test.setTimeout(120_000)

  test('export writes the live snapshot; import repopulates from the file', async ({
    app,
    page
  }) => {
    // Deterministic tmp path for the stubbed save/open dialogs. Unique per
    // run so rerun-on-failure does not observe stale files.
    const exportPath = join(tmpdir(), `rv-e2e-snapshot-${Date.now()}.json`)

    try {
      // Wait for canvas + first scan so there is something to export.
      const canvas = page.getByTestId('cloud-canvas')
      await expect(canvas).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('[data-testid^="resource-node-"]').first()).toBeVisible({
        timeout: 45_000
      })

      // Silence the auto-scan timer so a mid-test cycle cannot race the
      // delete/import ordering below. setSettings is the production hook —
      // no test-only IPC involved.
      await page.evaluate(async () => {
        const current = await window.riftview.getSettings()
        await window.riftview.setSettings({ ...current, scanInterval: 'manual' })
      })

      // Wait for the scanner to persist its first snapshot — writeSnapshotSafe
      // runs at the tail of each scan cycle, so listSnapshots() goes from []
      // to a 1-entry list shortly after the canvas surfaces resource nodes.
      await expect
        .poll(async () => (await page.evaluate(() => window.riftview.listSnapshots())).length, {
          timeout: 15_000,
          intervals: [100, 250, 500]
        })
        .toBeGreaterThan(0)

      // Fingerprint the snapshot the scanner just wrote (source of truth for
      // the export payload).
      const fingerprint = await page.evaluate(async () => {
        const rows = await window.riftview.listSnapshots()
        const snap = await window.riftview.readSnapshot(rows[0].id)
        return snap ? [...new Set(snap.nodes.map((n) => n.id))].sort() : []
      })
      expect(fingerprint.length, 'scanner should have persisted at least one node').toBeGreaterThan(
        0
      )

      // ── EXPORT ────────────────────────────────────────────────────────────
      // Monkey-patch showSaveDialog in the main process so the button click
      // below writes deterministically to `exportPath` instead of blocking on
      // a native picker.
      await app.evaluate(async ({ dialog }, filePath) => {
        const d = dialog as unknown as { showSaveDialog: unknown }
        d.showSaveDialog = async () => ({ canceled: false, filePath })
      }, exportPath)

      await page.getByTestId('topbar-export').click()
      await page.getByTestId('topbar-export-snapshot').click()

      // Export resolves via async IPC; poll until the file lands rather than
      // racing on a toast that auto-clears after 2.5s.
      await expect
        .poll(() => existsSync(exportPath), { timeout: 15_000, intervals: [100, 250, 500] })
        .toBe(true)

      const fileRaw = readFileSync(exportPath, 'utf-8')
      const parsed = JSON.parse(fileRaw) as SnapshotFileV1
      expect(parsed.schemaVersion).toBe(1)
      expect(parsed.command).toBe('scan')
      expect(Array.isArray(parsed.nodes)).toBe(true)

      const exportedIds = [...new Set((parsed.nodes as CloudNode[]).map((n) => n.id))].sort()
      expect(
        exportedIds,
        'exported file should carry the same node set as the stored snapshot'
      ).toEqual(fingerprint)

      // ── CLEAR STATE ───────────────────────────────────────────────────────
      // Delete every row in the snapshot history DB so the upcoming import
      // is the sole source of any snapshot entry. Scanner is already paused
      // above, so nothing will race this.
      await page.evaluate(async () => {
        const rows = await window.riftview.listSnapshots()
        for (const row of rows) {
          await window.riftview.deleteSnapshot(row.id)
        }
      })

      const afterClear = await page.evaluate(() => window.riftview.listSnapshots())
      expect(afterClear, 'history DB should be empty before import').toHaveLength(0)

      // ── IMPORT ────────────────────────────────────────────────────────────
      await app.evaluate(async ({ dialog }, filePath) => {
        const d = dialog as unknown as { showOpenDialog: unknown }
        d.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
      }, exportPath)

      await page.getByTestId('topbar-import').click()
      await page.getByTestId('topbar-import-snapshot').click()

      // Wait for the import handler to land the snapshot in history. Poll on
      // the listSnapshots count rather than the toast so we do not depend on
      // UI timing.
      await expect
        .poll(async () => (await page.evaluate(() => window.riftview.listSnapshots())).length, {
          timeout: 15_000,
          intervals: [100, 250, 500]
        })
        .toBeGreaterThan(0)

      const importedIds = await page.evaluate(async () => {
        const rows = await window.riftview.listSnapshots()
        const snap = await window.riftview.readSnapshot(rows[0].id)
        return snap ? snap.nodes.map((n) => n.id) : []
      })
      expect(
        [...new Set(importedIds)].sort(),
        'imported snapshot should reproduce the pre-export node set'
      ).toEqual(fingerprint)
    } finally {
      if (existsSync(exportPath)) rmSync(exportPath, { force: true })
    }
  })
})
