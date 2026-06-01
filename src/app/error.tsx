'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  ERROR_TITLE,
  ERROR_MESSAGE,
  ERROR_RETRY_LABEL,
  ERROR_HOME_LABEL,
  ERROR_SHOW_DETAILS_IN_DEV,
} from '../../config/site_metadata';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const showDetails = ERROR_SHOW_DETAILS_IN_DEV && process.env.NODE_ENV === 'development';

  return (
    <main className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">{ERROR_TITLE}</h1>
      <p className="text-lg text-gray-300 max-w-md">{ERROR_MESSAGE}</p>
      {showDetails && (
        <pre className="max-w-2xl overflow-auto rounded-lg bg-gray-900 p-4 text-left text-xs text-red-300">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ''}
        </pre>
      )}
      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <button
          onClick={reset}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full transition-all shadow-lg shadow-blue-500/20"
        >
          {ERROR_RETRY_LABEL}
        </button>
        <Link
          href="/"
          className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-full transition-all"
        >
          {ERROR_HOME_LABEL}
        </Link>
      </div>
    </main>
  );
}
