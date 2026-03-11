export const IPC = {
  PROFILES_LIST:  'profiles:list',
  PROFILE_SELECT: 'profile:select',
  REGION_SELECT:  'region:select',
  SCAN_START:     'scan:start',
  SCAN_DELTA:     'scan:delta',
  SCAN_STATUS:    'scan:status',
  CONN_STATUS:    'conn:status',
} as const

export type IpcChannel = typeof IPC[keyof typeof IPC]
