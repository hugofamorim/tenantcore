"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authMutation } from "@/lib/auth";
import { navigateAfterAuth } from "@/lib/auth-navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError("");
    try {
      await authMutation(mode, {
        ...(register ? { name: String(data.get("name") ?? "") } : {}),
        email: String(data.get("email") ?? ""), password: String(data.get("password") ?? ""),
      });
      form.reset();
      if (register) setComplete(true);
      else navigateAfterAuth("/account");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally { setPending(false); }
  }

  if (complete) return (
    <div className="space-y-5">
      <p role="status">If this email is available, your account has been created. You can now sign in.</p>
      <p className="text-sm text-muted-foreground">Check your inbox for a verification email.</p>
      <Link className="font-medium underline underline-offset-4" href="/login">Continue to sign in</Link>
    </div>
  );

  const inputClass = "mt-2 w-full rounded-lg border border-input bg-card text-card-foreground px-3 py-2.5 outline-offset-4 focus:outline-2 focus:outline-ring";
  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
      {register && <div>
        <label htmlFor="name" className="block text-sm font-medium">Full name</label>
        <input className={inputClass} id="name" name="name" autoComplete="name" minLength={2} maxLength={80} required disabled={pending} />
      </div>}
      <div>
        <label htmlFor="email" className="block text-sm font-medium">Email address</label>
        <input className={inputClass} id="email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={pending} />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">Password</label>
        <input className={inputClass} id="password" name="password" type="password" autoComplete={register ? "new-password" : "current-password"}
          minLength={15} maxLength={128} required disabled={pending} aria-describedby={register ? "password-help" : undefined} />
        {register && <p id="password-help" className="mt-2 text-sm text-muted-foreground">Use 15–128 characters. A long, unique passphrase works well.</p>}
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-400 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {!register && <Link className="block text-sm underline underline-offset-4" href="/forgot-password">Forgot your password?</Link>}
      <button className="w-full rounded-lg bg-blue-700 px-4 py-3 font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Please wait…" : register ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-sm">
        {register ? "Already have an account? " : "New to TenantCore? "}
        <Link className="font-medium underline underline-offset-4" href={register ? "/login" : "/register"}>{register ? "Sign in" : "Create an account"}</Link>
      </p>
    </form>
  );
}
