import { LOADING_LABEL } from '../../config/site_metadata';

export default function Loading() {
  return (
    <main className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center gap-6 p-8">
      <div
        className="h-12 w-12 rounded-full border-4 border-gray-700 border-t-blue-500 animate-spin"
        role="status"
        aria-label="Loading"
      />
      {LOADING_LABEL ? (
        <p className="text-sm text-gray-400 uppercase tracking-widest">{LOADING_LABEL}</p>
      ) : null}
    </main>
  );
}
