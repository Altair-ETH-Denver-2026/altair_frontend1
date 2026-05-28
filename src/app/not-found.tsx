import Link from 'next/link';
import {
  NOT_FOUND_TITLE,
  NOT_FOUND_MESSAGE,
  NOT_FOUND_CTA_LABEL,
} from '../../config/site_metadata';

export default function NotFound() {
  return (
    <main className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-7xl sm:text-8xl font-extrabold tracking-tight">{NOT_FOUND_TITLE}</h1>
      <p className="text-lg sm:text-xl text-gray-300 max-w-md">{NOT_FOUND_MESSAGE}</p>
      <Link
        href="/"
        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full transition-all shadow-lg shadow-blue-500/20"
      >
        {NOT_FOUND_CTA_LABEL}
      </Link>
    </main>
  );
}
