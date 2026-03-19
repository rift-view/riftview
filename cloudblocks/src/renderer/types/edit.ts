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

export type EditParams =
  | VpcEditParams | Ec2EditParams | SgEditParams | RdsEditParams
  | S3EditParams  | LambdaEditParams | AlbEditParams | CloudFrontEditParams | ApigwEditParams
