// src/renderer/types/create.ts

export interface VpcParams {
  resource: 'aws:vpc'
  name: string
  cidr: string
  tenancy: 'default' | 'dedicated'
}

export interface Ec2Params {
  resource: 'aws:ec2'
  name: string
  amiId: string
  instanceType: string
  keyName: string
  subnetId: string
  securityGroupIds: string[]
}

export interface SgParams {
  resource: 'aws:security-group'
  name: string
  description: string
  vpcId: string
  inboundRules: Array<{
    protocol: 'tcp' | 'udp' | 'icmp' | '-1'
    fromPort: number
    toPort: number
    cidr: string
  }>
}

export interface S3Params {
  resource: 'aws:s3'
  bucketName: string
  region: string
  blockPublicAccess: boolean
}

export interface RdsParams {
  resource: 'aws:rds'
  identifier: string
  engine: 'mysql' | 'postgres' | 'mariadb'
  instanceClass: string
  masterUsername: string
  masterPassword: string
  allocatedStorage: number
  multiAZ: boolean
  publiclyAccessible: boolean
  vpcId: string
  dbSubnetGroupName?: string
}

export interface LambdaParams {
  resource: 'aws:lambda'
  name: string
  runtime: 'nodejs20.x' | 'python3.12' | 'java21' | 'go1.x'
  handler: string
  roleArn: string
  memorySize: number
  timeout: number
  vpcId?: string
  subnetIds?: string[]
  securityGroupIds?: string[]
}

export interface AlbParams {
  resource: 'aws:alb'
  name: string
  scheme: 'internet-facing' | 'internal'
  subnetIds: string[]
  securityGroupIds: string[]
  vpcId: string
}

export interface AcmParams {
  resource: 'aws:acm'
  domainName: string
  subjectAlternativeNames: string[]
  validationMethod: 'DNS' | 'EMAIL'
}

export interface CloudFrontParams {
  resource: 'aws:cloudfront'
  comment: string
  origins: Array<{ id: string; domainName: string }>
  defaultRootObject: string
  certArn?: string
  priceClass: 'PriceClass_All' | 'PriceClass_100' | 'PriceClass_200'
}

export interface ApigwParams {
  resource: 'aws:apigw'
  name: string
  corsOrigins: string[]
}

export interface ApigwRouteParams {
  resource: 'aws:apigw-route'
  apiId: string
  method: string
  path: string
}

export interface SqsParams {
  resource: 'aws:sqs'
  name: string
  fifo?: boolean
  visibilityTimeout?: number
}
export interface SnsParams {
  resource: 'aws:sns'
  name: string
  fifo?: boolean
}
export interface DynamoParams {
  resource: 'aws:dynamo'
  tableName: string
  hashKey: string
  billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED'
}
export interface SecretParams {
  resource: 'aws:secret'
  name: string
  value: string
}
export interface EcrParams {
  resource: 'aws:ecr-repo'
  name: string
}
export interface SfnParams {
  resource: 'aws:sfn'
  name: string
  type?: 'STANDARD' | 'EXPRESS'
  roleArn: string
  definition: string
}
export interface EventBusParams {
  resource: 'aws:eventbridge-bus'
  name: string
}
export interface R53ZoneParams {
  resource: 'aws:r53-zone'
  domainName: string
  isPrivate: boolean
}
export interface CreateSsmParamParams {
  resource: 'aws:ssm-param'
  name: string
  value: string
  paramType: 'String' | 'StringList'
  description?: string
}
export interface CreateSubnetParams {
  resource: 'aws:subnet'
  vpcId: string
  cidrBlock: string
  availabilityZone?: string
}
export interface CreateIgwParams {
  resource: 'aws:igw'
  name?: string
}

export type CreateParams =
  | VpcParams
  | Ec2Params
  | SgParams
  | S3Params
  | RdsParams
  | LambdaParams
  | AlbParams
  | AcmParams
  | CloudFrontParams
  | ApigwParams
  | ApigwRouteParams
  | SqsParams
  | SnsParams
  | DynamoParams
  | SecretParams
  | EcrParams
  | SfnParams
  | EventBusParams
  | R53ZoneParams
  | CreateSsmParamParams
  | CreateSubnetParams
  | CreateIgwParams
