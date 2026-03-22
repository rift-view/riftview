import type { CloudNode } from '../../renderer/types/cloud'
import { terraformGenerators } from './generators'

/**
 * Generate Terraform HCL for a single node.
 * Returns empty string for unsupported node types.
 */
export function generateTerraformBlock(node: CloudNode): string {
  return terraformGenerators[node.type](node)
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
