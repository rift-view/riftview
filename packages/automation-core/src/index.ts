export const PACKAGE = '@riftview/automation-core' as const
export { acquireLock, releaseLock, reclaimIfStale, DEFAULT_LOCK_DIR } from './lock'
export * from './config'
export * from './halt'
export * from './hooks/predicates'
export * from './linear'
export * from './probe'
export * from './audit'
