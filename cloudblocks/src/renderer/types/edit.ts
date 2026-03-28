export interface VpcEditParams    { resource: 'vpc';    name: string }
export interface Ec2EditParams    { resource: 'ec2';    name?: string; instanceType?: string; securityGroupIds?: string[] }
export interface SgEditParams     { resource: 'sg';     rules: SgRule[] }
export interface RdsEditParams    { resource: 'rds';    dbInstanceClass?: string; multiAZ?: boolean; deletionProtection?: boolean }
export interface S3EditParams     { resource: 's3';     versioning?: boolean; blockPublicAccess?: boolean }
export interface LambdaEditParams { resource: 'lambda'; memorySize?: number; timeout?: number; environment?: Record<string, string> }
export interface AlbEditParams    { resource: 'alb';    name: string }

export interface SgRule {
  protocol: string
  fromPort: number
  toPort: number
  cidr: string
}

export interface CloudFrontEditParams {
  resource: 'cloudfront'
  comment?: string
  defaultRootObject?: string
  certArn?: string
  priceClass?: 'PriceClass_All' | 'PriceClass_100' | 'PriceClass_200'
}

export interface ApigwEditParams {
  resource: 'apigw'
  apiId: string
  name: string
  corsOrigins: string[]
}

export interface EventBridgeEditParams {
  resource: 'eventbridge-bus'
  busName: string
  description: string
}

export interface SqsEditParams {
  resource: 'sqs'
  queueUrl: string
  visibilityTimeout: number
  messageRetentionPeriod: number
}

export interface SnsEditParams {
  resource: 'sns'
  topicArn: string
  displayName: string
}

export interface EcrEditParams {
  resource: 'ecr-repo'
  repositoryName: string
  imageTagMutability: 'MUTABLE' | 'IMMUTABLE'
  scanOnPush: boolean
}

export interface SecretEditParams {
  resource: 'secret'
  secretId: string
  description: string
}

export interface DynamoEditParams {
  resource: 'dynamo'
  tableName: string
  billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED'
  readCapacityUnits?: number
  writeCapacityUnits?: number
}

export interface SsmEditParams {
  resource: 'ssm-param'
  paramName: string
  value: string
  paramType: string
  description?: string
}

export interface SfnEditParams {
  resource: 'sfn'
  stateMachineArn: string
  definition?: string
  roleArn?: string
}

export type EditParams =
  | VpcEditParams | Ec2EditParams | SgEditParams | RdsEditParams
  | S3EditParams  | LambdaEditParams | AlbEditParams | CloudFrontEditParams | ApigwEditParams
  | EventBridgeEditParams | SqsEditParams | SnsEditParams | EcrEditParams | SecretEditParams
  | DynamoEditParams | SsmEditParams | SfnEditParams
