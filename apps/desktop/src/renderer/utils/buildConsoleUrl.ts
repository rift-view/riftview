import type { CloudNode } from '@riftview/shared'

export function buildConsoleUrl(node: CloudNode): string | null {
  const { id, type, label, region, metadata } = node
  const r = encodeURIComponent(region)

  switch (type) {
    case 'aws:ec2':
      return `https://console.aws.amazon.com/ec2/v2/home?region=${r}#Instances:instanceId=${id}`
    case 'aws:vpc':
      return `https://console.aws.amazon.com/vpc/home?region=${r}#VpcDetails:VpcId=${id}`
    case 'aws:subnet':
      return `https://console.aws.amazon.com/vpc/home?region=${r}#SubnetDetails:subnetId=${id}`
    case 'aws:rds':
      return `https://console.aws.amazon.com/rds/home?region=${r}#database:id=${encodeURIComponent(label)}`
    case 'aws:s3':
      return `https://s3.console.aws.amazon.com/s3/buckets/${encodeURIComponent(label)}`
    case 'aws:lambda':
      return `https://console.aws.amazon.com/lambda/home?region=${r}#/functions/${encodeURIComponent(label)}`
    case 'aws:alb':
      return `https://console.aws.amazon.com/ec2/v2/home?region=${r}#LoadBalancers:search=${encodeURIComponent(label)}`
    case 'aws:security-group':
      return `https://console.aws.amazon.com/ec2/v2/home?region=${r}#SecurityGroups:groupId=${id}`
    case 'aws:igw':
      return `https://console.aws.amazon.com/vpc/home?region=${r}#InternetGateways:internetGatewayId=${id}`
    case 'aws:nat-gateway':
      return `https://console.aws.amazon.com/vpc/home?region=${r}#NatGateways:natGatewayId=${id}`
    case 'aws:acm':
      return `https://console.aws.amazon.com/acm/home?region=${r}#/`
    case 'aws:cloudfront':
      return `https://console.aws.amazon.com/cloudfront/v3/home#/distributions/${id}`
    case 'aws:apigw': {
      // APIGW node id is an ARN like arn:aws:apigateway:us-east-1::/apis/abc123
      // Extract the API ID from the end
      const apiId = id.split('/').pop() ?? id
      return `https://console.aws.amazon.com/apigateway/home?region=${r}#/apis/${apiId}`
    }
    case 'aws:sqs': {
      // SQS id is queue ARN; navigate to queue list filtered by name
      return `https://console.aws.amazon.com/sqs/v2/home?region=${r}#/queues`
    }
    case 'aws:secret':
      return `https://console.aws.amazon.com/secretsmanager/secret?name=${encodeURIComponent(label)}&region=${r}`
    case 'aws:ecr-repo':
      return `https://console.aws.amazon.com/ecr/repositories/${encodeURIComponent(label)}?region=${r}`
    case 'aws:sns':
      return `https://console.aws.amazon.com/sns/v3/home?region=${r}#/topic/${encodeURIComponent(id)}`
    case 'aws:dynamo':
      return `https://console.aws.amazon.com/dynamodbv2/home?region=${r}#table?name=${encodeURIComponent(label)}`
    case 'aws:ssm-param':
      return `https://console.aws.amazon.com/systems-manager/parameters?region=${r}`
    case 'aws:r53-zone':
      return `https://console.aws.amazon.com/route53/v2/hostedzones#`
    case 'aws:sfn':
      return `https://console.aws.amazon.com/states/home?region=${r}#/statemachines/view/${encodeURIComponent(id)}`
    case 'aws:eventbridge-bus':
      return `https://console.aws.amazon.com/events/home?region=${r}#/eventbus/${encodeURIComponent(label)}`
    case 'aws:ses':
      return `https://console.aws.amazon.com/ses/home?region=${r}#/verified-identities`
    case 'aws:cognito':
      return `https://console.aws.amazon.com/cognito/v2/idp/user-pools/${encodeURIComponent(id)}/users?region=${r}`
    case 'aws:kinesis':
      return `https://console.aws.amazon.com/kinesis/home?region=${r}#/streams/details/${encodeURIComponent(label)}/monitoring`
    case 'aws:ecs': {
      const clusterName = (metadata.clusterName as string | undefined) ?? ''
      const svcName = encodeURIComponent(label)
      const clusterEnc = encodeURIComponent(clusterName)
      return `https://console.aws.amazon.com/ecs/v2/clusters/${clusterEnc}/services/${svcName}?region=${r}`
    }
    case 'aws:elasticache':
      return `https://console.aws.amazon.com/elasticache/home?region=${r}#/redis`
    case 'aws:eks':
      return `https://console.aws.amazon.com/eks/home?region=${r}#/clusters/${encodeURIComponent(label)}`
    case 'aws:opensearch':
      return `https://console.aws.amazon.com/aos/home?region=${r}#opensearch/domains/${encodeURIComponent(label)}`
    case 'aws:msk':
      return `https://console.aws.amazon.com/msk/home?region=${r}#/clusters`
    case 'aws:apigw-route':
    case 'unknown':
      return null
    default:
      return null
  }
}
