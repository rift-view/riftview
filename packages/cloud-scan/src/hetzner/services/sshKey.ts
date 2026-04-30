import type { CloudNode } from '@riftview/shared'
import type { HetznerClient } from '../client'

interface HetznerSshKey {
  id: number
  name: string
  fingerprint: string
  public_key: string
  created?: string
  labels?: Record<string, string>
}

/**
 * Scan Hetzner Cloud SSH keys. SSH keys are project-pool resources —
 * they are referenced at server-create time but are not attached to a
 * running server in the way volumes/firewalls/networks are. There is no
 * runtime edge from any other resource to an SSH key, so we render them
 * as standalone nodes (the existing `markStandalone` analysis pass in
 * the renderer surfaces them appropriately, just like AWS unattached
 * resources).
 */
export async function scanSshKeys(client: HetznerClient, region: string): Promise<CloudNode[]> {
  const keys = await client.list<HetznerSshKey>('/ssh_keys', 'ssh_keys')

  return keys.map(
    (k): CloudNode => ({
      id: `hcloud-ssh-key-${k.id}`,
      type: 'hetzner:ssh-key',
      label: k.name,
      status: 'running',
      region,
      metadata: {
        hetznerId: k.id,
        fingerprint: k.fingerprint,
        publicKey: k.public_key,
        created: k.created,
        labels: k.labels ?? {}
      }
    })
  )
}
