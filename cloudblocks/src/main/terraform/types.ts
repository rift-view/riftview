import type { CloudNode } from '../../renderer/types/cloud'

/**
 * A single Terraform resource block as a string of HCL.
 * Empty string means the NodeType is not yet supported for export.
 */
export type TerraformBlock = string

/**
 * Generator function type: takes a CloudNode and returns HCL.
 */
export type TerraformGenerator = (node: CloudNode) => TerraformBlock

/**
 * Exhaustive map — every NodeType must have an entry.
 * Compile-time enforcement: adding a new NodeType will cause a type error here.
 */
export type TerraformGeneratorMap = Record<import('../../renderer/types/cloud').NodeType, TerraformGenerator>
