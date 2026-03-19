import { CloudNode } from '../../../renderer/types/cloud'

export interface FlatServiceConfig<TClient, TItem> {
  /** Call the SDK paginator/list command and return raw items */
  fetch: (client: TClient) => Promise<TItem[]>
  /** Map a raw SDK item to a CloudNode */
  map: (item: TItem, region: string) => CloudNode
}

/**
 * Generic helper for AWS services whose resources are a flat list
 * with no hierarchy (no parent/child nesting).
 */
export async function scanFlatService<TClient, TItem>(
  client: TClient,
  region: string,
  config: FlatServiceConfig<TClient, TItem>,
): Promise<CloudNode[]> {
  const items = await config.fetch(client)
  return items.map(item => config.map(item, region))
}
