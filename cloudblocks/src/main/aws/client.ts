import { EC2Client } from '@aws-sdk/client-ec2'
import { RDSClient } from '@aws-sdk/client-rds'
import { S3Client } from '@aws-sdk/client-s3'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { ElasticLoadBalancingV2Client } from '@aws-sdk/client-elastic-load-balancing-v2'
import { ACMClient } from '@aws-sdk/client-acm'
import { CloudFrontClient } from '@aws-sdk/client-cloudfront'
import { ApiGatewayV2Client } from '@aws-sdk/client-apigatewayv2'
import { SQSClient } from '@aws-sdk/client-sqs'
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { ECRClient } from '@aws-sdk/client-ecr'
import { SNSClient } from '@aws-sdk/client-sns'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { Route53Client } from '@aws-sdk/client-route-53'
import { SFNClient } from '@aws-sdk/client-sfn'
import { EventBridgeClient } from '@aws-sdk/client-eventbridge'

export interface AwsClients {
  ec2: EC2Client
  rds: RDSClient
  s3: S3Client
  lambda: LambdaClient
  alb: ElasticLoadBalancingV2Client
  acm: ACMClient
  cloudfront: CloudFrontClient
  apigw: ApiGatewayV2Client
  sqs: SQSClient
  secrets: SecretsManagerClient
  ecr: ECRClient
  sns: SNSClient
  dynamo: DynamoDBClient
  ssm: SSMClient
  r53: Route53Client
  sfn: SFNClient
  eventbridge: EventBridgeClient
}

// Creates a fresh set of AWS SDK clients for the given profile + region.
export function createClients(profile: string, region: string): AwsClients {
  const config = { region }

  // Set AWS_PROFILE so the SDK credential provider picks up the right profile.
  process.env.AWS_PROFILE = profile
  process.env.AWS_REGION = region

  return {
    ec2:        new EC2Client(config),
    rds:        new RDSClient(config),
    s3:         new S3Client(config),
    lambda:     new LambdaClient(config),
    alb:        new ElasticLoadBalancingV2Client(config),
    // ACM for CloudFront must always use us-east-1
    acm:        new ACMClient({ region: 'us-east-1' }),
    cloudfront: new CloudFrontClient(config),
    apigw:      new ApiGatewayV2Client(config),
    sqs:        new SQSClient(config),
    secrets:    new SecretsManagerClient(config),
    ecr:        new ECRClient(config),
    sns:        new SNSClient(config),
    dynamo:     new DynamoDBClient(config),
    ssm:        new SSMClient(config),
    r53:        new Route53Client({ region: 'us-east-1' }),
    sfn:        new SFNClient(config),
    eventbridge: new EventBridgeClient(config),
  }
}
