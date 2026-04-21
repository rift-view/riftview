import { describe, expect, it } from 'vitest'
import { awsPlugin } from '../../../src/main/plugin/awsPlugin'
import { hetznerPluginStub } from '../../../src/main/plugin/hetznerPlugin.stub'
import { vercelPluginStub } from '../../../src/main/plugin/vercelPlugin.stub'
import type {
  ApplyEvent,
  RestorePlan,
  RestoreStep,
  StoredVersion,
  TypedConfirmation,
  VersionFormatId
} from '../../../src/main/plugin/types'

describe('plugin/restoreTypes — RIF-18 interface', () => {
  describe('plugin conformance', () => {
    it('awsPlugin declares versionFormat="scan-snapshot"', () => {
      expect(awsPlugin.versionFormat).toBe('scan-snapshot')
    })

    it('hetznerPluginStub declares its own versionFormat id', () => {
      expect(hetznerPluginStub.versionFormat).toBe('hetzner-cloud-api-v1')
    })

    it('vercelPluginStub declares versionFormat="unsupported"', () => {
      expect(vercelPluginStub.versionFormat).toBe('unsupported')
    })

    it('opted-in plugins (stub) expose all three snapshot-export methods', () => {
      expect(typeof hetznerPluginStub.planRestore).toBe('function')
      expect(typeof hetznerPluginStub.applyRestore).toBe('function')
      expect(typeof hetznerPluginStub.estimateCostDelta).toBe('function')
    })

    it('opted-out plugin (stub) leaves snapshot-export methods undefined', () => {
      expect(vercelPluginStub.planRestore).toBeUndefined()
      expect(vercelPluginStub.applyRestore).toBeUndefined()
      expect(vercelPluginStub.estimateCostDelta).toBeUndefined()
    })
  })

  describe('shape contracts (JSON-serializable)', () => {
    const sampleStoredVersion: StoredVersion = {
      versionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      capturedAt: '2026-04-20T12:00:00Z',
      pluginId: 'com.riftview.aws',
      region: 'us-east-1',
      versionFormat: 'scan-snapshot'
    }

    const sampleStep: RestoreStep = {
      stepId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      op: 'destroy',
      targetNode: { id: 'i-123', type: 'ec2', label: 'web-01', region: 'us-east-1' },
      detail: { argv: [['ec2', 'terminate-instances', '--instance-ids', 'i-123']] },
      destructive: true
    }

    const samplePlan: RestorePlan = {
      planId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      pluginId: 'com.riftview.aws',
      versionFormat: 'scan-snapshot',
      from: sampleStoredVersion,
      to: 'live',
      steps: [sampleStep],
      createdAt: '2026-04-20T12:00:00Z',
      planToken: 'opaque-token-abc'
    }

    it('RestorePlan JSON round-trips without loss', () => {
      const json = JSON.stringify(samplePlan)
      const reparsed = JSON.parse(json) as RestorePlan
      expect(reparsed).toEqual(samplePlan)
    })

    it('ApplyEvent discriminated union — every kind is serializable', () => {
      const events: ApplyEvent[] = [
        { kind: 'started', stepId: 's1', startedAt: '2026-04-20T00:00:00Z' },
        {
          kind: 'succeeded',
          stepId: 's1',
          finishedAt: '2026-04-20T00:00:01Z',
          observed: { status: 'terminated' }
        },
        {
          kind: 'failed',
          stepId: 's1',
          finishedAt: '2026-04-20T00:00:02Z',
          message: 'boom'
        },
        {
          kind: 'rolled-back',
          stepId: 's1',
          finishedAt: '2026-04-20T00:00:03Z',
          message: 'restored prior state'
        }
      ]
      for (const ev of events) {
        expect(JSON.parse(JSON.stringify(ev))).toEqual(ev)
      }
    })

    it('TypedConfirmation carries its phantom brand into runtime shape', () => {
      const conf: TypedConfirmation = {
        _brand: 'confirmed',
        stepId: 's1',
        planId: 'p1',
        phrase: 'i-123',
        confirmedAt: '2026-04-20T00:00:00Z'
      }
      expect(conf._brand).toBe('confirmed')
    })

    it('RestoreStep.destructive is a hard boolean, not optional', () => {
      expect(sampleStep.destructive).toBe(true)
      // @ts-expect-error — destructive cannot be omitted in a literal
      const bogus: RestoreStep = { ...sampleStep, destructive: undefined }
      // suppress unused warning without changing runtime behavior
      void bogus
    })
  })

  describe('VersionFormatId', () => {
    it('accepts the known literals without widening', () => {
      const known: VersionFormatId[] = ['scan-snapshot', 'unsupported', 'custom-id']
      expect(known).toHaveLength(3)
    })
  })
})
