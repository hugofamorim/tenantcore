"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { authMutation, currentUser, type PublicUser } from "@/lib/auth";
import { navigateAfterAuth } from "@/lib/auth-navigation";
import { getOrganization, listOrganizations, OrganizationRequestError, type Organization, type OrganizationPage } from "@/lib/organizations";
import { OrganizationForm } from "./organization-form";
import { MembershipPanel, type ManagementSection } from "./membership-panel";

export function OrganizationsPanel({ organizationId, settings = false, section }: { organizationId?: string; settings?: boolean; section?: ManagementSection }) {
  const router = useRouter();
  const selectorId = useId();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [page, setPage] = useState<OrganizationPage | null>(null);
  const [selected, setSelected] = useState<Organization | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const identity = await currentUser();
      if (!active) return;
      if (!identity) { navigateAfterAuth("/login"); return; }
      setUser(identity);
      if (!identity.emailVerifiedAt) return;
      const [memberships, organization] = await Promise.all([listOrganizations(), organizationId ? getOrganization(organizationId) : Promise.resolve(null)]);
      if (active) { setPage(memberships); setSelected(organization); }
    }
    void load().catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof OrganizationRequestError && cause.status === 401) navigateAfterAuth("/login");
      else setError(cause instanceof Error ? cause.message : "Please try again.");
    });
    return () => { active = false; };
  }, [organizationId]);

  async function more() {
    if (!page) return;
    setPending(true); setError("");
    try {
      const next = await listOrganizations(page.offset + page.limit);
      setPage({ ...next, items: [...page.items, ...next.items.filter((item) => !page.items.some((prior) => prior.id === item.id))] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setPending(false); }
  }

  async function logout() {
    setPending(true); setError("");
    try { await authMutation("logout"); navigateAfterAuth("/login"); }
    catch { setPending(false); setError("Could not sign out. Please try again."); }
  }

  function saved(organization: Organization) {
    setSelected(organization); setNotice("Organization settings updated.");
    setPage((prior) => prior ? { ...prior, items: prior.items.map((item) => item.id === organization.id ? organization : item) } : prior);
  }

  const options = page?.items ?? [];
  const choices = selected && !options.some((item) => item.id === selected.id) ? [selected, ...options] : options;
  return <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row dark:bg-zinc-950">
    <aside className="w-full shrink-0 border-b border-zinc-200 bg-white p-5 md:w-64 md:border-b-0 md:border-r dark:border-zinc-800 dark:bg-zinc-900">
      <Link href="/organizations" className="text-lg font-semibold tracking-tight text-blue-700 dark:text-blue-300">TenantCore</Link>
      <nav aria-label="Workspace navigation" className="mt-6 flex flex-col gap-3 text-sm">
        <Link href="/organizations" className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">Organizations</Link>
        {selected && <><Link href={`/organizations/${selected.id}`} className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">Overview</Link>
          <Link href={`/organizations/${selected.id}/settings`} className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">Settings</Link>
          {(selected.role === 'OWNER' || selected.role === 'ADMIN') && <><Link href={`/organizations/${selected.id}/members`} className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">Members</Link><Link href={`/organizations/${selected.id}/invitations`} className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">Invitations</Link><Link href={`/organizations/${selected.id}/audit`} className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">Audit log</Link></>}</>}
        <Link href="/account" className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">Your account</Link>
      </nav>
      {choices.length > 0 && <div className="mt-6">
        <label htmlFor={selectorId} className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Active organization</label>
        <select id={selectorId} className="mt-2 w-full rounded-lg border border-zinc-400 bg-transparent px-2 py-2 text-sm" value={selected?.id ?? ""}
          onChange={(event) => { if (event.target.value) router.push(`/organizations/${event.target.value}`); }}>
          <option value="" disabled>Select an organization</option>
          {choices.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.slug}</option>)}
        </select>
        {page?.hasMore && <button className="mt-2 text-sm underline" onClick={() => void more()} disabled={pending}>Load more organizations</button>}
      </div>}
      {user && <div className="mt-8 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className="break-words text-sm text-zinc-600 dark:text-zinc-400">{user.email}</p>
        <button className="mt-3 text-sm underline underline-offset-4 disabled:opacity-60" disabled={pending} onClick={() => void logout()}>Sign out</button>
      </div>}
    </aside>
    <main className="w-full min-w-0 max-w-5xl flex-1 p-5 sm:p-9" aria-busy={pending}>
      {error && <div className="mb-6 rounded-xl border border-red-400 bg-white p-4 dark:bg-zinc-900"><p role="alert" className="text-red-700 dark:text-red-300">{error}</p>
        <div className="mt-3 flex gap-4 text-sm"><button className="underline" onClick={() => window.location.reload()}>Try again</button><Link href="/organizations" className="underline">Back to organizations</Link></div></div>}
      {notice && <p role="status" className="mb-5 rounded-lg border border-green-500 p-3 text-sm">{notice}</p>}
      {!user && !error && <p role="status">Loading your workspace…</p>}
      {user && !user.emailVerifiedAt && <section className="rounded-xl border border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold">Verify your email</h1><p className="mt-3">Confirm your email address before creating or accessing organizations.</p>
        <Link href="/account" className="mt-5 inline-block text-blue-700 underline dark:text-blue-300">Go to your account to verify</Link>
      </section>}
      {user?.emailVerifiedAt && !page && !error && <p role="status">Loading organizations…</p>}
      {page && !organizationId && <>
        <h1 className="text-3xl font-semibold tracking-tight">Your organizations</h1><p className="mt-2 text-zinc-600 dark:text-zinc-400">Choose a workspace or create a new one.</p>
        <section aria-label="Organization list" className="mt-7 grid gap-4 sm:grid-cols-2">
          {page.items.map((item) => <Link key={item.id} href={`/organizations/${item.id}`} className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">{item.name}</h2><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{item.slug}</p><span className="mt-4 inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium dark:bg-zinc-800">{item.role}</span>
          </Link>)}
          {page.items.length === 0 && <p className="text-zinc-600 dark:text-zinc-400">You have no organizations yet. Create your first workspace below.</p>}
        </section>
        <section className="mt-9 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900" aria-labelledby="create-heading">
          <h2 id="create-heading" className="mb-5 text-xl font-semibold">Create an organization</h2><OrganizationForm onComplete={(organization) => router.push(`/organizations/${organization.id}`)} />
        </section>
      </>}
      {selected && <>
        <div className="mb-7 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">{section ? section === 'audit' ? 'Audit log' : section === 'members' ? 'Organization members' : 'Organization invitations' : settings ? "Organization settings" : selected.name}</h1><span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium dark:border-zinc-600">{selected.role}</span></div>
        {section && user ? <MembershipPanel key={`${selected.id}-${section}`} organization={selected} userId={user.id} section={section} /> : settings ? <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900"><OrganizationForm key={selected.updatedAt} existing={selected} onComplete={saved} /></section> :
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900"><h2 className="text-lg font-semibold">Organization details</h2>
            <dl className="mt-5 space-y-4"><div><dt className="text-sm text-zinc-600 dark:text-zinc-400">Slug</dt><dd className="mt-1">{selected.slug}</dd></div>
              <div><dt className="text-sm text-zinc-600 dark:text-zinc-400">Your role</dt><dd className="mt-1">{selected.role}</dd></div>
              <div><dt className="text-sm text-zinc-600 dark:text-zinc-400">Created</dt><dd className="mt-1">{new Date(selected.createdAt).toLocaleDateString()}</dd></div></dl>
            <Link href={`/organizations/${selected.id}/settings`} className="mt-6 inline-block font-medium text-blue-700 underline dark:text-blue-300">View settings</Link>
          </section>}
      </>}
    </main>
  </div>;
}
