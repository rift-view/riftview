/**
 * Terraform HCL export — generator tests
 *
 * Covers:
 *  - Each implemented generator (vpc, subnet, ec2, s3, lambda) produces non-empty HCL
 *  - Output contains the expected resource type string
 *  - Key fields from node metadata appear in the output
 *  - Unimplemented NodeTypes return empty string (no throw)
 *  - generateTerraformFile joins multiple blocks and skips empty ones
 */
import { describe, it, expect } from 'vitest'
import { generateTerraformBlock, generateTerraformFile } from '../../../src/main/terraform/index'
import type { CloudNode } from '../../../src/renderer/types/cloud'

// Helper: build a minimal CloudNode
function makeNode(overrides: Partial<CloudNode> & { type: CloudNode['type'] }): CloudNode {
  return {
    id: 'test-id',
    label: 'test-label',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides,
  }
}

// ── vpc ──────────────────────────────────────────────────────────────────────

describe('generateTerraformBlock — vpc', () => {
  it('produces non-empty HCL', () => {
    const node = makeNode({ type: 'vpc', label: 'my vpc', metadata: { cidrBlock: '10.0.0.0/16' } })
    expect(generateTerraformBlock(node).length).toBeGreaterThan(0)
  })

  it('contains resource "aws_vpc"', () => {
    const node = makeNode({ type: 'vpc', label: 'my vpc', metadata: { cidrBlock: '10.0.0.0/16' } })
    expect(generateTerraformBlock(node)).toContain('resource "aws_vpc"')
  })

  it('includes the cidr_block from metadata', () => {
    const node = makeNode({ type: 'vpc', label: 'prod', metadata: { cidrBlock: '172.16.0.0/12' } })
    expect(generateTerraformBlock(node)).toContain('172.16.0.0/12')
  })

  it('sanitizes label into valid identifier', () => {
    const node = makeNode({ type: 'vpc', label: 'My VPC Name!', metadata: { cidrBlock: '10.0.0.0/16' } })
    const hcl = generateTerraformBlock(node)
    // Sanitized: lowercase, spaces->underscore, specials removed => my_vpc_name
    expect(hcl).toContain('my_vpc_name')
  })

  it('falls back to node id when label sanitizes to empty string', () => {
    const node = makeNode({ type: 'vpc', id: 'vpc-fallback', label: '!!!', metadata: { cidrBlock: '10.0.0.0/8' } })
    expect(generateTerraformBlock(node)).toContain('vpc-fallback')
  })

  it('uses UNKNOWN when cidrBlock metadata is absent', () => {
    const node = makeNode({ type: 'vpc', label: 'bare', metadata: {} })
    expect(generateTerraformBlock(node)).toContain('UNKNOWN')
  })
})

// ── subnet ───────────────────────────────────────────────────────────────────

describe('generateTerraformBlock — subnet', () => {
  it('produces non-empty HCL', () => {
    const node = makeNode({
      type: 'subnet', label: 'pub-a',
      metadata: { cidrBlock: '10.0.1.0/24', availabilityZone: 'us-east-1a', vpcId: 'vpc-123' },
    })
    expect(generateTerraformBlock(node).length).toBeGreaterThan(0)
  })

  it('contains resource "aws_subnet"', () => {
    const node = makeNode({
      type: 'subnet', label: 'pub-a',
      metadata: { cidrBlock: '10.0.1.0/24', availabilityZone: 'us-east-1a', vpcId: 'vpc-123' },
    })
    expect(generateTerraformBlock(node)).toContain('resource "aws_subnet"')
  })

  it('includes cidr_block in output', () => {
    const node = makeNode({
      type: 'subnet', label: 'pub-a',
      metadata: { cidrBlock: '10.0.2.0/24', availabilityZone: 'us-east-1b', vpcId: 'vpc-abc' },
    })
    expect(generateTerraformBlock(node)).toContain('10.0.2.0/24')
  })

  it('includes availability_zone in output', () => {
    const node = makeNode({
      type: 'subnet', label: 'priv-b',
      metadata: { cidrBlock: '10.0.3.0/24', availabilityZone: 'eu-west-1b', vpcId: 'vpc-xyz' },
    })
    expect(generateTerraformBlock(node)).toContain('eu-west-1b')
  })

  it('uses parentId for vpc_id when vpcId metadata absent', () => {
    const node = makeNode({
      type: 'subnet', label: 'priv-c', parentId: 'vpc-parent-001',
      metadata: { cidrBlock: '10.0.4.0/24', availabilityZone: 'us-west-2a' },
    })
    expect(generateTerraformBlock(node)).toContain('vpc-parent-001')
  })
})

// ── ec2 ──────────────────────────────────────────────────────────────────────

describe('generateTerraformBlock — ec2', () => {
  it('produces non-empty HCL', () => {
    const node = makeNode({ type: 'ec2', label: 'web-server', metadata: { instanceType: 't3.micro' } })
    expect(generateTerraformBlock(node).length).toBeGreaterThan(0)
  })

  it('contains resource "aws_instance"', () => {
    const node = makeNode({ type: 'ec2', label: 'web-server', metadata: { instanceType: 't3.micro' } })
    expect(generateTerraformBlock(node)).toContain('resource "aws_instance"')
  })

  it('includes instance_type from metadata', () => {
    const node = makeNode({ type: 'ec2', label: 'api-server', metadata: { instanceType: 'm5.large' } })
    expect(generateTerraformBlock(node)).toContain('m5.large')
  })

  it('emits AMI placeholder when ami metadata is absent', () => {
    const node = makeNode({ type: 'ec2', label: 'no-ami', metadata: { instanceType: 't2.micro' } })
    expect(generateTerraformBlock(node)).toContain('REPLACE_WITH_AMI_ID')
  })

  it('uses provided ami from metadata when present', () => {
    const node = makeNode({ type: 'ec2', label: 'with-ami', metadata: { instanceType: 't3.small', ami: 'ami-0abcdef1234567890' } })
    expect(generateTerraformBlock(node)).toContain('ami-0abcdef1234567890')
  })

  it('sanitizes label with spaces into a valid identifier', () => {
    const node = makeNode({ type: 'ec2', label: 'My Web Server', metadata: { instanceType: 't3.nano' } })
    expect(generateTerraformBlock(node)).toContain('my_web_server')
  })
})

// ── s3 ───────────────────────────────────────────────────────────────────────

describe('generateTerraformBlock — s3', () => {
  it('produces non-empty HCL', () => {
    const node = makeNode({ type: 's3', label: 'my-bucket', metadata: {} })
    expect(generateTerraformBlock(node).length).toBeGreaterThan(0)
  })

  it('contains resource "aws_s3_bucket"', () => {
    const node = makeNode({ type: 's3', label: 'my-bucket', metadata: {} })
    expect(generateTerraformBlock(node)).toContain('resource "aws_s3_bucket"')
  })

  it('includes the bucket name (node label) in output', () => {
    const node = makeNode({ type: 's3', label: 'prod-assets-bucket', metadata: {} })
    expect(generateTerraformBlock(node)).toContain('prod-assets-bucket')
  })
})

// ── lambda ───────────────────────────────────────────────────────────────────

describe('generateTerraformBlock — lambda', () => {
  it('produces non-empty HCL', () => {
    const node = makeNode({ type: 'lambda', label: 'my-fn', metadata: { runtime: 'nodejs20.x', handler: 'index.handler' } })
    expect(generateTerraformBlock(node).length).toBeGreaterThan(0)
  })

  it('contains resource "aws_lambda_function"', () => {
    const node = makeNode({ type: 'lambda', label: 'my-fn', metadata: { runtime: 'nodejs20.x', handler: 'index.handler' } })
    expect(generateTerraformBlock(node)).toContain('resource "aws_lambda_function"')
  })

  it('includes runtime from metadata', () => {
    const node = makeNode({ type: 'lambda', label: 'py-fn', metadata: { runtime: 'python3.12', handler: 'main.handler' } })
    expect(generateTerraformBlock(node)).toContain('python3.12')
  })

  it('includes handler from metadata', () => {
    const node = makeNode({ type: 'lambda', label: 'go-fn', metadata: { runtime: 'provided.al2', handler: 'bootstrap' } })
    expect(generateTerraformBlock(node)).toContain('bootstrap')
  })

  it('includes the function_name in output', () => {
    const node = makeNode({ type: 'lambda', label: 'process-orders', metadata: { runtime: 'nodejs18.x', handler: 'src/index.handler' } })
    expect(generateTerraformBlock(node)).toContain('process-orders')
  })
})

// ── unimplemented node types return empty string (no throw) ──────────────────

describe('generateTerraformBlock — unimplemented types', () => {
  const unimplemented: CloudNode['type'][] = [
    'rds', 'alb', 'security-group', 'igw', 'acm', 'cloudfront',
    'apigw', 'apigw-route', 'sqs', 'secret', 'ecr-repo', 'sns',
    'dynamo', 'ssm-param', 'nat-gateway', 'r53-zone', 'sfn', 'eventbridge-bus',
  ]

  for (const nodeType of unimplemented) {
    it(`${nodeType} does not throw and returns empty string`, () => {
      const node = makeNode({ type: nodeType, label: 'test', metadata: {} })
      let result: string | undefined
      expect(() => { result = generateTerraformBlock(node) }).not.toThrow()
      expect(result).toBe('')
    })
  }
})

// ── generateTerraformFile ─────────────────────────────────────────────────────

describe('generateTerraformFile', () => {
  it('returns empty string for empty node list', () => {
    expect(generateTerraformFile([])).toBe('')
  })

  it('returns empty string when all nodes are unimplemented types', () => {
    const nodes = [
      makeNode({ type: 'rds', label: 'db', metadata: {} }),
      makeNode({ type: 'alb', label: 'lb', metadata: {} }),
    ]
    expect(generateTerraformFile(nodes)).toBe('')
  })

  it('joins multiple implemented blocks with a blank line between them', () => {
    const nodes: CloudNode[] = [
      makeNode({ id: 'v1', type: 'vpc', label: "vpc a", metadata: { cidrBlock: "10.0.0.0/16" } }),
      makeNode({ id: 'v2', type: 'vpc', label: "vpc b", metadata: { cidrBlock: "10.1.0.0/16" } }),
    ]
    const output = generateTerraformFile(nodes)
    expect(output).toContain('vpc_a')
    expect(output).toContain('vpc_b')
    // Two blocks separated by blank line
    expect(output).toContain('\n\n')
  })

  it('skips unimplemented nodes but includes implemented ones', () => {
    const nodes: CloudNode[] = [
      makeNode({ type: 'rds', label: 'db', metadata: {} }),
      makeNode({ type: 'vpc', label: 'my-vpc', metadata: { cidrBlock: '10.0.0.0/8' } }),
      makeNode({ type: 'alb', label: 'lb', metadata: {} }),
    ]
    const output = generateTerraformFile(nodes)
    expect(output).toContain('resource "aws_vpc"')
    expect(output).not.toContain('resource "aws_db_instance"')
    expect(output).not.toContain('resource "aws_lb"')
  })

  it('returns a single block (no trailing blank line) for one implemented node', () => {
    const nodes: CloudNode[] = [
      makeNode({ type: 's3', label: 'solo-bucket', metadata: {} }),
    ]
    const output = generateTerraformFile(nodes)
    expect(output).toContain('resource "aws_s3_bucket"')
    expect(output.endsWith('\n\n')).toBe(false)
  })
})
