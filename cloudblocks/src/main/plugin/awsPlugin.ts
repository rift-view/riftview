// src/main/plugin/awsPlugin.ts
import { createClients, type AwsClients } from '../aws/client'
import { describeInstances, describeVpcs, describeSubnets, describeSecurityGroups } from '../aws/services/ec2'
import { describeDBInstances } from '../aws/services/rds'
import { listBuckets } from '../aws/services/s3'
import { listFunctions } from '../aws/services/lambda'
import { describeLoadBalancers } from '../aws/services/alb'
import { listCertificates } from '../aws/services/acm'
import { listDistributions } from '../aws/services/cloudfront'
import { listApis } from '../aws/services/apigw'
import { listInternetGateways } from '../aws/services/igw'
import { listNatGateways } from '../aws/services/nat'
import { listQueues } from '../aws/services/sqs'
import { listSecrets } from '../aws/services/secrets'
import { listRepositories } from '../aws/services/ecr'
import { listTopics } from '../aws/services/sns'
import { listTables } from '../aws/services/dynamo'
import { listParameters } from '../aws/services/ssm'
import { listHostedZones } from '../aws/services/r53'
import { listStateMachines } from '../aws/services/sfn'
import { listEventBuses } from '../aws/services/eventbridge'
import { listIdentities } from '../aws/services/ses'
import { listUserPools } from '../aws/services/cognito'
import { listStreams } from '../aws/services/kinesis'
import { listEcsServices } from '../aws/services/ecs'
import { listCacheClusters } from '../aws/services/elasticache'
import { listEksClusters } from '../aws/services/eks'
import { listOpenSearchDomains } from '../aws/services/opensearch'
import { listMskClusters } from '../aws/services/msk'
import type { CloudblocksPlugin, NodeTypeMetadata, PluginScanResult, ScanContext } from './types'
import type { CloudNode } from '../../renderer/types/cloud'

function errCatch(service: string, region: string, errors: PluginScanResult['errors']) {
  return (e: unknown): CloudNode[] => {
    errors.push({ service, region, message: (e as Error)?.message ?? String(e) })
    return []
  }
}

type ServiceScanner = (clients: AwsClients, region: string) => Promise<CloudNode[]>

// Maps the service key used in catch_() calls to its scanner function.
// Used by scanService() to scope a retry to a single named service.
const SERVICE_SCANNERS: Record<string, ServiceScanner> = {
  'ec2:instances':  (c, r) => describeInstances(c.ec2, r),
  'ec2:vpcs':       (c, r) => describeVpcs(c.ec2, r),
  'ec2:subnets':    (c, r) => describeSubnets(c.ec2, r),
  'security-group': (c, r) => describeSecurityGroups(c.ec2, r),
  'rds':            (c, r) => describeDBInstances(c.rds, r),
  's3':             (c, r) => listBuckets(c.s3, r),
  'lambda':         (c, r) => listFunctions(c.lambda, r),
  'alb':            (c, r) => describeLoadBalancers(c.alb, r),
  'acm':            (c)    => listCertificates(c.acm),
  'cloudfront':     (c)    => listDistributions(c.cloudfront),
  'apigw':          (c, r) => listApis(c.apigw, r),
  'igw':            (c, r) => listInternetGateways(c.ec2, r),
  'nat-gateway':    (c, r) => listNatGateways(c.ec2, r),
  'sqs':            (c, r) => listQueues(c.sqs, c.lambda, r),
  'secret':         (c, r) => listSecrets(c.secrets, r),
  'ecr-repo':       (c, r) => listRepositories(c.ecr, r),
  'sns':            (c, r) => listTopics(c.sns, r),
  'dynamo':         (c, r) => listTables(c.dynamo, c.lambda, r),
  'ssm-param':      (c, r) => listParameters(c.ssm, r),
  'r53-zone':       (c)    => listHostedZones(c.r53),
  'sfn':            (c, r) => listStateMachines(c.sfn, r),
  'eventbridge-bus':(c, r) => listEventBuses(c.eventbridge, r),
  'ses':            (c, r) => listIdentities(c.ses, r),
  'cognito':        (c, r) => listUserPools(c.cognito, r),
  'kinesis':        (c, r) => listStreams(c.kinesis, r),
  'ecs':            (c, r) => listEcsServices(c.ecs, r),
  'elasticache':    (c, r) => listCacheClusters(c.elasticache, r),
  'eks':            (c, r) => listEksClusters(c.eks, r),
  'opensearch':     (c, r) => listOpenSearchDomains(c.opensearch, r),
  'msk':            (c, r) => listMskClusters(c.msk, r),
}

const NODE_TYPE_METADATA: Readonly<Record<string, NodeTypeMetadata>> = {
  ec2:               { label: 'EC2',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'EC2',    displayName: 'EC2 Instance',              hasCreate: true  },
  vpc:               { label: 'VPC',    borderColor: '#1976D2', badgeColor: '#1976D2', shortLabel: 'VPC',    displayName: 'VPC',                       hasCreate: true  },
  subnet:            { label: 'SUBNET', borderColor: '#4CAF50', badgeColor: '#4CAF50', shortLabel: 'SUBNET', displayName: 'Subnet',                    hasCreate: true  },
  rds:               { label: 'RDS',    borderColor: '#4CAF50', badgeColor: '#4CAF50', shortLabel: 'RDS',    displayName: 'RDS Instance',              hasCreate: true  },
  s3:                { label: 'S3',     borderColor: '#64b5f6', badgeColor: '#64b5f6', shortLabel: 'S3',     displayName: 'S3 Bucket',                 hasCreate: true  },
  lambda:            { label: 'λ',      borderColor: '#64b5f6', badgeColor: '#64b5f6', shortLabel: 'λ',      displayName: 'Lambda Function',           hasCreate: true  },
  alb:               { label: 'ALB',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'ALB',    displayName: 'Load Balancer',             hasCreate: true  },
  'security-group':  { label: 'SG',     borderColor: '#9c27b0', badgeColor: '#9c27b0', shortLabel: 'SG',     displayName: 'Security Group',            hasCreate: true  },
  igw:               { label: 'IGW',    borderColor: '#4CAF50', badgeColor: '#4CAF50', shortLabel: 'IGW',    displayName: 'Internet Gateway',          hasCreate: false },
  acm:               { label: 'ACM',    borderColor: '#64b5f6', badgeColor: '#64b5f6', shortLabel: 'ACM',    displayName: 'ACM Certificate',           hasCreate: true  },
  cloudfront:        { label: 'CF',     borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'CF',     displayName: 'CloudFront Distribution',   hasCreate: true  },
  apigw:             { label: 'APIGW',  borderColor: '#8b5cf6', badgeColor: '#8b5cf6', shortLabel: 'APIGW',  displayName: 'API Gateway',               hasCreate: true  },
  'apigw-route':     { label: 'ROUTE',  borderColor: '#22c55e', badgeColor: '#22c55e', shortLabel: 'ROUTE',  displayName: 'API Gateway Route',         hasCreate: true  },
  sqs:               { label: 'SQS',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'SQS',    displayName: 'SQS Queue',                 hasCreate: true  },
  secret:            { label: 'SECRET', borderColor: '#22c55e', badgeColor: '#22c55e', shortLabel: 'SECRET', displayName: 'Secrets Manager Secret',    hasCreate: true  },
  'ecr-repo':        { label: 'ECR',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'ECR',    displayName: 'ECR Repository',            hasCreate: true  },
  sns:               { label: 'SNS',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'SNS',    displayName: 'SNS Topic',                 hasCreate: true  },
  dynamo:            { label: 'DDB',    borderColor: '#64b5f6', badgeColor: '#64b5f6', shortLabel: 'DDB',    displayName: 'DynamoDB Table',            hasCreate: true  },
  'ssm-param':       { label: 'SSM',    borderColor: '#22c55e', badgeColor: '#22c55e', shortLabel: 'SSM',    displayName: 'SSM Parameter',             hasCreate: true  },
  'nat-gateway':     { label: 'NAT',    borderColor: '#4CAF50', badgeColor: '#4CAF50', shortLabel: 'NAT',    displayName: 'NAT Gateway',               hasCreate: false },
  'r53-zone':        { label: 'R53',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'R53',    displayName: 'Route 53 Hosted Zone',      hasCreate: true  },
  sfn:               { label: 'SFN',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'SFN',    displayName: 'Step Functions State Machine', hasCreate: true },
  'eventbridge-bus': { label: 'EB',     borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'EB',     displayName: 'EventBridge Bus',           hasCreate: true  },
  ses:               { label: 'SES',    borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'SES',    displayName: 'SES Identity',               hasCreate: false },
  cognito:           { label: 'COGNITO',borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'COGNITO',displayName: 'Cognito User Pool',           hasCreate: false },
  kinesis:           { label: 'KDS',    borderColor: '#8b5cf6', badgeColor: '#8b5cf6', shortLabel: 'KDS',    displayName: 'Kinesis Data Stream',         hasCreate: false },
  ecs:               { label: 'ECS',   borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'ECS',   displayName: 'ECS Service',                 hasCreate: false },
  elasticache:       { label: 'REDIS', borderColor: '#22c55e', badgeColor: '#22c55e', shortLabel: 'REDIS', displayName: 'ElastiCache Cluster',          hasCreate: false },
  eks:               { label: 'EKS',   borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'EKS',   displayName: 'EKS Cluster',                 hasCreate: false },
  opensearch:        { label: 'OS',    borderColor: '#005EB8', badgeColor: '#005EB8', shortLabel: 'OS',    displayName: 'OpenSearch Domain',           hasCreate: false },
  msk:               { label: 'MSK',   borderColor: '#FF9900', badgeColor: '#FF9900', shortLabel: 'MSK',   displayName: 'MSK Cluster',                 hasCreate: false },
  unknown:           { label: '?',      borderColor: '#6b7280', badgeColor: '#6b7280', shortLabel: '?',      displayName: 'Unknown',                   hasCreate: false },
}

export const awsPlugin: CloudblocksPlugin = {
  id: 'com.cloudblocks.aws',
  displayName: 'Amazon Web Services',

  nodeTypes: [
    'ec2', 'vpc', 'subnet', 'rds', 's3', 'lambda', 'alb', 'security-group',
    'igw', 'acm', 'cloudfront', 'apigw', 'apigw-route', 'sqs', 'secret',
    'ecr-repo', 'sns', 'dynamo', 'ssm-param', 'nat-gateway', 'r53-zone',
    'sfn', 'eventbridge-bus', 'ses', 'cognito', 'kinesis', 'ecs', 'elasticache',
    'eks', 'opensearch', 'msk', 'unknown',
  ],

  nodeTypeMetadata: NODE_TYPE_METADATA,

  createCredentials(profile: string, region: string, endpoint?: string): AwsClients {
    return createClients(profile, region, endpoint)
  },

  async scanService(serviceName: string, context: ScanContext): Promise<PluginScanResult | undefined> {
    const scanner = SERVICE_SCANNERS[serviceName]
    if (!scanner) return undefined
    const clients = context.credentials as AwsClients
    const region = context.region
    const errors: PluginScanResult['errors'] = []
    try {
      const raw = await scanner(clients, region)
      const nodes = raw.map((node) => ({ ...node, region: node.region ?? region }))
      return { nodes, errors }
    } catch (e) {
      errors.push({ service: serviceName, region, message: (e as Error)?.message ?? String(e) })
      return { nodes: [], errors }
    }
  },

  async scan(context: ScanContext): Promise<PluginScanResult> {
    const clients = context.credentials as AwsClients
    const region = context.region
    const errors: PluginScanResult['errors'] = []
    const catch_ = (service: string): ((e: unknown) => CloudNode[]) => errCatch(service, region, errors)

    const results = await Promise.all([
      describeInstances(clients.ec2, region).catch(catch_('ec2:instances')),
      describeVpcs(clients.ec2, region).catch(catch_('ec2:vpcs')),
      describeSubnets(clients.ec2, region).catch(catch_('ec2:subnets')),
      describeSecurityGroups(clients.ec2, region).catch(catch_('security-group')),
      describeDBInstances(clients.rds, region).catch(catch_('rds')),
      listBuckets(clients.s3, region).catch(catch_('s3')),
      listFunctions(clients.lambda, region).catch(catch_('lambda')),
      describeLoadBalancers(clients.alb, region).catch(catch_('alb')),
      listCertificates(clients.acm).catch(catch_('acm')),
      listDistributions(clients.cloudfront).catch(catch_('cloudfront')),
      listApis(clients.apigw, region).catch(catch_('apigw')),
      listInternetGateways(clients.ec2, region).catch(catch_('igw')),
      listNatGateways(clients.ec2, region).catch(catch_('nat-gateway')),
      listQueues(clients.sqs, clients.lambda, region).catch(catch_('sqs')),
      listSecrets(clients.secrets, region).catch(catch_('secret')),
      listRepositories(clients.ecr, region).catch(catch_('ecr-repo')),
      listTopics(clients.sns, region).catch(catch_('sns')),
      listTables(clients.dynamo, clients.lambda, region).catch(catch_('dynamo')),
      listParameters(clients.ssm, region).catch(catch_('ssm-param')),
      listHostedZones(clients.r53).catch(catch_('r53-zone')),
      listStateMachines(clients.sfn, region).catch(catch_('sfn')),
      listEventBuses(clients.eventbridge, region).catch(catch_('eventbridge-bus')),
      listIdentities(clients.ses, region).catch(catch_('ses')),
      listUserPools(clients.cognito, region).catch(catch_('cognito')),
      listStreams(clients.kinesis, region).catch(catch_('kinesis')),
      listEcsServices(clients.ecs, region).catch(catch_('ecs')),
      listCacheClusters(clients.elasticache, region).catch(catch_('elasticache')),
      listEksClusters(clients.eks, region).catch(catch_('eks')),
      listOpenSearchDomains(clients.opensearch, region).catch(catch_('opensearch')),
      listMskClusters(clients.msk, region).catch(catch_('msk')),
    ])

    const nodes = results.flat().map((node) => ({ ...node, region: node.region ?? region }))
    return { nodes, errors }
  },
}
