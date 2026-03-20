declare module 'electron-updater' {
  export const autoUpdater: {
    checkForUpdatesAndNotify(): Promise<unknown>
    on(event: 'update-downloaded', listener: () => void): void
  }
}
