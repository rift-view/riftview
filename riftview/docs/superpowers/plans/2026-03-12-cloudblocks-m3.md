# Cloudblocks M3 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete CRUD core — delete/edit for all 7 resource types, 3 new create forms (RDS, Lambda, ALB), settings panel, EC2 key pair scanning, and M2 tech debt cleanup.

**Architecture:** Every write operation routes through CLI Engine → Command Drawer with explicit user confirmation. Delete uses a type-to-confirm dialog; edit reuses the Create modal with `mode='edit'`; quick actions (stop/start/reboot) go straight to the Command Drawer. Settings persist to `app.getPath('userData')/settings.json` via new IPC channels.

**Tech Stack:** Electron 32, electron-vite, React 18, TypeScript, Zustand 5, React Flow, Tailwind CSS, Vitest, @testing-library/react

**Working directory:** `cloudblocks/` (all paths below are relative to it)

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/renderer/types/edit.ts` | EditParams union type per resource |
| `src/renderer/utils/buildDeleteCommands.ts` | Pure fn: CloudNode → delete CLI argv arrays; also buildQuickActionCommand |
| `src/renderer/utils/__tests__/buildDeleteCommands.test.ts` | Tests for above |
| `src/renderer/utils/buildEditCommands.ts` | Pure fn: (CloudNode, EditParams) → edit CLI argv arrays; SG rule diffing |
| `src/renderer/utils/__tests__/buildEditCommands.test.ts` | Tests for above |
| `src/renderer/components/SettingsPanel.tsx` | Full-panel settings overlay |
| `src/renderer/components/modals/DeleteDialog.tsx` | Type-to-confirm delete modal |
| `src/renderer/components/modals/__tests__/DeleteDialog.test.tsx` | Tests |
| `src/renderer/components/modals/VpcEditForm.tsx` | VPC edit form (name tag only) |
| `src/renderer/components/modals/Ec2EditForm.tsx` | EC2 edit form (name, instance type, SGs) |
| `src/renderer/components/modals/SgEditForm.tsx` | SG edit form (inbound rules diff) |
| `src/renderer/components/modals/RdsEditForm.tsx` | RDS edit form (class, multi-AZ, deletion protection) |
| `src/renderer/components/modals/S3EditForm.tsx` | S3 edit form (versioning, public access) |
| `src/renderer/components/modals/LambdaEditForm.tsx` | Lambda edit form (memory, timeout, env vars) |
| `src/renderer/components/modals/AlbEditForm.tsx` | ALB edit form (name tag only) |
| `src/renderer/components/modals/__tests__/EditModal.test.tsx` | EditModal render + cancel tests |
| `src/renderer/components/canvas/NodeContextMenu.tsx` | Right-click menu for nodes (Edit/Delete/Stop/Start) |
| `src/renderer/components/modals/RdsForm.tsx` | New RDS create form |
| `src/renderer/components/modals/LambdaForm.tsx` | New Lambda create form |
| `src/renderer/components/modals/AlbForm.tsx` | New ALB create form |

### Modified files
| File | Changes |
|------|---------|
| `src/renderer/store/cloud.ts` | Add `keyPairs`, `settings`, `pendingCommand`; widen `commandPreview` to `string[]` |
| `src/renderer/store/__tests__/cloud.test.ts` | Tests for new state |
| `src/renderer/types/create.ts` | Add `RdsParams`, `LambdaParams`, `AlbParams` |
| `src/main/ipc/channels.ts` | Add `SETTINGS_GET`, `SETTINGS_SET` inside `IPC` const |
| `src/main/ipc/handlers.ts` | Settings handlers; change `CLI_RUN` to accept `string[][]` |
| `src/preload/index.ts` | Fix `removeAllListeners` → `removeListener`; add `getSettings`/`setSettings`; change `runCli` to accept `string[][]` |
| `src/main/aws/services/ec2.ts` | Add `describeKeyPairs` |
| `src/main/aws/scanner.ts` | Call `describeKeyPairs`, send via IPC |
| `src/renderer/utils/buildCommand.ts` | Add `buildRdsCommands`, `buildLambdaCommands`, `buildAlbCommands` |
| `src/renderer/utils/__tests__/buildCommand.test.ts` | Tests for new create commands |
| `src/renderer/components/canvas/CloudCanvas.tsx` | Add `onNodeContextMenu` handler |
| `src/renderer/components/canvas/CanvasContextMenu.tsx` | Add RDS, Lambda, ALB to create menu |
| `src/renderer/components/Inspector.tsx` | Add Edit/Delete buttons + EC2/RDS quick action buttons |
| `src/renderer/components/CommandDrawer.tsx` | Handle `string[]` commandPreview; execute `pendingCommand` on Run |
| `src/renderer/components/TitleBar.tsx` | Add gear icon → opens SettingsPanel |
| `src/renderer/src/App.tsx` | Mount NodeContextMenu, DeleteDialog, EditModal, SettingsPanel |
| `src/renderer/components/modals/CreateModal.tsx` | Pass `string[][]` to `runCli`; add RDS/Lambda/ALB dispatch; add required-field validation |
| `src/renderer/components/modals/Ec2Form.tsx` | Key pair free-text → dropdown from `keyPairs` store |
| `src/renderer/components/modals/VpcForm.tsx` | Required-field validation |
| `src/renderer/components/modals/SgForm.tsx` | Required-field validation |
| `src/renderer/components/modals/S3Form.tsx` | Required-field validation |

---

## Chunk 1: Foundation

### Task 1: Fix IPC listener teardown + widen `runCli` to accept `string[][]`

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc/handlers.ts`

**Context:** `ipcRenderer.removeAllListeners` in preload tears down ALL listeners for a channel (including ones registered by other components). Replace with `ipcRenderer.removeListener` + stable callback refs. Simultaneously change `runCli` from `CreateParams` → `string[][]` so the renderer builds commands and sends them directly — simplifying M3 delete/edit/quick-action flows.

- [ ] **Step 1: Read both files**

```bash
cat src/preload/index.ts
cat src/main/ipc/handlers.ts
```

- [ ] **Step 2: Rewrite `src/preload/index.ts`**

Replace the entire file with:

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { ScanDelta } from '../renderer/types/cloud'
import type { Settings } from '../renderer/store/cloud'

contextBridge.exposeInMainWorld('cloudblocks', {
  listProfiles: () => ipcRenderer.invoke('profiles:list'),
  selectProfile: (name: string) => ipcRenderer.invoke('profile:select', name),
  selectRegion: (region: string) => ipcRenderer.invoke('region:select', region),
  startScan: () => ipcRenderer.invoke('scan:start'),

  onScanDelta: (cb: (delta: ScanDelta) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, delta: ScanDelta) => cb(delta)
    ipcRenderer.on('scan:delta', handler)
    return () => ipcRenderer.removeListener('scan:delta', handler)
  },
  onScanStatus: (cb: (status: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, s: string) => cb(s)
    ipcRenderer.on('scan:status', handler)
    return () => ipcRenderer.removeListener('scan:status', handler)
  },
  onConnStatus: (cb: (status: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, s: string) => cb(s)
    ipcRenderer.on('conn:status', handler)
    return () => ipcRenderer.removeListener('conn:status', handler)
  },

  // CLI — renderer sends pre-built string[][] argv arrays
  runCli: (commands: string[][]) => ipcRenderer.invoke('cli:run', commands),
  cancelCli: () => ipcRenderer.send('cli:cancel'),
  onCliOutput: (cb: (data: { line: string; stream: 'stdout' | 'stderr' }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { line: string; stream: 'stdout' | 'stderr' }) => cb(data)
    ipcRenderer.on('cli:output', handler)
    return () => ipcRenderer.removeListener('cli:output', handler)
  },
  onCliDone: (cb: (data: { code: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { code: number }) => cb(data)
    ipcRenderer.on('cli:done', handler)
    return () => ipcRenderer.removeListener('cli:done', handler)
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s: Settings) => ipcRenderer.invoke('settings:set', s),
})
```

Each `on*` method stores the handler as a named const so `removeListener` receives the same function reference — this is the correct fix for the M2 multi-subscriber bug.

- [ ] **Step 3: Update `src/main/ipc/handlers.ts` — change CLI_RUN handler**

Find the `ipcMain.handle(IPC.CLI_RUN, ...)` handler and replace it:

```typescript
// OLD:
ipcMain.handle(IPC.CLI_RUN, async (_, params: CreateParams) => {
  if (!cliEngine) return { code: 1 }
  return cliEngine.execute(buildCommands(params))
})

// NEW:
ipcMain.handle(IPC.CLI_RUN, async (_, commands: string[][]) => {
  if (!cliEngine) return { code: 1 }
  return cliEngine.execute(commands)
})
```

Also remove the `buildCommands` import from handlers.ts if it's no longer used.

- [ ] **Step 4: Update `src/renderer/components/modals/CreateModal.tsx` — build commands in renderer**

Find where `window.cloudblocks.runCli(paramsRef.current)` is called and replace with:

```typescript
import { buildCommands } from '../../utils/buildCommand'
// ...
const commands = buildCommands(paramsRef.current)
const result = await window.cloudblocks.runCli(commands)
```

- [ ] **Step 5: Update `src/preload/index.d.ts`** to reflect the new `runCli` signature:

```typescript
interface Window {
  cloudblocks: {
    listProfiles(): Promise<{ name: string; region?: string }[]>
    selectProfile(name: string): Promise<void>
    selectRegion(region: string): Promise<void>
    startScan(): Promise<void>
    onScanDelta(cb: (delta: import('../renderer/types/cloud').ScanDelta) => void): () => void
    onScanStatus(cb: (status: string) => void): () => void
    onConnStatus(cb: (status: string) => void): () => void
    runCli(commands: string[][]): Promise<{ code: number }>
    cancelCli(): void
    onCliOutput(cb: (data: { line: string; stream: 'stdout' | 'stderr' }) => void): () => void
    onCliDone(cb: (data: { code: number }) => void): () => void
    getSettings(): Promise<import('../renderer/store/cloud').Settings>
    setSettings(s: import('../renderer/store/cloud').Settings): Promise<void>
  }
}
```

- [ ] **Step 6: Run tests to confirm nothing broken**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: all existing tests pass (engine tests, buildCommand tests, store tests).

- [ ] **Step 7: Commit**

```bash
git add src/preload/index.ts src/preload/index.d.ts src/main/ipc/handlers.ts src/renderer/components/modals/CreateModal.tsx
git commit -m "refactor: fix IPC listener teardown; runCli now accepts string[][]"
```

---

### Task 2: Widen `commandPreview` to `string[]` in store

**Files:**
- Modify: `src/renderer/store/cloud.ts`
- Modify: `src/renderer/store/__tests__/cloud.test.ts`
- Modify: `src/renderer/components/CommandDrawer.tsx`
- Modify: `src/renderer/components/modals/CreateModal.tsx`

**Context:** `commandPreview: string` becomes `commandPreview: string[]`. The Command Drawer renders each string as its own line. CreateModal wraps single commands in an array. A new `pendingCommand: string[][] | null` field allows quick actions / delete to pre-load commands for the Run button without opening a form modal.

- [ ] **Step 1: Write the failing store test**

In `src/renderer/store/__tests__/cloud.test.ts`, add:

```typescript
it('setCommandPreview accepts string array', () => {
  const store = createCloudStore()
  store.getState().setCommandPreview(['aws ec2 stop-instances --instance-ids i-123', 'aws ec2 start-instances --instance-ids i-123'])
  expect(store.getState().commandPreview).toEqual([
    'aws ec2 stop-instances --instance-ids i-123',
    'aws ec2 start-instances --instance-ids i-123',
  ])
})

it('setPendingCommand stores command chain', () => {
  const store = createCloudStore()
  store.getState().setPendingCommand([['ec2', 'stop-instances', '--instance-ids', 'i-123']])
  expect(store.getState().pendingCommand).toEqual([['ec2', 'stop-instances', '--instance-ids', 'i-123']])
  store.getState().setPendingCommand(null)
  expect(store.getState().pendingCommand).toBeNull()
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- --run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -10
```

Expected: FAIL (type error or wrong value)

- [ ] **Step 3: Update `src/renderer/store/cloud.ts`**

Change `commandPreview: string` → `commandPreview: string[]` and add `pendingCommand`:

```typescript
// In interface CloudState — replace commandPreview line and add pendingCommand:
commandPreview: string[]
pendingCommand: string[][] | null

// In actions — replace setCommandPreview and add setPendingCommand:
setCommandPreview: (cmd: string[]) => void
setPendingCommand: (cmds: string[][] | null) => void

// In the create() call — replace the commandPreview initial value:
commandPreview: [],
pendingCommand: null,

// In the create() call — replace setCommandPreview action:
setCommandPreview: (cmd) => set({ commandPreview: cmd }),
setPendingCommand: (cmds) => set({ pendingCommand: cmds }),
```

- [ ] **Step 4: Run tests — confirm store tests pass**

```bash
npm test -- --run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Read `src/renderer/components/CommandDrawer.tsx` first**

```bash
cat src/renderer/components/CommandDrawer.tsx
```

Identify: (a) where `commandPreview` is rendered as a string, (b) the `handleRun` function, (c) which store selectors are already declared at the top.

- [ ] **Step 6: Update `src/renderer/components/CommandDrawer.tsx`**

Find where `commandPreview` is read as a string and update to handle `string[]`. The existing line will look like `{commandPreview || ...}` — replace it:

```typescript
// Change the preview display:
{commandPreview.length > 0
  ? commandPreview.map((line, i) => <div key={i} style={{ color: '#eee' }}>{line}</div>)
  : <span style={{ color: '#555' }}>Waiting for command...</span>
}
```

Add `pendingCommand` and `setPendingCommand` to the store selectors at the top of the component (alongside existing selectors like `commandPreview`, `clearCliOutput`):

```typescript
const pendingCommand = useCloudStore((s) => s.pendingCommand)
const setPendingCommand = useCloudStore((s) => s.setPendingCommand)
const setCommandPreview = useCloudStore((s) => s.setCommandPreview)
```

Update the Run button's click handler. Find the existing `handleRun` (or the Run button's onClick) and replace:

```typescript
const handleRun = async () => {
  if (pendingCommand) {
    // Quick action / delete / edit — commands pre-built in store
    setIsRunning(true)
    clearCliOutput()
    await window.cloudblocks.runCli(pendingCommand)
    setPendingCommand(null)
    setCommandPreview([])
  } else {
    // Create modal path — CommandDrawer signals modal to run
    window.dispatchEvent(new CustomEvent('commanddrawer:run'))
  }
}
```

`setIsRunning` and `clearCliOutput` are already in the existing CommandDrawer — do not add duplicates.

- [ ] **Step 7: Update `src/renderer/components/modals/CreateModal.tsx`**

Change `setCommandPreview` call from string to array:

```typescript
// Find the preview update (where buildCommands is called for preview):
const preview = buildCommands(params).map(argv => 'aws ' + argv.join(' '))
store.setCommandPreview(preview)
```

- [ ] **Step 8: Run full test suite**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add src/renderer/store/cloud.ts src/renderer/store/__tests__/cloud.test.ts src/renderer/components/CommandDrawer.tsx src/renderer/components/modals/CreateModal.tsx
git commit -m "feat: widen commandPreview to string[]; add pendingCommand for direct CLI dispatch"
```

---

### Task 3: EC2 key pair scanning

**Files:**
- Modify: `src/main/aws/services/ec2.ts`
- Modify: `src/main/ipc/channels.ts`
- Modify: `src/main/aws/scanner.ts`
- Modify: `src/main/ipc/handlers.ts` (or `useIpc` hook)
- Modify: `src/renderer/store/cloud.ts`
- Modify: `src/renderer/store/__tests__/cloud.test.ts`
- Modify: `src/renderer/hooks/useIpc.ts`
- Modify: `src/renderer/components/modals/Ec2Form.tsx`

- [ ] **Step 1: Add `SCAN_KEYPAIRS` IPC channel**

In `src/main/ipc/channels.ts`, add inside the `IPC` const:

```typescript
SCAN_KEYPAIRS: 'scan:keypairs',   // on → (keyPairs: string[])
```

- [ ] **Step 2: Write failing store test**

In `src/renderer/store/__tests__/cloud.test.ts`, add:

```typescript
it('setKeyPairs stores key pair names', () => {
  const store = createCloudStore()
  store.getState().setKeyPairs(['my-key', 'dev-key'])
  expect(store.getState().keyPairs).toEqual(['my-key', 'dev-key'])
})
```

Run:
```bash
npm test -- --run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -5
```
Expected: FAIL

- [ ] **Step 3: Add `keyPairs` to store**

In `src/renderer/store/cloud.ts`:

```typescript
// Add to interface:
keyPairs: string[]
setKeyPairs: (pairs: string[]) => void

// Add to create():
keyPairs: [],
setKeyPairs: (pairs) => set({ keyPairs: pairs }),
```

- [ ] **Step 4: Run store tests — confirm pass**

```bash
npm test -- --run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: Add `describeKeyPairs` to EC2 service**

In `src/main/aws/services/ec2.ts`, add at the bottom:

```typescript
export async function describeKeyPairs(client: EC2Client): Promise<string[]> {
  const { KeyPairs } = await client.send(new DescribeKeyPairsCommand({}))
  return (KeyPairs ?? []).map(kp => kp.KeyName ?? '').filter(Boolean)
}
```

Add `DescribeKeyPairsCommand` to the imports from `@aws-sdk/client-ec2`.

- [ ] **Step 6: Call `describeKeyPairs` in scanner and broadcast via IPC**

In `src/main/aws/scanner.ts`, after the existing scan logic:

```typescript
// After scanning resources, also scan key pairs:
const keyPairs = await describeKeyPairs(clients.ec2)
win.webContents.send(IPC.SCAN_KEYPAIRS, keyPairs)
```

Import `describeKeyPairs` from `./services/ec2` and `IPC` from `../ipc/channels`.

- [ ] **Step 7: Read `src/renderer/hooks/useIpc.ts` first**

```bash
cat src/renderer/hooks/useIpc.ts
```

Note: the existing hook subscribes to `onScanDelta`, `onScanStatus`, `onConnStatus` and returns a combined cleanup. The unsub variable names match whatever is in the file — use the same pattern.

- [ ] **Step 8: Subscribe to key pairs in `useIpc` hook**

In `src/renderer/hooks/useIpc.ts`, add a subscription alongside the existing ones inside the useEffect:

```typescript
const unsubKeypairs = window.cloudblocks.onScanKeypairs((pairs: string[]) => {
  useCloudStore.getState().setKeyPairs(pairs)
})
```

Add `unsubKeypairs()` to the existing cleanup return. The cleanup return already calls the other unsub functions — just add this one to the same return statement.

Also add `onScanKeypairs` to the preload and `index.d.ts`:

In `src/preload/index.ts`:
```typescript
onScanKeypairs: (cb: (pairs: string[]) => void) => {
  const handler = (_e: Electron.IpcRendererEvent, pairs: string[]) => cb(pairs)
  ipcRenderer.on('scan:keypairs', handler)
  return () => ipcRenderer.removeListener('scan:keypairs', handler)
},
```

In `src/preload/index.d.ts`:
```typescript
onScanKeypairs(cb: (pairs: string[]) => void): () => void
```

- [ ] **Step 9: Update `Ec2Form.tsx` — replace free-text key pair with dropdown**

Find the key pair input and replace:

```tsx
// OLD: free text
<input value={form.keyName} onChange={e => update('keyName', e.target.value)} ... />

// NEW: dropdown from store
import { useCloudStore } from '../../store/cloud'
// inside component:
const keyPairs = useCloudStore((s) => s.keyPairs)
// ...
<select
  value={form.keyName}
  onChange={e => update('keyName', e.target.value)}
  style={inputStyle}
>
  <option value="">— select key pair —</option>
  {keyPairs.map(kp => <option key={kp} value={kp}>{kp}</option>)}
</select>
```

- [ ] **Step 10: Run full test suite**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 11: Commit**

```bash
git add src/main/ipc/channels.ts src/main/aws/services/ec2.ts src/main/aws/scanner.ts src/preload/index.ts src/preload/index.d.ts src/renderer/hooks/useIpc.ts src/renderer/store/cloud.ts src/renderer/store/__tests__/cloud.test.ts src/renderer/components/modals/Ec2Form.tsx
git commit -m "feat: scan EC2 key pairs; replace free-text key field with dropdown"
```

---

### Task 4: Required field validation

**Files:**
- Modify: `src/renderer/components/modals/CreateModal.tsx`
- Modify: `src/renderer/components/modals/VpcForm.tsx`
- Modify: `src/renderer/components/modals/Ec2Form.tsx`
- Modify: `src/renderer/components/modals/SgForm.tsx`
- Modify: `src/renderer/components/modals/S3Form.tsx`

**Context:** On Run attempt, highlight empty required fields with a red border and block submission. Each form component accepts a `showErrors: boolean` prop; when true, required-but-empty fields get `border: '1px solid #ff5f57'`.

- [ ] **Step 1: Read the existing test file first**

```bash
cat src/renderer/components/modals/__tests__/CreateModal.test.tsx
```

Note: identify how `window.cloudblocks` is mocked (likely `vi.stubGlobal` or `beforeEach` setup). Use the same mock object name.

- [ ] **Step 2: Write failing test**

In `src/renderer/components/modals/__tests__/CreateModal.test.tsx`, add a new `it` block. Adapt the mock references to match what already exists in the file (the mock object may be called `mockCloudblocks`, `mockBridge`, or set up inline):

```typescript
it('blocks submission and does not call runCli when required VPC fields are empty', async () => {
  // Set activeCreate to 'vpc' with empty form (name='', cidr='')
  useCloudStore.getState().setActiveCreate({ resource: 'vpc', view: 'topology' })
  const runCli = vi.fn().mockResolvedValue({ code: 0 })
  // Override the runCli mock (use same mock pattern as existing tests in this file)
  window.cloudblocks = { ...window.cloudblocks, runCli }

  render(<CreateModal />)
  // Trigger Run without filling fields
  window.dispatchEvent(new CustomEvent('commanddrawer:run'))
  await new Promise(r => setTimeout(r, 10))
  expect(runCli).not.toHaveBeenCalled()
})
```

Run:
```bash
npm test -- --run src/renderer/components/modals/__tests__/CreateModal.test.tsx 2>&1 | tail -10
```
Expected: FAIL

- [ ] **Step 3: Add `showErrors` prop to each form**

Each form receives `showErrors: boolean`. Required fields use this style helper:

```typescript
// Add to each form file:
function fieldStyle(value: string, showErrors: boolean): React.CSSProperties {
  return {
    width: '100%',
    background: '#060d14',
    border: `1px solid ${showErrors && !value.trim() ? '#ff5f57' : '#30363d'}`,
    borderRadius: 3,
    padding: '3px 6px',
    color: '#eee',
    fontFamily: 'monospace',
    fontSize: 10,
    boxSizing: 'border-box' as const,
  }
}
```

For `VpcForm`, required fields: `name`, `cidr`. Update the form interface:
```typescript
interface VpcFormProps {
  onChange: (p: VpcParams) => void
  showErrors?: boolean
}
```

Apply `fieldStyle(form.name, showErrors ?? false)` to the name input and `fieldStyle(form.cidr, showErrors ?? false)` to the CIDR input.

For `Ec2Form`, required fields: `name`, `amiId`, `instanceType`. Apply same pattern.

For `SgForm`, required fields: `name`, `description`, `vpcId`.

For `S3Form`, required fields: `bucketName`.

- [ ] **Step 4: Add validation to `CreateModal.tsx`**

In `CreateModal`, add `showErrors` state and validation before running:

```typescript
const [showErrors, setShowErrors] = useState(false)

// In handleRun (the function called on commanddrawer:run):
const isValid = validateParams(paramsRef.current)
if (!isValid) {
  setShowErrors(true)
  return
}
setShowErrors(false)
// ... rest of handleRun (create pending node, run CLI)
```

Add `validateParams`:

```typescript
function validateParams(params: CreateParams | null): boolean {
  if (!params) return false
  switch (params.resource) {
    case 'vpc':    return !!(params.name && params.cidr)
    case 'ec2':    return !!(params.name && params.amiId && params.instanceType)
    case 'sg':     return !!(params.name && params.description && params.vpcId)
    case 's3':     return !!(params.bucketName)
    default:       return true
  }
}
```

Pass `showErrors` down to the rendered form:

```tsx
{activeCreate?.resource === 'vpc' && <VpcForm onChange={handleChange} showErrors={showErrors} />}
// etc.
```

- [ ] **Step 5: Run tests — confirm pass**

```bash
npm test -- --run src/renderer/components/modals/__tests__/CreateModal.test.tsx 2>&1 | tail -10
```

- [ ] **Step 6: Run full suite**

```bash
npm test -- --run 2>&1 | tail -20
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/modals/CreateModal.tsx src/renderer/components/modals/VpcForm.tsx src/renderer/components/modals/Ec2Form.tsx src/renderer/components/modals/SgForm.tsx src/renderer/components/modals/S3Form.tsx
git commit -m "feat: required field validation — red border + block submit on empty fields"
```

---

## Chunk 2: Settings Panel

### Task 5: Settings IPC channels + handlers + store

**Files:**
- Modify: `src/main/ipc/channels.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/renderer/store/cloud.ts`
- Modify: `src/renderer/store/__tests__/cloud.test.ts`

- [ ] **Step 1: Add settings channels to `src/main/ipc/channels.ts`**

Inside the `IPC` const, add:

```typescript
SETTINGS_GET: 'settings:get',   // invoke → Settings
SETTINGS_SET: 'settings:set',   // invoke → void
```

- [ ] **Step 2: Add settings handler to `src/main/ipc/handlers.ts`**

At the top of the file, add imports:

```typescript
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
```

Add a helper and two handlers (call this inside `registerHandlers`):

```typescript
function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

const DEFAULT_SETTINGS = {
  deleteConfirmStyle: 'type-to-confirm' as const,
  scanInterval: 30 as const,
}

ipcMain.handle(IPC.SETTINGS_GET, () => {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
})

ipcMain.handle(IPC.SETTINGS_SET, (_e, settings) => {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
})
```

- [ ] **Step 3: Write failing store test first**

In `src/renderer/store/__tests__/cloud.test.ts`, add before implementing:

```typescript
it('settings defaults are correct', () => {
  const store = createCloudStore()
  expect(store.getState().settings.deleteConfirmStyle).toBe('type-to-confirm')
  expect(store.getState().settings.scanInterval).toBe(30)
})
```

Run:
```bash
npm test -- --run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -5
```
Expected: FAIL (Property 'settings' does not exist)

- [ ] **Step 4: Export `Settings` type + add to store**

In `src/renderer/store/cloud.ts`, add the `Settings` type export and new state:

```typescript
export interface Settings {
  deleteConfirmStyle: 'type-to-confirm' | 'command-drawer'
  scanInterval: 15 | 30 | 60 | 'manual'
}

const DEFAULT_SETTINGS: Settings = {
  deleteConfirmStyle: 'type-to-confirm',
  scanInterval: 30,
}

// In CloudState interface, add:
settings: Settings
loadSettings: () => Promise<void>
saveSettings: (s: Settings) => Promise<void>

// In create(), add:
settings: DEFAULT_SETTINGS,
loadSettings: async () => {
  const s = await window.cloudblocks.getSettings()
  set({ settings: s })
},
saveSettings: async (s: Settings) => {
  await window.cloudblocks.setSettings(s)
  set({ settings: s })
},
```

- [ ] **Step 5: Run all store tests — confirm pass**

```bash
npm test -- --run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/channels.ts src/main/ipc/handlers.ts src/renderer/store/cloud.ts src/renderer/store/__tests__/cloud.test.ts
git commit -m "feat: settings IPC channels + handlers + store state"
```

---

### Task 6: SettingsPanel component + TitleBar gear icon

**Files:**
- Create: `src/renderer/components/SettingsPanel.tsx`
- Modify: `src/renderer/components/TitleBar.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Create `src/renderer/components/SettingsPanel.tsx`**

```tsx
import React, { useEffect, useState } from 'react'
import { useCloudStore, Settings } from '../store/cloud'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, saveSettings } = useCloudStore()
  const [local, setLocal] = useState<Settings>(settings)

  useEffect(() => { setLocal(settings) }, [settings])

  const update = <K extends keyof Settings>(key: K, val: Settings[K]) =>
    setLocal(prev => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    await saveSettings(local)
    onClose()
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  }
  const panel: React.CSSProperties = {
    background: '#0d1117', border: '1px solid #30363d', borderRadius: 8,
    padding: 24, width: 400, fontFamily: 'monospace', color: '#eee',
  }
  const label: React.CSSProperties = { fontSize: 10, color: '#aaa', textTransform: 'uppercase', marginBottom: 4 }
  const select: React.CSSProperties = {
    width: '100%', background: '#060d14', border: '1px solid #30363d',
    borderRadius: 3, padding: '4px 8px', color: '#eee', fontFamily: 'monospace', fontSize: 11,
    marginBottom: 16,
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panel}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: '#FF9900', marginBottom: 20, borderBottom: '1px solid #1e2d40', paddingBottom: 8 }}>
          Settings
        </div>

        <div style={label}>Delete confirmation style</div>
        <select
          style={select}
          value={local.deleteConfirmStyle}
          onChange={e => update('deleteConfirmStyle', e.target.value as Settings['deleteConfirmStyle'])}
        >
          <option value="type-to-confirm">Type to confirm</option>
          <option value="command-drawer">Command Drawer</option>
        </select>

        <div style={label}>Scan interval</div>
        <select
          style={select}
          value={String(local.scanInterval)}
          onChange={e => {
            const v = e.target.value
            update('scanInterval', v === 'manual' ? 'manual' : Number(v) as 15 | 30 | 60)
          }}
        >
          <option value="15">15s</option>
          <option value="30">30s</option>
          <option value="60">60s</option>
          <option value="manual">Manual only</option>
        </select>

        <div style={{ fontSize: 10, color: '#555', marginBottom: 16 }}>
          Theme — coming in M4
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ background: '#1a2332', border: '1px solid #30363d', borderRadius: 3, padding: '4px 16px', color: '#aaa', fontFamily: 'monospace', fontSize: 11, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ background: '#22c55e', border: 'none', borderRadius: 3, padding: '4px 16px', color: '#000', fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add gear icon to `src/renderer/components/TitleBar.tsx`**

The TitleBar needs a `onSettingsOpen` prop. Add at the right side of the bar:

```tsx
interface TitleBarProps {
  onSettingsOpen: () => void
}

// Inside the rendered JSX, add a gear button at the far right:
<button
  onClick={onSettingsOpen}
  title="Settings"
  style={{
    background: 'none', border: 'none', color: '#aaa', cursor: 'pointer',
    fontSize: 14, padding: '0 8px', marginLeft: 'auto',
  }}
>
  ⚙
</button>
```

- [ ] **Step 3: Wire in `src/renderer/src/App.tsx`**

```tsx
import SettingsPanel from '../components/SettingsPanel'
// Add state:
const [settingsOpen, setSettingsOpen] = useState(false)
// Load settings on mount:
useEffect(() => { useCloudStore.getState().loadSettings() }, [])

// Pass to TitleBar:
<TitleBar onSettingsOpen={() => setSettingsOpen(true)} />
// Render panel:
{settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
```

- [ ] **Step 4: Run full test suite**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/SettingsPanel.tsx src/renderer/components/TitleBar.tsx src/renderer/src/App.tsx
git commit -m "feat: settings panel with delete-confirm style and scan interval"
```

---

## Chunk 3: Delete Flow

### Task 7: `buildDeleteCommands` utility

**Files:**
- Create: `src/renderer/utils/buildDeleteCommands.ts`
- Create: `src/renderer/utils/__tests__/buildDeleteCommands.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/utils/__tests__/buildDeleteCommands.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildDeleteCommands, buildQuickActionCommand } from '../buildDeleteCommands'
import type { CloudNode } from '../../types/cloud'

function node(type: CloudNode['type'], id: string, status: CloudNode['status'] = 'running'): CloudNode {
  return { id, type, label: id, status, region: 'us-east-1', metadata: {} }
}

describe('buildDeleteCommands', () => {
  it('VPC delete', () => {
    expect(buildDeleteCommands(node('vpc', 'vpc-123'))).toEqual([
      ['ec2', 'delete-vpc', '--vpc-id', 'vpc-123'],
    ])
  })
  it('EC2 terminate', () => {
    expect(buildDeleteCommands(node('ec2', 'i-abc'))).toEqual([
      ['ec2', 'terminate-instances', '--instance-ids', 'i-abc'],
    ])
  })
  it('SG delete', () => {
    expect(buildDeleteCommands(node('security-group', 'sg-xyz'))).toEqual([
      ['ec2', 'delete-security-group', '--group-id', 'sg-xyz'],
    ])
  })
  it('RDS delete without final snapshot', () => {
    expect(buildDeleteCommands(node('rds', 'mydb'), { skipFinalSnapshot: true })).toEqual([
      ['rds', 'delete-db-instance', '--db-instance-identifier', 'mydb', '--skip-final-snapshot'],
    ])
  })
  it('S3 delete with force', () => {
    expect(buildDeleteCommands(node('s3', 'my-bucket'), { force: true })).toEqual([
      ['s3', 'rb', 's3://my-bucket', '--force'],
    ])
  })
  it('Lambda delete', () => {
    expect(buildDeleteCommands(node('lambda', 'my-fn'))).toEqual([
      ['lambda', 'delete-function', '--function-name', 'my-fn'],
    ])
  })
  it('ALB delete', () => {
    expect(buildDeleteCommands(node('alb', 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/my-alb/abc'))).toEqual([
      ['elbv2', 'delete-load-balancer', '--load-balancer-arn', 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/my-alb/abc'],
    ])
  })
})

describe('buildQuickActionCommand', () => {
  it('EC2 stop', () => {
    expect(buildQuickActionCommand(node('ec2', 'i-123'), 'stop')).toEqual([
      ['ec2', 'stop-instances', '--instance-ids', 'i-123'],
    ])
  })
  it('EC2 start', () => {
    expect(buildQuickActionCommand(node('ec2', 'i-123'), 'start')).toEqual([
      ['ec2', 'start-instances', '--instance-ids', 'i-123'],
    ])
  })
  it('EC2 reboot', () => {
    expect(buildQuickActionCommand(node('ec2', 'i-123'), 'reboot')).toEqual([
      ['ec2', 'reboot-instances', '--instance-ids', 'i-123'],
    ])
  })
  it('RDS stop', () => {
    expect(buildQuickActionCommand(node('rds', 'mydb'), 'stop')).toEqual([
      ['rds', 'stop-db-instance', '--db-instance-identifier', 'mydb'],
    ])
  })
  it('RDS start', () => {
    expect(buildQuickActionCommand(node('rds', 'mydb'), 'start')).toEqual([
      ['rds', 'start-db-instance', '--db-instance-identifier', 'mydb'],
    ])
  })
  it('RDS reboot', () => {
    expect(buildQuickActionCommand(node('rds', 'mydb'), 'reboot')).toEqual([
      ['rds', 'reboot-db-instance', '--db-instance-identifier', 'mydb'],
    ])
  })
  it('returns empty array for unsupported type', () => {
    expect(buildQuickActionCommand(node('vpc', 'vpc-1'), 'stop')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test -- --run src/renderer/utils/__tests__/buildDeleteCommands.test.ts 2>&1 | tail -5
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/renderer/utils/buildDeleteCommands.ts`**

```typescript
import type { CloudNode } from '../types/cloud'

export interface DeleteOptions {
  skipFinalSnapshot?: boolean
  force?: boolean
}

export function buildDeleteCommands(node: CloudNode, opts: DeleteOptions = {}): string[][] {
  switch (node.type) {
    case 'vpc':
      return [['ec2', 'delete-vpc', '--vpc-id', node.id]]
    case 'ec2':
      return [['ec2', 'terminate-instances', '--instance-ids', node.id]]
    case 'security-group':
      return [['ec2', 'delete-security-group', '--group-id', node.id]]
    case 'rds': {
      const args = ['rds', 'delete-db-instance', '--db-instance-identifier', node.id]
      if (opts.skipFinalSnapshot) args.push('--skip-final-snapshot')
      return [args]
    }
    case 's3': {
      const args = ['s3', 'rb', `s3://${node.id}`]
      if (opts.force) args.push('--force')
      return [args]
    }
    case 'lambda':
      return [['lambda', 'delete-function', '--function-name', node.id]]
    case 'alb':
      return [['elbv2', 'delete-load-balancer', '--load-balancer-arn', node.id]]
    default:
      return []
  }
}

export function buildQuickActionCommand(node: CloudNode, action: 'stop' | 'start' | 'reboot'): string[][] {
  if (node.type === 'ec2') {
    if (action === 'stop')   return [['ec2', 'stop-instances',   '--instance-ids', node.id]]
    if (action === 'start')  return [['ec2', 'start-instances',  '--instance-ids', node.id]]
    if (action === 'reboot') return [['ec2', 'reboot-instances', '--instance-ids', node.id]]
  }
  if (node.type === 'rds') {
    if (action === 'stop')   return [['rds', 'stop-db-instance',   '--db-instance-identifier', node.id]]
    if (action === 'start')  return [['rds', 'start-db-instance',  '--db-instance-identifier', node.id]]
    if (action === 'reboot') return [['rds', 'reboot-db-instance', '--db-instance-identifier', node.id]]
  }
  return []
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npm test -- --run src/renderer/utils/__tests__/buildDeleteCommands.test.ts 2>&1 | tail -10
```

Expected: all 14 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/utils/buildDeleteCommands.ts src/renderer/utils/__tests__/buildDeleteCommands.test.ts
git commit -m "feat: buildDeleteCommands and buildQuickActionCommand utilities"
```

---

### Task 8: `DeleteDialog` component

**Files:**
- Create: `src/renderer/components/modals/DeleteDialog.tsx`
- Create: `src/renderer/components/modals/__tests__/DeleteDialog.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/components/modals/__tests__/DeleteDialog.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DeleteDialog from '../DeleteDialog'
import type { CloudNode } from '../../../types/cloud'

const node: CloudNode = { id: 'vpc-0abc1234', type: 'vpc', label: 'my-vpc', status: 'running', region: 'us-east-1', metadata: {} }

describe('DeleteDialog', () => {
  it('renders type-to-confirm input and disabled delete button initially', () => {
    render(<DeleteDialog node={node} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByPlaceholderText('vpc-0abc1234')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled()
  })

  it('enables Delete button only when input matches resource ID', async () => {
    render(<DeleteDialog node={node} onClose={vi.fn()} onConfirm={vi.fn()} />)
    const input = screen.getByPlaceholderText('vpc-0abc1234')
    fireEvent.change(input, { target: { value: 'vpc-0abc1234' } })
    expect(screen.getByRole('button', { name: /delete/i })).not.toBeDisabled()
  })

  it('calls onConfirm with empty options when confirmed', async () => {
    const onConfirm = vi.fn()
    render(<DeleteDialog node={node} onClose={vi.fn()} onConfirm={onConfirm} />)
    const input = screen.getByPlaceholderText('vpc-0abc1234')
    fireEvent.change(input, { target: { value: 'vpc-0abc1234' } })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onConfirm).toHaveBeenCalledWith({})
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<DeleteDialog node={node} onClose={onClose} onConfirm={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows force-delete toggle for S3 bucket', () => {
    const s3Node: CloudNode = { ...node, id: 'my-bucket', type: 's3' }
    render(<DeleteDialog node={s3Node} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText(/force delete/i)).toBeInTheDocument()
  })

  it('shows skip-final-snapshot toggle for RDS', () => {
    const rdsNode: CloudNode = { ...node, id: 'mydb', type: 'rds' }
    render(<DeleteDialog node={rdsNode} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText(/skip final snapshot/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test -- --run src/renderer/components/modals/__tests__/DeleteDialog.test.tsx 2>&1 | tail -5
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/renderer/components/modals/DeleteDialog.tsx`**

```tsx
import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { DeleteOptions } from '../../utils/buildDeleteCommands'

interface DeleteDialogProps {
  node: CloudNode
  onClose: () => void
  onConfirm: (opts: DeleteOptions) => void
}

const RESOURCE_LABELS: Record<string, string> = {
  vpc: 'VPC', ec2: 'EC2 Instance', 'security-group': 'Security Group',
  rds: 'RDS Instance', s3: 'S3 Bucket', lambda: 'Lambda Function', alb: 'Load Balancer',
}

export default function DeleteDialog({ node, onClose, onConfirm }: DeleteDialogProps) {
  const [input, setInput] = useState('')
  const [skipSnapshot, setSkipSnapshot] = useState(false)
  const [force, setForce] = useState(false)

  const confirmed = input === node.id

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  }
  const dialog: React.CSSProperties = {
    background: '#0d1117', border: '1px solid #ff5f57', borderRadius: 8,
    padding: 20, width: 340, fontFamily: 'monospace',
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={dialog}>
        <div style={{ color: '#ff5f57', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>
          Delete {RESOURCE_LABELS[node.type] ?? node.type}?
        </div>
        <div style={{ color: '#aaa', fontSize: 10, marginBottom: 4 }}>
          Type <span style={{ color: '#eee' }}>{node.id}</span> to confirm
        </div>
        <input
          autoFocus
          placeholder={node.id}
          value={input}
          onChange={e => setInput(e.target.value)}
          style={{
            width: '100%', background: '#060d14', border: '1px solid #30363d',
            borderRadius: 3, padding: '4px 8px', color: '#eee',
            fontFamily: 'monospace', fontSize: 11, boxSizing: 'border-box', marginBottom: 10,
          }}
        />

        {node.type === 's3' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#aaa', marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
            Force delete (removes all objects)
          </label>
        )}

        {node.type === 'rds' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#aaa', marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={skipSnapshot} onChange={e => setSkipSnapshot(e.target.checked)} />
            Skip final snapshot
          </label>
        )}

        <div style={{ color: '#555', fontSize: 9, marginBottom: 12 }}>This action cannot be undone.</div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: '#1a2332', border: '1px solid #30363d', borderRadius: 3, padding: '4px 14px', color: '#aaa', fontFamily: 'monospace', fontSize: 11, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            disabled={!confirmed}
            onClick={() => onConfirm({ skipFinalSnapshot: skipSnapshot || undefined, force: force || undefined })}
            style={{
              background: confirmed ? '#ff5f57' : '#3a1a1a',
              border: '1px solid #ff5f57', borderRadius: 3, padding: '4px 14px',
              color: confirmed ? '#000' : '#ff5f57', fontFamily: 'monospace', fontSize: 11,
              fontWeight: 'bold', cursor: confirmed ? 'pointer' : 'not-allowed', opacity: confirmed ? 1 : 0.5,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npm test -- --run src/renderer/components/modals/__tests__/DeleteDialog.test.tsx 2>&1 | tail -10
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/modals/DeleteDialog.tsx src/renderer/components/modals/__tests__/DeleteDialog.test.tsx
git commit -m "feat: DeleteDialog type-to-confirm component with S3/RDS options"
```

---

### Task 9: NodeContextMenu component

**Files:**
- Create: `src/renderer/components/canvas/NodeContextMenu.tsx`
- Modify: `src/renderer/components/canvas/CloudCanvas.tsx`

- [ ] **Step 1: Read `src/renderer/components/canvas/CloudCanvas.tsx`**

```bash
cat src/renderer/components/canvas/CloudCanvas.tsx
```

Note: identify where `onContextMenu` is handled and where the canvas inner component renders (the component uses `ReactFlowProvider` wrapping an inner component that has access to `useReactFlow`). The `onNodeContextMenu` prop must be added to the `<ReactFlow>` element inside the inner component.

- [ ] **Step 2: Create `src/renderer/components/canvas/NodeContextMenu.tsx`**

```tsx
import React from 'react'
import type { CloudNode } from '../../types/cloud'

interface NodeContextMenuProps {
  node: CloudNode
  x: number
  y: number
  onEdit: (node: CloudNode) => void
  onDelete: (node: CloudNode) => void
  onStop?: (node: CloudNode) => void
  onStart?: (node: CloudNode) => void
  onClose: () => void
}

const RESOURCE_LABELS: Record<string, string> = {
  vpc: 'VPC', ec2: 'EC2 Instance', 'security-group': 'Security Group',
  rds: 'RDS Instance', s3: 'S3 Bucket', lambda: 'Lambda Function', alb: 'Load Balancer',
}

export default function NodeContextMenu({ node, x, y, onEdit, onDelete, onStop, onStart, onClose }: NodeContextMenuProps) {
  const label = RESOURCE_LABELS[node.type] ?? node.type
  const showStopStart = node.type === 'ec2' || node.type === 'rds'

  const menu: React.CSSProperties = {
    position: 'fixed', left: x, top: y,
    background: '#0d1117', border: '1px solid #30363d', borderRadius: 4,
    padding: '4px 0', fontFamily: 'monospace', fontSize: 11, zIndex: 150, minWidth: 160,
  }
  const item: React.CSSProperties = {
    padding: '5px 14px', cursor: 'pointer', color: '#eee',
  }
  const itemRed: React.CSSProperties = { ...item, color: '#ff5f57' }

  const handleClick = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
    onClose()
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={onClose} />
      <div style={menu}>
        <div style={{ padding: '3px 14px 5px', color: '#555', fontSize: 9, textTransform: 'uppercase', borderBottom: '1px solid #1e2d40', marginBottom: 2 }}>
          {node.id}
        </div>
        <div style={item} onMouseOver={e => (e.currentTarget.style.background = '#1a2332')} onMouseOut={e => (e.currentTarget.style.background = '')} onClick={handleClick(() => onEdit(node))}>
          ✎ Edit {label}
        </div>
        {showStopStart && node.status === 'running' && onStop && (
          <div style={item} onMouseOver={e => (e.currentTarget.style.background = '#1a2332')} onMouseOut={e => (e.currentTarget.style.background = '')} onClick={handleClick(() => onStop(node))}>
            ⏹ Stop {label}
          </div>
        )}
        {showStopStart && node.status === 'stopped' && onStart && (
          <div style={item} onMouseOver={e => (e.currentTarget.style.background = '#1a2332')} onMouseOut={e => (e.currentTarget.style.background = '')} onClick={handleClick(() => onStart(node))}>
            ▶ Start {label}
          </div>
        )}
        <div style={{ borderTop: '1px solid #1e2d40', marginTop: 2 }} />
        <div style={itemRed} onMouseOver={e => (e.currentTarget.style.background = '#1a2332')} onMouseOut={e => (e.currentTarget.style.background = '')} onClick={handleClick(() => onDelete(node))}>
          ✕ Delete {label}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Add `onNodeContextMenu` to `CloudCanvas.tsx`**

In `CloudCanvas.tsx`, the inner component (the one that calls `useReactFlow`) needs these additions:

Add props to the inner component interface:
```typescript
interface CanvasInnerProps {
  // existing props...
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}
```

Add handler to the `<ReactFlow>` element:
```tsx
onNodeContextMenu={(event, node) => {
  event.preventDefault()
  // node.data contains the CloudNode (check how ResourceNode stores it — node.data should be the CloudNode)
  onNodeContextMenu(node.data as CloudNode, event.clientX, event.clientY)
}}
```

Pass `onNodeContextMenu` from the outer `CloudCanvas` component to `CanvasInner`. The outer component receives it as a prop:
```typescript
interface CloudCanvasProps {
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}
```

- [ ] **Step 4: Run full test suite — confirm no regressions**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/canvas/NodeContextMenu.tsx src/renderer/components/canvas/CloudCanvas.tsx
git commit -m "feat: NodeContextMenu for node right-click (Edit/Delete/Stop/Start)"
```

---

### Task 10: Wire delete flow + Inspector delete button

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/components/Inspector.tsx`

**Context:** App.tsx manages `deleteTarget: CloudNode | null` state. When set, DeleteDialog renders. On confirm, builds delete commands, sets `commandPreview` + `pendingCommand` in the store, closes dialog. If `settings.deleteConfirmStyle === 'command-drawer'`, skip dialog and go straight to pendingCommand.

- [ ] **Step 1: Read `src/renderer/src/App.tsx` and `src/renderer/components/Inspector.tsx`**

```bash
cat src/renderer/src/App.tsx
cat src/renderer/components/Inspector.tsx
```

- [ ] **Step 2: Update `src/renderer/src/App.tsx`**

Add imports:
```typescript
import NodeContextMenu from '../components/canvas/NodeContextMenu'
import DeleteDialog from '../components/modals/DeleteDialog'
import { buildDeleteCommands, buildQuickActionCommand } from '../utils/buildDeleteCommands'
```

Add state:
```typescript
const [deleteTarget, setDeleteTarget] = useState<CloudNode | null>(null)
const [nodeMenu, setNodeMenu] = useState<{ node: CloudNode; x: number; y: number } | null>(null)
```

Add the delete handler (called from both dialog confirm and context menu when style='command-drawer'):
```typescript
const settings = useCloudStore((s) => s.settings)
const setCommandPreview = useCloudStore((s) => s.setCommandPreview)
const setPendingCommand = useCloudStore((s) => s.setPendingCommand)
const startScan = useCloudStore((s) => s.setScanStatus) // used after success

const handleDeleteConfirm = (node: CloudNode, opts: DeleteOptions) => {
  const commands = buildDeleteCommands(node, opts)
  setCommandPreview(commands.map(argv => 'aws ' + argv.join(' ')))
  setPendingCommand(commands)
  setDeleteTarget(null)
  // pendingCommand in store → CommandDrawer Run button executes it
  // After execution, rescan is triggered by CommandDrawer's onCliDone handler (see Task 2)
}

const handleDeleteRequest = (node: CloudNode) => {
  if (settings.deleteConfirmStyle === 'command-drawer') {
    // Skip dialog — go straight to Command Drawer
    handleDeleteConfirm(node, {})
  } else {
    setDeleteTarget(node)
  }
}

const handleNodeContextMenu = (node: CloudNode, x: number, y: number) => {
  setNodeMenu({ node, x, y })
}
```

Wire `onNodeContextMenu` into `<CloudCanvas>`:
```tsx
<CloudCanvas onNodeContextMenu={handleNodeContextMenu} />
```

Render NodeContextMenu and DeleteDialog:
```tsx
{nodeMenu && (
  <NodeContextMenu
    node={nodeMenu.node}
    x={nodeMenu.x}
    y={nodeMenu.y}
    onEdit={node => { setNodeMenu(null); setEditTarget(node) }}
    onDelete={node => { setNodeMenu(null); handleDeleteRequest(node) }}
    onStop={node => {
      setNodeMenu(null)
      const cmds = buildQuickActionCommand(node, 'stop')
      setCommandPreview(cmds.map(a => 'aws ' + a.join(' ')))
      setPendingCommand(cmds)
    }}
    onStart={node => {
      setNodeMenu(null)
      const cmds = buildQuickActionCommand(node, 'start')
      setCommandPreview(cmds.map(a => 'aws ' + a.join(' ')))
      setPendingCommand(cmds)
    }}
    onClose={() => setNodeMenu(null)}
  />
)}
{deleteTarget && (
  <DeleteDialog
    node={deleteTarget}
    onClose={() => setDeleteTarget(null)}
    onConfirm={opts => handleDeleteConfirm(deleteTarget, opts)}
  />
)}
```

Note: `setEditTarget` is used here — it will be added in Task 13. For now, add `const [editTarget, setEditTarget] = useState<CloudNode | null>(null)` as a placeholder.

- [ ] **Step 3: Add rescan after pendingCommand completes**

In `src/renderer/components/CommandDrawer.tsx`, the `handleRun` that executes `pendingCommand` should trigger a rescan on success. Find the `pendingCommand` execution block added in Task 2 and add:

```typescript
const result = await window.cloudblocks.runCli(pendingCommand)
setPendingCommand(null)
setCommandPreview([])
if (result.code === 0) {
  await window.cloudblocks.startScan()
}
```

- [ ] **Step 4: Add Delete button to Inspector**

In `src/renderer/components/Inspector.tsx`, read the file first:

```bash
cat src/renderer/components/Inspector.tsx
```

The Inspector receives `selectedNode` from the store. Add an `onDelete` prop:

```typescript
interface InspectorProps {
  onDelete: (node: CloudNode) => void
  onEdit: (node: CloudNode) => void
}
```

Add Edit and Delete buttons at the bottom of the node detail view:

```tsx
<div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
  <button
    onClick={() => onEdit(selectedNode)}
    style={{ flex: 1, background: '#1a2332', border: '1px solid #64b5f6', borderRadius: 2, padding: '3px 0', color: '#64b5f6', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}
  >
    ✎ Edit
  </button>
  <button
    onClick={() => onDelete(selectedNode)}
    style={{ flex: 1, background: '#1a2332', border: '1px solid #ff5f57', borderRadius: 2, padding: '3px 0', color: '#ff5f57', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}
  >
    ✕ Delete
  </button>
</div>
```

Pass `onDelete` and `onEdit` from App.tsx to Inspector:
```tsx
<Inspector onDelete={handleDeleteRequest} onEdit={node => setEditTarget(node)} />
```

- [ ] **Step 5: Run full test suite**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/components/Inspector.tsx src/renderer/components/CommandDrawer.tsx
git commit -m "feat: wire delete flow — context menu + Inspector delete button → DeleteDialog → CLI"
```

---

## Chunk 4: Edit Flow

### Task 11: `buildEditCommands` utility

**Files:**
- Create: `src/renderer/types/edit.ts`
- Create: `src/renderer/utils/buildEditCommands.ts`
- Create: `src/renderer/utils/__tests__/buildEditCommands.test.ts`

- [ ] **Step 1: Create `src/renderer/types/edit.ts`**

```typescript
export interface VpcEditParams    { resource: 'vpc';    name: string }
export interface Ec2EditParams    { resource: 'ec2';    name?: string; instanceType?: string; securityGroupIds?: string[] }
export interface SgEditParams     { resource: 'sg';     rules: SgRule[] }
export interface RdsEditParams    { resource: 'rds';    dbInstanceClass?: string; multiAZ?: boolean; deletionProtection?: boolean }
export interface S3EditParams     { resource: 's3';     versioning?: boolean; blockPublicAccess?: boolean }
export interface LambdaEditParams { resource: 'lambda'; memorySize?: number; timeout?: number; environment?: Record<string, string> }
export interface AlbEditParams    { resource: 'alb';    name: string }

export interface SgRule {
  protocol: string
  fromPort: number
  toPort: number
  cidr: string
}

export type EditParams =
  | VpcEditParams | Ec2EditParams | SgEditParams | RdsEditParams
  | S3EditParams  | LambdaEditParams | AlbEditParams
```

- [ ] **Step 2: Write the failing tests**

Create `src/renderer/utils/__tests__/buildEditCommands.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildEditCommands } from '../buildEditCommands'
import type { CloudNode } from '../../types/cloud'

function node(type: CloudNode['type'], id: string, status: CloudNode['status'] = 'running', metadata: Record<string, unknown> = {}): CloudNode {
  return { id, type, label: id, status, region: 'us-east-1', metadata }
}

describe('buildEditCommands — VPC', () => {
  it('emits create-tags for name change', () => {
    expect(buildEditCommands(node('vpc', 'vpc-123'), { resource: 'vpc', name: 'my-vpc' })).toEqual([
      ['ec2', 'create-tags', '--resources', 'vpc-123', '--tags', 'Key=Name,Value=my-vpc'],
    ])
  })
})

describe('buildEditCommands — EC2', () => {
  it('name tag only', () => {
    expect(buildEditCommands(node('ec2', 'i-123'), { resource: 'ec2', name: 'web-server' })).toEqual([
      ['ec2', 'create-tags', '--resources', 'i-123', '--tags', 'Key=Name,Value=web-server'],
    ])
  })

  it('instance type change on running instance: stop + modify + start', () => {
    const cmds = buildEditCommands(node('ec2', 'i-123', 'running'), { resource: 'ec2', instanceType: 't3.large' })
    expect(cmds).toEqual([
      ['ec2', 'stop-instances', '--instance-ids', 'i-123'],
      ['ec2', 'modify-instance-attribute', '--instance-id', 'i-123', '--instance-type', 'Value=t3.large'],
      ['ec2', 'start-instances', '--instance-ids', 'i-123'],
    ])
  })

  it('instance type change on stopped instance: modify + start only', () => {
    const cmds = buildEditCommands(node('ec2', 'i-123', 'stopped'), { resource: 'ec2', instanceType: 't3.large' })
    expect(cmds).toEqual([
      ['ec2', 'modify-instance-attribute', '--instance-id', 'i-123', '--instance-type', 'Value=t3.large'],
      ['ec2', 'start-instances', '--instance-ids', 'i-123'],
    ])
  })
})

describe('buildEditCommands — SG (rule diffing)', () => {
  const existingRules = [
    { protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '0.0.0.0/0' },
    { protocol: 'tcp', fromPort: 22, toPort: 22, cidr: '10.0.0.0/8' },
  ]

  it('authorizes new rules', () => {
    const cmds = buildEditCommands(
      node('security-group', 'sg-abc', 'running', { rules: existingRules }),
      { resource: 'sg', rules: [...existingRules, { protocol: 'tcp', fromPort: 80, toPort: 80, cidr: '0.0.0.0/0' }] }
    )
    expect(cmds).toEqual([
      ['ec2', 'authorize-security-group-ingress', '--group-id', 'sg-abc', '--ip-permissions',
       'IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0}]'],
    ])
  })

  it('revokes removed rules before authorizing new ones', () => {
    const newRules = [existingRules[0]] // only keep the 443 rule
    const cmds = buildEditCommands(
      node('security-group', 'sg-abc', 'running', { rules: existingRules }),
      { resource: 'sg', rules: newRules }
    )
    expect(cmds).toEqual([
      ['ec2', 'revoke-security-group-ingress', '--group-id', 'sg-abc', '--ip-permissions',
       'IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=10.0.0.0/8}]'],
    ])
  })

  it('returns empty array when rules unchanged', () => {
    expect(buildEditCommands(
      node('security-group', 'sg-abc', 'running', { rules: existingRules }),
      { resource: 'sg', rules: existingRules }
    )).toEqual([])
  })
})

describe('buildEditCommands — RDS', () => {
  it('modifies instance class', () => {
    const cmds = buildEditCommands(node('rds', 'mydb'), { resource: 'rds', dbInstanceClass: 'db.t3.small' })
    expect(cmds[0]).toEqual(['rds', 'modify-db-instance', '--db-instance-identifier', 'mydb', '--apply-immediately', '--db-instance-class', 'db.t3.small'])
  })

  it('enables deletion protection', () => {
    const cmds = buildEditCommands(node('rds', 'mydb'), { resource: 'rds', deletionProtection: true })
    expect(cmds[0]).toContain('--deletion-protection')
    expect(cmds[0]).not.toContain('--no-deletion-protection')
  })

  it('disables deletion protection', () => {
    const cmds = buildEditCommands(node('rds', 'mydb'), { resource: 'rds', deletionProtection: false })
    expect(cmds[0]).toContain('--no-deletion-protection')
  })
})

describe('buildEditCommands — S3', () => {
  it('enables versioning', () => {
    expect(buildEditCommands(node('s3', 'my-bucket'), { resource: 's3', versioning: true })).toEqual([
      ['s3api', 'put-bucket-versioning', '--bucket', 'my-bucket', '--versioning-configuration', 'Status=Enabled'],
    ])
  })
  it('suspends versioning', () => {
    expect(buildEditCommands(node('s3', 'my-bucket'), { resource: 's3', versioning: false })).toEqual([
      ['s3api', 'put-bucket-versioning', '--bucket', 'my-bucket', '--versioning-configuration', 'Status=Suspended'],
    ])
  })
  it('sets public access block', () => {
    const cmds = buildEditCommands(node('s3', 'my-bucket'), { resource: 's3', blockPublicAccess: true })
    expect(cmds[0][0]).toBe('s3api')
    expect(cmds[0][1]).toBe('put-public-access-block')
  })
})

describe('buildEditCommands — Lambda', () => {
  it('updates memory and timeout', () => {
    const cmds = buildEditCommands(node('lambda', 'my-fn'), { resource: 'lambda', memorySize: 256, timeout: 10 })
    expect(cmds[0]).toEqual(['lambda', 'update-function-configuration', '--function-name', 'my-fn', '--memory-size', '256', '--timeout', '10'])
  })
  it('updates environment variables', () => {
    const cmds = buildEditCommands(node('lambda', 'my-fn'), { resource: 'lambda', environment: { KEY: 'value' } })
    expect(cmds[0]).toContain('--environment')
  })
})

describe('buildEditCommands — ALB', () => {
  it('adds name tag', () => {
    expect(buildEditCommands(node('alb', 'arn:aws:alb'), { resource: 'alb', name: 'my-alb' })).toEqual([
      ['elbv2', 'add-tags', '--resource-arns', 'arn:aws:alb', '--tags', 'Key=Name,Value=my-alb'],
    ])
  })
})
```

- [ ] **Step 3: Run tests to confirm failure**

```bash
npm test -- --run src/renderer/utils/__tests__/buildEditCommands.test.ts 2>&1 | tail -5
```

Expected: FAIL (module not found)

- [ ] **Step 4: Implement `src/renderer/utils/buildEditCommands.ts`**

```typescript
import type { CloudNode } from '../types/cloud'
import type { EditParams, SgRule } from '../types/edit'

function ruleKey(r: SgRule): string {
  return `${r.protocol}:${r.fromPort}:${r.toPort}:${r.cidr}`
}

function formatPermission(r: SgRule): string {
  return `IpProtocol=${r.protocol},FromPort=${r.fromPort},ToPort=${r.toPort},IpRanges=[{CidrIp=${r.cidr}}]`
}

export function buildEditCommands(node: CloudNode, params: EditParams): string[][] {
  switch (params.resource) {
    case 'vpc':
      return [['ec2', 'create-tags', '--resources', node.id, '--tags', `Key=Name,Value=${params.name}`]]

    case 'ec2': {
      const cmds: string[][] = []
      if (params.instanceType) {
        const isRunning = node.status === 'running'
        if (isRunning) cmds.push(['ec2', 'stop-instances', '--instance-ids', node.id])
        cmds.push(['ec2', 'modify-instance-attribute', '--instance-id', node.id, '--instance-type', `Value=${params.instanceType}`])
        cmds.push(['ec2', 'start-instances', '--instance-ids', node.id])
      }
      if (params.name) {
        cmds.push(['ec2', 'create-tags', '--resources', node.id, '--tags', `Key=Name,Value=${params.name}`])
      }
      if (params.securityGroupIds && params.securityGroupIds.length > 0) {
        cmds.push(['ec2', 'modify-instance-attribute', '--instance-id', node.id, '--groups', ...params.securityGroupIds])
      }
      return cmds
    }

    case 'sg': {
      const existing: SgRule[] = (node.metadata.rules as SgRule[]) || []
      const existingKeys = new Set(existing.map(ruleKey))
      const newKeys = new Set(params.rules.map(ruleKey))
      const toRevoke = existing.filter(r => !newKeys.has(ruleKey(r)))
      const toAuthorize = params.rules.filter(r => !existingKeys.has(ruleKey(r)))
      const cmds: string[][] = []
      for (const r of toRevoke) {
        cmds.push(['ec2', 'revoke-security-group-ingress', '--group-id', node.id, '--ip-permissions', formatPermission(r)])
      }
      for (const r of toAuthorize) {
        cmds.push(['ec2', 'authorize-security-group-ingress', '--group-id', node.id, '--ip-permissions', formatPermission(r)])
      }
      return cmds
    }

    case 'rds': {
      const args = ['rds', 'modify-db-instance', '--db-instance-identifier', node.id, '--apply-immediately']
      if (params.dbInstanceClass) args.push('--db-instance-class', params.dbInstanceClass)
      if (params.multiAZ === true)  args.push('--multi-az')
      if (params.multiAZ === false) args.push('--no-multi-az')
      if (params.deletionProtection === true)  args.push('--deletion-protection')
      if (params.deletionProtection === false) args.push('--no-deletion-protection')
      return [args]
    }

    case 's3': {
      const cmds: string[][] = []
      if (params.versioning !== undefined) {
        cmds.push(['s3api', 'put-bucket-versioning', '--bucket', node.id,
          '--versioning-configuration', `Status=${params.versioning ? 'Enabled' : 'Suspended'}`])
      }
      if (params.blockPublicAccess !== undefined) {
        const v = String(params.blockPublicAccess)
        cmds.push(['s3api', 'put-public-access-block', '--bucket', node.id,
          '--public-access-block-configuration',
          `BlockPublicAcls=${v},IgnorePublicAcls=${v},BlockPublicPolicy=${v},RestrictPublicBuckets=${v}`])
      }
      return cmds
    }

    case 'lambda': {
      const args = ['lambda', 'update-function-configuration', '--function-name', node.id]
      if (params.memorySize) args.push('--memory-size', String(params.memorySize))
      if (params.timeout)    args.push('--timeout', String(params.timeout))
      if (params.environment) {
        const vars = Object.entries(params.environment).map(([k, v]) => `${k}=${v}`).join(',')
        args.push('--environment', `Variables={${vars}}`)
      }
      return [args]
    }

    case 'alb':
      return [['elbv2', 'add-tags', '--resource-arns', node.id, '--tags', `Key=Name,Value=${params.name}`]]

    default:
      return []
  }
}
```

- [ ] **Step 5: Run tests — confirm pass**

```bash
npm test -- --run src/renderer/utils/__tests__/buildEditCommands.test.ts 2>&1 | tail -10
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/types/edit.ts src/renderer/utils/buildEditCommands.ts src/renderer/utils/__tests__/buildEditCommands.test.ts
git commit -m "feat: buildEditCommands utility with SG rule diffing"
```

---

### Task 12: Edit form components

**Files:**
- Create: `src/renderer/components/modals/VpcEditForm.tsx`
- Create: `src/renderer/components/modals/Ec2EditForm.tsx`
- Create: `src/renderer/components/modals/SgEditForm.tsx`
- Create: `src/renderer/components/modals/RdsEditForm.tsx`
- Create: `src/renderer/components/modals/S3EditForm.tsx`
- Create: `src/renderer/components/modals/LambdaEditForm.tsx`
- Create: `src/renderer/components/modals/AlbEditForm.tsx`

Each edit form takes `node: CloudNode` (for initial values) and `onChange: (params: XxxEditParams) => void`.

- [ ] **Step 1: Create `src/renderer/components/modals/VpcEditForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { VpcEditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: VpcEditParams) => void; showErrors?: boolean }

const inputStyle = (err: boolean): React.CSSProperties => ({
  width: '100%', background: '#060d14', border: `1px solid ${err ? '#ff5f57' : '#30363d'}`,
  borderRadius: 3, padding: '3px 6px', color: '#eee', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
})
const label: React.CSSProperties = { fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function VpcEditForm({ node, onChange, showErrors }: Props) {
  const [name, setName] = useState((node.metadata.name as string) ?? node.label)

  const update = (v: string) => { setName(v); onChange({ resource: 'vpc', name: v }) }

  return (
    <div>
      <div style={label}>Name</div>
      <input style={inputStyle(!!(showErrors && !name.trim()))} value={name} onChange={e => update(e.target.value)} />
    </div>
  )
}
```

- [ ] **Step 2: Create `src/renderer/components/modals/AlbEditForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { AlbEditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: AlbEditParams) => void; showErrors?: boolean }

const inputStyle = (err: boolean): React.CSSProperties => ({
  width: '100%', background: '#060d14', border: `1px solid ${err ? '#ff5f57' : '#30363d'}`,
  borderRadius: 3, padding: '3px 6px', color: '#eee', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
})
const label: React.CSSProperties = { fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function AlbEditForm({ node, onChange, showErrors }: Props) {
  const [name, setName] = useState((node.metadata.name as string) ?? node.label)
  const update = (v: string) => { setName(v); onChange({ resource: 'alb', name: v }) }
  return (
    <div>
      <div style={label}>Name Tag</div>
      <input style={inputStyle(!!(showErrors && !name.trim()))} value={name} onChange={e => update(e.target.value)} />
    </div>
  )
}
```

- [ ] **Step 3: Create `src/renderer/components/modals/RdsEditForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { RdsEditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: RdsEditParams) => void }

const sel: React.CSSProperties = { width: '100%', background: '#060d14', border: '1px solid #30363d', borderRadius: 3, padding: '3px 6px', color: '#eee', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }

export default function RdsEditForm({ node, onChange }: Props) {
  const [cls, setCls]    = useState((node.metadata.dbInstanceClass as string) ?? 'db.t3.micro')
  const [multiAZ, setMultiAZ] = useState(!!(node.metadata.multiAZ))
  const [delProt, setDelProt] = useState(!!(node.metadata.deletionProtection))

  const emit = (overrides: Partial<RdsEditParams>) =>
    onChange({ resource: 'rds', dbInstanceClass: cls, multiAZ, deletionProtection: delProt, ...overrides })

  return (
    <div>
      <div style={lbl}>Instance class</div>
      <select style={sel} value={cls} onChange={e => { setCls(e.target.value); emit({ dbInstanceClass: e.target.value }) }}>
        {['db.t3.micro','db.t3.small','db.m5.large'].map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <label style={row}><input type="checkbox" checked={multiAZ} onChange={e => { setMultiAZ(e.target.checked); emit({ multiAZ: e.target.checked }) }} /><span style={{ fontSize: 10, color: '#aaa' }}>Multi-AZ</span></label>
      <label style={row}><input type="checkbox" checked={delProt} onChange={e => { setDelProt(e.target.checked); emit({ deletionProtection: e.target.checked }) }} /><span style={{ fontSize: 10, color: '#aaa' }}>Deletion protection</span></label>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/renderer/components/modals/S3EditForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { S3EditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: S3EditParams) => void }

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }

export default function S3EditForm({ node, onChange }: Props) {
  const [versioning, setVersioning] = useState(!!(node.metadata.versioning))
  const [blockPublic, setBlockPublic] = useState(!!(node.metadata.blockPublicAccess))

  const emit = (overrides: Partial<S3EditParams>) =>
    onChange({ resource: 's3', versioning, blockPublicAccess: blockPublic, ...overrides })

  return (
    <div>
      <label style={row}><input type="checkbox" checked={versioning} onChange={e => { setVersioning(e.target.checked); emit({ versioning: e.target.checked }) }} /><span style={{ fontSize: 10, color: '#aaa' }}>Versioning</span></label>
      <label style={row}><input type="checkbox" checked={blockPublic} onChange={e => { setBlockPublic(e.target.checked); emit({ blockPublicAccess: e.target.checked }) }} /><span style={{ fontSize: 10, color: '#aaa' }}>Block public access</span></label>
    </div>
  )
}
```

- [ ] **Step 5: Create `src/renderer/components/modals/LambdaEditForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { LambdaEditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: LambdaEditParams) => void }

const inp: React.CSSProperties = { width: '100%', background: '#060d14', border: '1px solid #30363d', borderRadius: 3, padding: '3px 6px', color: '#eee', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function LambdaEditForm({ node, onChange }: Props) {
  const [memory, setMemory]   = useState(Number(node.metadata.memorySize) || 128)
  const [timeout, setTimeout] = useState(Number(node.metadata.timeout) || 3)
  const [envStr, setEnvStr]   = useState(() => {
    const env = node.metadata.environment as Record<string, string> | undefined
    return env ? Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') : ''
  })

  const parseEnv = (s: string): Record<string, string> =>
    Object.fromEntries(s.split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] }))

  const emit = (overrides: Partial<LambdaEditParams>) =>
    onChange({ resource: 'lambda', memorySize: memory, timeout, environment: parseEnv(envStr), ...overrides })

  return (
    <div>
      <div style={lbl}>Memory (MB)</div>
      <input type="number" style={inp} value={memory} onChange={e => { setMemory(Number(e.target.value)); emit({ memorySize: Number(e.target.value) }) }} />
      <div style={lbl}>Timeout (s)</div>
      <input type="number" style={inp} value={timeout} onChange={e => { setTimeout(Number(e.target.value)); emit({ timeout: Number(e.target.value) }) }} />
      <div style={lbl}>Environment variables (KEY=value, one per line)</div>
      <textarea style={{ ...inp, height: 60, resize: 'vertical' }} value={envStr} onChange={e => { setEnvStr(e.target.value); emit({ environment: parseEnv(e.target.value) }) }} />
    </div>
  )
}
```

- [ ] **Step 6: Create `src/renderer/components/modals/Ec2EditForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { Ec2EditParams } from '../../types/edit'
import { useCloudStore } from '../../store/cloud'

interface Props { node: CloudNode; onChange: (p: Ec2EditParams) => void }

const inp: React.CSSProperties = { width: '100%', background: '#060d14', border: '1px solid #30363d', borderRadius: 3, padding: '3px 6px', color: '#eee', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const }
const sel = inp
const lbl: React.CSSProperties = { fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function Ec2EditForm({ node, onChange }: Props) {
  const nodes = useCloudStore((s) => s.nodes)
  const [name, setName]       = useState((node.metadata.name as string) ?? node.label)
  const [instType, setInstType] = useState((node.metadata.instanceType as string) ?? 't3.micro')
  const [sgIds, setSgIds]     = useState<string[]>((node.metadata.securityGroupIds as string[]) ?? [])

  const sgs = nodes.filter(n => n.type === 'security-group')

  const emit = (overrides: Partial<Ec2EditParams>) =>
    onChange({ resource: 'ec2', name, instanceType: instType, securityGroupIds: sgIds, ...overrides })

  const toggleSg = (id: string) => {
    const next = sgIds.includes(id) ? sgIds.filter(x => x !== id) : [...sgIds, id]
    setSgIds(next)
    emit({ securityGroupIds: next })
  }

  return (
    <div>
      <div style={lbl}>Name</div>
      <input style={inp} value={name} onChange={e => { setName(e.target.value); emit({ name: e.target.value }) }} />
      <div style={lbl}>Instance type</div>
      <select style={sel} value={instType} onChange={e => { setInstType(e.target.value); emit({ instanceType: e.target.value }) }}>
        {['t3.micro','t3.small','t3.medium','t3.large','m5.large','m5.xlarge','c5.large'].map(t => <option key={t}>{t}</option>)}
      </select>
      {sgs.length > 0 && (
        <>
          <div style={lbl}>Security groups</div>
          {sgs.map(sg => (
            <label key={sg.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, color: '#aaa', cursor: 'pointer' }}>
              <input type="checkbox" checked={sgIds.includes(sg.id)} onChange={() => toggleSg(sg.id)} />
              {sg.label} ({sg.id})
            </label>
          ))}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Create `src/renderer/components/modals/SgEditForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { SgEditParams, SgRule } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: SgEditParams) => void }

const inp: React.CSSProperties = { background: '#060d14', border: '1px solid #30363d', borderRadius: 3, padding: '2px 4px', color: '#eee', fontFamily: 'monospace', fontSize: 9, boxSizing: 'border-box' as const }

export default function SgEditForm({ node, onChange }: Props) {
  const initial: SgRule[] = (node.metadata.rules as SgRule[]) ?? []
  const [rules, setRules] = useState<SgRule[]>(initial.length > 0 ? initial : [{ protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '0.0.0.0/0' }])

  const update = (next: SgRule[]) => { setRules(next); onChange({ resource: 'sg', rules: next }) }

  const setRule = (i: number, field: keyof SgRule, value: string | number) => {
    const next = rules.map((r, idx) => idx === i ? { ...r, [field]: value } : r)
    update(next)
  }

  return (
    <div>
      <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 6 }}>Inbound rules</div>
      {rules.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
          <select style={{ ...inp, width: 60 }} value={r.protocol} onChange={e => setRule(i, 'protocol', e.target.value)}>
            {['tcp','udp','icmp','-1'].map(p => <option key={p} value={p}>{p === '-1' ? 'all' : p}</option>)}
          </select>
          <input style={{ ...inp, width: 40 }} type="number" value={r.fromPort} onChange={e => setRule(i, 'fromPort', Number(e.target.value))} />
          <span style={{ color: '#555', fontSize: 9 }}>-</span>
          <input style={{ ...inp, width: 40 }} type="number" value={r.toPort} onChange={e => setRule(i, 'toPort', Number(e.target.value))} />
          <input style={{ ...inp, flex: 1 }} value={r.cidr} onChange={e => setRule(i, 'cidr', e.target.value)} />
          <button onClick={() => update(rules.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#ff5f57', cursor: 'pointer', fontSize: 12, padding: '0 2px' }}>✕</button>
        </div>
      ))}
      <button onClick={() => update([...rules, { protocol: 'tcp', fromPort: 80, toPort: 80, cidr: '0.0.0.0/0' }])} style={{ background: 'none', border: '1px solid #30363d', borderRadius: 3, color: '#aaa', fontSize: 9, padding: '2px 8px', cursor: 'pointer', marginTop: 2 }}>
        + Add rule
      </button>
    </div>
  )
}
```

- [ ] **Step 8: Run full test suite**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: all pass (edit forms have no tests yet — covered by visual inspection + EditModal tests in Task 13)

- [ ] **Step 9: Commit**

```bash
git add src/renderer/components/modals/VpcEditForm.tsx src/renderer/components/modals/Ec2EditForm.tsx src/renderer/components/modals/SgEditForm.tsx src/renderer/components/modals/RdsEditForm.tsx src/renderer/components/modals/S3EditForm.tsx src/renderer/components/modals/LambdaEditForm.tsx src/renderer/components/modals/AlbEditForm.tsx
git commit -m "feat: edit form components for all 7 resource types"
```

---

### Task 13: EditModal + wire edit flow

**Files:**
- Create: `src/renderer/components/modals/EditModal.tsx`
- Create: `src/renderer/components/modals/__tests__/EditModal.test.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/renderer/components/modals/__tests__/EditModal.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EditModal from '../EditModal'
import type { CloudNode } from '../../../types/cloud'

const vpcNode: CloudNode = { id: 'vpc-123', type: 'vpc', label: 'my-vpc', status: 'running', region: 'us-east-1', metadata: { name: 'my-vpc' } }

beforeEach(() => {
  window.cloudblocks = {
    runCli: vi.fn().mockResolvedValue({ code: 0 }),
    cancelCli: vi.fn(),
    onCliOutput: vi.fn().mockReturnValue(() => {}),
    onCliDone: vi.fn().mockReturnValue(() => {}),
    startScan: vi.fn().mockResolvedValue(undefined),
  } as unknown as typeof window.cloudblocks
})

describe('EditModal', () => {
  it('renders nothing when node is null', () => {
    const { container } = render(<EditModal node={null} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders edit title for VPC', () => {
    render(<EditModal node={vpcNode} onClose={vi.fn()} />)
    expect(screen.getByText(/edit vpc/i)).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<EditModal node={vpcNode} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test -- --run src/renderer/components/modals/__tests__/EditModal.test.tsx 2>&1 | tail -5
```

Expected: FAIL (module not found)

- [ ] **Step 3: Create `src/renderer/components/modals/EditModal.tsx`**

```tsx
import React, { useRef, useState, useEffect } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { EditParams } from '../../types/edit'
import { buildEditCommands } from '../../utils/buildEditCommands'
import { useCloudStore } from '../../store/cloud'
import VpcEditForm from './VpcEditForm'
import Ec2EditForm from './Ec2EditForm'
import SgEditForm from './SgEditForm'
import RdsEditForm from './RdsEditForm'
import S3EditForm from './S3EditForm'
import LambdaEditForm from './LambdaEditForm'
import AlbEditForm from './AlbEditForm'

interface EditModalProps {
  node: CloudNode | null
  onClose: () => void
}

const RESOURCE_LABELS: Record<string, string> = {
  vpc: 'VPC', ec2: 'EC2 Instance', 'security-group': 'Security Group',
  rds: 'RDS Instance', s3: 'S3 Bucket', lambda: 'Lambda Function', alb: 'Load Balancer',
}

export default function EditModal({ node, onClose }: EditModalProps) {
  const { setCommandPreview, appendCliOutput, clearCliOutput } = useCloudStore()
  const [showErrors, setShowErrors] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const paramsRef = useRef<EditParams | null>(null)
  const handleRunRef = useRef<() => void>(() => {})

  useEffect(() => {
    const listener = () => handleRunRef.current()
    window.addEventListener('commanddrawer:run', listener)
    return () => window.removeEventListener('commanddrawer:run', listener)
  }, [])

  if (!node) return null

  const handleChange = (params: EditParams) => {
    paramsRef.current = params
    const cmds = buildEditCommands(node, params)
    setCommandPreview(cmds.map(argv => 'aws ' + argv.join(' ')))
  }

  const handleRun = async () => {
    if (!paramsRef.current) { setShowErrors(true); return }
    const cmds = buildEditCommands(node, paramsRef.current)
    if (cmds.length === 0) { onClose(); return }
    setIsRunning(true)
    clearCliOutput()
    const unsubOutput = window.cloudblocks.onCliOutput(d => appendCliOutput(d))
    const result = await window.cloudblocks.runCli(cmds)
    unsubOutput()
    setIsRunning(false)
    if (result.code === 0) {
      setCommandPreview([])
      onClose()
      await window.cloudblocks.startScan()
    }
  }

  handleRunRef.current = handleRun

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  }
  const modal: React.CSSProperties = {
    background: '#0d1117', border: `1px solid #FF9900`, borderRadius: 8,
    padding: 20, width: 360, maxHeight: '80vh', overflowY: 'auto',
    fontFamily: 'monospace',
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && !isRunning && onClose()}>
      <div style={modal}>
        <div style={{ color: '#FF9900', fontWeight: 'bold', fontSize: 13, marginBottom: 12, borderBottom: '1px solid #1e2d40', paddingBottom: 8 }}>
          Edit {RESOURCE_LABELS[node.type] ?? node.type}
        </div>

        {node.type === 'vpc'             && <VpcEditForm    node={node} onChange={handleChange} showErrors={showErrors} />}
        {node.type === 'ec2'             && <Ec2EditForm    node={node} onChange={handleChange} />}
        {node.type === 'security-group'  && <SgEditForm     node={node} onChange={handleChange} />}
        {node.type === 'rds'             && <RdsEditForm    node={node} onChange={handleChange} />}
        {node.type === 's3'              && <S3EditForm     node={node} onChange={handleChange} />}
        {node.type === 'lambda'          && <LambdaEditForm node={node} onChange={handleChange} />}
        {node.type === 'alb'             && <AlbEditForm    node={node} onChange={handleChange} showErrors={showErrors} />}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            disabled={isRunning}
            onClick={onClose}
            style={{ background: '#1a2332', border: '1px solid #30363d', borderRadius: 3, padding: '4px 16px', color: '#aaa', fontFamily: 'monospace', fontSize: 11, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            disabled={isRunning}
            onClick={handleRun}
            style={{ background: '#22c55e', border: 'none', borderRadius: 3, padding: '4px 16px', color: '#000', fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}
          >
            {isRunning ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npm test -- --run src/renderer/components/modals/__tests__/EditModal.test.tsx 2>&1 | tail -10
```

Expected: all 3 tests PASS

- [ ] **Step 5: Mount EditModal in `src/renderer/src/App.tsx`**

Add import:
```typescript
import EditModal from '../components/modals/EditModal'
```

The `editTarget` state was added as a placeholder in Task 10. Add the render:
```tsx
<EditModal node={editTarget} onClose={() => setEditTarget(null)} />
```

The `NodeContextMenu` already calls `setEditTarget(node)` on Edit. Inspector already calls `setEditTarget(node)` on Edit button (wired in Task 10).

- [ ] **Step 6: Run full test suite**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/modals/EditModal.tsx src/renderer/components/modals/__tests__/EditModal.test.tsx src/renderer/src/App.tsx
git commit -m "feat: EditModal with per-resource edit forms; wire from context menu + Inspector"
```

---

## Chunk 5: Quick Actions + New Create Forms

### Task 14: Inspector quick action buttons

**Files:**
- Modify: `src/renderer/components/Inspector.tsx`
- Modify: `src/renderer/src/App.tsx`

**Context:** EC2 and RDS nodes show Stop/Start/Reboot buttons in the Inspector. Clicking dispatches `buildQuickActionCommand` result to `pendingCommand` + `commandPreview` in the store. The CommandDrawer Run button then executes it.

- [ ] **Step 1: Read `src/renderer/components/Inspector.tsx`**

```bash
cat src/renderer/components/Inspector.tsx
```

- [ ] **Step 2: Update `Inspector.tsx` — add `onQuickAction` prop + buttons**

Add props:
```typescript
interface InspectorProps {
  onDelete: (node: CloudNode) => void
  onEdit: (node: CloudNode) => void
  onQuickAction: (node: CloudNode, action: 'stop' | 'start' | 'reboot') => void
}
```

After the existing Edit/Delete buttons, add quick action buttons for EC2 and RDS:

```tsx
{(selectedNode.type === 'ec2' || selectedNode.type === 'rds') && (
  <div style={{ marginTop: 8 }}>
    <div style={{ fontSize: 8, color: '#555', textTransform: 'uppercase', marginBottom: 4 }}>Quick actions</div>
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {selectedNode.status !== 'stopped' && (
        <button onClick={() => onQuickAction(selectedNode, 'stop')}
          style={{ background: '#1a2332', border: '1px solid #febc2e', borderRadius: 2, padding: '2px 8px', color: '#febc2e', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}>
          Stop
        </button>
      )}
      {selectedNode.status === 'stopped' && (
        <button onClick={() => onQuickAction(selectedNode, 'start')}
          style={{ background: '#1a2332', border: '1px solid #28c840', borderRadius: 2, padding: '2px 8px', color: '#28c840', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}>
          Start
        </button>
      )}
      <button onClick={() => onQuickAction(selectedNode, 'reboot')}
        style={{ background: '#1a2332', border: '1px solid #64b5f6', borderRadius: 2, padding: '2px 8px', color: '#64b5f6', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}>
        Reboot
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Update `App.tsx` — pass `onQuickAction` to Inspector**

```typescript
const handleQuickAction = (node: CloudNode, action: 'stop' | 'start' | 'reboot') => {
  const cmds = buildQuickActionCommand(node, action)
  setCommandPreview(cmds.map(a => 'aws ' + a.join(' ')))
  setPendingCommand(cmds)
}
```

```tsx
<Inspector
  onDelete={handleDeleteRequest}
  onEdit={node => setEditTarget(node)}
  onQuickAction={handleQuickAction}
/>
```

- [ ] **Step 4: Run full test suite**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Inspector.tsx src/renderer/src/App.tsx
git commit -m "feat: Inspector quick action buttons for EC2/RDS stop/start/reboot"
```

---

### Task 15: New create forms — RDS, Lambda, ALB

**Files:**
- Modify: `src/renderer/types/create.ts`
- Modify: `src/renderer/utils/buildCommand.ts`
- Modify: `src/renderer/utils/__tests__/buildCommand.test.ts`
- Create: `src/renderer/components/modals/RdsForm.tsx`
- Create: `src/renderer/components/modals/LambdaForm.tsx`
- Create: `src/renderer/components/modals/AlbForm.tsx`

- [ ] **Step 1: Write failing buildCommand tests for new types**

In `src/renderer/utils/__tests__/buildCommand.test.ts`, add:

```typescript
describe('buildCommands — RDS', () => {
  it('generates create-db-instance command', () => {
    const cmds = buildCommands({
      resource: 'rds',
      identifier: 'mydb',
      engine: 'mysql',
      instanceClass: 'db.t3.micro',
      masterUsername: 'admin',
      masterPassword: 'secret',
      allocatedStorage: 20,
      multiAZ: false,
      publiclyAccessible: false,
    })
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toContain('create-db-instance')
    expect(cmds[0]).toContain('mydb')
    expect(cmds[0]).toContain('mysql')
    expect(cmds[0]).toContain('--no-publicly-accessible')
  })
})

describe('buildCommands — Lambda', () => {
  it('generates create-function command without VPC', () => {
    const cmds = buildCommands({
      resource: 'lambda',
      name: 'my-fn',
      runtime: 'nodejs20.x',
      handler: 'index.handler',
      roleArn: 'arn:aws:iam::123:role/my-role',
      memorySize: 128,
      timeout: 3,
    })
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toContain('create-function')
    expect(cmds[0]).toContain('my-fn')
    expect(cmds[0]).not.toContain('--vpc-config')
  })

  it('includes vpc-config when VPC is set', () => {
    const cmds = buildCommands({
      resource: 'lambda',
      name: 'my-fn',
      runtime: 'nodejs20.x',
      handler: 'index.handler',
      roleArn: 'arn:aws:iam::123:role/my-role',
      memorySize: 128,
      timeout: 3,
      vpcId: 'vpc-123',
      subnetIds: ['subnet-1', 'subnet-2'],
      securityGroupIds: ['sg-1'],
    })
    expect(cmds[0]).toContain('--vpc-config')
    expect(cmds[0].join(' ')).toContain('subnet-1,subnet-2')
  })
})

describe('buildCommands — ALB', () => {
  it('generates create-load-balancer command', () => {
    const cmds = buildCommands({
      resource: 'alb',
      name: 'my-alb',
      scheme: 'internet-facing',
      subnetIds: ['subnet-1', 'subnet-2'],
      securityGroupIds: ['sg-1'],
    })
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toContain('create-load-balancer')
    expect(cmds[0]).toContain('my-alb')
    expect(cmds[0]).toContain('internet-facing')
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test -- --run src/renderer/utils/__tests__/buildCommand.test.ts 2>&1 | tail -5
```

Expected: FAIL

- [ ] **Step 3: Add new params types to `src/renderer/types/create.ts`**

```typescript
export interface RdsParams {
  resource: 'rds'
  identifier: string
  engine: 'mysql' | 'postgres' | 'mariadb'
  instanceClass: string
  masterUsername: string
  masterPassword: string
  allocatedStorage: number
  multiAZ: boolean
  publiclyAccessible: boolean
  vpcId?: string
}

export interface LambdaParams {
  resource: 'lambda'
  name: string
  runtime: 'nodejs20.x' | 'python3.12' | 'java21' | 'go1.x'
  handler: string
  roleArn: string
  memorySize: number
  timeout: number
  vpcId?: string
  subnetIds?: string[]
  securityGroupIds?: string[]
}

export interface AlbParams {
  resource: 'alb'
  name: string
  scheme: 'internet-facing' | 'internal'
  subnetIds: string[]
  securityGroupIds: string[]
  vpcId?: string
}

// Add to CreateParams union:
export type CreateParams = VpcParams | Ec2Params | SgParams | S3Params | RdsParams | LambdaParams | AlbParams
```

- [ ] **Step 4: Add builders to `src/renderer/utils/buildCommand.ts`**

```typescript
function buildRdsCommands(p: RdsParams): string[][] {
  const args = [
    'rds', 'create-db-instance',
    '--db-instance-identifier', p.identifier,
    '--db-instance-class', p.instanceClass,
    '--engine', p.engine,
    '--master-username', p.masterUsername,
    '--master-user-password', p.masterPassword,
    '--allocated-storage', String(p.allocatedStorage),
  ]
  if (p.multiAZ) args.push('--multi-az')
  if (p.publiclyAccessible) args.push('--publicly-accessible')
  else args.push('--no-publicly-accessible')
  return [args]
}

function buildLambdaCommands(p: LambdaParams): string[][] {
  const args = [
    'lambda', 'create-function',
    '--function-name', p.name,
    '--runtime', p.runtime,
    '--handler', p.handler,
    '--role', p.roleArn,
    '--code', 'ZipFile=fileb://function.zip',
    '--memory-size', String(p.memorySize),
    '--timeout', String(p.timeout),
  ]
  if (p.vpcId && p.subnetIds && p.securityGroupIds) {
    args.push('--vpc-config', `SubnetIds=${p.subnetIds.join(',')},SecurityGroupIds=${p.securityGroupIds.join(',')}`)
  }
  return [args]
}

function buildAlbCommands(p: AlbParams): string[][] {
  return [[
    'elbv2', 'create-load-balancer',
    '--name', p.name,
    '--scheme', p.scheme,
    '--subnets', ...p.subnetIds,
    '--security-groups', ...p.securityGroupIds,
  ]]
}
```

In the `buildCommands` exported function, find the existing `switch (params.resource)` statement and add three new cases before the `default` (or closing brace):

```typescript
case 'rds':    return buildRdsCommands(params as RdsParams)
case 'lambda': return buildLambdaCommands(params as LambdaParams)
case 'alb':    return buildAlbCommands(params as AlbParams)
```

Also import the new types at the top of the file: `import type { ..., RdsParams, LambdaParams, AlbParams } from '../types/create'`

- [ ] **Step 5: Run buildCommand tests — confirm pass**

```bash
npm test -- --run src/renderer/utils/__tests__/buildCommand.test.ts 2>&1 | tail -10
```

Expected: all tests PASS

- [ ] **Step 6: Create `src/renderer/components/modals/RdsForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { RdsParams } from '../../types/create'
import { useCloudStore } from '../../store/cloud'

interface Props { onChange: (p: RdsParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({ width: '100%', background: '#060d14', border: `1px solid ${err ? '#ff5f57' : '#30363d'}`, borderRadius: 3, padding: '3px 6px', color: '#eee', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const })
const sel = (err: boolean): React.CSSProperties => ({ ...inp(err), cursor: 'pointer' })
const lbl: React.CSSProperties = { fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }

export default function RdsForm({ onChange, showErrors }: Props) {
  const [form, setForm] = useState<Omit<RdsParams, 'resource'>>({
    identifier: '', engine: 'mysql', instanceClass: 'db.t3.micro',
    masterUsername: '', masterPassword: '', allocatedStorage: 20,
    multiAZ: false, publiclyAccessible: false,
  })

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange({ resource: 'rds', ...next })
  }

  const err = showErrors ?? false

  return (
    <div>
      <div style={lbl}>DB instance identifier *</div>
      <input style={inp(err && !form.identifier)} value={form.identifier} onChange={e => update('identifier', e.target.value)} />
      <div style={lbl}>Engine</div>
      <select style={sel(false)} value={form.engine} onChange={e => update('engine', e.target.value as RdsParams['engine'])}>
        <option value="mysql">MySQL</option>
        <option value="postgres">PostgreSQL</option>
        <option value="mariadb">MariaDB</option>
      </select>
      <div style={lbl}>Instance class</div>
      <select style={sel(false)} value={form.instanceClass} onChange={e => update('instanceClass', e.target.value)}>
        {['db.t3.micro','db.t3.small','db.m5.large'].map(c => <option key={c}>{c}</option>)}
      </select>
      <div style={lbl}>Master username *</div>
      <input style={inp(err && !form.masterUsername)} value={form.masterUsername} onChange={e => update('masterUsername', e.target.value)} />
      <div style={lbl}>Master password *</div>
      <input type="password" style={inp(err && !form.masterPassword)} value={form.masterPassword} onChange={e => update('masterPassword', e.target.value)} />
      <div style={lbl}>Allocated storage (GB)</div>
      <input type="number" style={inp(false)} value={form.allocatedStorage} onChange={e => update('allocatedStorage', Number(e.target.value))} />
      <label style={row}><input type="checkbox" checked={form.multiAZ} onChange={e => update('multiAZ', e.target.checked)} /><span style={{ fontSize: 10, color: '#aaa' }}>Multi-AZ</span></label>
      <label style={row}><input type="checkbox" checked={form.publiclyAccessible} onChange={e => update('publiclyAccessible', e.target.checked)} /><span style={{ fontSize: 10, color: '#aaa' }}>Publicly accessible</span></label>
    </div>
  )
}
```

- [ ] **Step 7: Create `src/renderer/components/modals/LambdaForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { LambdaParams } from '../../types/create'
import { useCloudStore } from '../../store/cloud'

interface Props { onChange: (p: LambdaParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({ width: '100%', background: '#060d14', border: `1px solid ${err ? '#ff5f57' : '#30363d'}`, borderRadius: 3, padding: '3px 6px', color: '#eee', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const })
const sel = inp
const lbl: React.CSSProperties = { fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function LambdaForm({ onChange, showErrors }: Props) {
  const nodes = useCloudStore((s) => s.nodes)
  const vpcs    = nodes.filter(n => n.type === 'vpc')
  const subnets = nodes.filter(n => n.type === 'subnet')
  const sgs     = nodes.filter(n => n.type === 'security-group')

  const [form, setForm] = useState<Omit<LambdaParams, 'resource'>>({
    name: '', runtime: 'nodejs20.x', handler: 'index.handler', roleArn: '',
    memorySize: 128, timeout: 3,
  })

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange({ resource: 'lambda', ...next })
  }

  const err = showErrors ?? false
  const filteredSubnets = form.vpcId ? subnets.filter(s => s.metadata.vpcId === form.vpcId) : subnets

  return (
    <div>
      <div style={lbl}>Function name *</div>
      <input style={inp(err && !form.name)} value={form.name} onChange={e => update('name', e.target.value)} />
      <div style={lbl}>Runtime</div>
      <select style={sel(false)} value={form.runtime} onChange={e => update('runtime', e.target.value as LambdaParams['runtime'])}>
        {['nodejs20.x','python3.12','java21','go1.x'].map(r => <option key={r}>{r}</option>)}
      </select>
      <div style={lbl}>Handler</div>
      <input style={inp(err && !form.handler)} value={form.handler} onChange={e => update('handler', e.target.value)} />
      <div style={lbl}>Role ARN *</div>
      <input style={inp(err && !form.roleArn)} value={form.roleArn} onChange={e => update('roleArn', e.target.value)} />
      <div style={lbl}>Memory (MB)</div>
      <input type="number" style={inp(false)} value={form.memorySize} onChange={e => update('memorySize', Number(e.target.value))} />
      <div style={lbl}>Timeout (s)</div>
      <input type="number" style={inp(false)} value={form.timeout} onChange={e => update('timeout', Number(e.target.value))} />
      {vpcs.length > 0 && (
        <>
          <div style={lbl}>VPC (optional)</div>
          <select style={sel(false)} value={form.vpcId ?? ''} onChange={e => update('vpcId', e.target.value || undefined)}>
            <option value="">— none —</option>
            {vpcs.map(v => <option key={v.id} value={v.id}>{v.label} ({v.id})</option>)}
          </select>
        </>
      )}
      {form.vpcId && (
        <>
          <div style={lbl}>Subnets *</div>
          {filteredSubnets.map(s => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, color: '#aaa', cursor: 'pointer' }}>
              <input type="checkbox" checked={(form.subnetIds ?? []).includes(s.id)} onChange={e => {
                const ids = form.subnetIds ?? []
                update('subnetIds', e.target.checked ? [...ids, s.id] : ids.filter(x => x !== s.id))
              }} />
              {s.label} ({s.id})
            </label>
          ))}
          <div style={lbl}>Security groups *</div>
          {sgs.map(sg => (
            <label key={sg.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, color: '#aaa', cursor: 'pointer' }}>
              <input type="checkbox" checked={(form.securityGroupIds ?? []).includes(sg.id)} onChange={e => {
                const ids = form.securityGroupIds ?? []
                update('securityGroupIds', e.target.checked ? [...ids, sg.id] : ids.filter(x => x !== sg.id))
              }} />
              {sg.label} ({sg.id})
            </label>
          ))}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Create `src/renderer/components/modals/AlbForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { AlbParams } from '../../types/create'
import { useCloudStore } from '../../store/cloud'

interface Props { onChange: (p: AlbParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({ width: '100%', background: '#060d14', border: `1px solid ${err ? '#ff5f57' : '#30363d'}`, borderRadius: 3, padding: '3px 6px', color: '#eee', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const })
const sel = inp
const lbl: React.CSSProperties = { fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function AlbForm({ onChange, showErrors }: Props) {
  const nodes   = useCloudStore((s) => s.nodes)
  const vpcs    = nodes.filter(n => n.type === 'vpc')
  const subnets = nodes.filter(n => n.type === 'subnet')
  const sgs     = nodes.filter(n => n.type === 'security-group')

  const [form, setForm] = useState<Omit<AlbParams, 'resource'>>({
    name: '', scheme: 'internet-facing', subnetIds: [], securityGroupIds: [],
  })

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange({ resource: 'alb', ...next })
  }

  const err = showErrors ?? false
  const filteredSubnets = form.vpcId ? subnets.filter(s => s.metadata.vpcId === form.vpcId) : subnets

  return (
    <div>
      <div style={lbl}>Name *</div>
      <input style={inp(err && !form.name)} value={form.name} onChange={e => update('name', e.target.value)} />
      <div style={lbl}>Scheme</div>
      <select style={sel(false)} value={form.scheme} onChange={e => update('scheme', e.target.value as AlbParams['scheme'])}>
        <option value="internet-facing">Internet-facing</option>
        <option value="internal">Internal</option>
      </select>
      {vpcs.length > 0 && (
        <>
          <div style={lbl}>VPC</div>
          <select style={sel(false)} value={form.vpcId ?? ''} onChange={e => update('vpcId', e.target.value || undefined)}>
            <option value="">— select VPC —</option>
            {vpcs.map(v => <option key={v.id} value={v.id}>{v.label} ({v.id})</option>)}
          </select>
        </>
      )}
      <div style={lbl}>Subnets (select ≥2) *</div>
      {filteredSubnets.map(s => (
        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, color: '#aaa', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.subnetIds.includes(s.id)} onChange={e => {
            const ids = form.subnetIds
            update('subnetIds', e.target.checked ? [...ids, s.id] : ids.filter(x => x !== s.id))
          }} />
          {s.label} ({s.id})
        </label>
      ))}
      <div style={lbl}>Security groups *</div>
      {sgs.map(sg => (
        <label key={sg.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, color: '#aaa', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.securityGroupIds.includes(sg.id)} onChange={e => {
            const ids = form.securityGroupIds
            update('securityGroupIds', e.target.checked ? [...ids, sg.id] : ids.filter(x => x !== sg.id))
          }} />
          {sg.label} ({sg.id})
        </label>
      ))}
    </div>
  )
}
```

- [ ] **Step 9: Run full test suite**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 10: Commit**

```bash
git add src/renderer/types/create.ts src/renderer/utils/buildCommand.ts src/renderer/utils/__tests__/buildCommand.test.ts src/renderer/components/modals/RdsForm.tsx src/renderer/components/modals/LambdaForm.tsx src/renderer/components/modals/AlbForm.tsx
git commit -m "feat: RDS/Lambda/ALB create params + command builders + forms"
```

---

### Task 16: Wire new create forms into CreateModal + CanvasContextMenu

**Files:**
- Modify: `src/renderer/components/modals/CreateModal.tsx`
- Modify: `src/renderer/components/canvas/CanvasContextMenu.tsx`

- [ ] **Step 1: Read both files**

```bash
cat src/renderer/components/modals/CreateModal.tsx
cat src/renderer/components/canvas/CanvasContextMenu.tsx
```

- [ ] **Step 2: Update `CreateModal.tsx` — add RDS, Lambda, ALB dispatch**

Add imports:
```typescript
import RdsForm from './RdsForm'
import LambdaForm from './LambdaForm'
import AlbForm from './AlbForm'
```

Add to the form render switch (alongside existing VPC/EC2/SG/S3 cases):
```tsx
{activeCreate?.resource === 'rds'    && <RdsForm    onChange={handleChange} showErrors={showErrors} />}
{activeCreate?.resource === 'lambda' && <LambdaForm onChange={handleChange} showErrors={showErrors} />}
{activeCreate?.resource === 'alb'    && <AlbForm    onChange={handleChange} showErrors={showErrors} />}
```

Add validation cases to `validateParams`:
```typescript
case 'rds':    return !!(params.identifier && params.masterUsername && params.masterPassword)
case 'lambda': return !!(params.name && params.roleArn && params.handler)
case 'alb':    return !!(params.name && params.subnetIds.length >= 2)
```

Update the modal title to include new types:
```typescript
const RESOURCE_TITLES: Record<string, string> = {
  vpc: 'VPC', ec2: 'EC2 Instance', sg: 'Security Group', s3: 'S3 Bucket',
  rds: 'RDS Instance', lambda: 'Lambda Function', alb: 'Load Balancer',
}
```

- [ ] **Step 3: Update `CanvasContextMenu.tsx` — add RDS, Lambda, ALB options**

The existing context menu shows a list of resource types to create. Read the file first (done in Step 1), then add RDS, Lambda, ALB entries to the menu alongside the existing VPC/EC2/SG/S3 entries. Each entry calls `setActiveCreate({ resource: 'rds', view })`, etc. Match the exact style of the existing entries.

- [ ] **Step 4: Run full test suite**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 5: Final commit**

```bash
git add src/renderer/components/modals/CreateModal.tsx src/renderer/components/canvas/CanvasContextMenu.tsx
git commit -m "feat: wire RDS/Lambda/ALB create forms into CreateModal and context menu"
```
