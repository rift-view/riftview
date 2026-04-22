// AWS client factory
export { createClients, type AwsClients } from './aws/client'

// Credential validation (wraps STS — no direct @aws-sdk/client-sts dep needed by callers)
export { validateAwsCredentials, type ValidateCredentialsResult } from './aws/credentials'

// Service helpers — all exported so awsPlugin.ts (desktop, pre-RIFT-59) can import from here
export {
  describeInstances,
  describeVpcs,
  describeSubnets,
  describeSecurityGroups,
  describeKeyPairs
} from './aws/services/ec2'
export { describeDBInstances } from './aws/services/rds'
export { listBuckets } from './aws/services/s3'
export { listFunctions } from './aws/services/lambda'
export { describeLoadBalancers } from './aws/services/alb'
export { listCertificates } from './aws/services/acm'
export { listDistributions } from './aws/services/cloudfront'
export { listApis } from './aws/services/apigw'
export { listInternetGateways } from './aws/services/igw'
export { listNatGateways } from './aws/services/nat'
export { listQueues } from './aws/services/sqs'
export { listSecrets } from './aws/services/secrets'
export { listRepositories } from './aws/services/ecr'
export { listTopics } from './aws/services/sns'
export { listTables } from './aws/services/dynamo'
export { listParameters } from './aws/services/ssm'
export { listHostedZones } from './aws/services/r53'
export { listStateMachines } from './aws/services/sfn'
export { listEventBuses } from './aws/services/eventbridge'
export { listIdentities } from './aws/services/ses'
export { listUserPools } from './aws/services/cognito'
export { listStreams } from './aws/services/kinesis'
export { listEcsServices } from './aws/services/ecs'
export { listCacheClusters } from './aws/services/elasticache'
export { listEksClusters } from './aws/services/eks'
export { listOpenSearchDomains } from './aws/services/opensearch'
export { listMskClusters } from './aws/services/msk'
export {
  fetchMetrics,
  fetchMetricsForProfile,
  type CloudMetric,
  type FetchMetricsParams,
  type FetchMetricsForProfileParams
} from './aws/services/cloudwatch'

// IAM analysis helpers
export { fetchEc2IamData, fetchLambdaIamData, fetchS3IamData } from './aws/iam/fetcher'
