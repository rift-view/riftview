export const IPC = {
  PROFILES_LIST:   'profiles:list',
  PROFILE_SELECT:  'profile:select',
  REGION_SELECT:   'region:select',
  SCAN_START:      'scan:start',
  SCAN_DELTA:      'scan:delta',
  SCAN_STATUS:     'scan:status',
  CONN_STATUS:     'conn:status',
  CLI_RUN:         'cli:run',
  CLI_OUTPUT:      'cli:output',
  CLI_DONE:        'cli:done',
  CLI_CANCEL:      'cli:cancel',
  SCAN_KEYPAIRS:   'scan:keypairs',   // on → (keyPairs: string[])
  SETTINGS_GET:    'settings:get',    // invoke → Settings
  SETTINGS_SET:    'settings:set',    // invoke → void
  THEME_OVERRIDES: 'theme:overrides',
  CF_CREATE:       'cloudfront:create',     // invoke → { code: number }
  CF_UPDATE:       'cloudfront:update',     // invoke → { code: number }
  CF_DELETE:       'cloudfront:delete',     // invoke → { code: number }
  CF_INVALIDATE:   'cloudfront:invalidate', // invoke → { code: number }
  TERRAFORM_EXPORT: 'terraform:export',     // invoke → { success: boolean }
  CANVAS_EXPORT_PNG: 'canvas:export-png',   // invoke → { success: boolean; filePath?: string }
  AWS_LIST_PROFILES: 'aws:list-profiles',   // invoke → string[]
  UPDATE_AVAILABLE: 'update:available',      // push → void (main → renderer)
  ANNOTATIONS_LOAD: 'annotations:load',      // invoke → Record<string, string>
  ANNOTATIONS_SAVE: 'annotations:save',      // invoke → void
  TFSTATE_IMPORT:   'tfstate:import',         // invoke → { nodes: CloudNode[]; error?: string }
  TFSTATE_CLEAR:    'tfstate:clear',          // invoke → { ok: boolean }
  IAM_ANALYZE:      'iam:analyze',            // invoke → IamAnalysisResult
} as const

export type IpcChannel = typeof IPC[keyof typeof IPC]
