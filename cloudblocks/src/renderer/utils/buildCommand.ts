import type { CreateParams, SgParams, S3Params, RdsParams, LambdaParams, AlbParams, AcmParams, ApigwParams, ApigwRouteParams, SqsParams, SnsParams, DynamoParams, SecretParams, EcrParams, SfnParams, EventBusParams, R53ZoneParams, CreateSsmParamParams } from '../types/create'

/**
 * Returns an array of argv arrays — one per aws CLI command.
 * For multi-step resources (SG with rules, S3 with public-access-block),
 * the engine runs them sequentially and stops on first non-zero exit.
 *
 * SG authorize commands use the literal placeholder `{GroupId}`.
 * The CliEngine substitutes this with the GroupId parsed from the
 * `create-security-group` stdout before running each authorize command.
 */
export function buildCommands(params: CreateParams): string[][] {
  switch (params.resource) {
    case 'vpc':
      return [[
        'ec2', 'create-vpc',
        '--cidr-block', params.cidr,
        '--instance-tenancy', params.tenancy,
        '--tag-specifications',
        `ResourceType=vpc,Tags=[{Key=Name,Value=${params.name}}]`,
      ]]

    case 'ec2': {
      const ec2Args: string[] = [
        'ec2', 'run-instances',
        '--image-id',       params.amiId,
        '--instance-type',  params.instanceType,
        '--count', '1',
        '--tag-specifications',
        `ResourceType=instance,Tags=[{Key=Name,Value=${params.name}}]`,
      ]
      if (params.keyName) ec2Args.push('--key-name', params.keyName)
      if (params.subnetId) ec2Args.push('--subnet-id', params.subnetId)
      if (params.securityGroupIds.length > 0) ec2Args.push('--security-group-ids', ...params.securityGroupIds)
      return [ec2Args]
    }

    case 'sg':
      return buildSgCommands(params)

    case 's3':
      return buildS3Commands(params)

    case 'rds':        return buildRdsCommands(params as RdsParams)
    case 'lambda':     return buildLambdaCommands(params as LambdaParams)
    case 'alb':        return buildAlbCommands(params as AlbParams)
    case 'acm':        return buildAcmCommands(params as AcmParams)
    case 'cloudfront': return []   // CloudFront create uses SDK via IPC, not CLI
    case 'apigw':      return buildApigwCommands(params as ApigwParams)
    case 'apigw-route': return buildApigwRouteCommands(params as ApigwRouteParams)
    case 'sqs':            return buildSqsCommands(params as SqsParams)
    case 'sns':            return buildSnsCommands(params as SnsParams)
    case 'dynamo':         return buildDynamoCommands(params as DynamoParams)
    case 'secret':         return buildSecretCommands(params as SecretParams)
    case 'ecr':            return buildEcrCommands(params as EcrParams)
    case 'sfn':            return buildSfnCommands(params as SfnParams)
    case 'eventbridge-bus': return buildEventBusCommands(params as EventBusParams)
    case 'r53-zone':        return buildR53ZoneCommands(params as R53ZoneParams)
    case 'ssm-param':      return buildSsmParamCommands(params as CreateSsmParamParams)
  }
}

function buildRdsCommands(p: RdsParams): string[][] {
  const args = [
    'rds', 'create-db-instance',
    '--db-instance-identifier', p.identifier,
    '--db-instance-class', p.instanceClass,
    '--engine', p.engine,
    '--master-username', p.masterUsername,
    '--master-user-password', p.masterPassword,
    '--allocated-storage', String(p.allocatedStorage),
  ]
  if (p.multiAZ) args.push('--multi-az')
  if (p.publiclyAccessible) args.push('--publicly-accessible')
  else args.push('--no-publicly-accessible')
  if (p.dbSubnetGroupName) args.push('--db-subnet-group-name', p.dbSubnetGroupName)
  return [args]
}

function buildLambdaCommands(p: LambdaParams): string[][] {
  const args = [
    'lambda', 'create-function',
    '--function-name', p.name,
    '--runtime', p.runtime,
    '--handler', p.handler,
    '--role', p.roleArn,
    '--code', 'ZipFile=fileb://function.zip',
    '--memory-size', String(p.memorySize),
    '--timeout', String(p.timeout),
  ]
  if (p.vpcId && p.subnetIds && p.securityGroupIds) {
    args.push('--vpc-config', `SubnetIds=${p.subnetIds.join(',')},SecurityGroupIds=${p.securityGroupIds.join(',')}`)
  }
  return [args]
}

function buildAlbCommands(p: AlbParams): string[][] {
  return [[
    'elbv2', 'create-load-balancer',
    '--name', p.name,
    '--scheme', p.scheme,
    '--subnets', ...p.subnetIds,
    '--security-groups', ...p.securityGroupIds,
  ]]
}

function buildSgCommands(params: SgParams): string[][] {
  const create: string[] = [
    'ec2', 'create-security-group',
    '--group-name',  params.name,
    '--description', params.description,
    '--vpc-id',      params.vpcId,
  ]

  // Use --group-id with {GroupId} placeholder.
  // The CliEngine substitutes this with the actual GroupId parsed from
  // create-security-group stdout before running each authorize command.
  const authorizes: string[][] = params.inboundRules.map((rule) => [
    'ec2', 'authorize-security-group-ingress',
    '--group-id', '{GroupId}',
    '--ip-permissions',
    `IpProtocol=${rule.protocol},FromPort=${rule.fromPort},ToPort=${rule.toPort},IpRanges=[{CidrIp=${rule.cidr}}]`,
  ])

  return [create, ...authorizes]
}

function buildApigwCommands(p: ApigwParams): string[][] {
  const args = [
    'apigatewayv2', 'create-api',
    '--name', p.name,
    '--protocol-type', 'HTTP',
  ]
  if (p.corsOrigins.length > 0) {
    args.push('--cors-configuration', `AllowOrigins=${p.corsOrigins.join(',')},AllowMethods=*,AllowHeaders=*`)
  }
  return [args]
}

function buildApigwRouteCommands(p: ApigwRouteParams): string[][] {
  return [[
    'apigatewayv2', 'create-route',
    '--api-id', p.apiId,
    '--route-key', `${p.method} ${p.path}`,
  ]]
}

function buildAcmCommands(p: AcmParams): string[][] {
  const args = [
    'acm', 'request-certificate',
    '--domain-name', p.domainName,
    '--validation-method', p.validationMethod,
  ]
  if (p.subjectAlternativeNames.length > 0) {
    args.push('--subject-alternative-names', ...p.subjectAlternativeNames)
  }
  return [args]
}

function buildSqsCommands(p: SqsParams): string[][] {
  const queueName = p.fifo ? `${p.name}.fifo` : p.name
  const args = ['sqs', 'create-queue', '--queue-name', queueName]
  const attrs: string[] = []
  if (p.fifo) attrs.push('FifoQueue=true')
  if (p.visibilityTimeout !== undefined) attrs.push(`VisibilityTimeout=${p.visibilityTimeout}`)
  if (attrs.length > 0) args.push('--attributes', attrs.join(','))
  return [args]
}

function buildSnsCommands(p: SnsParams): string[][] {
  const topicName = p.fifo ? `${p.name}.fifo` : p.name
  const args = ['sns', 'create-topic', '--name', topicName]
  if (p.fifo) args.push('--attributes', 'FifoTopic=true')
  return [args]
}

function buildDynamoCommands(p: DynamoParams): string[][] {
  const billingMode = p.billingMode ?? 'PAY_PER_REQUEST'
  return [[
    'dynamodb', 'create-table',
    '--table-name', p.tableName,
    '--key-schema', `AttributeName=${p.hashKey},KeyType=HASH`,
    '--attribute-definitions', `AttributeName=${p.hashKey},AttributeType=S`,
    '--billing-mode', billingMode,
  ]]
}

function buildSecretCommands(p: SecretParams): string[][] {
  return [[
    'secretsmanager', 'create-secret',
    '--name', p.name,
    '--secret-string', p.value,
  ]]
}

function buildEcrCommands(p: EcrParams): string[][] {
  return [['ecr', 'create-repository', '--repository-name', p.name]]
}

function buildSfnCommands(p: SfnParams): string[][] {
  return [[
    'stepfunctions', 'create-state-machine',
    '--name', p.name,
    '--type', p.type ?? 'STANDARD',
    '--role-arn', p.roleArn,
    '--definition', p.definition,
  ]]
}

function buildEventBusCommands(p: EventBusParams): string[][] {
  return [['events', 'create-event-bus', '--name', p.name]]
}

function buildR53ZoneCommands(p: R53ZoneParams): string[][] {
  return [[
    'route53', 'create-hosted-zone',
    '--name', p.domainName,
    '--caller-reference', Date.now().toString(),
    '--hosted-zone-config', `Comment="",PrivateZone=${p.isPrivate}`,
  ]]
}

function buildSsmParamCommands(p: CreateSsmParamParams): string[][] {
  const args = [
    'ssm', 'put-parameter',
    '--name', p.name,
    '--value', p.value,
    '--type', p.paramType,
    '--overwrite',
  ]
  if (p.description) args.push('--description', p.description)
  return [args]
}

function buildS3Commands(params: S3Params): string[][] {
  const create: string[] = ['s3api', 'create-bucket', '--bucket', params.bucketName]

  if (params.region !== 'us-east-1') {
    create.push('--create-bucket-configuration', `LocationConstraint=${params.region}`)
  }

  const cmds: string[][] = [create]

  if (params.blockPublicAccess) {
    cmds.push([
      's3api', 'put-public-access-block',
      '--bucket', params.bucketName,
      '--public-access-block-configuration',
      'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true',
    ])
  }

  return cmds
}
