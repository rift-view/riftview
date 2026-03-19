import { create } from 'zustand'

interface CliState {
  cliOutput:      Array<{ line: string; stream: 'stdout' | 'stderr' }>
  commandPreview: string[]
  pendingCommand: string[][] | null

  appendCliOutput:   (entry: { line: string; stream: 'stdout' | 'stderr' }) => void
  clearCliOutput:    () => void
  setCommandPreview: (cmd: string[]) => void
  setPendingCommand: (cmds: string[][] | null) => void
}

export const useCliStore = create<CliState>((set) => ({
  cliOutput:      [],
  commandPreview: [],
  pendingCommand: null,

  appendCliOutput:   (entry) => set((s) => ({ cliOutput: [...s.cliOutput, entry] })),
  clearCliOutput:    ()      => set({ cliOutput: [] }),
  setCommandPreview: (cmd)   => set({ commandPreview: cmd }),
  setPendingCommand: (cmds)  => set({ pendingCommand: cmds }),
}))
