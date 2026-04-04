import type { CloudNode } from '../types/cloud'

export function buildConsoleUrl(node: CloudNode): string | null {
  const { id, type, label, region, metadata } = node
  const r = encodeURIComponent(region)

  switch (type) {
    case 'ec2':
      return `https://console.aws.amazon.com/ec2/v2/home?region=${r}#Instances:instanceId=${id}`
    case 'vpc':
      return `https://console.aws.amazon.com/vpc/home?region=${r}#VpcDetails:VpcId=${id}`
    case 'subnet':
      return `https://console.aws.amazon.com/vpc/home?region=${r}#SubnetDetails:subnetId=${id}`
    case 'rds':
      return `https://console.aws.amazon.com/rds/home?region=${r}#database:id=${encodeURIComponent(label)}`
    case 's3':
      return `https://s3.console.aws.amazon.com/s3/buckets/${encodeURIComponent(label)}`
    case 'lambda':
      return `https://console.aws.amazon.com/lambda/home?region=${r}#/functions/${encodeURIComponent(label)}`
    case 'alb':
      return `https://console.aws.amazon.com/ec2/v2/home?region=${r}#LoadBalancers:search=${encodeURIComponent(label)}`
    case 'security-group':
      return `https://console.aws.amazon.com/ec2/v2/home?region=${r}#SecurityGroups:groupId=${id}`
    case 'igw':
      return `https://console.aws.amazon.com/vpc/home?region=${r}#InternetGateways:internetGatewayId=${id}`
    case 'nat-gateway':
      return `https://console.aws.amazon.com/vpc/home?region=${r}#NatGateways:natGatewayId=${id}`
    case 'acm':
      return `https://console.aws.amazon.com/acm/home?region=${r}#/`
    case 'cloudfront':
      return `https://console.aws.amazon.com/cloudfront/v3/home#/distributions/${id}`
    case 'apigw': {
      // APIGW node id is an ARN like arn:aws:apigateway:us-east-1::/apis/abc123
      // Extract the API ID from the end
      const apiId = id.split('/').pop() ?? id
      return `https://console.aws.amazon.com/apigateway/home?region=${r}#/apis/${apiId}`
    }
    case 'sqs': {
      // SQS id is queue ARN; navigate to queue list filtered by name
      return `https://console.aws.amazon.com/sqs/v2/home?region=${r}#/queues`
    }
    case 'secret':
      return `https://console.aws.amazon.com/secretsmanager/secret?name=${encodeURIComponent(label)}&region=${r}`
    case 'ecr-repo':
      return `https://console.aws.amazon.com/ecr/repositories/${encodeURIComponent(label)}?region=${r}`
    case 'sns':
      return `https://console.aws.amazon.com/sns/v3/home?region=${r}#/topic/${encodeURIComponent(id)}`
    case 'dynamo':
      return `https://console.aws.amazon.com/dynamodbv2/home?region=${r}#table?name=${encodeURIComponent(label)}`
    case 'ssm-param':
      return `https://console.aws.amazon.com/systems-manager/parameters?region=${r}`
    case 'r53-zone':
      return `https://console.aws.amazon.com/route53/v2/hostedzones#`
    case 'sfn':
      return `https://console.aws.amazon.com/states/home?region=${r}#/statemachines/view/${encodeURIComponent(id)}`
    case 'eventbridge-bus':
      return `https://console.aws.amazon.com/events/home?region=${r}#/eventbus/${encodeURIComponent(label)}`
    case 'ses':
      return `https://console.aws.amazon.com/ses/home?region=${r}#/verified-identities`
    case 'cognito':
      return `https://console.aws.amazon.com/cognito/v2/idp/user-pools/${encodeURIComponent(id)}/users?region=${r}`
    case 'kinesis':
      return `https://console.aws.amazon.com/kinesis/home?region=${r}#/streams/details/${encodeURIComponent(label)}/monitoring`
    case 'ecs': {
      const clusterName = (metadata.clusterName as string | undefined) ?? ''
      const svcName = encodeURIComponent(label)
      const clusterEnc = encodeURIComponent(clusterName)
      return `https://console.aws.amazon.com/ecs/v2/clusters/${clusterEnc}/services/${svcName}?region=${r}`
    }
    case 'elasticache':
      return `https://console.aws.amazon.com/elasticache/home?region=${r}#/redis`
    case 'eks':
      return `https://console.aws.amazon.com/eks/home?region=${r}#/clusters/${encodeURIComponent(label)}`
    case 'opensearch':
      return `https://console.aws.amazon.com/aos/home?region=${r}#opensearch/domains/${encodeURIComponent(label)}`
    case 'msk':
      return `https://console.aws.amazon.com/msk/home?region=${r}#/clusters`
    case 'apigw-route':
    case 'unknown':
      return null
    default:
      return null
  }
}
