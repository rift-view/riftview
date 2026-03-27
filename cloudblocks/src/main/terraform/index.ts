import type { CloudNode } from '../../renderer/types/cloud'
import type { TerraformGenerator } from './types'
import { terraformGenerators } from './generators'
import { pluginRegistry } from '../plugin/index'

/**
 * Generate Terraform HCL for a single node.
 * Returns empty string for unsupported node types.
 * Falls back to pluginRegistry.getHclGenerator for non-built-in node types.
 */
export function generateTerraformBlock(node: CloudNode): string {
  const builtinGen = (terraformGenerators as Record<string, TerraformGenerator | undefined>)[node.type]
  const gen = builtinGen ?? pluginRegistry.getHclGenerator(node.type)
  if (!gen) return ''
  return gen(node)
}

/**
 * Generate a complete Terraform file from a list of nodes.
 * Skips nodes with no generator output.
 * Returns both the HCL and a list of NodeTypes that were skipped.
 */
export function generateTerraformFile(nodes: CloudNode[]): { hcl: string; skippedTypes: string[] } {
  const skippedTypes: string[] = []
  const blocks = nodes
    .map((n) => {
      const block = generateTerraformBlock(n)
      if (block === '' && n.type !== 'unknown') {
        skippedTypes.push(n.type)
      }
      return block
    })
    .filter((b) => b.length > 0)
  return {
    hcl: blocks.join('\n\n'),
    skippedTypes: [...new Set(skippedTypes)],  // deduplicate
  }
}
