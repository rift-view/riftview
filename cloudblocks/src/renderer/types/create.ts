// src/renderer/types/create.ts

export interface VpcParams {
  resource: 'vpc'
  name: string
  cidr: string
  tenancy: 'default' | 'dedicated'
}

export interface Ec2Params {
  resource: 'ec2'
  name: string
  amiId: string
  instanceType: string
  keyName: string
  subnetId: string
  securityGroupIds: string[]
}

export interface SgParams {
  resource: 'sg'
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
  resource: 's3'
  bucketName: string
  region: string
  blockPublicAccess: boolean
}

export interface RdsParams {
  resource: 'rds'
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
  resource: 'lambda'
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
  resource: 'alb'
  name: string
  scheme: 'internet-facing' | 'internal'
  subnetIds: string[]
  securityGroupIds: string[]
  vpcId: string
}

export interface AcmParams {
  resource: 'acm'
  domainName: string
  subjectAlternativeNames: string[]
  validationMethod: 'DNS' | 'EMAIL'
}

export interface CloudFrontParams {
  resource: 'cloudfront'
  comment: string
  origins: Array<{ id: string; domainName: string }>
  defaultRootObject: string
  certArn?: string
  priceClass: 'PriceClass_All' | 'PriceClass_100' | 'PriceClass_200'
}

export interface ApigwParams {
  resource: 'apigw'
  name: string
  corsOrigins: string[]
}

export interface ApigwRouteParams {
  resource: 'apigw-route'
  apiId: string
  method: string
  path: string
}

export interface SqsParams { resource: 'sqs'; name: string; fifo?: boolean; visibilityTimeout?: number }
export interface SnsParams { resource: 'sns'; name: string; fifo?: boolean }
export interface DynamoParams { resource: 'dynamo'; tableName: string; hashKey: string; billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED' }
export interface SecretParams { resource: 'secret'; name: string; value: string }
export interface EcrParams { resource: 'ecr'; name: string }
export interface SfnParams { resource: 'sfn'; name: string; type?: 'STANDARD' | 'EXPRESS'; roleArn: string; definition: string }
export interface EventBusParams { resource: 'eventbridge-bus'; name: string }
export interface R53ZoneParams { resource: 'r53-zone'; domainName: string; isPrivate: boolean }
export interface CreateSsmParamParams { resource: 'ssm-param'; name: string; value: string; paramType: 'String' | 'StringList'; description?: string }

export type CreateParams = VpcParams | Ec2Params | SgParams | S3Params | RdsParams | LambdaParams | AlbParams | AcmParams | CloudFrontParams | ApigwParams | ApigwRouteParams | SqsParams | SnsParams | DynamoParams | SecretParams | EcrParams | SfnParams | EventBusParams | R53ZoneParams | CreateSsmParamParams
