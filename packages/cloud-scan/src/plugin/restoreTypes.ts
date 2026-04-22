/**
 * Snapshot Export — provider-agnostic restore types (RIF-18).
 *
 * Pure data types. Every interface here is JSON-serializable — no function
 * fields, no Dates, no class instances — so plans and events survive the
 * main → renderer → main IPC loop unchanged.
 *
 * Spec: docs/superpowers/specs/2026-04-20-snapshot-export-provider-interface.md
 * Companion: RIF-5 (stored shape), RIF-20 (apply IPC + security), RIF-21 (cost).
 */

/**
 * Opaque handle to a snapshot archived by RIF-5.
 * The plugin never cracks this open — it asks the store (via main-process
 * helpers) to materialize nodes for a given version when needed. The shape
 * below is deliberately narrow; anything richer is RIF-5's.
 */
export interface StoredVersion {
  readonly versionId: string
  readonly capturedAt: string
  readonly pluginId: string
  readonly region: string
  readonly versionFormat: string
}

/**
 * Literal string identifying the on-disk shape the plugin emits and consumes.
 * `scan-snapshot` is the AWS plugin's day-one format. Future providers are
 * free to declare their own identifier. Cross-plugin restore is explicitly
 * unsupported — the registry enforces that fromVersion.pluginId === plugin.id
 * before calling planRestore.
 *
 * `'unsupported'` is the explicit opt-out for plugins that will not ship
 * snapshot-export in this milestone.
 */
export type VersionFormatId = 'scan-snapshot' | 'unsupported' | (string & {})

/**
 * Structured cost estimate for a single step or an aggregate plan.
 * Shape locked by RIF-21.
 */
export interface CostDeltaEntry {
  readonly currency: 'USD'
  readonly oneTime: number
  readonly recurringMonthly: number
  readonly confidence: 'exact' | 'estimate' | 'unknown'
  readonly notes?: readonly string[]
}

export interface CostDelta {
  readonly planId: string
  readonly perStep: Readonly<Record<string, CostDeltaEntry>>
  readonly aggregate: CostDeltaEntry
}

/**
 * One reversible step the plan will execute.
 * Pure data — JSON-round-trippable so it survives IPC hops.
 */
export interface RestoreStep {
  readonly stepId: string
  readonly op: 'create' | 'update' | 'destroy'
  readonly targetNode: {
    readonly id: string
    readonly type: string
    readonly label: string
    readonly region: string
  }
  /**
   * Plugin-private payload describing *how* to execute the step.
   * Type-erased at the interface boundary. The plugin that produced the plan
   * is the only consumer. Must be JSON-serializable.
   */
  readonly detail: Readonly<Record<string, unknown>>
  /** Filled in by RIF-21's cost model after planning. Undefined at plan time. */
  readonly estimatedCost?: CostDeltaEntry
  /**
   * True if the step would delete, downsize, or otherwise make an externally
   * visible irreversible change. Forces a TypedConfirmation at apply time.
   */
  readonly destructive: boolean
}

/**
 * A planned restore, produced by planRestore, consumed by applyRestore.
 * Inert until applyRestore runs — nothing has happened yet when a
 * RestorePlan exists.
 */
export interface RestorePlan {
  readonly planId: string
  readonly pluginId: string
  readonly versionFormat: VersionFormatId
  readonly from: StoredVersion
  readonly to: StoredVersion | 'live'
  readonly steps: readonly RestoreStep[]
  readonly createdAt: string
  /**
   * Opaque plugin-issued token. The registry-level applyRestore wrapper
   * rejects any plan whose token the plugin does not recognize — prevents
   * tampered plans from reaching apply.
   */
  readonly planToken: string
}

/**
 * A confirmation the user supplied for a destructive step.
 *
 * The `_brand: 'confirmed'` phantom field makes this type impossible to
 * construct by accident — only the RIF-20 IPC round-trip mints one.
 * TypeScript won't let `applyRestore()` run without it for destructive
 * steps; the registry additionally runtime-checks that every destructive
 * step has a matching confirmation before the plugin body runs.
 */
export interface TypedConfirmation {
  readonly _brand: 'confirmed'
  readonly stepId: string
  readonly planId: string
  readonly phrase: string
  readonly confirmedAt: string
}

/**
 * One event per applied step, streamed back to the caller.
 * AsyncIterable is cancellable via iterator return() or an AbortSignal
 * passed in opts (see applyRestore signature).
 */
export type ApplyEvent =
  | { readonly kind: 'started'; readonly stepId: string; readonly startedAt: string }
  | {
      readonly kind: 'succeeded'
      readonly stepId: string
      readonly finishedAt: string
      readonly observed?: Readonly<Record<string, unknown>>
    }
  | {
      readonly kind: 'failed'
      readonly stepId: string
      readonly finishedAt: string
      readonly message: string
      readonly cause?: unknown
    }
  | {
      readonly kind: 'rolled-back'
      readonly stepId: string
      readonly finishedAt: string
      readonly message: string
    }

/**
 * Snapshot-export surface. Mixed into RiftViewPlugin.
 *
 * A plugin declares participation via `versionFormat`:
 *   - a concrete id → the six methods become the plugin's responsibility.
 *   - `'unsupported'` → opt-out. The registry surfaces "restore not supported"
 *     in the UI and the methods remain undefined.
 *
 * Method signatures are optional at the type level so opting-out plugins
 * compile cleanly. The registry enforces the contract at runtime when
 * versionFormat !== 'unsupported'.
 *
 * Additions from RIF-18 (interface-first; AWS plugin stubs with throw):
 *   listVersions — enumerate archived versions for a snapshot
 *   confirmStep  — validate a typed confirmation string for a destructive step
 *   cancel       — cancel an in-flight apply by applyId
 */
export interface RiftViewPluginSnapshotExport {
  readonly versionFormat: VersionFormatId

  /** List stored versions for the given snapshot. Read-only; no side effects. */
  listVersions?(snapshotId: string): Promise<StoredVersion[]>

  planRestore?(fromVersion: StoredVersion, toVersion: StoredVersion | 'live'): Promise<RestorePlan>

  applyRestore?(
    plan: RestorePlan,
    confirmations: readonly TypedConfirmation[],
    opts?: { signal?: AbortSignal }
  ): AsyncIterable<ApplyEvent>

  /**
   * Validate that `typedString` matches the expected confirmation phrase for
   * the given destructive step. Returns an opaque confirmation token scoped to
   * (planToken, stepId) that RESTORE_APPLY requires.
   */
  confirmStep?(
    planToken: string,
    stepId: string,
    typedString: string
  ): Promise<{ confirmationToken: string }>

  /** Cancel an in-flight apply. Idempotent. Does NOT roll back completed steps. */
  cancel?(applyId: string): Promise<{ ok: boolean }>

  /** RIF-21 cost-delta hook. Pass-through; cost model fills CostDelta after planning. */
  estimateCostDelta?(plan: RestorePlan): Promise<CostDelta>
}
