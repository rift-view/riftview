# IPC Boundary

The renderer and main process communicate exclusively through
`window.terminus.*` — a curated set of methods exposed via `contextBridge`
in `src/preload/index.ts`. **Credentials never cross this boundary.**

## Layering

```
renderer (sandboxed)   │   preload (contextBridge)   │   main (privileged)
─────────────────────  │   ─────────────────────────  │   ─────────────────────
React components       │   window.terminus.X(...)     │   ipcMain.handle(IPC.X)
Zustand stores         │   ↓ ipcRenderer.invoke       │   AWS SDK + CLI subprocess
                       │                              │   Filesystem, keychain,
                       │                              │   child_process.spawn
```

Adding a new IPC method requires edits in **four** files — no shortcuts:

1. `src/main/ipc/channels.ts` — add channel constant
2. `src/main/ipc/handlers.ts` — register `ipcMain.handle`
3. `src/preload/index.ts` — expose on `contextBridge`
4. `src/preload/index.d.ts` — declare on `Window.terminus`

Skipping any step fails typecheck or fails at runtime.

## Privilege classes

Every method falls into one of four privilege classes. Classes with
**elevated** privilege MUST be audited by Cybersecurity before changes.

| Class | Risk | What it can do |
|---|---|---|
| **read** | low | Read state, list profiles, fetch metrics (no mutation) |
| **write-scoped** | medium | AWS writes via CLI subprocess with specific argv |
| **elevated** | high | Subprocess spawn, filesystem writes, credential use |

## Method catalogue

### Scan lifecycle — **read**
| Method | Channel | Notes |
|---|---|---|
| `listProfiles()` | `profiles:list` | Reads `~/.aws/config` |
| `selectProfile(AwsProfile)` | `profile:select` | Sets active profile in main |
| `selectRegion(region, endpoint?)` | `region:select` | Endpoint is LocalStack override |
| `startScan(selectedRegions?)` | `scan:start` | Triggers multi-region parallel scan |
| `onScanDelta(cb)` | `scan:delta` (push) | Per-service scan deltas |
| `onScanStatus(cb)` | `scan:status` (push) | `'idle'` / `'scanning'` / `'error'` |
| `onConnStatus(cb)` | `conn:status` (push) | AWS connectivity ping |
| `onScanKeypairs(cb)` | `scan:keypairs` (push) | EC2 key pair names |
| `retryScanService(service)` | `scan:retry-service` | Re-run one service scan |
| `validateCredentials(AwsProfile)` | `credentials:validate` | STS probe before scan |
| `fetchMetrics(params)` | `metrics:fetch` | CloudWatch GetMetricStatistics |
| `getNodeHistory(nodeId)` | `history:get` | Per-node change log JSON |

### Settings / theme — **read**
| Method | Channel | Notes |
|---|---|---|
| `getSettings()` | `settings:get` | Persisted user settings |
| `setSettings(s)` | `settings:set` | Writes to userData/settings.json |
| `getThemeOverrides()` | `theme:overrides` | CSS variable overrides |

### CLI subprocess — **elevated**
| Method | Channel | Notes |
|---|---|---|
| `runCli(argv[][])` | `cli:run` | Spawns `aws` CLI — **argv is not sanitized by preload**; main process assembles env with `AWS_PROFILE` or LocalStack static creds |
| `cancelCli()` | `cli:cancel` (send) | SIGKILL to current CLI child |
| `onCliOutput(cb)` | `cli:output` (push) | stdout/stderr stream |
| `onCliDone(cb)` | `cli:done` (push) | Exit code |

> **Security note:** `runCli` is the most dangerous surface. All write
> actions in Cloudblocks flow through it. Input (argv arrays) comes from
> renderer-side pure builders (`buildCommands`, `buildDeleteCommands`,
> `buildEditCommands`, `buildRemediateCommands`, `buildAdvisoryRemediations`).
> Any new write path MUST go through a pure builder with tests.

### CloudFront SDK writes — **write-scoped** (SDK-based, not CLI)
| Method | Channel |
|---|---|
| `createCloudFront(params)` | `cloudfront:create` |
| `updateCloudFront(id, params)` | `cloudfront:update` |
| `deleteCloudFront(id)` | `cloudfront:delete` |
| `invalidateCloudFront(id, path)` | `cloudfront:invalidate` |

### Terraform — **elevated**
| Method | Channel | Notes |
|---|---|---|
| `exportTerraform(nodes)` | `terraform:export` | File-save dialog; writes .tf |
| `terraformDeploy(hcl, region, endpoint?)` | `terraform:deploy` | Spawns `terraform apply` |
| `importTfState()` | `tfstate:import` | Reads user-selected .tfstate |
| `clearTfState()` | `tfstate:clear` | Removes in-memory baseline |
| `listTfStateModules()` | `tfstate:list-modules` | Module selector data |
| `saveBaseline(nodes, profile, region)` | `tfstate:save-baseline` | Writes scan → baseline .tfstate-like |

### Canvas export — **write-scoped** (filesystem)
| Method | Channel |
|---|---|
| `exportPng()` | `canvas:export-png` |
| `saveExportImage(dataUrl, name)` | `canvas:save-image` |

### Annotations / custom edges — **write-scoped** (filesystem)
| Method | Channel |
|---|---|
| `loadAnnotations()` | `annotations:load` |
| `saveAnnotations(map)` | `annotations:save` |
| `loadCustomEdges()` | `custom-edges:load` |
| `saveCustomEdges(edges)` | `custom-edges:save` |

### IAM analysis — **read**
| Method | Channel |
|---|---|
| `analyzeIam(nodeId, nodeType, metadata)` | `iam:analyze` |

### Drift notification — **read**
| Method | Channel |
|---|---|
| `notifyDrift(count)` | `notify:drift` |

### Plugin metadata — **read**
| Method | Channel |
|---|---|
| `onPluginMetadata(cb)` | `plugin:metadata` (push) |

### SSM terminal — **elevated**
| Method | Channel | Notes |
|---|---|---|
| `startTerminal(params)` | `terminal:start` | Spawns `aws ssm start-session` |
| `sendTerminalInput(sid, data)` | `terminal:input` | Writes to child stdin |
| `resizeTerminal(sid, cols, rows)` | `terminal:resize` | PTY resize |
| `closeTerminal(sid)` | `terminal:close` | SIGKILL session |
| `onTerminalOutput(cb)` | `terminal:output` (push) | Stream stdout/stderr |

### Updates / misc — **read**
| Method | Channel |
|---|---|
| `listAwsProfiles()` | `aws:list-profiles` |
| `onUpdateAvailable(cb)` | `update:available` (push) |

## Invariants

1. **No AWS SDK calls from renderer.** All SDK use happens in main.
2. **No CLI spawn from renderer.** `runCli` is the only write path.
3. **Credentials never serialized to renderer.** `AwsProfile` carries
   only the profile name + optional endpoint. The STS/creds resolution
   happens in main, scoped to the CLI subprocess env.
4. **All `window.terminus.*` methods declared in `preload/index.d.ts`.**
   Runtime calls to undeclared methods fail.

## Architectural holes flagged by graphify

- `App.handleRemediate` → `window.terminus.runCli` is an IPC edge
  invisible to import-graph analysis. Covered by smoke test in
  `tests/renderer/App.handleRemediate.test.tsx`.

## See also

- `src/renderer/STORES.md` — renderer state slice ownership
- `CLAUDE.md` — repo layout and architecture rules
- `src/main/ipc/channels.ts` — canonical channel constants
