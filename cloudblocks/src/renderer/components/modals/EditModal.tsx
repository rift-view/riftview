import React, { useRef, useState, useEffect } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { EditParams } from '../../types/edit'
import { buildEditCommands } from '../../utils/buildEditCommands'
import { useCloudStore } from '../../store/cloud'
import VpcEditForm from './VpcEditForm'
import Ec2EditForm from './Ec2EditForm'
import SgEditForm from './SgEditForm'
import RdsEditForm from './RdsEditForm'
import S3EditForm from './S3EditForm'
import LambdaEditForm from './LambdaEditForm'
import AlbEditForm from './AlbEditForm'

interface EditModalProps {
  node: CloudNode | null
  onClose: () => void
}

const RESOURCE_LABELS: Record<string, string> = {
  vpc: 'VPC', ec2: 'EC2 Instance', 'security-group': 'Security Group',
  rds: 'RDS Instance', s3: 'S3 Bucket', lambda: 'Lambda Function', alb: 'Load Balancer',
}

export default function EditModal({ node, onClose }: EditModalProps) {
  const { setCommandPreview, appendCliOutput, clearCliOutput } = useCloudStore()
  const [showErrors, setShowErrors] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const paramsRef = useRef<EditParams | null>(null)
  const handleRunRef = useRef<() => void>(() => {})

  useEffect(() => {
    const listener = () => handleRunRef.current()
    window.addEventListener('commanddrawer:run', listener)
    return () => window.removeEventListener('commanddrawer:run', listener)
  }, [])

  if (!node) return null

  const handleChange = (params: EditParams) => {
    paramsRef.current = params
    const cmds = buildEditCommands(node, params)
    setCommandPreview(cmds.map(argv => 'aws ' + argv.join(' ')))
  }

  const handleRun = async () => {
    if (!paramsRef.current) { setShowErrors(true); return }
    const cmds = buildEditCommands(node, paramsRef.current)
    if (cmds.length === 0) { onClose(); return }
    setIsRunning(true)
    clearCliOutput()
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
    background: '#0d1117', border: `1px solid #FF9900`, borderRadius: 8,
    padding: 20, width: 360, maxHeight: '80vh', overflowY: 'auto',
    fontFamily: 'monospace',
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && !isRunning && onClose()}>
      <div style={modal}>
        <div style={{ color: '#FF9900', fontWeight: 'bold', fontSize: 13, marginBottom: 12, borderBottom: '1px solid #1e2d40', paddingBottom: 8 }}>
          Edit {RESOURCE_LABELS[node.type] ?? node.type}
        </div>

        {node.type === 'vpc'             && <VpcEditForm    node={node} onChange={handleChange} showErrors={showErrors} />}
        {node.type === 'ec2'             && <Ec2EditForm    node={node} onChange={handleChange} />}
        {node.type === 'security-group'  && <SgEditForm     node={node} onChange={handleChange} />}
        {node.type === 'rds'             && <RdsEditForm    node={node} onChange={handleChange} />}
        {node.type === 's3'              && <S3EditForm     node={node} onChange={handleChange} />}
        {node.type === 'lambda'          && <LambdaEditForm node={node} onChange={handleChange} />}
        {node.type === 'alb'             && <AlbEditForm    node={node} onChange={handleChange} showErrors={showErrors} />}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            disabled={isRunning}
            onClick={onClose}
            style={{ background: '#1a2332', border: '1px solid #30363d', borderRadius: 3, padding: '4px 16px', color: '#aaa', fontFamily: 'monospace', fontSize: 11, cursor: 'pointer' }}
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
