export const IPC = {
  PROFILES_LIST: 'profiles:list',
  PROFILE_SELECT: 'profile:select',
  REGION_SELECT: 'region:select',
  SCAN_START: 'scan:start',
  SCAN_DELTA: 'scan:delta',
  SCAN_STATUS: 'scan:status',
  CONN_STATUS: 'conn:status',
  CLI_RUN: 'cli:run',
  CLI_OUTPUT: 'cli:output',
  CLI_DONE: 'cli:done',
  CLI_CANCEL: 'cli:cancel',
  SCAN_KEYPAIRS: 'scan:keypairs', // on → (keyPairs: string[])
  SETTINGS_GET: 'settings:get', // invoke → Settings
  SETTINGS_SET: 'settings:set', // invoke → void
  STYLE_OVERRIDES: 'style:overrides',
  CF_CREATE: 'cloudfront:create', // invoke → { code: number }
  CF_UPDATE: 'cloudfront:update', // invoke → { code: number }
  CF_DELETE: 'cloudfront:delete', // invoke → { code: number }
  CF_INVALIDATE: 'cloudfront:invalidate', // invoke → { code: number }
  TERRAFORM_EXPORT: 'terraform:export', // invoke → { success: boolean }
  TERRAFORM_DEPLOY: 'terraform:deploy', // invoke → TerraformDeployResult
  CANVAS_EXPORT_PNG: 'canvas:export-png', // invoke → { success: boolean; filePath?: string }
  CANVAS_SAVE_IMAGE: 'canvas:save-image', // invoke(dataUrl, defaultName) → { success: boolean; filePath?: string }
  AWS_LIST_PROFILES: 'aws:list-profiles', // invoke → string[]
  UPDATE_AVAILABLE: 'update:available', // push → void (main → renderer)
  ANNOTATIONS_LOAD: 'annotations:load', // invoke → Record<string, string>
  ANNOTATIONS_SAVE: 'annotations:save', // invoke → void
  TFSTATE_IMPORT: 'tfstate:import', // invoke → { nodes: CloudNode[]; error?: string }
  TFSTATE_CLEAR: 'tfstate:clear', // invoke → { ok: boolean }
  IAM_ANALYZE: 'iam:analyze', // invoke → IamAnalysisResult
  NOTIFY_DRIFT: 'notify:drift', // invoke → void (count: number)
  PLUGIN_METADATA: 'plugin:metadata', // push: main → renderer
  CUSTOM_EDGES_SAVE: 'custom-edges:save', // invoke → void
  CUSTOM_EDGES_LOAD: 'custom-edges:load', // invoke → CustomEdge[]
  TFSTATE_LIST_MODULES: 'tfstate:list-modules', // invoke → { modules: TfModuleInfo[]; error?: string }
  TFSTATE_SAVE_BASELINE: 'tfstate:save-baseline', // invoke → { ok: boolean }
  SCAN_RETRY_SERVICE: 'scan:retry-service', // invoke → { ok: boolean }
  CREDENTIALS_VALIDATE: 'credentials:validate', // invoke(AwsProfile) → { ok: boolean; account?: string; arn?: string; error?: string }
  METRICS_FETCH: 'metrics:fetch', // invoke → CloudMetric[]
  HISTORY_GET: 'history:get', // invoke(nodeId: string) → HistoryEntry[]
  TERMINAL_START: 'terminal:start', // invoke → { ok: true; sessionId: string } | { ok: false; error: string }
  TERMINAL_INPUT: 'terminal:input', // invoke(sessionId, data) → void
  TERMINAL_RESIZE: 'terminal:resize', // invoke(sessionId, cols, rows) → void
  TERMINAL_CLOSE: 'terminal:close', // invoke(sessionId) → void
  TERMINAL_OUTPUT: 'terminal:output', // push: main → renderer
  SCAN_ERROR_DETAIL: 'scan:error-detail', // push: main → renderer — { message, kind } for actionable scan failure toasts
  SNAPSHOT_LIST: 'snapshot:list', // invoke(filter?: { profile?, region?, limit? }) → VersionMeta[]
  SNAPSHOT_READ: 'snapshot:read', // invoke(versionId: string) → Snapshot | null
  SNAPSHOT_DELETE: 'snapshot:delete', // invoke(versionId: string) → { ok: boolean }
  // RIFT-40: CLI ↔ desktop file-level interop. Both absent in demo mode.
  SNAPSHOT_EXPORT: 'snapshot:export', // invoke({versionId}) → { ok, path? , error? }
  SNAPSHOT_IMPORT: 'snapshot:import', // invoke() → { ok, versionId?, accountMismatch?, error? }
  // RIFT-77: live current-scan file bridge — distinct from RIFT-40's history-
  // snapshot bridge above. Both absent in demo mode (the preload omits the
  // `scanFile` key entirely). Round-trips the in-memory scan; not stored in
  // SQLite, just a portable JSON blob.
  SCAN_EXPORT_JSON: 'scan:export-json', // invoke({nodes, scannedAt, profile, edges?}) → { ok, path? , error? }
  SCAN_IMPORT_JSON: 'scan:import-json', // invoke() → { ok, nodes, scannedAt, profile, edges? } | { ok: false, error }

  // --- RESTORE (SecOps review required per handler) ---
  // Channels below carry the restore flow. Conditionally registered:
  // - ALL absent in demo mode (RIFTVIEW_DEMO_MODE=1)
  // - RESTORE_PLAN / RESTORE_CONFIRM_STEP / RESTORE_APPLY also absent when safeStorage unavailable
  RESTORE_VERSIONS: 'restore:versions', // invoke(snapshotId) → StoredVersion[]
  RESTORE_PLAN: 'restore:plan', // invoke(snapshotId, versionId) → SignedPlanResponse
  RESTORE_COST_ESTIMATE: 'restore:cost-estimate', // invoke(planToken) → CostDelta
  RESTORE_CONFIRM_STEP: 'restore:confirm-step', // invoke(planToken, stepId, typedString) → { confirmationToken }
  RESTORE_APPLY: 'restore:apply', // invoke(planToken, confirmationTokens[]) → { applyId }
  RESTORE_CANCEL: 'restore:cancel', // invoke(applyId) → { ok }
  RESTORE_EVENT: 'restore:event', // push main → renderer: { applyId, stepId, status, message }

  // --- E2E-only channels (registered only when RIFTVIEW_E2E=1) ---
  // Bypasses the native file dialog so Playwright @release specs can drive
  // tfstate import deterministically. No production code path depends on it.
  E2E_IMPORT_TFSTATE: 'e2e:import-tfstate' // invoke(path: string) → CloudNode[]
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
