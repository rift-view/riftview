interface Window {
  cloudblocks: {
    listProfiles(): Promise<{ name: string; region?: string }[]>
    selectProfile(name: string): Promise<void>
    selectRegion(region: string): Promise<void>
    startScan(): Promise<void>
    onScanDelta(cb: (delta: import('../renderer/types/cloud').ScanDelta) => void): () => void
    onScanStatus(cb: (status: string) => void): () => void
    onConnStatus(cb: (status: string) => void): () => void
    runCli(commands: string[][]): Promise<{ code: number }>
    cancelCli(): void
    onCliOutput(cb: (data: { line: string; stream: 'stdout' | 'stderr' }) => void): () => void
    onCliDone(cb: (data: { code: number }) => void): () => void
    onScanKeypairs(cb: (pairs: string[]) => void): () => void
    getSettings(): Promise<import('../renderer/types/cloud').Settings>
    setSettings(s: import('../renderer/types/cloud').Settings): Promise<void>
  }
}
