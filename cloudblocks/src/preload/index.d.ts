interface Window {
  cloudblocks: {
    listProfiles(): Promise<import('../renderer/types/cloud').AwsProfile[]>
    selectProfile(profile: import('../renderer/types/cloud').AwsProfile): Promise<void>
    selectRegion(region: string, endpoint?: string): Promise<void>
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
    getThemeOverrides(): Promise<Record<string, string>>
    createCloudFront(params: import('../renderer/types/create').CloudFrontParams): Promise<{ code: number }>
    updateCloudFront(id: string, params: import('../renderer/types/edit').CloudFrontEditParams): Promise<{ code: number }>
    deleteCloudFront(id: string): Promise<{ code: number }>
    invalidateCloudFront(id: string, path: string): Promise<{ code: number }>
    deleteAcm(arn: string): Promise<{ code: number }>
  }
}
