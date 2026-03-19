import type { TerraformGeneratorMap } from './types'
import type { CloudNode } from '../../renderer/types/cloud'

function sanitizeName(label: string, fallback: string): string {
  const sanitized = label
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
  return sanitized.length > 0 ? sanitized : fallback
}

function str(value: unknown, fallback = 'UNKNOWN'): string {
  if (typeof value === 'string' && value.length > 0) return value
  return fallback
}

function generateVpc(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const cidr = str(node.metadata['cidrBlock'])
  return `resource "aws_vpc" "${name}" {\n  cidr_block = "${cidr}"\n}`
}

function generateSubnet(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const vpcId = str(node.parentId ?? node.metadata['vpcId'])
  const cidr = str(node.metadata['cidrBlock'])
  const az = str(node.metadata['availabilityZone'])
  return `resource "aws_subnet" "${name}" {\n  vpc_id            = "${vpcId}"\n  cidr_block        = "${cidr}"\n  availability_zone = "${az}"\n}`
}

function generateEc2(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  // ami is not stored in metadata — emit a placeholder the user must fill in
  const ami = str(node.metadata['ami'], 'REPLACE_WITH_AMI_ID')
  const instanceType = str(node.metadata['instanceType'])
  return `resource "aws_instance" "${name}" {\n  ami           = "${ami}"\n  instance_type = "${instanceType}"\n}`
}

function generateS3(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const bucket = str(node.label, node.id)
  return `resource "aws_s3_bucket" "${name}" {\n  bucket = "${bucket}"\n}`
}

function generateLambda(node: CloudNode): string {
  const name = sanitizeName(node.label, node.id)
  const functionName = str(node.label, node.id)
  const runtime = str(node.metadata['runtime'])
  const handler = str(node.metadata['handler'])
  return `resource "aws_lambda_function" "${name}" {\n  function_name = "${functionName}"\n  # filename     = "REPLACE_WITH_DEPLOYMENT_PACKAGE"\n  runtime       = "${runtime}"\n  handler       = "${handler}"\n}`
}

export const terraformGenerators: TerraformGeneratorMap = {
  'vpc': generateVpc,
  'subnet': generateSubnet,
  'ec2': generateEc2,
  's3': generateS3,
  'lambda': generateLambda,
  'rds': () => '',
  'alb': () => '',
  'security-group': () => '',
  'igw': () => '',
  'acm': () => '',
  'cloudfront': () => '',
  'apigw': () => '',
  'apigw-route': () => '',
  'sqs': () => '',
  'secret': () => '',
  'ecr-repo': () => '',
  'sns': () => '',
  'dynamo': () => '',
  'ssm-param': () => '',
  'nat-gateway': () => '',
  'r53-zone': () => '',
  'sfn': () => '',
  'eventbridge-bus': () => '',
}
