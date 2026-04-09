import type { Advisory, CloudNode } from '../types/cloud'

export function analyzeNode(node: CloudNode): Advisory[] {
  const advisories: Advisory[] = []

  if (node.type === 'lambda') {
    const timeout = node.metadata.timeout as number | undefined
    if (!timeout || timeout === 0) {
      advisories.push({
        ruleId: 'lambda-no-timeout',
        severity: 'critical',
        title: 'No timeout configured',
        detail:
          'This Lambda function has no timeout set and may run indefinitely, incurring unexpected costs. Set a timeout in the function configuration.',
        nodeId: node.id,
      })
    }

    const memorySize = node.metadata.memorySize as number | undefined
    if (memorySize === 128) {
      advisories.push({
        ruleId: 'lambda-low-memory',
        severity: 'warning',
        title: 'Memory at default (128 MB)',
        detail:
          'This function uses the default memory allocation and has likely never been tuned. Review execution duration and consider adjusting memory to optimise cost and latency.',
        nodeId: node.id,
      })
    }
  }

  if (node.type === 'ec2' && node.metadata.hasPublicSsh === true) {
    advisories.push({
      ruleId: 'ec2-public-ssh',
      severity: 'critical',
      title: 'Public SSH exposure (port 22 open to 0.0.0.0/0)',
      detail:
        'A security group on this instance allows inbound SSH from any IP. Restrict port 22 to known CIDR ranges or use AWS Systems Manager Session Manager instead.',
      nodeId: node.id,
    })
  }

  if (node.type === 's3' && node.metadata.publicAccessEnabled === true) {
    advisories.push({
      ruleId: 's3-public-access',
      severity: 'critical',
      title: 'Public access not fully blocked',
      detail:
        'This S3 bucket does not have all public access block settings enabled. Unless intentionally serving public content, enable all four public access block settings in the bucket configuration.',
      nodeId: node.id,
    })
  }

  if (node.type === 'rds' && !node.metadata.multiAZ) {
    advisories.push({
      ruleId: 'rds-no-multiaz',
      severity: 'warning',
      title: 'Single-AZ deployment',
      detail:
        'This RDS instance is not configured for Multi-AZ. A hardware failure or maintenance event may cause unplanned downtime. Enable Multi-AZ for production workloads.',
      nodeId: node.id,
    })
  }

  if (node.type === 'sqs' && node.metadata.hasDlq === false) {
    advisories.push({
      ruleId:   'sqs-no-dlq',
      severity: 'warning',
      title:    'No dead-letter queue configured',
      detail:   'Messages that fail processing will be discarded. Configure a DLQ to retain failed messages for inspection and replay.',
      nodeId:   node.id,
    })
  }

  if (node.type === 'rds') {
    if (node.metadata.deletionProtection === false) {
      advisories.push({
        ruleId:   'rds-no-deletion-protection',
        severity: 'warning',
        title:    'Deletion protection disabled',
        detail:   'This RDS instance can be deleted with a single API call. Enable deletion protection to prevent accidental or unauthorised deletion.',
        nodeId:   node.id,
      })
    }
    if (typeof node.metadata.backupRetentionPeriod === 'number' && node.metadata.backupRetentionPeriod === 0) {
      advisories.push({
        ruleId:   'rds-no-backup',
        severity: 'critical',
        title:    'Automated backups disabled',
        detail:   'Backup retention period is 0 days — automated backups are disabled. Set a retention period of at least 7 days to enable point-in-time recovery.',
        nodeId:   node.id,
      })
    }
  }

  if (node.type === 's3' && node.metadata.versioningEnabled === false) {
    advisories.push({
      ruleId:   's3-no-versioning',
      severity: 'warning',
      title:    'Versioning not enabled',
      detail:   'Objects deleted or overwritten cannot be recovered. Enable versioning to protect against accidental deletion and enable point-in-time recovery.',
      nodeId:   node.id,
    })
  }

  if (node.type === 'lambda' && node.metadata.hasDlq === false) {
    advisories.push({
      ruleId:   'lambda-no-dlq',
      severity: 'warning',
      title:    'No dead-letter queue or destination configured',
      detail:   'Failed asynchronous invocations are silently discarded. Configure a dead-letter queue or an on-failure destination to capture errors.',
      nodeId:   node.id,
    })
  }

  return advisories
}
