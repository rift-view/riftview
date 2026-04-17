export function Onboarding(): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4 text-center"
      style={{ fontFamily: 'monospace' }}
    >
      <div className="text-3xl font-bold tracking-tighter" style={{ color: 'var(--cb-accent)' }}>
        TERMINUS
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--cb-text-primary)' }}>
        The incident diagnostic layer AWS doesn&apos;t have.
      </p>
      <p
        className="text-[11px] max-w-sm"
        style={{ color: 'var(--cb-text-muted)', lineHeight: 1.6 }}
      >
        Connect your AWS account to see your infrastructure as a live, connected graph — so you
        understand blast radius before the 3am page, not during it.
      </p>
      <div
        className="rounded p-4 text-left max-w-sm"
        style={{ background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border-strong)' }}
      >
        <div
          className="text-[10px] mb-3"
          style={{ color: 'var(--cb-text-secondary)', fontSize: 13 }}
        >
          New to AWS CLI? Run this in your terminal first:
        </div>
        <code
          style={{
            fontFamily: 'monospace',
            background: 'var(--cb-bg-elevated)',
            padding: '4px 8px',
            borderRadius: 3,
            fontSize: 12,
            color: 'var(--cb-accent)',
            display: 'inline-block',
            marginBottom: 10
          }}
        >
          aws configure
        </code>
        <div className="text-[10px]" style={{ color: 'var(--cb-text-secondary)', fontSize: 13 }}>
          Then enter your profile name below (default: &quot;default&quot;).
        </div>
        <div className="text-[10px] mt-3" style={{ color: 'var(--cb-text-muted)' }}>
          Then restart Terminus.
        </div>
      </div>
      <details
        className="rounded text-left max-w-sm w-full"
        style={{ background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border-strong)' }}
      >
        <summary
          className="text-[10px] cursor-pointer select-none px-4 py-3"
          style={{
            color: 'var(--cb-text-secondary)',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span style={{ color: 'var(--cb-accent)', fontWeight: 700, fontSize: 10 }}>▶</span>
          Required AWS Permissions
        </summary>
        <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--cb-border)' }}>
          <div className="text-[9px] mt-3 mb-2" style={{ color: 'var(--cb-text-muted)' }}>
            Attach these read-only actions to your IAM user or role:
          </div>
          <ul
            className="text-[9px] leading-relaxed"
            style={{ color: 'var(--cb-text-secondary)', listStyle: 'none', padding: 0, margin: 0 }}
          >
            {[
              'ec2:Describe*',
              'elasticloadbalancing:Describe*',
              'lambda:List*, lambda:Get*',
              's3:ListAllMyBuckets, s3:GetBucketLocation, s3:GetBucketTagging',
              'rds:Describe*',
              'cloudfront:List*, cloudfront:Get*',
              'acm:ListCertificates, acm:DescribeCertificate',
              'apigateway:GET',
              'sqs:ListQueues, sqs:GetQueueAttributes',
              'secretsmanager:ListSecrets, secretsmanager:DescribeSecret',
              'ecr:DescribeRepositories',
              'sns:ListTopics, sns:GetTopicAttributes',
              'dynamodb:ListTables, dynamodb:DescribeTable',
              'ssm:DescribeParameters',
              'route53:ListHostedZones, route53:ListResourceRecordSets',
              'states:ListStateMachines, states:DescribeStateMachine',
              'events:ListEventBuses',
              'ses:ListIdentities',
              'cognito-idp:ListUserPools',
              'kinesis:ListStreams, kinesis:DescribeStream',
              'ecs:ListClusters, ecs:DescribeClusters',
              'elasticache:DescribeCacheClusters',
              'eks:ListClusters, eks:DescribeCluster',
              'es:ListDomainNames, es:DescribeElasticsearchDomains',
              'kafka:ListClusters, kafka:DescribeCluster',
              'sts:GetCallerIdentity'
            ].map((perm) => (
              <li key={perm} style={{ padding: '1px 0', color: 'var(--cb-accent)' }}>
                {perm}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  )
}
