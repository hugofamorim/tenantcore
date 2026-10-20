import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <Link
          href="/"
          className="text-xl font-semibold tracking-tight text-blue-700 dark:text-blue-300"
        >
          TenantCore
        </Link>
        <nav
          aria-label="Account"
          className="flex flex-wrap gap-5 text-sm font-medium"
        >
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>
          <Link href="/register" className="underline underline-offset-4">
            Create account
          </Link>
          <Link href="/status" className="underline underline-offset-4">
            Service status
          </Link>
        </nav>
      </header>
      <section className="max-w-3xl py-16 sm:py-24">
        <p className="text-sm font-medium uppercase tracking-widest text-blue-700 dark:text-blue-300">
          Open-source multi-tenant workspaces
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
          Your organizations.
          <br />
          Clear boundaries.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Create a workspace, invite your team and manage access with
          organization-specific roles. Follow real membership activity in an
          administrative dashboard.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/register"
            className="rounded-lg bg-blue-700 px-5 py-3 font-medium text-white"
          >
            Create your account
          </Link>
          <Link
            href="/organizations"
            className="rounded-lg border border-zinc-400 px-5 py-3 font-medium"
          >
            Open your workspaces
          </Link>
        </div>
      </section>
      <section
        aria-label="Workspace capabilities"
        className="grid gap-5 pb-12 md:grid-cols-3"
      >
        {[
          [
            "Verified identity",
            "Email verification, password recovery and rotating sessions keep account access explicit.",
          ],
          [
            "Roles per organization",
            "Owners, administrators, members and viewers have permissions checked by the API on each action.",
          ],
          [
            "Visible activity",
            "Track membership and invitation changes with real tenant metrics and a scoped audit log.",
          ],
        ].map(([title, description]) => (
          <article
            key={title}
            className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-700"
          >
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {description}
            </p>
          </article>
        ))}
      </section>
      <footer className="mt-auto border-t border-zinc-200 pt-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <a
          href="https://github.com/hugofamorim/tenantcore"
          className="underline underline-offset-4"
        >
          Source, architecture and local demonstration instructions
        </a>
      </footer>
    </main>
  );
}
