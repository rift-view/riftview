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
 */
export function generateTerraformFile(nodes: CloudNode[]): string {
  const blocks = nodes
    .map(generateTerraformBlock)
    .filter((b) => b.length > 0)
  return blocks.join('\n\n')
}
