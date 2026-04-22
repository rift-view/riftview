// AWS client factory
export { createClients, type AwsClients } from './aws/client'

// Credential validation (wraps STS)
export { validateAwsCredentials, type ValidateCredentialsResult } from './aws/credentials'

// CloudWatch metrics (used by desktop IPC)
export {
  fetchMetricsForProfile,
  type CloudMetric,
  type FetchMetricsForProfileParams
} from './aws/services/cloudwatch'

// EC2 helper used by desktop scanner
export { describeKeyPairs } from './aws/services/ec2'

// IAM helpers (used by desktop handlers)
export { fetchEc2IamData, fetchLambdaIamData, fetchS3IamData } from './aws/iam/fetcher'

// Plugin registry + built-in plugins
export { pluginRegistry, PluginRegistry } from './plugin/registry'
export { awsPlugin } from './plugin/awsPlugin'
export { vercelPluginStub } from './plugin/vercelPlugin.stub'
export { hetznerPluginStub } from './plugin/hetznerPlugin.stub'
export { registerBuiltinPlugins } from './plugin/boot'

// Plugin + restore types (re-export all for consumers)
export type * from './plugin/types'
export type * from './plugin/restoreTypes'
