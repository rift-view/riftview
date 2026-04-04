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
import { IAMClient } from '@aws-sdk/client-iam'
import { SESClient } from '@aws-sdk/client-ses'
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'
import { KinesisClient } from '@aws-sdk/client-kinesis'
import { ECSClient } from '@aws-sdk/client-ecs'
import { ElastiCacheClient } from '@aws-sdk/client-elasticache'

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
  iam: IAMClient
  ses: SESClient
  cognito: CognitoIdentityProviderClient
  kinesis:      KinesisClient
  ecs:          ECSClient
  elasticache:  ElastiCacheClient
}

// Creates a fresh set of AWS SDK clients for the given profile + region.
// Pass an optional endpoint to redirect all clients to a local emulator (e.g. LocalStack).
export function createClients(profile: string, region: string, endpoint?: string): AwsClients {
  const endpointConfig = endpoint ? { endpoint } : {}

  // Local emulators (LocalStack, etc.) don't validate credentials but the SDK still
  // needs something to sign requests with. Provide static test credentials so the
  // credential provider chain doesn't fail trying to resolve a non-existent profile.
  const credentialsConfig = endpoint
    ? { credentials: { accessKeyId: 'test', secretAccessKey: 'test' } }
    : {}

  const config = { region, ...endpointConfig, ...credentialsConfig }

  // Set AWS_PROFILE so the SDK credential provider picks up the right profile.
  process.env.AWS_PROFILE = profile
  process.env.AWS_REGION = region

  // ACM and Route53 must use us-east-1 for real AWS, but local emulators are fully regional.
  const globalRegion = endpoint ? region : 'us-east-1'

  return {
    ec2:        new EC2Client(config),
    rds:        new RDSClient(config),
    s3:         new S3Client({ region, ...endpointConfig, ...credentialsConfig, ...(endpoint ? { forcePathStyle: true } : {}) }),
    lambda:     new LambdaClient(config),
    alb:        new ElasticLoadBalancingV2Client(config),
    acm:        new ACMClient({ region: globalRegion, ...endpointConfig, ...credentialsConfig }),
    cloudfront: new CloudFrontClient(config),
    apigw:      new ApiGatewayV2Client(config),
    sqs:        new SQSClient(config),
    secrets:    new SecretsManagerClient(config),
    ecr:        new ECRClient(config),
    sns:        new SNSClient(config),
    dynamo:     new DynamoDBClient(config),
    ssm:        new SSMClient(config),
    r53:        new Route53Client({ region: globalRegion, ...endpointConfig, ...credentialsConfig }),
    sfn:        new SFNClient(config),
    eventbridge: new EventBridgeClient(config),
    iam:         new IAMClient(config),
    ses:         new SESClient(config),
    cognito:     new CognitoIdentityProviderClient(config),
    kinesis:     new KinesisClient(config),
    ecs:         new ECSClient(config),
    elasticache: new ElastiCacheClient(config),
  }
}
