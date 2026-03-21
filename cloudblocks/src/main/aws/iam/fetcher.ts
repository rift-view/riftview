import {
  GetInstanceProfileCommand,
  GetPolicyCommand,
  GetPolicyVersionCommand,
  GetRolePolicyCommand,
  ListAttachedRolePoliciesCommand,
  ListRolePoliciesCommand,
} from '@aws-sdk/client-iam'
import { DescribeInstancesCommand } from '@aws-sdk/client-ec2'
import { GetBucketPolicyCommand } from '@aws-sdk/client-s3'
import type { AwsClients } from '../client'
import type { CloudNode } from '../../../renderer/types/cloud'
import { evaluatePolicy } from './evaluator'
import type { IamFinding } from '../../../renderer/types/iam'

interface PolicyDocument {
  Statement: Array<{
    Effect: string
    Action: string | string[]
    Resource: string | string[]
    Principal?: string | Record<string, string | string[]>
  }>
}

export function urlDecodePolicy(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

async function fetchRolePolicies(
  clients: AwsClients,
  roleName: string
): Promise<Array<{ doc: PolicyDocument; policyName: string }>> {
  const results: Array<{ doc: PolicyDocument; policyName: string }> = []

  // Managed policies
  const attached = await clients.iam.send(
    new ListAttachedRolePoliciesCommand({ RoleName: roleName })
  )
  for (const policy of attached.AttachedPolicies ?? []) {
    const details = await clients.iam.send(
      new GetPolicyCommand({ PolicyArn: policy.PolicyArn! })
    )
    const version = await clients.iam.send(
      new GetPolicyVersionCommand({
        PolicyArn: policy.PolicyArn!,
        VersionId: details.Policy!.DefaultVersionId!,
      })
    )
    const docStr = urlDecodePolicy(version.PolicyVersion!.Document!)
    results.push({ doc: JSON.parse(docStr) as PolicyDocument, policyName: policy.PolicyName! })
  }

  // Inline policies
  const inline = await clients.iam.send(
    new ListRolePoliciesCommand({ RoleName: roleName })
  )
  for (const policyName of inline.PolicyNames ?? []) {
    const res = await clients.iam.send(
      new GetRolePolicyCommand({ RoleName: roleName, PolicyName: policyName })
    )
    const docStr = urlDecodePolicy(res.PolicyDocument!)
    results.push({ doc: JSON.parse(docStr) as PolicyDocument, policyName })
  }

  return results
}

export async function fetchEc2IamData(node: CloudNode, clients: AwsClients): Promise<IamFinding[]> {
  const instances = await clients.ec2.send(
    new DescribeInstancesCommand({ InstanceIds: [node.id] })
  )
  const instance = instances.Reservations?.[0]?.Instances?.[0]
  if (!instance?.IamInstanceProfile?.Arn) return []

  // Extract profile name from ARN: arn:aws:iam::123:instance-profile/MyProfileName
  const profileName = instance.IamInstanceProfile.Arn.split('/').pop()
  if (!profileName) return []

  // Resolve actual role name via GetInstanceProfile (role name ≠ profile name in general)
  const profileRes = await clients.iam.send(
    new GetInstanceProfileCommand({ InstanceProfileName: profileName })
  )
  const roleName = profileRes.InstanceProfile?.Roles?.[0]?.RoleName
  if (!roleName) return []

  const policies = await fetchRolePolicies(clients, roleName)
  return policies.flatMap(({ doc, policyName }) => evaluatePolicy(doc, policyName))
}

export async function fetchLambdaIamData(node: CloudNode, clients: AwsClients): Promise<IamFinding[]> {
  const roleArn = node.metadata?.['role'] as string | undefined
  if (!roleArn) return []

  const roleName = roleArn.split('/').pop()
  if (!roleName) return []

  const policies = await fetchRolePolicies(clients, roleName)
  return policies.flatMap(({ doc, policyName }) => evaluatePolicy(doc, policyName))
}

export async function fetchS3IamData(node: CloudNode, clients: AwsClients): Promise<IamFinding[]> {
  try {
    const res = await clients.s3.send(new GetBucketPolicyCommand({ Bucket: node.id }))
    if (!res.Policy) return []
    const doc = JSON.parse(urlDecodePolicy(res.Policy)) as PolicyDocument
    return evaluatePolicy(doc)
  } catch (err) {
    if ((err as { name?: string }).name === 'NoSuchBucketPolicy') return []
    throw err
  }
}
