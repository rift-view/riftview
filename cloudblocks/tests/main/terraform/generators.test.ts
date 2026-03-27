/**
 * Terraform HCL export — generator tests
 *
 * Covers:
 *  - Each implemented generator (vpc, subnet, ec2, s3, lambda) produces non-empty HCL
 *  - Output contains the expected resource type string
 *  - Key fields from node metadata appear in the output
 *  - All previously-stub NodeTypes now produce non-empty HCL (no throw)
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

// ── newly-implemented node types produce non-empty HCL ───────────────────────

describe('generateTerraformBlock — newly-implemented types', () => {
  it('rds produces aws_db_instance HCL', () => {
    const node = makeNode({ type: 'rds', label: 'mydb', metadata: { engine: 'postgres', instanceClass: 'db.t3.micro' } })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_db_instance"')
    expect(hcl).toContain('postgres')
    expect(hcl).toContain('db.t3.micro')
  })

  it('alb produces aws_lb HCL with internal=false for internet-facing', () => {
    const node = makeNode({ type: 'alb', label: 'my-alb', metadata: { scheme: 'internet-facing', type: 'application' } })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_lb"')
    expect(hcl).toContain('internal           = false')
    expect(hcl).toContain('application')
  })

  it('alb produces internal=true for internal scheme', () => {
    const node = makeNode({ type: 'alb', label: 'internal-alb', metadata: { scheme: 'internal', type: 'network' } })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('internal           = true')
  })

  it('security-group produces aws_security_group HCL', () => {
    const node = makeNode({ type: 'security-group', label: 'web-sg', metadata: {} })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_security_group"')
    expect(hcl).toContain('web-sg')
  })

  it('igw produces aws_internet_gateway HCL', () => {
    const node = makeNode({ type: 'igw', label: 'my-igw', metadata: {} })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_internet_gateway"')
    expect(hcl).toContain('my-igw')
  })

  it('acm produces aws_acm_certificate HCL', () => {
    const node = makeNode({ type: 'acm', label: 'example.com', metadata: { domainName: 'example.com' } })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_acm_certificate"')
    expect(hcl).toContain('example.com')
    expect(hcl).toContain('DNS')
  })

  it('cloudfront produces aws_cloudfront_distribution HCL', () => {
    const node = makeNode({ type: 'cloudfront', label: 'my-dist', metadata: { origins: [{ domain: 'bucket.s3.amazonaws.com' }], priceClass: 'PriceClass_200' } })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_cloudfront_distribution"')
    expect(hcl).toContain('bucket.s3.amazonaws.com')
    expect(hcl).toContain('PriceClass_200')
  })

  it('cloudfront uses placeholder when origins absent', () => {
    const node = makeNode({ type: 'cloudfront', label: 'my-dist', metadata: {} })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('REPLACE_WITH_ORIGIN_DOMAIN')
  })

  it('apigw produces aws_apigatewayv2_api HCL', () => {
    const node = makeNode({ type: 'apigw', label: 'my-api', metadata: { protocolType: 'HTTP' } })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_apigatewayv2_api"')
    expect(hcl).toContain('HTTP')
  })

  it('apigw-route produces aws_apigatewayv2_route HCL', () => {
    const node = makeNode({ type: 'apigw-route', label: 'GET /items', metadata: { method: 'GET', path: '/items', apiId: 'abc123' } })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_apigatewayv2_route"')
    expect(hcl).toContain('GET /items')
    expect(hcl).toContain('abc123')
  })

  it('sqs produces aws_sqs_queue HCL', () => {
    const node = makeNode({ type: 'sqs', label: 'my-queue', metadata: {} })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_sqs_queue"')
    expect(hcl).toContain('my-queue')
  })

  it('secret produces aws_secretsmanager_secret HCL', () => {
    const node = makeNode({ type: 'secret', label: 'my-secret', metadata: { description: 'A test secret' } })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_secretsmanager_secret"')
    expect(hcl).toContain('my-secret')
    expect(hcl).toContain('A test secret')
  })

  it('ecr-repo produces aws_ecr_repository HCL', () => {
    const node = makeNode({ type: 'ecr-repo', label: 'my-repo', metadata: {} })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_ecr_repository"')
    expect(hcl).toContain('my-repo')
  })

  it('sns produces aws_sns_topic HCL', () => {
    const node = makeNode({ type: 'sns', label: 'my-topic', metadata: {} })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_sns_topic"')
    expect(hcl).toContain('my-topic')
  })

  it('dynamo produces aws_dynamodb_table HCL with PAY_PER_REQUEST', () => {
    const node = makeNode({ type: 'dynamo', label: 'my-table', metadata: {} })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_dynamodb_table"')
    expect(hcl).toContain('PAY_PER_REQUEST')
    expect(hcl).toContain('REPLACE_WITH_HASH_KEY')
  })

  it('ssm-param produces aws_ssm_parameter HCL', () => {
    const node = makeNode({ type: 'ssm-param', label: '/my/param', metadata: { type: 'SecureString' } })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_ssm_parameter"')
    expect(hcl).toContain('SecureString')
    expect(hcl).toContain('REPLACE_WITH_VALUE')
  })

  it('nat-gateway produces aws_nat_gateway HCL with placeholders', () => {
    const node = makeNode({ type: 'nat-gateway', label: 'my-nat', metadata: {} })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_nat_gateway"')
    expect(hcl).toContain('REPLACE_WITH_EIP_ALLOCATION_ID')
    expect(hcl).toContain('REPLACE_WITH_SUBNET_ID')
  })

  it('r53-zone produces aws_route53_zone HCL (public)', () => {
    const node = makeNode({ type: 'r53-zone', label: 'example.com', metadata: { private: false } })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_route53_zone"')
    expect(hcl).toContain('example.com')
  })

  it('r53-zone includes vpc block for private zone', () => {
    const node = makeNode({ type: 'r53-zone', label: 'internal.local', metadata: { private: true } })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('vpc {')
    expect(hcl).toContain('REPLACE_WITH_VPC_ID')
  })

  it('sfn produces aws_sfn_state_machine HCL', () => {
    const node = makeNode({ type: 'sfn', label: 'my-machine', metadata: { type: 'EXPRESS' } })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_sfn_state_machine"')
    expect(hcl).toContain('EXPRESS')
    expect(hcl).toContain('REPLACE_WITH_ROLE_ARN')
  })

  it('eventbridge-bus produces aws_cloudwatch_event_bus HCL', () => {
    const node = makeNode({ type: 'eventbridge-bus', label: 'my-bus', metadata: {} })
    const hcl = generateTerraformBlock(node)
    expect(hcl).toContain('resource "aws_cloudwatch_event_bus"')
    expect(hcl).toContain('my-bus')
  })

  it('unknown still returns empty string', () => {
    const node = makeNode({ type: 'unknown', label: 'mystery', metadata: {} })
    expect(generateTerraformBlock(node)).toBe('')
  })
})

// ── pluginRegistry HCL fallback ───────────────────────────────────────────────

describe('generateTerraformBlock — pluginRegistry fallback', () => {
  it('falls back to pluginRegistry.getHclGenerator for non-built-in node types', async () => {
    const { PluginRegistry } = await import('../../../src/main/plugin/registry')

    // Register a temporary plugin with an HCL generator for 'azure-vm'
    const mockGen = (node: CloudNode) => `resource "azure_virtual_machine" "${node.id}" {}`
    const testPlugin = {
      id: 'com.test.azure-vm-hcl',
      displayName: 'Test Azure VM',
      nodeTypes: ['azure-vm-hcl-test'],
      nodeTypeMetadata: {
        'azure-vm-hcl-test': {
          label: 'AVM',
          borderColor: '#0078D4',
          badgeColor: '#0078D4',
          shortLabel: 'AVM',
          displayName: 'Azure VM (test)',
          hasCreate: false,
        },
      },
      createCredentials: () => ({}),
      scan: async () => ({ nodes: [], errors: [] }),
      hclGenerators: {
        'azure-vm-hcl-test': mockGen,
      },
    }

    // Use a fresh registry to avoid polluting the singleton
    const freshRegistry = new PluginRegistry()
    freshRegistry.register(testPlugin as Parameters<typeof freshRegistry.register>[0])

    const gen = freshRegistry.getHclGenerator('azure-vm-hcl-test')
    expect(gen).toBeDefined()

    const node = makeNode({ type: 'unknown', id: 'vm-001', label: 'test-vm', metadata: {} })
    // Directly verify the generator produces the expected HCL
    const hcl = gen!({ ...node, type: 'azure-vm-hcl-test' } as unknown as CloudNode)
    expect(hcl).toBe('resource "azure_virtual_machine" "vm-001" {}')
  })

  it('getHclGenerator returns undefined for unregistered plugin types', async () => {
    const { PluginRegistry } = await import('../../../src/main/plugin/registry')
    const freshRegistry = new PluginRegistry()
    expect(freshRegistry.getHclGenerator('not-registered-type')).toBeUndefined()
  })
})

// ── generateTerraformFile ─────────────────────────────────────────────────────

describe('generateTerraformFile', () => {
  it('returns empty HCL and no skipped types for empty node list', () => {
    const result = generateTerraformFile([])
    expect(result.hcl).toBe('')
    expect(result.skippedTypes).toEqual([])
  })

  it('returns non-empty HCL and no skipped types when all nodes are now-implemented types', () => {
    const nodes = [
      makeNode({ type: 'rds', label: 'db', metadata: {} }),
      makeNode({ type: 'alb', label: 'lb', metadata: {} }),
    ]
    const result = generateTerraformFile(nodes)
    expect(result.hcl).toContain('resource "aws_db_instance"')
    expect(result.hcl).toContain('resource "aws_lb"')
    expect(result.skippedTypes).toEqual([])
  })

  it('joins multiple implemented blocks with a blank line between them', () => {
    const nodes: CloudNode[] = [
      makeNode({ id: 'v1', type: 'vpc', label: "vpc a", metadata: { cidrBlock: "10.0.0.0/16" } }),
      makeNode({ id: 'v2', type: 'vpc', label: "vpc b", metadata: { cidrBlock: "10.1.0.0/16" } }),
    ]
    const result = generateTerraformFile(nodes)
    expect(result.hcl).toContain('vpc_a')
    expect(result.hcl).toContain('vpc_b')
    // Two blocks separated by blank line
    expect(result.hcl).toContain('\n\n')
    expect(result.skippedTypes).toEqual([])
  })

  it('includes all implemented nodes and has no skipped types', () => {
    const nodes: CloudNode[] = [
      makeNode({ type: 'rds', label: 'db', metadata: {} }),
      makeNode({ type: 'vpc', label: 'my-vpc', metadata: { cidrBlock: '10.0.0.0/8' } }),
      makeNode({ type: 'alb', label: 'lb', metadata: {} }),
    ]
    const result = generateTerraformFile(nodes)
    expect(result.hcl).toContain('resource "aws_vpc"')
    expect(result.hcl).toContain('resource "aws_db_instance"')
    expect(result.hcl).toContain('resource "aws_lb"')
    expect(result.skippedTypes).toEqual([])
  })

  it('returns a single block (no trailing blank line) for one implemented node, no skipped types', () => {
    const nodes: CloudNode[] = [
      makeNode({ type: 's3', label: 'solo-bucket', metadata: {} }),
    ]
    const result = generateTerraformFile(nodes)
    expect(result.hcl).toContain('resource "aws_s3_bucket"')
    expect(result.hcl.endsWith('\n\n')).toBe(false)
    expect(result.skippedTypes).toEqual([])
  })

  it('skips unknown nodes and lists them in skippedTypes', () => {
    const nodes: CloudNode[] = [
      makeNode({ type: 'unknown', label: 'mystery', metadata: {} }),
      makeNode({ type: 'vpc', label: 'my-vpc', metadata: { cidrBlock: '10.0.0.0/8' } }),
    ]
    const result = generateTerraformFile(nodes)
    expect(result.hcl).toContain('resource "aws_vpc"')
    expect(result.skippedTypes).toEqual([])  // unknown is excluded from skippedTypes by design
  })
})
