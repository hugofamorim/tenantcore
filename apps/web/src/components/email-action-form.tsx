"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authMutation } from "@/lib/auth";

export function EmailActionForm({ mode }: { mode: "verify-email" | "reset-password" }) {
  const reset = mode === "reset-password";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true); setError("");
    try {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
      if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("This link is invalid or expired. Please request a new email.");
      const password = String(data.get("password") ?? "");
      if (reset && password !== String(data.get("confirm-password") ?? "")) throw new Error("The passwords do not match.");
      await authMutation(mode, { token, ...(reset ? { password } : {}) });
      window.history.replaceState(null, "", window.location.pathname);
      form.reset(); setComplete(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setPending(false); }
  }

  if (complete) return <div className="space-y-5">
    <p role="status">{reset ? "Your password has been updated and all sessions have been signed out. Please sign in again." : "Your email address is now verified."}</p>
    <Link className="font-medium underline underline-offset-4" href={reset ? "/login" : "/account"}>{reset ? "Continue to sign in" : "Continue to your account"}</Link>
  </div>;

  const inputClass = "mt-2 w-full rounded-lg border border-input bg-card text-card-foreground px-3 py-2.5 outline-offset-4 focus:outline-2 focus:outline-ring";
  return <form className="space-y-5" onSubmit={submit} aria-busy={pending}>
    {reset && <>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">New password</label>
        <input className={inputClass} id="password" name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={128} disabled={pending} aria-describedby="password-help" />
        <p id="password-help" className="mt-2 text-sm text-muted-foreground">Use a unique passphrase of 15–128 characters.</p>
      </div>
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium">Confirm new password</label>
        <input className={inputClass} id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" required minLength={15} maxLength={128} disabled={pending} />
      </div>
    </>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <button className="w-full rounded-lg bg-blue-700 px-4 py-3 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-60" disabled={pending}>
      {pending ? "Please wait…" : reset ? "Set new password" : "Verify email address"}
    </button>
    <Link className="inline-block text-sm underline underline-offset-4" href={reset ? "/forgot-password" : "/resend-verification"}>Request a new email</Link>
  </form>;
}
