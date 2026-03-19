import React, { useRef, useState, useEffect } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { EditParams, CloudFrontEditParams } from '../../types/edit'
import { buildEditCommands } from '../../utils/buildEditCommands'
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

interface EditModalProps {
  node: CloudNode | null
  onClose: () => void
}

const RESOURCE_LABELS: Record<string, string> = {
  vpc: 'VPC', ec2: 'EC2 Instance', 'security-group': 'Security Group',
  rds: 'RDS Instance', s3: 'S3 Bucket', lambda: 'Lambda Function', alb: 'Load Balancer',
  cloudfront: 'CloudFront Distribution', apigw: 'API Gateway',
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

  const handleChange = (params: EditParams): void => {
    paramsRef.current = params
    if (params.resource === 'cloudfront') {
      setCommandPreview(['[CloudFront distribution will be updated via SDK]'])
      return
    }
    const cmds = buildEditCommands(node, params)
    setCommandPreview(cmds.map(argv => 'aws ' + argv.join(' ')))
  }

  const handleRun = async (): Promise<void> => {
    if (!paramsRef.current) { setShowErrors(true); return }
    setIsRunning(true)
    clearCliOutput()

    if (paramsRef.current.resource === 'cloudfront') {
      try {
        const result = await window.cloudblocks.updateCloudFront(node.id, paramsRef.current as CloudFrontEditParams)
        if (result.code === 0) {
          setCommandPreview([])
          onClose()
          await window.cloudblocks.startScan()
        }
      } finally {
        setIsRunning(false)
      }
      return
    }

    const cmds = buildEditCommands(node, paramsRef.current)
    if (cmds.length === 0) { setIsRunning(false); onClose(); return }
    const unsubOutput = window.cloudblocks.onCliOutput(d => appendCliOutput(d))
    try {
      const result = await window.cloudblocks.runCli(cmds)
      if (result.code === 0) {
        setCommandPreview([])
        onClose()
        await window.cloudblocks.startScan()
      }
    } finally {
      unsubOutput()
      setIsRunning(false)
    }
  }

  handleRunRef.current = handleRun

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  }
  const modal: React.CSSProperties = {
    background: 'var(--cb-bg-panel)', border: `1px solid var(--cb-accent)`, borderRadius: 8,
    padding: 20, width: 360, maxHeight: '80vh', overflowY: 'auto',
    fontFamily: 'monospace',
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && !isRunning && onClose()}>
      <div style={modal}>
        <div style={{ color: 'var(--cb-accent)', fontWeight: 'bold', fontSize: 13, marginBottom: 12, borderBottom: '1px solid var(--cb-border-strong)', paddingBottom: 8 }}>
          Edit {RESOURCE_LABELS[node.type] ?? node.type}
        </div>

        {node.type === 'vpc'             && <VpcEditForm        node={node} onChange={handleChange} showErrors={showErrors} />}
        {node.type === 'ec2'             && <Ec2EditForm        node={node} onChange={handleChange} />}
        {node.type === 'security-group'  && <SgEditForm         node={node} onChange={handleChange} />}
        {node.type === 'rds'             && <RdsEditForm        node={node} onChange={handleChange} />}
        {node.type === 's3'              && <S3EditForm         node={node} onChange={handleChange} />}
        {node.type === 'lambda'          && <LambdaEditForm     node={node} onChange={handleChange} />}
        {node.type === 'alb'             && <AlbEditForm        node={node} onChange={handleChange} showErrors={showErrors} />}
        {node.type === 'cloudfront'      && <CloudFrontEditForm node={node} onChange={handleChange} />}
        {node.type === 'apigw'           && <ApigwEditForm      node={node} onChange={handleChange} />}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            disabled={isRunning}
            onClick={onClose}
            style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', borderRadius: 3, padding: '4px 16px', color: 'var(--cb-text-secondary)', fontFamily: 'monospace', fontSize: 11, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            disabled={isRunning}
            onClick={handleRun}
            style={{ background: '#22c55e', border: 'none', borderRadius: 3, padding: '4px 16px', color: '#000', fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}
          >
            {isRunning ? 'Saving\u2026' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
