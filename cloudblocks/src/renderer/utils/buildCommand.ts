import type { CreateParams, SgParams, S3Params } from '../types/create'

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

    case 'ec2':
      return [[
        'ec2', 'run-instances',
        '--image-id',       params.amiId,
        '--instance-type',  params.instanceType,
        '--key-name',       params.keyName,
        '--subnet-id',      params.subnetId,
        '--security-group-ids', ...params.securityGroupIds,
        '--count', '1',
        '--tag-specifications',
        `ResourceType=instance,Tags=[{Key=Name,Value=${params.name}}]`,
      ]]

    case 'sg':
      return buildSgCommands(params)

    case 's3':
      return buildS3Commands(params)
  }
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
