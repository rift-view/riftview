import { contextBridge, ipcRenderer } from 'electron'
import type { ScanDelta } from '../renderer/types/cloud'

contextBridge.exposeInMainWorld('cloudblocks', {
  listProfiles: () => ipcRenderer.invoke('profiles:list'),
  selectProfile: (name: string) => ipcRenderer.invoke('profile:select', name),
  selectRegion: (region: string) => ipcRenderer.invoke('region:select', region),
  startScan: () => ipcRenderer.invoke('scan:start'),

  onScanDelta: (cb: (delta: ScanDelta) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, delta: ScanDelta) => cb(delta)
    ipcRenderer.on('scan:delta', handler)
    return () => ipcRenderer.removeListener('scan:delta', handler)
  },
  onScanStatus: (cb: (status: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, s: string) => cb(s)
    ipcRenderer.on('scan:status', handler)
    return () => ipcRenderer.removeListener('scan:status', handler)
  },
  onConnStatus: (cb: (status: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, s: string) => cb(s)
    ipcRenderer.on('conn:status', handler)
    return () => ipcRenderer.removeListener('conn:status', handler)
  },

  // CLI — renderer sends pre-built string[][] argv arrays
  runCli: (commands: string[][]) => ipcRenderer.invoke('cli:run', commands),
  cancelCli: () => ipcRenderer.send('cli:cancel'),
  onCliOutput: (cb: (data: { line: string; stream: 'stdout' | 'stderr' }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { line: string; stream: 'stdout' | 'stderr' }) => cb(data)
    ipcRenderer.on('cli:output', handler)
    return () => ipcRenderer.removeListener('cli:output', handler)
  },
  onCliDone: (cb: (data: { code: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { code: number }) => cb(data)
    ipcRenderer.on('cli:done', handler)
    return () => ipcRenderer.removeListener('cli:done', handler)
  },

  // Settings (used by Task 5 — adding now for type completeness)
  getSettings: () => ipcRenderer.invoke('settings:get'),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSettings: (s: any) => ipcRenderer.invoke('settings:set', s),
})
