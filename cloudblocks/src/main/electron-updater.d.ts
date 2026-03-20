declare module 'electron-updater' {
  export const autoUpdater: {
    checkForUpdatesAndNotify(): Promise<unknown>
  }
}
