interface RiftviewRestoreApi {
  listVersions(snapshotId: string): Promise<import('../main/history/read').VersionMeta[]>
  planRestore(
    snapshotId: string,
    versionId: string
  ): Promise<{
    planToken: string
    signedPlanProjection: { destructiveIds: string[]; hmac: string }
    steps: unknown[]
    error?: string
  }>
  estimateCostDelta(planToken: string): Promise<unknown>
  confirmStep(
    planToken: string,
    stepId: string,
    destructiveIds: string[],
    hmac: string,
    typedString: string
  ): Promise<{ confirmationToken: string } | { error: string }>
  apply(
    planToken: string,
    confirmationTokens: string[]
  ): Promise<{ applyId: string } | { error: string }>
  cancel(applyId: string): Promise<{ ok: boolean }>
  onEvent(
    cb: (event: { applyId: string; stepId: string; status: string; message: string }) => void
  ): () => void
}

interface Window {
  /** Synchronous capability flags — populated at preload init, no IPC round-trip needed. */
  __riftviewCapabilities: {
    /** True when RIFTVIEW_DEMO_MODE=1. Renderer uses this for UI gating only; main is the security gate. */
    isDemoMode: boolean
    /** True when RIFTVIEW_E2E=1. Enables gated test affordances in preload + renderer. Never set in prod. */
    isE2EMode: boolean
  }

  /**
   * E2E-only renderer hatch. Only defined when `window.__riftviewCapabilities.isE2EMode`.
   * Exposes a tiny slice of the zustand store so Playwright @release specs can
   * drive state without having to click through every UI path.
   */
  __riftviewE2E?: {
    setImportedNodes(nodes: import('@riftview/shared').CloudNode[]): void
  }

  riftview: {
    /** Runtime demo-mode flag — captured at preload load from process.env.RIFTVIEW_DEMO_MODE. */
    isDemoMode: boolean
    listProfiles(): Promise<import('@riftview/shared').AwsProfile[]>
    selectProfile(profile: import('@riftview/shared').AwsProfile): Promise<void>
    selectRegion(region: string, endpoint?: string): Promise<void>
    startScan(selectedRegions?: string[]): Promise<void>
    onScanDelta(cb: (delta: import('@riftview/shared').ScanDelta) => void): () => void
    onScanStatus(cb: (status: string) => void): () => void
    onConnStatus(cb: (status: string) => void): () => void
    onScanErrorDetail(
      cb: (detail: { kind: string; message: string; raw: string }) => void
    ): () => void
    runCli(commands: string[][]): Promise<{ code: number }>
    cancelCli(): void
    onCliOutput(cb: (data: { line: string; stream: 'stdout' | 'stderr' }) => void): () => void
    onCliDone(cb: (data: { code: number }) => void): () => void
    onScanKeypairs(cb: (pairs: string[]) => void): () => void
    getSettings(): Promise<import('@riftview/shared').Settings>
    setSettings(s: import('@riftview/shared').Settings): Promise<void>
    getStyleOverrides(): Promise<Record<string, string>>
    createCloudFront(
      params: import('../renderer/types/create').CloudFrontParams
    ): Promise<{ code: number }>
    updateCloudFront(
      id: string,
      params: import('../renderer/types/edit').CloudFrontEditParams
    ): Promise<{ code: number }>
    deleteCloudFront(id: string): Promise<{ code: number }>
    invalidateCloudFront(id: string, path: string): Promise<{ code: number }>
    deleteAcm(arn: string): Promise<{ code: number }>
    exportTerraform(
      nodes: import('@riftview/shared').CloudNode[]
    ): Promise<{ success: boolean; skippedTypes?: string[] }>
    terraformDeploy(
      hcl: string,
      region: string,
      endpoint?: string
    ): Promise<
      | { status: 'success'; output: string }
      | { status: 'error'; output: string }
      | { status: 'not_found' }
    >
    exportPng(): Promise<{ success: boolean; filePath?: string }>
    saveExportImage(
      dataUrl: string,
      defaultName: string
    ): Promise<{ success: boolean; filePath?: string }>
    listAwsProfiles(): Promise<string[]>
    onUpdateAvailable(cb: () => void): () => void
    loadAnnotations(): Promise<Record<string, string>>
    saveAnnotations(data: Record<string, string>): Promise<void>
    loadCustomEdges(): Promise<import('@riftview/shared').CustomEdge[]>
    saveCustomEdges(edges: import('@riftview/shared').CustomEdge[]): Promise<void>
    importTfState(): Promise<{
      nodes: import('@riftview/shared').CloudNode[]
      error?: string
    }>
    clearTfState(): Promise<{ ok: boolean }>
    listTfStateModules(): Promise<{
      modules: import('../renderer/types/tfstate').TfModuleInfo[]
      error?: string
    }>
    saveBaseline(
      nodes: import('@riftview/shared').CloudNode[],
      profileName: string,
      region: string
    ): Promise<{ ok: boolean }>
    analyzeIam(
      nodeId: string,
      nodeType: import('@riftview/shared').NodeType,
      metadata: Record<string, unknown>
    ): Promise<import('../renderer/types/iam').IamAnalysisResult>
    notifyDrift(count: number): Promise<void>
    onPluginMetadata(
      cb: (meta: Record<string, import('../renderer/types/plugin').NodeTypeMetadata>) => void
    ): () => void
    retryScanService(service: string): Promise<{ ok: boolean }>
    validateCredentials(
      profile: import('@riftview/shared').AwsProfile
    ): Promise<{ ok: true; account: string; arn: string } | { ok: false; error: string }>
    fetchMetrics(params: {
      nodeId: string
      nodeType: string
      resourceId: string
      region: string
      profile: import('@riftview/shared').AwsProfile
    }): Promise<import('../main/aws/services/cloudwatch').CloudMetric[]>
    getNodeHistory(
      nodeId: string
    ): Promise<
      Array<{ timestamp: string; changes: Array<{ field: string; before: string; after: string }> }>
    >
    startTerminal(params: {
      instanceId: string
      region: string
      profile: import('@riftview/shared').AwsProfile
    }): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }>
    sendTerminalInput(sessionId: string, data: string): Promise<void>
    resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void>
    closeTerminal(sessionId: string): Promise<void>
    onTerminalOutput(cb: (data: { sessionId: string; data: string }) => void): () => void
    listSnapshots(filter?: {
      profile?: string
      region?: string
      limit?: number
    }): Promise<import('../main/history/read').VersionMeta[]>
    readSnapshot(versionId: string): Promise<import('../main/history/read').Snapshot | null>
    deleteSnapshot(versionId: string): Promise<{ ok: boolean }>
    /**
     * Restore surface — undefined when demo mode is active (amendment d, RIF-20 2026-04-21).
     * Renderer probes `window.riftview.restore === undefined` as the capability check.
     */
    restore?: RiftviewRestoreApi
    /**
     * E2E-only tfstate importer. Reads + parses the file at `tfstatePath` and returns
     * the parsed nodes. Unavailable unless RIFTVIEW_E2E=1. See preload/index.ts.
     */
    e2eImportTfState?(tfstatePath: string): Promise<import('@riftview/shared').CloudNode[]>
  }
}
