import type { Advisory } from '../types/cloud'

/**
 * Returns CLI argv arrays for a deterministic fix for the given advisory,
 * or null if no automated remediation is available for this rule.
 *
 * nodeId is the resource identifier (bucket name, DB identifier, etc.)
 */
export function buildAdvisoryRemediation(advisory: Advisory, nodeId: string): string[][] | null {
  switch (advisory.ruleId) {
    case 's3-public-access':
      return [[
        's3api', 'put-public-access-block',
        '--bucket', nodeId,
        '--public-access-block-configuration',
        'BlockPublicAcls=true,BlockPublicPolicy=true,IgnorePublicAcls=true,RestrictPublicBuckets=true',
      ]]

    case 'rds-no-deletion-protection':
      return [[
        'rds', 'modify-db-instance',
        '--db-instance-identifier', nodeId,
        '--deletion-protection',
        '--apply-immediately',
      ]]

    case 'rds-no-backup':
      return [[
        'rds', 'modify-db-instance',
        '--db-instance-identifier', nodeId,
        '--backup-retention-period', '7',
        '--apply-immediately',
      ]]

    default:
      return null
  }
}
