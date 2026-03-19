export function Onboarding(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center" style={{ fontFamily: 'monospace' }}>
      <div className="text-3xl font-bold tracking-tighter" style={{ color: 'var(--cb-accent)' }}>CLOUDBLOCKS</div>
      <p className="text-sm" style={{ color: 'var(--cb-text-muted)' }}>No AWS credentials found.</p>
      <div className="rounded p-4 text-left max-w-sm" style={{ background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border-strong)' }}>
        <div className="text-[10px] mb-2" style={{ color: 'var(--cb-text-secondary)' }}>Run the following to configure AWS credentials:</div>
        <code className="text-[11px]" style={{ color: 'var(--cb-accent)' }}>aws configure</code>
        <div className="text-[10px] mt-3" style={{ color: 'var(--cb-text-muted)' }}>
          Then restart Cloudblocks.
        </div>
      </div>
    </div>
  )
}
