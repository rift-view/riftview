import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { autoUpdater } from 'electron-updater'
import { registerHandlers } from './ipc/handlers'
import { IPC } from './ipc/channels'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Cloudblocks',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  registerHandlers(win)

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
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
