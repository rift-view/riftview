import { test, expect } from './fixtures'

test.describe('launch + empty-state onboarding', () => {
  test('app boots with no AWS profile and renders the onboarding', async ({ page }) => {
    // Collect renderer console errors for the duration of the test.
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    // Main window must be visible.
    await expect(page).toHaveTitle(/RiftView/, { timeout: 10_000 })

    // Onboarding surface is rendered when no AWS profile is present.
    // CI has no ~/.aws/credentials, so listProfiles() resolves to [].
    await expect(page.getByTestId('onboarding')).toBeVisible({ timeout: 5_000 })

    // Give the renderer a beat to surface any delayed errors.
    await page.waitForTimeout(500)

    // Known-benign noise to ignore:
    // - devtools / sourcemap warnings on load
    // - autofill service worker warnings
    // - CSP data: URI font violations from bundled @fontsource packages
    //   (fonts are cosmetic; app remains functional, system fallback kicks in)
    // Adjust this filter if a new benign message appears.
    const significantErrors = consoleErrors.filter((e) => {
      if (/DevTools/i.test(e)) return false
      if (/autofill/i.test(e)) return false
      if (/Content Security Policy/i.test(e) && /data:font/i.test(e)) return false
      return true
    })

    expect(
      significantErrors,
      `unexpected renderer errors: ${significantErrors.join('\n')}`
    ).toEqual([])
  })
})
