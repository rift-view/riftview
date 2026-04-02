import type { CloudNode } from '../types/cloud'

const REGION = 'us-east-1'

export const SAMPLE_NODES: CloudNode[] = [
  // VPC
  {
    id:       'vpc-0sample1',
    type:     'vpc',
    label:    'sample-vpc',
    status:   'running',
    region:   REGION,
    metadata: { cidr: '10.0.0.0/16' },
  },

  // Subnets
  {
    id:       'subnet-pub1',
    type:     'subnet',
    label:    'public-1a',
    status:   'running',
    region:   REGION,
    metadata: { cidr: '10.0.1.0/24', availabilityZone: 'us-east-1a', public: true },
    parentId: 'vpc-0sample1',
  },
  {
    id:       'subnet-priv1',
    type:     'subnet',
    label:    'private-1a',
    status:   'running',
    region:   REGION,
    metadata: { cidr: '10.0.2.0/24', availabilityZone: 'us-east-1a', public: false },
    parentId: 'vpc-0sample1',
  },

  // Security Group
  {
    id:       'sg-0sample1',
    type:     'security-group',
    label:    'web-sg',
    status:   'running',
    region:   REGION,
    metadata: { vpcId: 'vpc-0sample1', description: 'Web tier' },
    parentId: 'vpc-0sample1',
  },

  // Internet Gateway
  {
    id:       'igw-0sample1',
    type:     'igw',
    label:    'sample-igw',
    status:   'running',
    region:   REGION,
    metadata: { vpcId: 'vpc-0sample1' },
    parentId: 'vpc-0sample1',
  },

  // EC2 — public subnet
  {
    id:       'i-0sample01',
    type:     'ec2',
    label:    'web-server-1',
    status:   'running',
    region:   REGION,
    metadata: { instanceType: 't3.micro', state: 'running', privateIp: '10.0.1.10' },
    parentId: 'subnet-pub1',
  },

  // EC2 — private subnet
  {
    id:       'i-0sample02',
    type:     'ec2',
    label:    'app-server-1',
    status:   'running',
    region:   REGION,
    metadata: { instanceType: 't3.small', state: 'running', privateIp: '10.0.2.10' },
    parentId: 'subnet-priv1',
  },

  // RDS
  {
    id:       'sample-db',
    type:     'rds',
    label:    'sample-db',
    status:   'running',
    region:   REGION,
    metadata: { engine: 'mysql', instanceClass: 'db.t3.micro', status: 'available', deletionProtection: false },
    parentId: 'subnet-priv1',
  },

  // Lambda
  {
    id:       'arn:aws:lambda:us-east-1:123456789012:function:api-handler',
    type:     'lambda',
    label:    'api-handler',
    status:   'running',
    region:   REGION,
    metadata: { runtime: 'nodejs20.x', memory: 256, timeout: 30 },
  },

  // API Gateway
  {
    id:       'abc123sample',
    type:     'apigw',
    label:    'sample-api',
    status:   'running',
    region:   REGION,
    metadata: { protocolType: 'HTTP' },
  },

  // API Gateway Route
  {
    id:       'abc123sample-GET-items',
    type:     'apigw-route',
    label:    'GET /items',
    status:   'running',
    region:   REGION,
    metadata: { apiId: 'abc123sample', routeKey: 'GET /items' },
    parentId: 'abc123sample',
  },

  // S3
  {
    id:       'sample-assets-bucket',
    type:     's3',
    label:    'sample-assets-bucket',
    status:   'running',
    region:   REGION,
    metadata: {},
  },

  // SQS — id is queue URL (enables SNS→SQS edges)
  {
    id:       'https://sqs.us-east-1.amazonaws.com/123456789012/job-queue',
    type:     'sqs',
    label:    'job-queue',
    status:   'running',
    region:   REGION,
    metadata: { url: 'https://sqs.us-east-1.amazonaws.com/123456789012/job-queue' },
  },

  // ALB
  {
    id:       'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/sample-alb/abc123',
    type:     'alb',
    label:    'sample-alb',
    status:   'running',
    region:   REGION,
    metadata: { dnsName: 'sample-alb.us-east-1.elb.amazonaws.com', scheme: 'internet-facing' },
  },
]
