// src/main/aws/provider.ts
import type { CloudNode, ScanError } from '../../renderer/types/cloud'
import type { AwsClients } from './client'
import { describeInstances, describeVpcs, describeSubnets, describeSecurityGroups } from './services/ec2'
import { describeDBInstances } from './services/rds'
import { listBuckets } from './services/s3'
import { listFunctions } from './services/lambda'
import { describeLoadBalancers } from './services/alb'
import { listCertificates } from './services/acm'
import { listDistributions } from './services/cloudfront'
import { listApis } from './services/apigw'
import { listInternetGateways } from './services/igw'
import { listQueues } from './services/sqs'
import { listSecrets } from './services/secrets'
import { listRepositories } from './services/ecr'
import { listTopics } from './services/sns'
import { listTables } from './services/dynamo'
import { listParameters } from './services/ssm'
import { listNatGateways } from './services/nat'
import { listHostedZones } from './services/r53'
import { listStateMachines } from './services/sfn'
import { listEventBuses } from './services/eventbridge'

/**
 * Contract every cloud provider plugin must satisfy.
 * M6 will add AzureProvider, GcpProvider implementing this.
 *
 * TODO(M6): `scan` currently accepts `AwsClients` which pins the interface to AWS.
 * Before adding a second provider, change to constructor injection so the interface
 * becomes `scan(region: string): Promise<ScanResult>` with clients bound at creation.
 */
export interface ScanResult {
  nodes: CloudNode[]
  scanErrors: ScanError[]
}

export interface CloudProvider {
  readonly id: string
  scan(clients: AwsClients, region: string): Promise<ScanResult>
}

function errCatch(service: string, region: string, errors: ScanError[]) {
  return (e: unknown): CloudNode[] => {
    errors.push({ service, region, message: (e as Error)?.message ?? String(e) })
    return []
  }
}

export const awsProvider: CloudProvider = {
  id: 'aws',
  async scan(clients, region) {
    const errors: ScanError[] = []
    const catch_ = (service: string): ((_e: unknown) => CloudNode[]) => errCatch(service, region, errors)

    const results = await Promise.all([
      describeInstances(clients.ec2, region).catch(catch_('ec2:instances')),
      describeVpcs(clients.ec2, region).catch(catch_('ec2:vpcs')),
      describeSubnets(clients.ec2, region).catch(catch_('ec2:subnets')),
      describeSecurityGroups(clients.ec2, region).catch(catch_('ec2:security-groups')),
      describeDBInstances(clients.rds, region).catch(catch_('rds')),
      listBuckets(clients.s3, region).catch(catch_('s3')),
      listFunctions(clients.lambda, region).catch(catch_('lambda')),
      describeLoadBalancers(clients.alb, region).catch(catch_('alb')),
      listCertificates(clients.acm).catch(catch_('acm')),
      listDistributions(clients.cloudfront).catch(catch_('cloudfront')),
      listApis(clients.apigw, region).catch(catch_('apigw')),
      listInternetGateways(clients.ec2, region).catch(catch_('igw')),
      listQueues(clients.sqs, clients.lambda, region).catch(catch_('sqs')),
      listSecrets(clients.secrets, region).catch(catch_('secrets')),
      listRepositories(clients.ecr, region).catch(catch_('ecr')),
      listTopics(clients.sns, region).catch(catch_('sns')),
      listTables(clients.dynamo, region).catch(catch_('dynamo')),
      listParameters(clients.ssm, region).catch(catch_('ssm')),
      listNatGateways(clients.ec2, region).catch(catch_('nat')),
      listHostedZones(clients.r53).catch(catch_('r53')),
      listStateMachines(clients.sfn, region).catch(catch_('sfn')),
      listEventBuses(clients.eventbridge, region).catch(catch_('eventbridge')),
    ])
    return { nodes: results.flat(), scanErrors: errors }
  },
}
