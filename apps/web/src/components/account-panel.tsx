"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authMutation, currentUser, renewSession, updateAccountName, type PublicUser } from "@/lib/auth";
import { navigateAfterAuth } from "@/lib/auth-navigation";

export function AccountPanel() {
  const router = useRouter();
  const nameId = useId();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    currentUser().then((account) => {
      if (!active) return;
      if (!account) router.replace("/login");
      else setUser(account);
    }).catch(() => { if (active) setError("Your account is temporarily unavailable. Please try again."); });
    return () => { active = false; };
  }, [router]);

  async function action(kind: "refresh" | "logout" | "resend-verification") {
    setPending(true); setError(""); setNotice("");
    try {
      if (kind === "refresh") { await renewSession(); setNotice("Your session has been renewed."); }
      else if (kind === "resend-verification" && user) { await authMutation(kind, { email: user.email }); setNotice("If your account is eligible, a verification email will arrive shortly."); }
      else { await authMutation("logout"); navigateAfterAuth("/login"); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally { setPending(false); }
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    setPending(true); setError(''); setNotice('');
    try {
      await updateAccountName(String(data.get('name') ?? ''));
      const account = await currentUser();
      if (!account) { navigateAfterAuth('/login'); return; }
      setUser(account); setNotice('Your display name has been updated.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { setPending(false); }
  }

  return <div className="space-y-5" aria-busy={pending}>
    {!user && !error && <p role="status">Loading your account…</p>}
    {user && <>
      <dl className="space-y-4">
        <div><dt className="text-sm text-muted-foreground">Name</dt><dd className="mt-1 font-medium">{user.name}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Email address</dt><dd className="mt-1 break-words">{user.email}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Email status</dt><dd className="mt-1">{user.emailVerifiedAt ? "Verified" : "Not verified"}</dd></div>
      </dl>
      <form onSubmit={event => void saveName(event)} className="space-y-3 rounded-lg border border-border bg-card text-card-foreground p-4">
        <label htmlFor={nameId} className="block text-sm font-medium">Display name</label>
        <input key={user.name} id={nameId} name="name" defaultValue={user.name} autoComplete="name" required minLength={2} maxLength={80} disabled={pending} className="w-full rounded-lg border border-input bg-card text-card-foreground px-3 py-2" />
        <button disabled={pending} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-60">Save display name</button>
      </form>
      <Link href="/forgot-password" className="inline-block text-sm underline">Reset your password</Link>
      <div className="flex flex-wrap gap-3">
        <Link href="/organizations" className="rounded-lg border border-input px-4 py-2">Your organizations</Link>
        {!user.emailVerifiedAt && <button className="rounded-lg border border-input px-4 py-2 disabled:opacity-60" disabled={pending} onClick={() => void action("resend-verification")}>Send verification email</button>}
        <button className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-60" disabled={pending} onClick={() => void action("refresh")}>Renew session</button>
        <button className="rounded-lg border border-input px-4 py-2 disabled:opacity-60" disabled={pending} onClick={() => void action("logout")}>Sign out</button>
      </div>
    </>}
    {error && <div><p role="alert" className="text-red-700 dark:text-red-300">{error}</p><button className="mt-3 underline" onClick={() => window.location.reload()}>Try again</button></div>}
    {notice && <p role="status">{notice}</p>}
  </div>;
}
