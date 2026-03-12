export const IPC = {
  PROFILES_LIST:  'profiles:list',
  PROFILE_SELECT: 'profile:select',
  REGION_SELECT:  'region:select',
  SCAN_START:     'scan:start',
  SCAN_DELTA:     'scan:delta',
  SCAN_STATUS:    'scan:status',
  CONN_STATUS:    'conn:status',
  CLI_RUN:        'cli:run',
  CLI_OUTPUT:     'cli:output',
  CLI_DONE:       'cli:done',
  CLI_CANCEL:     'cli:cancel',
} as const

export type IpcChannel = typeof IPC[keyof typeof IPC]
