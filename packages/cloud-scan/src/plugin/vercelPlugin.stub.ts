/**
 * Typecheck-only stub — proves the snapshot-export interface holds for Vercel.
 * Complement to hetznerPlugin.stub.ts — Vercel has almost no infrastructure
 * surface, so the interface has to hold for the "tiny provider" end of the
 * spectrum too.
 *
 * Spec: docs/superpowers/specs/2026-04-20-snapshot-export-provider-interface.md §7
 */

import type { PluginScanResult, RiftViewPlugin, ScanContext } from './types'

export const vercelPluginStub: RiftViewPlugin = {
  id: 'com.riftview.vercel',
  displayName: 'Vercel',
  nodeTypes: ['vercel:project', 'vercel:deployment', 'vercel:domain'],
  nodeTypeMetadata: {
    'vercel:project': {
      label: 'PRJ',
      borderColor: '#000000',
      badgeColor: '#000000',
      shortLabel: 'PRJ',
      displayName: 'Vercel Project',
      hasCreate: false
    },
    'vercel:deployment': {
      label: 'DEP',
      borderColor: '#000000',
      badgeColor: '#000000',
      shortLabel: 'DEP',
      displayName: 'Vercel Deployment',
      hasCreate: false
    },
    'vercel:domain': {
      label: 'DOM',
      borderColor: '#000000',
      badgeColor: '#000000',
      shortLabel: 'DOM',
      displayName: 'Vercel Domain',
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

  // Vercel's snapshot-export story is likely deferred past v1. Declaring
  // 'unsupported' exercises the opt-out path of the interface so the
  // registry's UI surface for that case is typechecked.
  versionFormat: 'unsupported'
}
