'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#080a16] p-6 text-white">
      <div className="max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-xl font-black">The scores hit a snag</h1>
        <p className="mt-3 text-sm text-slate-400">Reload the live schedule and try again.</p>
        <button className="retry-button mt-5" onClick={reset}>Retry</button>
      </div>
    </main>
  );
}
