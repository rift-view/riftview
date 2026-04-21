# E2E tests (Playwright + Electron)

End-to-end tests that drive the real RiftView Electron app via Playwright's
`_electron` launcher. Lives alongside the unit tests but runs on its own
`test:e2e` script — it boots a full Electron process per test, so it's too
slow to chain onto `vitest run`.

## Running locally

```bash
npm install
npx playwright install chromium
npm run build --workspace=@riftview/desktop   # produces out/main/index.js
npm run test:e2e                              # PR tier
```

The harness expects `apps/desktop/out/main/index.js` to exist. Rebuild
the desktop workspace whenever you change main- or preload-process code.

## PR tier vs release tier

- **PR tier** (`npm run test:e2e`): every spec not tagged `@release`.
  Runs on every PR. Keep it under a minute of wall time.
- **Release tier** (`npm run test:e2e:release`): specs tagged `@release`.
  Runs against the packaged binary (`RIFTVIEW_BUILT_APP=1`). M4 ships
  no `@release` specs yet — M5 adds the first ones.

## Debugging

- HTML report (CI): `apps/desktop/tests/e2e/playwright-report/index.html`.
- Traces on failure: attached to the HTML report; open via `npx playwright show-trace <path>`.
- Single spec: `cd apps/desktop && npx playwright test tests/e2e/<name>.spec.ts`.
- Headed run: append `--headed` (Electron usually ignores headless mode anyway).
