// src/main/plugin/registry.ts
import type { CloudblocksPlugin, NodeTypeMetadata, PluginHclGenerator, PluginScanResult } from './types'
import type { CloudNode } from '../../renderer/types/cloud'

export class PluginRegistry {
  private _plugins: CloudblocksPlugin[] = []
  private _ownerByType = new Map<string, CloudblocksPlugin>()
  private _credentials = new Map<string, unknown>()

  get plugins(): readonly CloudblocksPlugin[] {
    return this._plugins
  }

  register(plugin: CloudblocksPlugin): void {
    for (const nodeType of plugin.nodeTypes) {
      if (this._ownerByType.has(nodeType)) {
        const owner = this._ownerByType.get(nodeType)!
        throw new Error(
          `NodeType "${nodeType}" is already claimed by plugin "${owner.id}". ` +
          `Cannot register plugin "${plugin.id}".`
        )
      }
      this._ownerByType.set(nodeType, plugin)
    }
    this._plugins.push(plugin)
  }

  // Credentials are keyed by `${pluginId}::${region}` to support multi-region scanning.
  // Call once per profile/region change — not on every scan cycle.
  async activateAll(profile: string, regions: string[], endpoint?: string): Promise<void> {
    for (const region of regions) {
      for (const plugin of this._plugins) {
        try {
          const creds = plugin.createCredentials(profile, region, endpoint)
          this._credentials.set(`${plugin.id}::${region}`, creds)
          if (plugin.activate) await plugin.activate()
        } catch (err) {
          console.error(`[PluginRegistry] Failed to activate plugin "${plugin.id}":`, err)
        }
      }
    }
  }

  async deactivateAll(): Promise<void> {
    for (const plugin of [...this._plugins].reverse()) {
      try {
        if (plugin.deactivate) await plugin.deactivate()
      } catch (err) {
        console.error(`[PluginRegistry] Failed to deactivate plugin "${plugin.id}":`, err)
      }
    }
    this._credentials.clear()
  }

  async scanAll(region: string): Promise<PluginScanResult> {
    const allNodes: CloudNode[] = []
    const allErrors: PluginScanResult['errors'] = []

    await Promise.all(
      this._plugins.map(async (plugin) => {
        try {
          const credentials = this._credentials.get(`${plugin.id}::${region}`)
          const result = await plugin.scan({ credentials, region })
          allNodes.push(...result.nodes)
          allErrors.push(...result.errors)
          if (plugin.scanExtras) {
            await plugin.scanExtras(region)
          }
        } catch (err) {
          allErrors.push({
            service: plugin.id,
            region,
            message: (err as Error)?.message ?? String(err),
          })
        }
      })
    )

    return { nodes: allNodes, errors: allErrors }
  }

  buildCreate(resource: string, params: Record<string, unknown>): string[][] {
    const owner = this._ownerByType.get(resource)
    return owner?.commands?.buildCreate?.(resource, params) ?? []
  }

  buildDelete(node: CloudNode, opts?: Record<string, unknown>): string[][] {
    const owner = this._ownerByType.get(node.type)
    return owner?.commands?.buildDelete?.(node, opts) ?? []
  }

  buildEdit(node: CloudNode, params: Record<string, unknown>): string[][] {
    const owner = this._ownerByType.get(node.type)
    return owner?.commands?.buildEdit?.(node, params) ?? []
  }

  getHclGenerator(nodeType: string): PluginHclGenerator | undefined {
    const owner = this._ownerByType.get(nodeType)
    return owner?.hclGenerators?.[nodeType]
  }

  getNodeTypeMetadata(nodeType: string): NodeTypeMetadata | undefined {
    const owner = this._ownerByType.get(nodeType)
    return owner?.nodeTypeMetadata[nodeType]
  }

  getAllNodeTypeMetadata(): Record<string, NodeTypeMetadata> {
    const result: Record<string, NodeTypeMetadata> = {}
    for (const plugin of this._plugins) {
      for (const [type, meta] of Object.entries(plugin.nodeTypeMetadata)) {
        result[type] = meta
      }
    }
    return result
  }
}

export const pluginRegistry = new PluginRegistry()
