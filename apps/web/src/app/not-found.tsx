import Link from 'next/link';

export default function NotFound() {
  return <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center gap-5 p-8"><p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">404</p><h1 className="text-3xl font-semibold">Page not found</h1><p>The page may have moved or the address may be incorrect.</p><Link className="text-blue-700 underline dark:text-blue-300" href="/organizations">Go to your organizations</Link></main>;
}
