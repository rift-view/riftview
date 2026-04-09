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

  return advisories
}
