export function Onboarding(){
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center" style={{ fontFamily: 'monospace' }}>
      <div className="text-3xl font-bold tracking-tighter" style={{ color: '#FF9900' }}>CLOUDBLOCKS</div>
      <p className="text-sm" style={{ color: '#666' }}>No AWS credentials found.</p>
      <div className="rounded p-4 text-left max-w-sm" style={{ background: '#0d1117', border: '1px solid #1e2d40' }}>
        <div className="text-[10px] mb-2" style={{ color: '#aaa' }}>Run the following to configure AWS credentials:</div>
        <code className="text-[11px]" style={{ color: '#FF9900' }}>aws configure</code>
        <div className="text-[10px] mt-3" style={{ color: '#555' }}>
          Then restart Cloudblocks.
        </div>
      </div>
    </div>
  )
}
