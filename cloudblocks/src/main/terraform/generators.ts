import type { TerraformGeneratorMap } from './types'
import type { CloudNode } from '../../renderer/types/cloud'

function sanitizeName(label: string, fallback: string): string {
  const sanitized = label
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
  return sanitized.length > 0 ? sanitized : fallback
}

function str(value: unknown, fallback = 'UNKNOWN'): string {
  if (typeof value === 'string' && value.length > 0) return value
  return fallback
}

function generateVpc(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const cidr = str(node.metadata['cidrBlock'])
  return `resource "aws_vpc" "${name}" {\n  cidr_block = "${cidr}"\n}`
}

function generateSubnet(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const vpcId = str(node.parentId ?? node.metadata['vpcId'])
  const cidr = str(node.metadata['cidrBlock'])
  const az = str(node.metadata['availabilityZone'])
  return `resource "aws_subnet" "${name}" {\n  vpc_id            = "${vpcId}"\n  cidr_block        = "${cidr}"\n  availability_zone = "${az}"\n}`
}

function generateEc2(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const ami = str(node.metadata['ami'], 'REPLACE_WITH_AMI_ID')
  const instanceType = str(node.metadata['instanceType'])
  return `resource "aws_instance" "${name}" {\n  ami           = "${ami}"\n  instance_type = "${instanceType}"\n}`
}

function generateS3(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const bucket = str(node.label, node.id)
  return `resource "aws_s3_bucket" "${name}" {\n  bucket = "${bucket}"\n}`
}

function generateLambda(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const functionName = str(node.label, node.id)
  const runtime = str(node.metadata['runtime'])
  const handler = str(node.metadata['handler'])
  return `resource "aws_lambda_function" "${name}" {\n  function_name = "${functionName}"\n  # filename     = "REPLACE_WITH_DEPLOYMENT_PACKAGE"\n  runtime       = "${runtime}"\n  handler       = "${handler}"\n}`
}

function generateRds(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const engine = str(node.metadata['engine'])
  const instanceClass = str(node.metadata['instanceClass'])
  return `resource "aws_db_instance" "${name}" {
  identifier        = "${node.label}"
  engine            = "${engine}"
  instance_class    = "${instanceClass}"
  # username         = "REPLACE_WITH_USERNAME"
  # password         = "REPLACE_WITH_PASSWORD"
  # allocated_storage = 20
}`
}

function generateAlb(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const internal = (node.metadata['scheme'] as string | undefined) === 'internal'
  const lbType = str(node.metadata['type'], 'application')
  return `resource "aws_lb" "${name}" {
  name               = "${node.label}"
  internal           = ${internal}
  load_balancer_type = "${lbType}"
}`
}

function generateSg(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  return `resource "aws_security_group" "${name}" {
  name        = "${node.label}"
  description = "REPLACE_WITH_DESCRIPTION"
  # vpc_id    = "REPLACE_WITH_VPC_ID"
}`
}

function generateIgw(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  return `resource "aws_internet_gateway" "${name}" {
  # vpc_id = "REPLACE_WITH_VPC_ID"

  tags = {
    Name = "${node.label}"
  }
}`
}

function generateAcm(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const domain = str(node.metadata['domainName'], node.label)
  return `resource "aws_acm_certificate" "${name}" {
  domain_name       = "${domain}"
  validation_method = "DNS"
}`
}

function generateCloudFront(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const origins = node.metadata['origins'] as Array<{ domain: string }> | undefined
  const originDomain = origins?.[0]?.domain ?? 'REPLACE_WITH_ORIGIN_DOMAIN'
  const priceClass = str(node.metadata['priceClass'], 'PriceClass_100')
  return `resource "aws_cloudfront_distribution" "${name}" {
  origin {
    domain_name = "${originDomain}"
    origin_id   = "primary"
  }

  enabled             = true
  price_class         = "${priceClass}"

  default_cache_behavior {
    target_origin_id       = "primary"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}`
}

function generateApigw(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const protocol = str(node.metadata['protocolType'], 'HTTP')
  return `resource "aws_apigatewayv2_api" "${name}" {
  name          = "${node.label}"
  protocol_type = "${protocol}"
}`
}

function generateApigwRoute(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const method = str(node.metadata['method'], 'GET')
  const path   = str(node.metadata['path'], '/')
  const apiId  = str(node.metadata['apiId'])
  return `resource "aws_apigatewayv2_route" "${name}" {
  api_id    = "${apiId}"
  route_key = "${method} ${path}"
}`
}

function generateSqs(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const queueName = node.label
  return `resource "aws_sqs_queue" "${name}" {
  name = "${queueName}"
}`
}

function generateSecret(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const description = str(node.metadata['description'], '')
  const descLine = description && description !== 'UNKNOWN' ? `\n  description = "${description}"` : ''
  return `resource "aws_secretsmanager_secret" "${name}" {
  name = "${node.label}"${descLine}
}`
}

function generateEcr(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  return `resource "aws_ecr_repository" "${name}" {
  name = "${node.label}"
}`
}

function generateSns(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  return `resource "aws_sns_topic" "${name}" {
  name = "${node.label}"
}`
}

function generateDynamo(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  return `resource "aws_dynamodb_table" "${name}" {
  name         = "${node.label}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "REPLACE_WITH_HASH_KEY"

  attribute {
    name = "REPLACE_WITH_HASH_KEY"
    type = "S"
  }
}`
}

function generateSsmParam(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const type = str(node.metadata['type'], 'String')
  return `resource "aws_ssm_parameter" "${name}" {
  name  = "${node.label}"
  type  = "${type}"
  value = "REPLACE_WITH_VALUE"
}`
}

function generateNatGateway(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  return `resource "aws_nat_gateway" "${name}" {
  allocation_id = "REPLACE_WITH_EIP_ALLOCATION_ID"
  subnet_id     = "REPLACE_WITH_SUBNET_ID"

  tags = {
    Name = "${node.label}"
  }
}`
}

function generateR53Zone(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const isPrivate = (node.metadata['private'] as boolean | undefined) ?? false
  return `resource "aws_route53_zone" "${name}" {
  name    = "${node.label}"
  ${isPrivate ? 'vpc {\n    vpc_id = "REPLACE_WITH_VPC_ID"\n  }' : '# private_zone = false'}
}`
}

function generateSfn(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const type = str(node.metadata['type'], 'STANDARD')
  return `resource "aws_sfn_state_machine" "${name}" {
  name     = "${node.label}"
  role_arn = "REPLACE_WITH_ROLE_ARN"
  type     = "${type}"

  definition = jsonencode({
    Comment = "REPLACE_WITH_DEFINITION"
    StartAt = "HelloWorld"
    States = {
      HelloWorld = {
        Type = "Pass"
        End  = true
      }
    }
  })
}`
}

function generateEventBridgeBus(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  return `resource "aws_cloudwatch_event_bus" "${name}" {
  name = "${node.label}"
}`
}

function generateSes(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  return `resource "aws_ses_email_identity" "${name}" {
  email = "${node.label}"
}`
}

function generateCognito(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  return `resource "aws_cognito_user_pool" "${name}" {
  name = "${node.label}"
}`
}

function generateKinesis(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const mode = str(node.metadata['streamMode'], 'PROVISIONED')
  return `resource "aws_kinesis_stream" "${name}" {
  name             = "${node.label}"
  shard_count      = ${mode === 'ON_DEMAND' ? 'null  # ON_DEMAND mode' : '1'}
  stream_mode_details {
    stream_mode = "${mode}"
  }
}`
}

function generateEcs(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const cluster = str(node.metadata['clusterName'] as string | undefined, 'REPLACE_WITH_CLUSTER')
  const launchType = str(node.metadata['launchType'] as string | undefined, 'FARGATE')
  return `resource "aws_ecs_service" "${name}" {
  name            = "${node.label}"
  cluster         = "${cluster}"
  launch_type     = "${launchType}"
  desired_count   = ${node.metadata['desiredCount'] ?? 1}
  task_definition = "REPLACE_WITH_TASK_DEFINITION_ARN"
}`
}

function generateElastiCache(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const engine = str(node.metadata['engine'] as string | undefined, 'redis')
  const nodeType = str(node.metadata['nodeType'] as string | undefined, 'cache.t3.micro')
  if (engine === 'redis') {
    return `resource "aws_elasticache_replication_group" "${name}" {
  replication_group_id = "${node.label}"
  description          = "${node.label}"
  node_type            = "${nodeType}"
  num_cache_clusters   = ${node.metadata['numCaches'] ?? 1}
}`
  }
  return `resource "aws_elasticache_cluster" "${name}" {
  cluster_id           = "${node.label}"
  engine               = "${engine}"
  node_type            = "${nodeType}"
  num_cache_nodes      = 1
}`
}

function generateEks(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const version = str(node.metadata['version'] as string | undefined, 'REPLACE_WITH_VERSION')
  return `resource "aws_eks_cluster" "${name}" {
  name     = "${node.label}"
  version  = "${version}"
  role_arn = "REPLACE_WITH_ROLE_ARN"

  vpc_config {
    subnet_ids = ["REPLACE_WITH_SUBNET_IDS"]
  }
}`
}

function generateOpenSearch(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const version = str(node.metadata['engineVersion'] as string | undefined, 'OpenSearch_2.11')
  return `resource "aws_opensearch_domain" "${name}" {
  domain_name    = "${node.label}"
  engine_version = "${version}"

  cluster_config {
    instance_type = "t3.small.search"
  }
}`
}

function generateMsk(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const clusterType = str(node.metadata['clusterType'] as string | undefined, 'PROVISIONED')
  return `resource "aws_msk_cluster" "${name}" {
  cluster_name           = "${node.label}"
  kafka_version          = "REPLACE_WITH_KAFKA_VERSION"
  number_of_broker_nodes = 3

  broker_node_group_info {
    instance_type   = "kafka.m5.large"
    client_subnets  = ["REPLACE_WITH_SUBNET_IDS"]
    storage_info {
      ebs_storage_info {
        volume_size = 100
      }
    }
  }
  # cluster_type = "${clusterType}"
}`
}

export const terraformGenerators: TerraformGeneratorMap = {
  'vpc': generateVpc,
  'subnet': generateSubnet,
  'ec2': generateEc2,
  's3': generateS3,
  'lambda': generateLambda,
  'rds': generateRds,
  'alb': generateAlb,
  'security-group': generateSg,
  'igw': generateIgw,
  'acm': generateAcm,
  'cloudfront': generateCloudFront,
  'apigw': generateApigw,
  'apigw-route': generateApigwRoute,
  'sqs': generateSqs,
  'secret': generateSecret,
  'ecr-repo': generateEcr,
  'sns': generateSns,
  'dynamo': generateDynamo,
  'ssm-param': generateSsmParam,
  'nat-gateway': generateNatGateway,
  'r53-zone': generateR53Zone,
  'sfn': generateSfn,
  'eventbridge-bus': generateEventBridgeBus,
  'ses': generateSes,
  'cognito': generateCognito,
  'kinesis': generateKinesis,
  'ecs': generateEcs,
  'elasticache': generateElastiCache,
  'eks': generateEks,
  'opensearch': generateOpenSearch,
  'msk': generateMsk,
  'unknown': () => '',
}
