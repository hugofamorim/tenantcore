import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-9 dark:border-zinc-800 dark:bg-zinc-900" aria-labelledby="auth-title">
        <Link href="/" className="text-sm font-semibold tracking-wide text-blue-700 dark:text-blue-300">TenantCore</Link>
        <h1 id="auth-title" className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mb-7 mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
        {children}
      </section>
    </main>
  );
}
