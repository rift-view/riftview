import { useRef, useEffect, useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import { useCliStore } from '../../store/cli'
import { buildCommands } from '../../utils/buildCommand'
import type { CreateParams, CloudFrontParams } from '../../types/create'
import type { NodeType } from '../../types/cloud'
import { VpcForm } from './VpcForm'
import { Ec2Form } from './Ec2Form'
import { SgForm } from './SgForm'
import { S3Form } from './S3Form'
import { RdsForm } from './RdsForm'
import { LambdaForm } from './LambdaForm'
import { AlbForm } from './AlbForm'
import { AcmForm } from './AcmForm'
import { CloudFrontForm } from './CloudFrontForm'
import { ApigwForm } from './ApigwForm'
import { ApigwRouteForm } from './ApigwRouteForm'
import { SqsForm } from './SqsForm'
import { SnsForm } from './SnsForm'
import { DynamoForm } from './DynamoForm'
import { SecretForm } from './SecretForm'
import { EcrForm } from './EcrForm'
import { SfnForm } from './SfnForm'
import { EventBusForm } from './EventBusForm'
import { R53CreateForm } from './R53CreateForm'
import { SsmCreateForm } from './SsmCreateForm'
import { SubnetCreateForm } from './SubnetCreateForm'
import { IgwCreateForm } from './IgwCreateForm'

function validateParams(params: CreateParams | null): boolean {
  if (!params) return false
  switch (params.resource) {
    case 'vpc':          return !!(params.name && params.cidr)
    case 'ec2':          return !!(params.name && params.amiId && params.instanceType)
    case 'sg':           return !!(params.name && params.description && params.vpcId)
    case 's3':           return !!(params.bucketName)
    case 'rds':          return !!(params.identifier && params.masterUsername && params.masterPassword)
    case 'lambda':       return !!(params.name && params.roleArn && params.handler)
    case 'alb':          return !!(params.name && params.subnetIds.length >= 2 && params.securityGroupIds.length >= 1)
    case 'acm':          return !!(params.domainName)
    case 'cloudfront':   return !!(params.comment && params.origins.length > 0)
    case 'apigw':        return !!(params.name)
    case 'apigw-route':  return !!(params.apiId && params.path && params.path.startsWith('/'))
    case 'sqs':          return !!(params.name)
    case 'sns':          return !!(params.name)
    case 'dynamo':       return !!(params.tableName && params.hashKey)
    case 'secret':       return !!(params.name && params.value)
    case 'ecr':          return !!(params.name)
    case 'sfn':          return !!(params.name && params.roleArn && params.definition)
    case 'eventbridge-bus': return !!(params.name)
    case 'r53-zone':        return !!(params.domainName)
    case 'ssm-param':       return !!(params.name && params.value)
    case 'subnet':          return !!(params.vpcId && params.cidrBlock)
    case 'igw':             return true
    default:             return true
  }
}

const TITLES: Record<string, string> = {
  vpc:              'New VPC',
  ec2:              'New EC2 Instance',
  sg:               'New Security Group',
  s3:               'New S3 Bucket',
  rds:              'New RDS Instance',
  lambda:           'New Lambda Function',
  alb:              'New ALB',
  acm:              'New ACM Certificate',
  cloudfront:       'New CloudFront Distribution',
  apigw:            'New API Gateway',
  'apigw-route':    'New API Route',
  sqs:              'New SQS Queue',
  sns:              'New SNS Topic',
  dynamo:           'New DynamoDB Table',
  secret:           'New Secret',
  ecr:              'New ECR Repository',
  sfn:              'New Step Functions State Machine',
  'eventbridge-bus': 'New EventBridge Bus',
  'r53-zone':        'New Hosted Zone',
  'ssm-param':       'New SSM Parameter',
  subnet:            'New Subnet',
  igw:               'New Internet Gateway',
}

// Maps form resource identifier to CloudNode NodeType
const RESOURCE_TO_NODE_TYPE: Record<string, NodeType> = {
  vpc:              'vpc',
  ec2:              'ec2',
  sg:               'security-group',
  s3:               's3',
  rds:              'rds',
  lambda:           'lambda',
  alb:              'alb',
  acm:              'acm',
  cloudfront:       'cloudfront',
  apigw:            'apigw',
  'apigw-route':    'apigw-route',
  sqs:              'sqs',
  sns:              'sns',
  dynamo:           'dynamo',
  secret:           'secret',
  ecr:              'ecr-repo',
  sfn:              'sfn',
  'eventbridge-bus': 'eventbridge-bus',
  'r53-zone':        'r53-zone',
  'ssm-param':       'ssm-param',
  subnet:            'subnet',
  igw:               'igw',
}

export function CreateModal(): React.JSX.Element | null {
  const activeCreate         = useUIStore((s) => s.activeCreate)
  const setActiveCreate      = useUIStore((s) => s.setActiveCreate)
  const selectedNodeId       = useUIStore((s) => s.selectedNodeId)
  const setCommandPreview    = useCliStore((s) => s.setCommandPreview)
  const clearCliOutput       = useCliStore((s) => s.clearCliOutput)
  const region               = useCloudStore((s) => s.region)
  const addPendingNode       = useCloudStore((s) => s.addPendingNode)
  const removePendingNode    = useCloudStore((s) => s.removePendingNode)
  const addOptimisticNode    = useCloudStore((s) => s.addOptimisticNode)
  const removeOptimisticNode = useCloudStore((s) => s.removeOptimisticNode)
  const nodes                = useCloudStore((s) => s.nodes)

  // When creating a route, the parent API is the currently selected node (if it's an apigw)
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const parentApiId  = (activeCreate?.resource === 'apigw-route' && selectedNode?.type === 'apigw')
    ? selectedNode.id
    : (activeCreate as { resource: string; view: string; parentId?: string } | null)?.parentId ?? ''

  const [showErrors, setShowErrors] = useState(false)

  const pendingIdRef    = useRef<string | null>(null)
  const optimisticIdRef = useRef<string | null>(null)
  const paramsRef       = useRef<CreateParams | null>(null)
  const handleRunRef    = useRef<() => void>(() => {})

  // Listen for Run button from CommandDrawer (only while this modal is mounted)
  useEffect(() => {
    function onRun(): void {
      handleRunRef.current()
    }
    window.addEventListener('commanddrawer:run', onRun)
    return () => window.removeEventListener('commanddrawer:run', onRun)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeCreate) return null

  function handleChange(params: CreateParams): void {
    paramsRef.current = params
    try {
      if (params.resource === 'cloudfront') {
        setCommandPreview(['[CloudFront distribution will be created via SDK]'])
        return
      }
      const preview = buildCommands(params).map(argv => 'aws ' + argv.join(' '))
      setCommandPreview(preview)
    } catch {
      // incomplete form — ignore preview update
    }
  }

  function handleCancel(): void {
    if (pendingIdRef.current) removePendingNode(pendingIdRef.current)
    if (optimisticIdRef.current) removeOptimisticNode(optimisticIdRef.current)
    optimisticIdRef.current = null
    clearCliOutput()
    setCommandPreview([])
    setActiveCreate(null)
  }

  function deriveOptimisticLabel(params: CreateParams): string {
    switch (params.resource) {
      case 'ec2':          return (params as { name?: string }).name || 'New EC2'
      case 'rds':          return (params as { identifier?: string }).identifier || 'New RDS'
      case 's3':           return (params as { bucketName?: string }).bucketName || 'New S3'
      case 'lambda':       return (params as { name?: string }).name || 'New Lambda'
      case 'alb':          return (params as { name?: string }).name || 'New ALB'
      case 'vpc':          return (params as { name?: string }).name || 'New VPC'
      case 'acm':          return (params as { domainName?: string }).domainName || 'New Certificate'
      case 'cloudfront':   return (params as { comment?: string }).comment || 'New Distribution'
      case 'apigw':          return (params as { name?: string }).name || 'New API'
      case 'sqs':            return (params as { name?: string }).name || 'New Queue'
      case 'sns':            return (params as { name?: string }).name || 'New Topic'
      case 'dynamo':         return (params as { tableName?: string }).tableName || 'New Table'
      case 'secret':         return (params as { name?: string }).name || 'New Secret'
      case 'ecr':            return (params as { name?: string }).name || 'New Repository'
      case 'sfn':            return (params as { name?: string }).name || 'New State Machine'
      case 'eventbridge-bus': return (params as { name?: string }).name || 'New Event Bus'
      case 'r53-zone':        return (params as { domainName?: string }).domainName || 'New Hosted Zone'
      case 'ssm-param':       return (params as { name?: string }).name || 'New Parameter'
      case 'subnet':          return (params as { cidrBlock?: string }).cidrBlock || 'New Subnet'
      case 'igw':             return (params as { name?: string }).name || 'New Internet Gateway'
      default:             return `New ${params.resource}`
    }
  }

  function handleRun(): void {
    if (!activeCreate || !paramsRef.current) return
    const isValid = validateParams(paramsRef.current)
    if (!isValid) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)

    // Optimistic node — goes into the main nodes array so the next scan can replace it
    // For S3, use the bucket name as the ID so applyDelta overwrites it cleanly (scanner uses b.Name as ID)
    const optimisticId = activeCreate.resource === 's3'
      ? (paramsRef.current as { bucketName: string }).bucketName
      : `optimistic-${Date.now()}`
    optimisticIdRef.current = optimisticId
    addOptimisticNode({
      id:       optimisticId,
      type:     RESOURCE_TO_NODE_TYPE[activeCreate.resource] ?? 'ec2',
      label:    deriveOptimisticLabel(paramsRef.current),
      status:   'creating',
      region,
      metadata: {},
    })

    // Pending node — lives in pendingNodes for backward compat with existing canvas code
    const id = `pending:${crypto.randomUUID()}`
    pendingIdRef.current = id
    addPendingNode({
      id,
      type:   RESOURCE_TO_NODE_TYPE[activeCreate.resource] ?? 'ec2',
      label:  'Creating…',
      status: 'creating',
      region,
      metadata: {},
    })
    clearCliOutput()

    const runPromise = paramsRef.current!.resource === 'cloudfront'
      ? window.cloudblocks.createCloudFront(paramsRef.current! as CloudFrontParams)
      : window.cloudblocks.runCli(buildCommands(paramsRef.current!))

    runPromise
      .then((result) => {
        if (pendingIdRef.current) removePendingNode(pendingIdRef.current)
        pendingIdRef.current = null
        optimisticIdRef.current = null
        if (result.code === 0) {
          removeOptimisticNode(optimisticId)   // remove before scan — real node arrives via applyDelta
          setCommandPreview([])
          setActiveCreate(null)
          window.cloudblocks.startScan()
        } else {
          // CLI returned non-zero: remove optimistic node
          removeOptimisticNode(optimisticId)
        }
      })
      .catch(() => {
        if (pendingIdRef.current) removePendingNode(pendingIdRef.current)
        pendingIdRef.current = null
        removeOptimisticNode(optimisticId)
        optimisticIdRef.current = null
      })
  }

  // Update the ref each render so the event listener always calls the latest version
  handleRunRef.current = handleRun // eslint-disable-line react-hooks/refs

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
  }
  const modalStyle: React.CSSProperties = {
    background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-accent)', borderRadius: '6px',
    padding: '16px', width: '420px', maxHeight: '80vh', overflowY: 'auto',
    fontFamily: 'monospace', boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
  }

  return (
    <div style={overlayStyle} onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }} tabIndex={-1}>
      <div style={modalStyle}>
        <div style={{ color: 'var(--cb-accent)', fontSize: '12px', fontWeight: 'bold', marginBottom: '14px', borderBottom: '1px solid var(--cb-border-strong)', paddingBottom: '8px' }}>
          {TITLES[activeCreate.resource] ?? 'New Resource'}
        </div>

        {activeCreate.resource === 'vpc'        && <VpcForm        onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'ec2'        && <Ec2Form        onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'sg'         && <SgForm         onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 's3'         && <S3Form         onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'rds'        && <RdsForm        onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'lambda'     && <LambdaForm     onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'alb'        && <AlbForm        onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'acm'          && <AcmForm          onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'cloudfront'   && <CloudFrontForm   onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'apigw'        && <ApigwForm        onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'apigw-route'    && <ApigwRouteForm   onChange={handleChange} showErrors={showErrors} apiId={parentApiId} />}
        {activeCreate.resource === 'sqs'             && <SqsForm          onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'sns'             && <SnsForm          onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'dynamo'          && <DynamoForm       onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'secret'          && <SecretForm       onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'ecr'             && <EcrForm          onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'sfn'             && <SfnForm          onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'eventbridge-bus' && <EventBusForm     onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'r53-zone'        && <R53CreateForm    onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'ssm-param'       && <SsmCreateForm    onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'subnet'          && <SubnetCreateForm onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'igw'             && <IgwCreateForm    onChange={handleChange} showErrors={showErrors} />}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', paddingTop: '10px', borderTop: '1px solid var(--cb-border-strong)' }}>
          <button
            onClick={handleCancel}
            style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', borderRadius: '3px', color: 'var(--cb-text-secondary)', cursor: 'pointer', fontSize: '10px', padding: '4px 10px', fontFamily: 'monospace' }}
          >
            Cancel
          </button>
          <button
            onClick={handleRun}
            style={{ background: 'var(--cb-accent)', border: '1px solid var(--cb-accent)', borderRadius: '3px', color: '#000', cursor: 'pointer', fontSize: '10px', padding: '4px 12px', fontFamily: 'monospace', fontWeight: 'bold' }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
