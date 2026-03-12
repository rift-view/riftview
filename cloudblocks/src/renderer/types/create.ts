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

export type CreateParams = VpcParams | Ec2Params | SgParams | S3Params
