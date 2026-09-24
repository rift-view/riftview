import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { autoUpdater } from 'electron-updater'
import { registerBuiltinPlugins } from '@riftview/cloud-scan'
import { closeSnapshotStore } from './history/store'
import { registerHandlers } from './ipc/handlers'
import { IPC } from './ipc/channels'
import { isAllowedExternalUrl } from './security/externalUrl'
import { isAppNavigation } from './security/navigation'

const RENDERER_INDEX = join(__dirname, '../renderer/index.html')

// The only document the main window may navigate to: the bundled renderer,
// or the Vite dev server under `electron-vite dev`.
function rendererUrl(): string {
  return process.env['ELECTRON_RENDERER_URL'] ?? pathToFileURL(RENDERER_INDEX).href
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'RiftView',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      devTools: !app.isPackaged
    }
  })

  // RIFT-146: the renderer never gets a second window. A child window would
  // inherit these webPreferences — preload included — so window.open() of a
  // remote page would hand that page the whole window.riftview bridge.
  // Allow-listed https URLs go to the OS browser instead; everything else is
  // dropped.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url).catch((err) => console.error('[security] openExternal failed:', err))
    }
    return { action: 'deny' }
  })

  // The primary window stays on the app document: a dropped file or link
  // must not navigate it anywhere else.
  const appUrl = rendererUrl()
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppNavigation(url, appUrl)) event.preventDefault()
  })

  // <webview> is already off (webviewTag defaults to false); refuse it
  // outright so a future flip cannot reopen the door.
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())

  registerHandlers(win)

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(RENDERER_INDEX)
  }

  return win
}

app.whenReady().then(() => {
  // RIFT-146: deny every web permission request by default. The one grant is
  // clipboard-sanitized-write: Chromium routes navigator.clipboard.writeText
  // through it even for gesture-backed calls, and the renderer's copy actions
  // (Copy ARN, copy blast radius, copy template) depend on it.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'clipboard-sanitized-write')
  })

  registerBuiltinPlugins()
  const win = createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify()
    autoUpdater.on('update-downloaded', () => {
      win.webContents.send(IPC.UPDATE_AVAILABLE)
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeSnapshotStore()
})
