export const FIELD_LABELS: Record<string, string> = {
  // General
  vpcId:              'VPC',
  subnetId:           'Subnet',
  availabilityZone:   'AZ',
  region:             'Region',
  // EC2
  instanceType:       'Instance Type',
  keyName:            'Key Pair',
  privateIpAddress:   'Private IP',
  publicIpAddress:    'Public IP',
  iamInstanceProfile: 'IAM Role',
  // RDS
  engine:             'Engine',
  engineVersion:      'Version',
  dbInstanceClass:    'Instance Class',
  multiAZ:            'Multi-AZ',
  storageEncrypted:   'Encrypted',
  subnetGroupName:    'Subnet Group',
  // S3
  bucketRegion:       'Region',
  versioning:         'Versioning',
  // Lambda
  runtime:            'Runtime',
  handler:            'Handler',
  memorySize:         'Memory (MB)',
  timeout:            'Timeout (s)',
  codeSize:           'Code Size',
  lastModified:       'Last Modified',
  // ALB
  dnsName:            'DNS Name',
  scheme:             'Scheme',
  // ACM
  domainName:         'Domain',
  validationMethod:   'Validation',
  inUseBy:            'In Use By',
  // CloudFront
  origins:            'Origins',
  priceClass:         'Price Class',
  defaultRootObject:  'Default Root',
  certArn:            'Certificate',
  // API Gateway
  endpoint:           'Endpoint',
  corsOrigins:        'CORS Origins',
  // ECS (future-proofing)
  clusterName:        'Cluster',
  taskCount:          'Tasks',
  // General extras
  createdAt:          'Created',
  updatedAt:          'Updated',
}

/**
 * Returns a human-readable label for a metadata key.
 * Uses the FIELD_LABELS map first, then falls back to converting
 * camelCase to Title Case (e.g. "privateIpAddress" → "Private Ip Address").
 */
export function fieldLabel(key: string): string {
  if (key in FIELD_LABELS) return FIELD_LABELS[key]
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
}
