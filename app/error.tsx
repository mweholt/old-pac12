'use client';

import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'react-boundary', message: error.message, stack: error.stack, digest: error.digest }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#080a16] p-6 text-white">
      <div className="max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-xl font-black">Client error</h1>
        <p className="mt-3 break-words text-sm text-rose-300">{error.message || 'Unknown browser error'}</p>
        <button className="retry-button mt-5" onClick={reset}>Retry</button>
      </div>
    </main>
  );
}
