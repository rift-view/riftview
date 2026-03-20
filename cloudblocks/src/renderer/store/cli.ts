import { create } from 'zustand'

interface CliState {
  cliOutput:      Array<{ line: string; stream: 'stdout' | 'stderr' }>
  commandPreview: string[]
  pendingCommand: string[][] | null
  logHistory:     Array<{ line: string; stream: 'stdout' | 'stderr'; ts: number }>

  appendCliOutput:   (entry: { line: string; stream: 'stdout' | 'stderr' }) => void
  clearCliOutput:    () => void
  clearLogHistory:   () => void
  setCommandPreview: (cmd: string[]) => void
  setPendingCommand: (cmds: string[][] | null) => void
}

export const useCliStore = create<CliState>((set) => ({
  cliOutput:      [],
  commandPreview: [],
  pendingCommand: null,
  logHistory:     [],

  appendCliOutput:   (entry) => set((s) => ({
    cliOutput:  [...s.cliOutput, entry],
    logHistory: [...s.logHistory, { ...entry, ts: Date.now() }],
  })),
  clearCliOutput:    ()      => set({ cliOutput: [] }),
  clearLogHistory:   ()      => set({ logHistory: [] }),
  setCommandPreview: (cmd)   => set({ commandPreview: cmd }),
  setPendingCommand: (cmds)  => set({ pendingCommand: cmds }),
}))
