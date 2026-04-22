/**
 * Typecheck-only stub — proves the snapshot-export interface holds for a
 * non-AWS provider without introducing any real scanning code. NOT registered
 * with the plugin registry; NOT imported from production code paths. Its sole
 * purpose is to fail `npm run typecheck` loudly if the RestorePlan / RestoreStep
 * / ApplyEvent types drift in a way that locks the interface to AWS.
 *
 * Spec: docs/superpowers/specs/2026-04-20-snapshot-export-provider-interface.md §7
 */

import type {
  ApplyEvent,
  CostDelta,
  PluginScanResult,
  RestorePlan,
  RiftViewPlugin,
  ScanContext,
  StoredVersion,
  TypedConfirmation
} from './types'

// eslint-disable-next-line require-yield
async function* emptyEvents(): AsyncIterable<ApplyEvent> {
  throw new Error('stub: not implemented')
}

export const hetznerPluginStub: RiftViewPlugin = {
  id: 'com.riftview.hetzner',
  displayName: 'Hetzner Cloud',
  nodeTypes: ['hetzner-server', 'hetzner-volume', 'hetzner-network'],
  nodeTypeMetadata: {
    'hetzner-server': {
      label: 'SRV',
      borderColor: '#D50C2D',
      badgeColor: '#D50C2D',
      shortLabel: 'SRV',
      displayName: 'Hetzner Server',
      hasCreate: false
    },
    'hetzner-volume': {
      label: 'VOL',
      borderColor: '#D50C2D',
      badgeColor: '#D50C2D',
      shortLabel: 'VOL',
      displayName: 'Hetzner Volume',
      hasCreate: false
    },
    'hetzner-network': {
      label: 'NET',
      borderColor: '#D50C2D',
      badgeColor: '#D50C2D',
      shortLabel: 'NET',
      displayName: 'Hetzner Network',
      hasCreate: false
    }
  },
  createCredentials(): unknown {
    throw new Error('stub: not implemented')
  },
  async scan(ctx: ScanContext): Promise<PluginScanResult> {
    void ctx
    throw new Error('stub: not implemented')
  },

  versionFormat: 'hetzner-cloud-api-v1',

  async listVersions(snapshotId: string): Promise<StoredVersion[]> {
    void snapshotId
    throw new Error('stub: not implemented')
  },

  async planRestore(from: StoredVersion, to: StoredVersion | 'live'): Promise<RestorePlan> {
    void from
    void to
    throw new Error('stub: not implemented')
  },

  applyRestore(
    plan: RestorePlan,
    confirmations: readonly TypedConfirmation[]
  ): AsyncIterable<ApplyEvent> {
    void plan
    void confirmations
    return emptyEvents()
  },

  async confirmStep(
    planToken: string,
    stepId: string,
    typedString: string
  ): Promise<{ confirmationToken: string }> {
    void planToken
    void stepId
    void typedString
    throw new Error('stub: not implemented')
  },

  async cancel(applyId: string): Promise<{ ok: boolean }> {
    void applyId
    throw new Error('stub: not implemented')
  },

  async estimateCostDelta(plan: RestorePlan): Promise<CostDelta> {
    void plan
    throw new Error('stub: not implemented')
  }
}
