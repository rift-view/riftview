# Scan Error Surfacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface per-service scan errors as amber `⚠` badges in the Sidebar, so a failed ECR scan shows visually distinct from "no repositories exist."

**Architecture:** The full scan error pipeline (provider → scanner → IPC → store) already works end-to-end. This plan only adds UI: a new `showScanErrorBadges` Settings field, a service-key-to-NodeType lookup in `Sidebar.tsx`, and a toggle in `SettingsModal.tsx`.

**Tech Stack:** React 19, TypeScript, Zustand 5, Vitest + RTL

---

## File Structure

| File                                                 | What changes                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/types/cloud.ts`                        | Add `showScanErrorBadges: boolean` to `Settings` interface                                                                                            |
| `src/renderer/store/cloud.ts`                        | Add `showScanErrorBadges: true` to module-level `DEFAULT_SETTINGS` (the test factory at line ~153 references the same const, so one edit covers both) |
| `src/main/ipc/handlers.ts`                           | Add `showScanErrorBadges: true` to the main-process `DEFAULT_SETTINGS` (separate object from the renderer store)                                      |
| `src/renderer/components/Sidebar.tsx`                | Add `SCAN_KEY_TO_TYPE` map, `errorsByType` memo, `⚠` badges on service rows and SSM section header                                                    |
| `src/renderer/components/SettingsModal.tsx`          | Add toggle for `showScanErrorBadges` in the General tab                                                                                               |
| `src/renderer/components/__tests__/Sidebar.test.tsx` | New — RTL tests for badge visibility                                                                                                                  |

---

## Task 1: Add `showScanErrorBadges` to Settings type and defaults

**Files:**

- Modify: `src/renderer/types/cloud.ts:79-85`
- Modify: `src/renderer/store/cloud.ts:10-16`
- Modify: `src/main/ipc/handlers.ts:33-39`
- Test: `src/renderer/store/__tests__/cloud.test.ts` (add to existing `theme defaults` describe block)

### Background

`Settings` is defined in `src/renderer/types/cloud.ts` (lines 79–85). There are two `DEFAULT_SETTINGS` objects: one in the renderer store (`src/renderer/store/cloud.ts` line 10) and one in the main process (`src/main/ipc/handlers.ts` line 33). Both must be updated or the settings merge will fall back to `undefined` instead of `true`.

- [ ] **Step 1: Write failing test**

Add to `src/renderer/store/__tests__/cloud.test.ts`, inside the `theme defaults` describe block:

```ts
it('DEFAULT_SETTINGS includes showScanErrorBadges: true', () => {
  const store = createCloudStore()
  expect(store.getState().settings.showScanErrorBadges).toBe(true)
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd riftview && npx vitest run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -20
```

Expected: FAIL — property `showScanErrorBadges` is undefined

- [ ] **Step 3: Add `showScanErrorBadges` to the `Settings` interface**

In `src/renderer/types/cloud.ts`, update the `Settings` interface (currently ends at line 85):

```ts
export interface Settings {
  deleteConfirmStyle: 'type-to-confirm' | 'command-drawer'
  scanInterval: 15 | 30 | 60 | 'manual'
  theme: Theme
  showRegionIndicators: boolean
  regionColors: Record<string, string>
  showScanErrorBadges: boolean
}
```

- [ ] **Step 4: Add field to renderer `DEFAULT_SETTINGS`**

In `src/renderer/store/cloud.ts`, update `DEFAULT_SETTINGS` (lines 10–16):

```ts
const DEFAULT_SETTINGS: Settings = {
  deleteConfirmStyle: 'type-to-confirm',
  scanInterval: 30,
  theme: 'dark',
  showRegionIndicators: true,
  regionColors: {},
  showScanErrorBadges: true
}
```

- [ ] **Step 5: Add field to main-process `DEFAULT_SETTINGS`**

In `src/main/ipc/handlers.ts`, update `DEFAULT_SETTINGS` (lines 33–39):

```ts
const DEFAULT_SETTINGS = {
  deleteConfirmStyle: 'type-to-confirm' as const,
  scanInterval: 30 as const,
  theme: 'dark' as const,
  showRegionIndicators: true,
  regionColors: {} as Record<string, string>,
  showScanErrorBadges: true
}
```

- [ ] **Step 6: Run test to confirm it passes**

```bash
cd riftview && npx vitest run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 7: Run typecheck**

```bash
cd riftview && npm run typecheck 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
cd riftview && git add src/renderer/types/cloud.ts src/renderer/store/cloud.ts src/main/ipc/handlers.ts src/renderer/store/__tests__/cloud.test.ts
git commit -m "feat(scan-errors): add showScanErrorBadges to Settings"
```

---

## Task 2: Sidebar error badges

**Files:**

- Modify: `src/renderer/components/Sidebar.tsx`
- Create: `src/renderer/components/__tests__/Sidebar.test.tsx`

### Background

`Sidebar.tsx` renders two sections that need badges:

1. **`SERVICES.map()`** (line 137) — one row per NodeType, with a `count` badge on the right. We add a `⚠` icon inline after the service label.
2. **Parameters section** (line 166–228) — bespoke SSM group renderer, gated on `ssmGroups.length > 0`. Since an SSM scan failure returns zero params, `ssmGroups` will be empty. The section header must render (showing just the `⚠`) even when `ssmGroups` is empty.

The lookup map below translates `scanError.service` strings (emitted by `provider.ts`) to `NodeType` values used in the `SERVICES` array:

```ts
const SCAN_KEY_TO_TYPE: Record<string, NodeType> = {
  'ec2:instances': 'ec2',
  'ec2:vpcs': 'vpc',
  'ec2:subnets': 'subnet',
  'ec2:security-groups': 'security-group',
  igw: 'igw',
  nat: 'nat-gateway',
  rds: 'rds',
  s3: 's3',
  lambda: 'lambda',
  alb: 'alb',
  acm: 'acm',
  cloudfront: 'cloudfront',
  apigw: 'apigw',
  sqs: 'sqs',
  secrets: 'secret',
  ecr: 'ecr-repo',
  sns: 'sns',
  dynamo: 'dynamo',
  ssm: 'ssm-param',
  r53: 'r53-zone',
  sfn: 'sfn',
  eventbridge: 'eventbridge-bus'
}
```

`errorsByType` is a `Map<NodeType, string>` where the value is the tooltip string (one `[service] region — message` line per error for that NodeType, joined by `\n`).

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/components/__tests__/Sidebar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Sidebar } from '../Sidebar'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import { useCliStore } from '../../store/cli'

vi.mock('../modals/SidebarFilterDialog', () => ({ default: () => null }))

const DEFAULT_SETTINGS = {
  deleteConfirmStyle: 'type-to-confirm' as const,
  scanInterval: 30 as const,
  theme: 'dark' as const,
  showRegionIndicators: true,
  regionColors: {},
  showScanErrorBadges: true
}

beforeEach(() => {
  useCloudStore.setState({ nodes: [], scanErrors: [], settings: DEFAULT_SETTINGS })
  useUIStore.setState({ view: 'topology', sidebarFilter: null, expandedSsmGroups: new Set() })
  useCliStore.setState({ commandPreview: [], pendingCommand: null })
})

describe('Sidebar scan error badges', () => {
  it('shows ⚠ on a service row when that service has a scan error', () => {
    useCloudStore.setState({
      scanErrors: [{ service: 'ecr', region: 'us-east-1', message: 'AccessDenied' }]
    })
    render(<Sidebar />)
    const badge = screen.getByTitle('[ecr] us-east-1 — AccessDenied')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toBe('⚠')
  })

  it('does not show ⚠ when scanErrors is empty', () => {
    useCloudStore.setState({ scanErrors: [] })
    render(<Sidebar />)
    expect(screen.queryByText('⚠')).not.toBeInTheDocument()
  })

  it('does not show ⚠ when showScanErrorBadges is false', () => {
    useCloudStore.setState({
      scanErrors: [{ service: 'rds', region: 'us-east-1', message: 'Forbidden' }],
      settings: { ...DEFAULT_SETTINGS, showScanErrorBadges: false }
    })
    render(<Sidebar />)
    expect(screen.queryByText('⚠')).not.toBeInTheDocument()
  })

  it('shows ⚠ on multiple service rows when multiple services failed', () => {
    useCloudStore.setState({
      scanErrors: [
        { service: 's3', region: 'us-east-1', message: 'err1' },
        { service: 'lambda', region: 'us-east-1', message: 'err2' }
      ]
    })
    render(<Sidebar />)
    const badges = screen.getAllByText('⚠')
    expect(badges).toHaveLength(2)
  })

  it('shows ⚠ on the Parameters section header even when no SSM params exist', () => {
    useCloudStore.setState({
      nodes: [], // no ssm-param nodes → ssmGroups will be empty
      scanErrors: [{ service: 'ssm', region: 'us-east-1', message: 'AccessDenied' }]
    })
    render(<Sidebar />)
    // Parameters header must render
    expect(screen.getByText('Parameters')).toBeInTheDocument()
    // ⚠ badge must also be present
    const badge = screen.getByTitle('[ssm] us-east-1 — AccessDenied')
    expect(badge).toBeInTheDocument()
  })

  it('tooltip contains the full error detail', () => {
    useCloudStore.setState({
      scanErrors: [{ service: 'dynamo', region: 'eu-west-1', message: 'ThrottlingException' }]
    })
    render(<Sidebar />)
    const badge = screen.getByTitle('[dynamo] eu-west-1 — ThrottlingException')
    expect(badge).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd riftview && npx vitest run src/renderer/components/__tests__/Sidebar.test.tsx 2>&1 | tail -30
```

Expected: FAIL — `⚠` elements not found

- [ ] **Step 3: Add `SCAN_KEY_TO_TYPE` constant to `Sidebar.tsx`**

After the `SERVICES` array (after line 36, before `getSsmPrefix`), add:

```ts
const SCAN_KEY_TO_TYPE: Record<string, NodeType> = {
  'ec2:instances': 'ec2',
  'ec2:vpcs': 'vpc',
  'ec2:subnets': 'subnet',
  'ec2:security-groups': 'security-group',
  igw: 'igw',
  nat: 'nat-gateway',
  rds: 'rds',
  s3: 's3',
  lambda: 'lambda',
  alb: 'alb',
  acm: 'acm',
  cloudfront: 'cloudfront',
  apigw: 'apigw',
  sqs: 'sqs',
  secrets: 'secret',
  ecr: 'ecr-repo',
  sns: 'sns',
  dynamo: 'dynamo',
  ssm: 'ssm-param',
  r53: 'r53-zone',
  sfn: 'sfn',
  eventbridge: 'eventbridge-bus'
}
```

- [ ] **Step 4: Add selectors for `scanErrors` and `settings` in the `Sidebar` component**

In the `Sidebar` function body, after the existing store selectors (around line 58), add:

```ts
const scanErrors = useCloudStore((s) => s.scanErrors)
const settings = useCloudStore((s) => s.settings)
```

- [ ] **Step 5: Add `errorsByType` memo**

After the `ssmGroups` memo (after line 93), add:

```ts
const errorsByType = useMemo<Map<NodeType, string>>(() => {
  const m = new Map<NodeType, string>()
  if (!settings.showScanErrorBadges) return m
  for (const err of scanErrors) {
    const nt = SCAN_KEY_TO_TYPE[err.service]
    if (!nt) continue
    const line = `[${err.service}] ${err.region} — ${err.message}`
    const existing = m.get(nt)
    m.set(nt, existing ? `${existing}\n${line}` : line)
  }
  return m
}, [scanErrors, settings.showScanErrorBadges])
```

- [ ] **Step 6: Add `⚠` badge to `SERVICES` rows**

In the `SERVICES.map()` JSX, the `.map()` callback currently opens with:

```tsx
return (
  <div
    key={s.type}
```

The full callback is:

```tsx
{SERVICES.map((s) => {
  const count = counts[s.type] ?? 0
  const isActive = sidebarFilter === s.type
  ...
  return (
    <div key={s.type} ...>
      <span>⬡ {s.label}</span>
      {count > 0 && (
        <span style={badgeStyle}>
          {count}
        </span>
      )}
    </div>
  )
})}
```

Add a local const for the error tooltip, then use it in the label span. Change the callback body so it reads:

```tsx
{
  SERVICES.map((s) => {
    const count = counts[s.type] ?? 0
    const isActive = sidebarFilter === s.type
    const errTooltip = errorsByType.get(s.type)
    const activeStyle: React.CSSProperties = {
      ...serviceRowStyle,
      border: '1px solid var(--cb-accent)',
      color: 'var(--cb-accent)',
      background: 'var(--cb-bg-elevated)',
      cursor: 'pointer'
    }
    return (
      <div
        key={s.type}
        draggable={s.hasCreate}
        onDragStart={
          s.hasCreate
            ? (e) => e.dataTransfer.setData('text/plain', s.resource ?? s.type)
            : undefined
        }
        onClick={() => {
          if (sidebarFilter === s.type) setSidebarFilter(null)
          else setFilterTarget(s.type)
        }}
        className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono"
        style={{
          ...(isActive ? activeStyle : serviceRowStyle),
          cursor: s.hasCreate ? 'grab' : 'default'
        }}
      >
        <span>
          ⬡ {s.label}
          {errTooltip && (
            <span title={errTooltip} style={{ color: '#f59e0b', fontSize: 10, marginLeft: 4 }}>
              ⚠
            </span>
          )}
        </span>
        {count > 0 && <span style={badgeStyle}>{count}</span>}
      </div>
    )
  })
}
```

- [ ] **Step 7: Update SSM section gate and add badge to Parameters header**

The SSM section in `Sidebar.tsx` currently looks like this (lines 166–228):

```tsx
      {ssmGroups.length > 0 && (
        <>
          <div className="px-2.5 text-[9px] uppercase tracking-widest mt-3 mb-1" style={{ color: 'var(--cb-text-muted)', fontFamily: 'monospace' }}>
            Parameters
          </div>

          {ssmGroups.map(({ prefix, nodes: groupNodes }) => {
```

Replace the gate condition and the Parameters header `<div>` — keeping the `<>` fragment and everything inside intact:

```tsx
      {(ssmGroups.length > 0 || errorsByType.has('ssm-param')) && (
        <>
          <div
            className="px-2.5 text-[9px] uppercase tracking-widest mt-3 mb-1"
            style={{ color: 'var(--cb-text-muted)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span>Parameters</span>
            {errorsByType.get('ssm-param') && (
              <span title={errorsByType.get('ssm-param')} style={{ color: '#f59e0b', fontSize: 10 }}>⚠</span>
            )}
          </div>

          {ssmGroups.map(({ prefix, nodes: groupNodes }) => {
```

Everything after `{ssmGroups.map(...` through the closing `</>` and `)}` is unchanged.

- [ ] **Step 8: Run tests to confirm they pass**

```bash
cd riftview && npx vitest run src/renderer/components/__tests__/Sidebar.test.tsx 2>&1 | tail -20
```

Expected: all 5 tests pass

- [ ] **Step 9: Run full test suite + typecheck**

```bash
cd riftview && npm run typecheck && npm test 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 10: Commit**

```bash
cd riftview && git add src/renderer/components/Sidebar.tsx src/renderer/components/__tests__/Sidebar.test.tsx
git commit -m "feat(scan-errors): add per-service error badges to Sidebar"
```

---

## Task 3: Settings toggle in SettingsModal

**Files:**

- Modify: `src/renderer/components/SettingsModal.tsx`

### Background

`SettingsModal.tsx` has a "General" tab (`tab === 'general'`) that already houses "Delete Confirmation" and "Scan Interval" sections (lines 460–513). Add a new "Scan Errors" section below them. The `handleSettingChange` helper already handles any `Settings` key generically — just call `handleSettingChange('showScanErrorBadges', checked)`.

- [ ] **Step 1: Add the toggle section to the General tab**

In `src/renderer/components/SettingsModal.tsx` the "Scan Interval" section ends with a closing `</div>` and then the general tab's outer `<div>` closes on the next line. The exact text to find (around lines 510–513) is:

```tsx
                </div>
              </div>
            )}
```

Where the first `</div>` closes the Scan Interval button list, the second `</div>` closes the entire general tab content wrapper, and `)}` closes `{tab === 'general' && (`.

Insert the new Scan Errors section **before the second `</div>`** (i.e., add it as the last child inside the general tab wrapper). Replace:

```tsx
                </div>
              </div>
            )}
```

with:

```tsx
                </div>

                <div style={{ marginTop: 20 }}>
                  <div style={sectionLabel}>Scan Errors</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.showScanErrorBadges}
                      onChange={(e): void => handleSettingChange('showScanErrorBadges', e.target.checked)}
                      style={{ accentColor: 'var(--cb-accent)', cursor: 'pointer' }}
                    />
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--cb-text-secondary)' }}>
                      Show error badges in sidebar when a service scan fails
                    </span>
                  </label>
                </div>
              </div>
            )}
```

- [ ] **Step 2: Run typecheck and full test suite**

```bash
cd riftview && npm run typecheck && npm test 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 3: Commit**

```bash
cd riftview && git add src/renderer/components/SettingsModal.tsx
git commit -m "feat(scan-errors): add showScanErrorBadges toggle to Settings modal"
```
