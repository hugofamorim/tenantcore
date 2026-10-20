"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authMutation } from "@/lib/auth";

export function EmailRequestForm({ mode }: { mode: "forgot-password" | "resend-verification" }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true); setError("");
    try {
      await authMutation(mode, { email: String(data.get("email") ?? "") });
      setComplete(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setPending(false); }
  }

  return <div className="space-y-5">
    {complete ? <p role="status">If this account is eligible, an email will arrive shortly. Check your inbox or try again in a minute.</p> :
      <form className="space-y-5" onSubmit={submit} aria-busy={pending}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email address</label>
          <input className="mt-2 w-full rounded-lg border border-zinc-400 bg-transparent px-3 py-2.5 outline-offset-4 focus:outline-2 focus:outline-blue-600"
            id="email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} />
        </div>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        <button className="w-full rounded-lg bg-blue-700 px-4 py-3 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-60" disabled={pending}>
          {pending ? "Please wait…" : mode === "forgot-password" ? "Send recovery email" : "Send verification email"}
        </button>
      </form>}
    <Link className="inline-block text-sm underline underline-offset-4" href="/login">Back to sign in</Link>
  </div>;
}
