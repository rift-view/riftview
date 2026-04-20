import React, { useRef, useState, useEffect } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { EditParams, CloudFrontEditParams } from '../../types/edit'
import { resolveEditCommands } from '../../plugin/pluginCommands'
import { useCliStore } from '../../store/cli'
import VpcEditForm from './VpcEditForm'
import Ec2EditForm from './Ec2EditForm'
import SgEditForm from './SgEditForm'
import RdsEditForm from './RdsEditForm'
import S3EditForm from './S3EditForm'
import LambdaEditForm from './LambdaEditForm'
import AlbEditForm from './AlbEditForm'
import CloudFrontEditForm from './CloudFrontEditForm'
import ApigwEditForm from './ApigwEditForm'
import EventBridgeEditForm from './EventBridgeEditForm'
import SqsEditForm from './SqsEditForm'
import SnsEditForm from './SnsEditForm'
import EcrEditForm from './EcrEditForm'
import SecretEditForm from './SecretEditForm'
import DynamoEditForm from './DynamoEditForm'
import SsmEditForm from './SsmEditForm'
import SfnEditForm from './SfnEditForm'

interface EditModalProps {
  node: CloudNode | null
  onClose: () => void
}

const RESOURCE_LABELS: Record<string, string> = {
  vpc: 'VPC',
  ec2: 'EC2 Instance',
  'security-group': 'Security Group',
  rds: 'RDS Instance',
  s3: 'S3 Bucket',
  lambda: 'Lambda Function',
  alb: 'Load Balancer',
  cloudfront: 'CloudFront Distribution',
  apigw: 'API Gateway',
  'eventbridge-bus': 'EventBridge Bus',
  sqs: 'SQS Queue',
  sns: 'SNS Topic',
  'ecr-repo': 'ECR Repository',
  secret: 'Secret',
  dynamo: 'DynamoDB Table',
  'ssm-param': 'SSM Parameter',
  sfn: 'Step Functions State Machine'
}

export default function EditModal({ node, onClose }: EditModalProps): React.JSX.Element | null {
  const { setCommandPreview, appendCliOutput, clearCliOutput } = useCliStore()
  const [showErrors, setShowErrors] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const paramsRef = useRef<EditParams | null>(null)
  const handleRunRef = useRef<() => void>(() => {})

  useEffect(() => {
    const listener = (): void => handleRunRef.current()
    window.addEventListener('commanddrawer:run', listener)
    return () => window.removeEventListener('commanddrawer:run', listener)
  }, [])

  if (!node) return null
  // ACM certificates have no editable fields via the AWS CLI
  if (node.type === 'acm') return null

  const handleChange = (params: EditParams): void => {
    paramsRef.current = params
    if (params.resource === 'cloudfront') {
      setCommandPreview(['[CloudFront distribution will be updated via SDK]'])
      return
    }
    const cmds = resolveEditCommands(node, params as unknown as Record<string, unknown>)
    setCommandPreview(cmds.map((argv) => 'aws ' + argv.join(' ')))
  }

  const handleRun = async (): Promise<void> => {
    if (!paramsRef.current) {
      setShowErrors(true)
      return
    }
    setIsRunning(true)
    clearCliOutput()

    if (paramsRef.current.resource === 'cloudfront') {
      try {
        const result = await window.riftview.updateCloudFront(
          node.id,
          paramsRef.current as CloudFrontEditParams
        )
        if (result.code === 0) {
          setCommandPreview([])
          onClose()
          await window.riftview.startScan()
        }
      } finally {
        setIsRunning(false)
      }
      return
    }

    const cmds = resolveEditCommands(node, paramsRef.current as unknown as Record<string, unknown>)
    if (cmds.length === 0) {
      setIsRunning(false)
      onClose()
      return
    }
    const unsubOutput = window.riftview.onCliOutput((d) => appendCliOutput(d))
    try {
      const result = await window.riftview.runCli(cmds)
      if (result.code === 0) {
        setCommandPreview([])
        onClose()
        await window.riftview.startScan()
      }
    } finally {
      unsubOutput()
      setIsRunning(false)
    }
  }

  handleRunRef.current = handleRun

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && !isRunning && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !isRunning) onClose()
      }}
      tabIndex={-1}
      style={{ zIndex: 200 }}
    >
      <div className="modal modal--sm">
        <div className="modal-head">
          <div className="modal-head-text">
            <span className="eyebrow">EDIT</span>
            <h2 className="modal-title">
              {RESOURCE_LABELS[node.type] ?? node.type}
            </h2>
          </div>
          <button className="modal-close" onClick={onClose} disabled={isRunning} title="Close">
            ×
          </button>
        </div>
        <div className="modal-body">

        {node.type === 'vpc' && (
          <VpcEditForm node={node} onChange={handleChange} showErrors={showErrors} />
        )}
        {node.type === 'ec2' && <Ec2EditForm node={node} onChange={handleChange} />}
        {node.type === 'security-group' && <SgEditForm node={node} onChange={handleChange} />}
        {node.type === 'rds' && <RdsEditForm node={node} onChange={handleChange} />}
        {node.type === 's3' && <S3EditForm node={node} onChange={handleChange} />}
        {node.type === 'lambda' && <LambdaEditForm node={node} onChange={handleChange} />}
        {node.type === 'alb' && (
          <AlbEditForm node={node} onChange={handleChange} showErrors={showErrors} />
        )}
        {node.type === 'cloudfront' && <CloudFrontEditForm node={node} onChange={handleChange} />}
        {node.type === 'apigw' && <ApigwEditForm node={node} onChange={handleChange} />}
        {node.type === 'eventbridge-bus' && (
          <EventBridgeEditForm node={node} onChange={handleChange} />
        )}
        {node.type === 'sqs' && <SqsEditForm node={node} onChange={handleChange} />}
        {node.type === 'sns' && <SnsEditForm node={node} onChange={handleChange} />}
        {node.type === 'ecr-repo' && <EcrEditForm node={node} onChange={handleChange} />}
        {node.type === 'secret' && <SecretEditForm node={node} onChange={handleChange} />}
        {node.type === 'dynamo' && <DynamoEditForm node={node} onChange={handleChange} />}
        {node.type === 'ssm-param' && <SsmEditForm node={node} onChange={handleChange} />}
        {node.type === 'sfn' && <SfnEditForm node={node} onChange={handleChange} />}

        </div>
        <div className="modal-foot">
          <button disabled={isRunning} onClick={onClose} className="btn btn-sm btn-ghost">
            Cancel
          </button>
          <button disabled={isRunning} onClick={handleRun} className="btn btn-sm btn-primary">
            {isRunning ? 'Saving\u2026' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
