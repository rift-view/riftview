// src/renderer/plugin/pluginCommands.ts
// Routing layer for create/delete/edit commands.
// Built-in NodeTypes delegate to existing builders.
// Plugin types delegate to registered PluginCommandHandlers.
import type { CloudNode } from '../types/cloud'
import { buildCommands } from '../utils/buildCommand'
import { buildDeleteCommands } from '../utils/buildDeleteCommands'
import { buildEditCommands } from '../utils/buildEditCommands'
import type { CreateParams } from '../types/create'
import type { EditParams } from '../types/edit'
import type { PluginCommandHandlers } from '../../main/plugin/types'

// Registry for plugin command handlers (populated at startup for bundled plugins)
const pluginHandlers = new Map<string, PluginCommandHandlers>()

export function registerPluginCommandHandlers(
  nodeType: string,
  handlers: PluginCommandHandlers
): void {
  pluginHandlers.set(nodeType, handlers)
}

function isBuiltinNodeType(type: string): boolean {
  // A built-in type is one not registered as a plugin type
  return !pluginHandlers.has(type)
}

export function resolveCreateCommands(
  resource: string,
  params: Record<string, unknown>
): string[][] {
  if (isBuiltinNodeType(resource)) {
    return buildCommands({ resource, ...params } as CreateParams)
  }
  return pluginHandlers.get(resource)?.buildCreate?.(resource, params) ?? []
}

export function resolveDeleteCommands(node: CloudNode, opts?: Record<string, unknown>): string[][] {
  if (isBuiltinNodeType(node.type)) {
    return buildDeleteCommands(node, opts)
  }
  return pluginHandlers.get(node.type)?.buildDelete?.(node, opts) ?? []
}

export function resolveEditCommands(node: CloudNode, params: Record<string, unknown>): string[][] {
  if (isBuiltinNodeType(node.type)) {
    return buildEditCommands(node, params as unknown as EditParams)
  }
  return pluginHandlers.get(node.type)?.buildEdit?.(node, params) ?? []
}
