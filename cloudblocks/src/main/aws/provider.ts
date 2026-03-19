// src/main/aws/provider.ts
import type { CloudNode } from '../../renderer/types/cloud'
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
 * becomes `scan(region: string): Promise<CloudNode[]>` with clients bound at creation.
 */
export interface CloudProvider {
  readonly id: string
  scan(clients: AwsClients, region: string): Promise<CloudNode[]>
}

export const awsProvider: CloudProvider = {
  id: 'aws',
  async scan(clients, region) {
    const results = await Promise.all([
      describeInstances(clients.ec2, region),
      describeVpcs(clients.ec2, region),
      describeSubnets(clients.ec2, region),
      describeSecurityGroups(clients.ec2, region),
      describeDBInstances(clients.rds, region),
      listBuckets(clients.s3, region),
      listFunctions(clients.lambda, region),
      describeLoadBalancers(clients.alb, region),
      listCertificates(clients.acm),
      listDistributions(clients.cloudfront),
      listApis(clients.apigw, region),
      listInternetGateways(clients.ec2, region).catch(() => [] as CloudNode[]),
      listQueues(clients.sqs, region).catch(() => [] as CloudNode[]),
      listSecrets(clients.secrets, region).catch(() => [] as CloudNode[]),
      listRepositories(clients.ecr, region).catch(() => [] as CloudNode[]),
      listTopics(clients.sns, region).catch(() => [] as CloudNode[]),
      listTables(clients.dynamo, region).catch(() => [] as CloudNode[]),
      listParameters(clients.ssm, region).catch(() => [] as CloudNode[]),
      listNatGateways(clients.ec2, region).catch(() => [] as CloudNode[]),
      listHostedZones(clients.r53).catch(() => [] as CloudNode[]),
      listStateMachines(clients.sfn, region).catch(() => [] as CloudNode[]),
      listEventBuses(clients.eventbridge, region).catch(() => [] as CloudNode[]),
    ])
    return results.flat()
  },
}
