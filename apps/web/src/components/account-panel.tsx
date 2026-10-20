"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authMutation, currentUser, renewSession, type PublicUser } from "@/lib/auth";
import { navigateAfterAuth } from "@/lib/auth-navigation";

export function AccountPanel() {
  const router = useRouter();
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

  return <div className="space-y-5" aria-busy={pending}>
    {!user && !error && <p role="status">Loading your account…</p>}
    {user && <>
      <dl className="space-y-4">
        <div><dt className="text-sm text-zinc-600 dark:text-zinc-400">Name</dt><dd className="mt-1 font-medium">{user.name}</dd></div>
        <div><dt className="text-sm text-zinc-600 dark:text-zinc-400">Email address</dt><dd className="mt-1 break-words">{user.email}</dd></div>
        <div><dt className="text-sm text-zinc-600 dark:text-zinc-400">Email status</dt><dd className="mt-1">{user.emailVerifiedAt ? "Verified" : "Not verified"}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-3">
        {!user.emailVerifiedAt && <button className="rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60" disabled={pending} onClick={() => void action("resend-verification")}>Send verification email</button>}
        <button className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-60" disabled={pending} onClick={() => void action("refresh")}>Renew session</button>
        <button className="rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60" disabled={pending} onClick={() => void action("logout")}>Sign out</button>
      </div>
    </>}
    {error && <div><p role="alert" className="text-red-700 dark:text-red-300">{error}</p><button className="mt-3 underline" onClick={() => window.location.reload()}>Try again</button></div>}
    {notice && <p role="status">{notice}</p>}
  </div>;
}
