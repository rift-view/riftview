export function Onboarding(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center" style={{ fontFamily: 'monospace' }}>
      <div className="text-3xl font-bold tracking-tighter" style={{ color: 'var(--cb-accent)' }}>TERMINUS</div>
      <p className="text-sm" style={{ color: 'var(--cb-text-muted)' }}>No AWS credentials found.</p>
      <div className="rounded p-4 text-left max-w-sm" style={{ background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border-strong)' }}>
        <div className="text-[10px] mb-2" style={{ color: 'var(--cb-text-secondary)' }}>Run the following to configure AWS credentials:</div>
        <code className="text-[11px]" style={{ color: 'var(--cb-accent)' }}>aws configure</code>
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
          style={{ color: 'var(--cb-text-secondary)', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span style={{ color: 'var(--cb-accent)', fontWeight: 700, fontSize: 10 }}>▶</span>
          Required AWS Permissions
        </summary>
        <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--cb-border)' }}>
          <div className="text-[9px] mt-3 mb-2" style={{ color: 'var(--cb-text-muted)' }}>
            Attach these read-only actions to your IAM user or role:
          </div>
          <ul className="text-[9px] leading-relaxed" style={{ color: 'var(--cb-text-secondary)', listStyle: 'none', padding: 0, margin: 0 }}>
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
              'sts:GetCallerIdentity',
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
