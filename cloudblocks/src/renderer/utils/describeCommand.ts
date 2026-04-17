// Builds the read-only AWS CLI describe command string for a given resource.
// Used by CommandDrawer (M1) and will be reused by the CLI Engine in M2.
export function buildDescribeCommand(type: string, id: string, region: string): string {
  const r = `--region ${region}`
  switch (type) {
    case 'ec2':
      return `aws ec2 describe-instances --instance-ids ${id} ${r}`
    case 'vpc':
      return `aws ec2 describe-vpcs --vpc-ids ${id} ${r}`
    case 'subnet':
      return `aws ec2 describe-subnets --subnet-ids ${id} ${r}`
    case 'rds':
      return `aws rds describe-db-instances --db-instance-identifier ${id} ${r}`
    case 's3':
      return `aws s3 ls s3://${id} ${r}`
    case 'lambda':
      return `aws lambda get-function --function-name ${id} ${r}`
    case 'alb':
      return `aws elbv2 describe-load-balancers --load-balancer-arns ${id} ${r}`
    case 'security-group':
      return `aws ec2 describe-security-groups --group-ids ${id} ${r}`
    default:
      return `aws ${type} describe --id ${id} ${r}`
  }
}
