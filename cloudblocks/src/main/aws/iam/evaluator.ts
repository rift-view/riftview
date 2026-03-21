import type { IamFinding } from '../../../renderer/types/iam'

// Main-process only types — not exported to renderer
export interface PolicyStatement {
  Effect?: string
  Action?: string | string[]
  Resource?: string | string[]
  Principal?: string | Record<string, string | string[]>
}

export interface PolicyDocument {
  Statement: PolicyStatement[]
}

export function evaluatePolicy(doc: PolicyDocument, policyName?: string): IamFinding[] {
  const findings: IamFinding[] = []

  // CRITICAL: AdministratorAccess managed policy by name (before statement loop)
  if (policyName === 'AdministratorAccess') {
    findings.push({
      severity: 'critical',
      title: 'AdministratorAccess managed policy attached',
      detail: 'The AdministratorAccess policy grants full access to all AWS services and resources.',
      policyName,
    })
    // Still continue to check statements for other rules, but skip the wildcard duplicate
  }

  for (const stmt of doc.Statement) {
    // Skip Deny statements entirely
    if (stmt.Effect === 'Deny') continue

    // Normalize Action and Resource to string[]
    const actions: string[] = [stmt.Action ?? []].flat() as string[]
    const resources: string[] = [stmt.Resource ?? []].flat() as string[]

    const stmtJson = JSON.stringify(stmt)

    // --- CRITICAL rules ---

    // Wildcard action on all resources (only when not already flagged via AdministratorAccess name)
    if (policyName !== 'AdministratorAccess' && actions.includes('*') && resources.includes('*')) {
      findings.push({
        severity: 'critical',
        title: 'Wildcard action on all resources',
        detail: 'Action: * with Resource: * grants full access to every AWS service.',
        ...(policyName ? { policyName } : {}),
        statement: stmtJson,
      })
    }

    // IAM full access
    if (actions.includes('iam:*')) {
      findings.push({
        severity: 'critical',
        title: 'IAM full access',
        detail: 'iam:* grants complete control over IAM, enabling privilege escalation.',
        policyName,
        statement: stmtJson,
      })
    }

    // --- WARNING rules ---

    // S3 wildcard on all buckets
    if (actions.includes('s3:*') && resources.includes('*')) {
      findings.push({
        severity: 'warning',
        title: 'S3 wildcard on all buckets',
        detail: 's3:* with Resource: * grants full S3 access across all buckets.',
        policyName,
        statement: stmtJson,
      })
    }

    // EC2 full access
    if (actions.includes('ec2:*')) {
      findings.push({
        severity: 'warning',
        title: 'EC2 full access',
        detail: 'ec2:* grants complete control over all EC2 resources.',
        policyName,
        statement: stmtJson,
      })
    }

    // AssumeRole wildcard
    if (actions.includes('sts:AssumeRole') && resources.includes('*')) {
      findings.push({
        severity: 'warning',
        title: 'AssumeRole wildcard',
        detail: 'sts:AssumeRole with Resource: * allows assuming any role in the account.',
        policyName,
        statement: stmtJson,
      })
    }

    // Public principal (bucket policy / resource policy)
    if (stmt.Principal !== undefined) {
      const principal = stmt.Principal
      let isPublic = false

      if (principal === '*') {
        isPublic = true
      } else if (typeof principal === 'object' && principal !== null) {
        const vals = Object.values(principal).flat()
        if (vals.includes('*')) isPublic = true
      }

      if (isPublic) {
        findings.push({
          severity: 'warning',
          title: 'Public principal — resource is publicly accessible',
          detail: 'Principal: * allows any AWS principal (or unauthenticated request) to perform this action.',
          policyName,
          statement: stmtJson,
        })
      }
    }

    // --- INFO rules ---

    // iam:PassRole
    if (actions.includes('iam:PassRole')) {
      findings.push({
        severity: 'info',
        title: 'iam:PassRole present',
        detail: 'iam:PassRole allows passing roles to AWS services; can be abused for privilege escalation.',
        policyName,
        statement: stmtJson,
      })
    }

    // Cross-account trust in Principal
    if (stmt.Principal !== undefined && typeof stmt.Principal === 'object' && stmt.Principal !== null) {
      const principalObj = stmt.Principal as Record<string, string | string[]>
      const vals = Object.values(principalObj).flat() as string[]
      const crossAccountPattern = /arn:aws:iam::\d{12}/
      const hasCrossAccount = vals.some(v => crossAccountPattern.test(v))
      if (hasCrossAccount) {
        findings.push({
          severity: 'info',
          title: 'Cross-account trust in Principal',
          detail: 'This statement trusts a principal from another AWS account.',
          policyName,
          statement: stmtJson,
        })
      }
    }
  }

  return findings
}
