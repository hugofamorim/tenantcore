import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-sm sm:p-9" aria-labelledby="auth-title">
        <Link href="/" className="text-sm font-semibold tracking-wide text-primary">TenantCore</Link>
        <h1 id="auth-title" className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mb-7 mt-2 text-sm text-muted-foreground">{description}</p>
        {children}
      </section>
    </main>
  );
}
