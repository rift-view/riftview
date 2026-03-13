import { useRef, useEffect, useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import { buildCommands } from '../../utils/buildCommand'
import type { CreateParams } from '../../types/create'
import type { NodeType } from '../../types/cloud'
import { VpcForm } from './VpcForm'
import { Ec2Form } from './Ec2Form'
import { SgForm } from './SgForm'
import { S3Form } from './S3Form'
import { RdsForm } from './RdsForm'
import { LambdaForm } from './LambdaForm'
import { AlbForm } from './AlbForm'

function validateParams(params: CreateParams | null): boolean {
  if (!params) return false
  switch (params.resource) {
    case 'vpc':    return !!(params.name && params.cidr)
    case 'ec2':    return !!(params.name && params.amiId && params.instanceType)
    case 'sg':     return !!(params.name && params.description && params.vpcId)
    case 's3':     return !!(params.bucketName)
    case 'rds':    return !!(params.identifier && params.masterUsername && params.masterPassword)
    case 'lambda': return !!(params.name && params.roleArn && params.handler)
    case 'alb':    return !!(params.name && params.subnetIds.length >= 2 && params.securityGroupIds.length >= 1)
    default:       return true
  }
}

const TITLES: Record<string, string> = {
  vpc:    'New VPC',
  ec2:    'New EC2 Instance',
  sg:     'New Security Group',
  s3:     'New S3 Bucket',
  rds:    'New RDS Instance',
  lambda: 'New Lambda Function',
  alb:    'New ALB',
}

// Maps form resource identifier to CloudNode NodeType
const RESOURCE_TO_NODE_TYPE: Record<string, NodeType> = {
  vpc:    'vpc',
  ec2:    'ec2',
  sg:     'security-group',
  s3:     's3',
  rds:    'rds',
  lambda: 'lambda',
  alb:    'alb',
}

export function CreateModal(){
  const activeCreate      = useCloudStore((s) => s.activeCreate)
  const region            = useCloudStore((s) => s.region)
  const setActiveCreate   = useCloudStore((s) => s.setActiveCreate)
  const setCommandPreview = useCloudStore((s) => s.setCommandPreview)
  const clearCliOutput    = useCloudStore((s) => s.clearCliOutput)
  const addPendingNode    = useCloudStore((s) => s.addPendingNode)
  const removePendingNode = useCloudStore((s) => s.removePendingNode)

  const [showErrors, setShowErrors] = useState(false)

  const pendingIdRef  = useRef<string | null>(null)
  const paramsRef     = useRef<CreateParams | null>(null)
  const handleRunRef  = useRef<() => void>(() => {})

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
      const preview = buildCommands(params).map(argv => 'aws ' + argv.join(' '))
      setCommandPreview(preview)
    } catch {
      // incomplete form — ignore preview update
    }
  }

  function handleCancel(): void {
    if (pendingIdRef.current) removePendingNode(pendingIdRef.current)
    clearCliOutput()
    setCommandPreview([])
    setActiveCreate(null)
  }

  function handleRun(): void {
    if (!activeCreate || !paramsRef.current) return
    const isValid = validateParams(paramsRef.current)
    if (!isValid) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
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

    const commands = buildCommands(paramsRef.current!)
    window.cloudblocks.runCli(commands)
      .then((result) => {
        if (pendingIdRef.current) removePendingNode(pendingIdRef.current)
        pendingIdRef.current = null
        if (result.code === 0) {
          setCommandPreview([])
          setActiveCreate(null)
          window.cloudblocks.startScan()
        }
      })
      .catch(() => {
        if (pendingIdRef.current) removePendingNode(pendingIdRef.current)
        pendingIdRef.current = null
      })
  }

  // Update the ref each render so the event listener always calls the latest version
  handleRunRef.current = handleRun // eslint-disable-line react-hooks/refs

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
  }
  const modalStyle: React.CSSProperties = {
    background: '#0d1117', border: '1px solid #FF9900', borderRadius: '6px',
    padding: '16px', width: '420px', maxHeight: '80vh', overflowY: 'auto',
    fontFamily: 'monospace', boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ color: '#FF9900', fontSize: '12px', fontWeight: 'bold', marginBottom: '14px', borderBottom: '1px solid #1e2d40', paddingBottom: '8px' }}>
          {TITLES[activeCreate.resource] ?? 'New Resource'}
        </div>

        {activeCreate.resource === 'vpc'    && <VpcForm    onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'ec2'    && <Ec2Form    onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'sg'     && <SgForm     onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 's3'     && <S3Form     onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'rds'    && <RdsForm    onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'lambda' && <LambdaForm onChange={handleChange} showErrors={showErrors} />}
        {activeCreate.resource === 'alb'    && <AlbForm    onChange={handleChange} showErrors={showErrors} />}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #1e2d40' }}>
          <button
            onClick={handleCancel}
            style={{ background: '#1a2332', border: '1px solid #30363d', borderRadius: '3px', color: '#aaa', cursor: 'pointer', fontSize: '10px', padding: '4px 10px', fontFamily: 'monospace' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
