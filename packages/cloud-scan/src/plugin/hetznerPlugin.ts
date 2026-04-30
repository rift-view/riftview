// packages/cloud-scan/src/plugin/hetznerPlugin.ts
//
// First non-AWS plugin — RIFT-103. Validates the multi-cloud interface
// (Doc D success criterion): Hetzner scan-only lands without touching
// shared package code beyond the 5 NodeType union additions and the
// renderer-map entries.
//
// Design notes:
//   - HETZNER_API_TOKEN is read in `createCredentials` (main process only)
//     and never crosses IPC. The credentials object holds the token; the
//     scan helpers receive a `HetznerClient` that closes over it.
//   - Per-server firewall edges (NOT subnet-scoped) are emitted from the
//     server scanner. Mirroring AWS's SG → VPC parent relationship would
//     misrepresent the Hetzner topology.
//   - Plugin opts out of snapshot-export with `versionFormat: 'unsupported'`
//     per Doc D Decision 1. Restore is AWS-only for v1.
//   - Zero new npm deps — REST via global `fetch`.

import { createHetznerClient, type HetznerClient, type HetznerCredentials } from '../hetzner/client'
import { scanServers } from '../hetzner/services/server'
import { scanNetworks } from '../hetzner/services/network'
import { scanVolumes } from '../hetzner/services/volume'
import { scanFirewalls } from '../hetzner/services/firewall'
import { scanSshKeys } from '../hetzner/services/sshKey'
import type { RiftViewPlugin, NodeTypeMetadata, PluginScanResult, ScanContext } from './types'
import type { CloudNode } from '@riftview/shared'

const HETZNER_BRAND = '#D50C2D'

const NODE_TYPE_METADATA: Readonly<Record<string, NodeTypeMetadata>> = {
  'hetzner:server': {
    label: 'SRV',
    borderColor: HETZNER_BRAND,
    badgeColor: HETZNER_BRAND,
    shortLabel: 'SRV',
    displayName: 'Hetzner Server',
    hasCreate: false
  },
  'hetzner:network': {
    label: 'NET',
    borderColor: HETZNER_BRAND,
    badgeColor: HETZNER_BRAND,
    shortLabel: 'NET',
    displayName: 'Hetzner Network',
    hasCreate: false
  },
  'hetzner:volume': {
    label: 'VOL',
    borderColor: HETZNER_BRAND,
    badgeColor: HETZNER_BRAND,
    shortLabel: 'VOL',
    displayName: 'Hetzner Volume',
    hasCreate: false
  },
  'hetzner:firewall': {
    label: 'FW',
    borderColor: HETZNER_BRAND,
    badgeColor: HETZNER_BRAND,
    shortLabel: 'FW',
    displayName: 'Hetzner Firewall',
    hasCreate: false
  },
  'hetzner:ssh-key': {
    label: 'SSH',
    borderColor: HETZNER_BRAND,
    badgeColor: HETZNER_BRAND,
    shortLabel: 'SSH',
    displayName: 'Hetzner SSH Key',
    hasCreate: false
  }
}

function errCatch(service: string, region: string, errors: PluginScanResult['errors']) {
  return (e: unknown): CloudNode[] => {
    errors.push({ service, region, message: (e as Error)?.message ?? String(e) })
    return []
  }
}

export const hetznerPlugin: RiftViewPlugin = {
  id: 'com.riftview.hetzner',
  displayName: 'Hetzner Cloud',
  versionFormat: 'unsupported',

  nodeTypes: [
    'hetzner:server',
    'hetzner:network',
    'hetzner:volume',
    'hetzner:firewall',
    'hetzner:ssh-key'
  ],

  nodeTypeMetadata: NODE_TYPE_METADATA,

  /**
   * Build the HETZNER_API_TOKEN-backed credentials object. Throws if the
   * env var is missing — that surfaces in the registry as a per-plugin
   * activation error rather than crashing the whole scan loop.
   *
   * The token is read once here (main process), captured by the
   * `HetznerClient` closure, and never passed back through IPC.
   */
  createCredentials(profile: string, region: string, endpoint?: string): HetznerCredentials {
    void profile
    void region
    void endpoint
    const token = process.env.HETZNER_API_TOKEN
    if (!token) {
      throw new Error(
        'HETZNER_API_TOKEN not set — set it in your environment to enable the Hetzner plugin'
      )
    }
    return { token }
  },

  async scan(context: ScanContext): Promise<PluginScanResult> {
    const credentials = context.credentials as HetznerCredentials
    const client: HetznerClient = createHetznerClient(credentials)
    const region = context.region
    const errors: PluginScanResult['errors'] = []
    const catch_ = (service: string): ((e: unknown) => CloudNode[]) =>
      errCatch(service, region, errors)

    const results = await Promise.all([
      scanServers(client, region).catch(catch_('hetzner:server')),
      scanNetworks(client, region).catch(catch_('hetzner:network')),
      scanVolumes(client, region).catch(catch_('hetzner:volume')),
      scanFirewalls(client, region).catch(catch_('hetzner:firewall')),
      scanSshKeys(client, region).catch(catch_('hetzner:ssh-key'))
    ])

    const nodes = results.flat().map((node) => ({ ...node, region: node.region ?? region }))
    return { nodes, errors }
  }
}
