const PERMISSIONS = [
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
]

export function Onboarding(): React.JSX.Element {
  return (
    <div
      data-testid="onboarding"
      className="onb"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 'var(--space-md)',
        maxWidth: 540,
        margin: '0 auto',
        padding: 'var(--space-md) var(--space-sm)'
      }}
    >
      <span className="eyebrow">WELCOME TO RIFTVIEW</span>
      <h1 className="empty-state-title">The incident diagnostic layer AWS doesn&apos;t have.</h1>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--bone-200)',
          lineHeight: 1.6,
          margin: 0
        }}
      >
        Connect your AWS account to see your infrastructure as a live, connected graph — so you
        understand blast radius before the 3am page, not during it.
      </p>

      <hr className="hairline" style={{ width: '100%' }} />

      <section
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)', width: '100%' }}
      >
        <span className="label">STEP 1 — AWS CLI</span>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--bone-200)',
            lineHeight: 1.6,
            margin: 0
          }}
        >
          New to AWS CLI? Run this in your terminal first:
        </p>
        <code
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--ember-400)',
            background: 'var(--ink-900)',
            border: '1px solid var(--border)',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            alignSelf: 'flex-start'
          }}
        >
          aws configure
        </code>
      </section>

      <hr className="hairline" style={{ width: '100%' }} />

      <section
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)', width: '100%' }}
      >
        <span className="label">STEP 2 — PROFILE</span>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--bone-200)',
            lineHeight: 1.6,
            margin: 0
          }}
        >
          Enter your profile name in Settings (default: &quot;default&quot;), then restart RiftView
          to scan your account.
        </p>
      </section>

      <hr className="hairline" style={{ width: '100%' }} />

      <details
        style={{
          width: '100%',
          background: 'var(--ink-900)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            userSelect: 'none',
            padding: 'var(--space-2xs) var(--space-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span className="eyebrow">Required AWS Permissions</span>
        </summary>
        <div
          style={{
            padding: 'var(--space-2xs) var(--space-sm) var(--space-sm)',
            borderTop: '1px solid var(--border)'
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-xs)',
              color: 'var(--bone-200)',
              margin: '0 0 var(--space-2xs) 0'
            }}
          >
            Attach these read-only actions to your IAM user or role:
          </p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--ember-400)',
              lineHeight: 1.7
            }}
          >
            {PERMISSIONS.map((perm) => (
              <li key={perm}>{perm}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  )
}
