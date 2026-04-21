// src/renderer/plugin/rendererRegistry.ts
import type { NodeProps } from '@xyflow/react'

const pluginNodeComponents = new Map<string, React.ComponentType<NodeProps>>()

export function registerPluginComponent(
  key: string,
  component: React.ComponentType<NodeProps>
): void {
  pluginNodeComponents.set(key, component)
}

export function getPluginNodeComponents(): Record<string, React.ComponentType<NodeProps>> {
  return Object.fromEntries(pluginNodeComponents)
}
