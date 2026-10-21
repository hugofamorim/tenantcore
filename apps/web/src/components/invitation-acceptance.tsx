"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { currentUser, type PublicUser } from "@/lib/auth";
import { acceptInvitation } from "@/lib/members";

export function InvitationAcceptance() {
  const router = useRouter();
  const secret = useRef<string | null>(null);
  const [identity, setIdentity] = useState<PublicUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      const token = new URLSearchParams(window.location.hash.slice(1)).get(
        "token",
      );
      // Keep the secret only in memory. GET/prefetch and session checks never consume it.
      if (token) {
        secret.current = token;
        window.history.replaceState(null, "", window.location.pathname);
      }
      const user = await currentUser();
      if (active) {
        setIdentity(user);
        setLoaded(true);
      }
    }
    const reopen = () => {
      void load().catch(() => {
        if (active) {
          setLoaded(true);
          setError(
            "Could not check your account. Please reopen the invitation and try again.",
          );
        }
      });
    };
    reopen();
    window.addEventListener("hashchange", reopen);
    return () => {
      active = false;
      window.removeEventListener("hashchange", reopen);
    };
  }, []);
  async function accept() {
    setPending(true);
    setError("");
    try {
      if (!secret.current || !/^[A-Za-z0-9_-]{43}$/.test(secret.current))
        throw new Error(
          "This invitation is invalid or expired. Reopen the email link or ask for a new invitation.",
        );
      const id = await acceptInvitation(secret.current);
      secret.current = null;
      router.refresh();
      router.replace(`/organizations/${encodeURIComponent(id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
      setPending(false);
    }
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center p-6">
      <main className="w-full space-y-5 rounded-xl border border-border bg-card text-card-foreground p-6">
        <Link
          href="/"
          className="font-semibold text-primary"
        >
          TenantCore
        </Link>
        <h1 className="text-2xl font-semibold">
          Accept organization invitation
        </h1>
        {!loaded && <p role="status">Checking your account…</p>}
        {loaded && !identity && (
          <>
            <p>
              Sign in with the invited email address, or create and verify your
              account. Then reopen the invitation link from your email.
            </p>
            <div className="flex gap-5">
              <Link href="/login" className="underline">
                Sign in
              </Link>
              <Link href="/register" className="underline">
                Create account
              </Link>
            </div>
          </>
        )}
        {identity && !identity.emailVerifiedAt && (
          <>
            <p>
              Verify your email address before accepting. Then reopen the
              invitation link.
            </p>
            <Link href="/account" className="underline">
              Your account
            </Link>
          </>
        )}
        {identity?.emailVerifiedAt && (
          <>
            <p>
              You are signed in as{" "}
              <strong className="break-all">{identity.email}</strong>. Accepting
              adds this account to the organization with the role chosen by its
              manager.
            </p>
            <button
              onClick={() => void accept()}
              disabled={pending}
              className="w-full rounded-lg bg-blue-700 p-3 font-medium text-white disabled:opacity-60"
            >
              {pending ? "Accepting…" : "Accept invitation"}
            </button>
            <p className="text-sm text-muted-foreground">
              If this is the wrong account, sign out from your account page and
              sign in with the invited email, then reopen the email link.
            </p>
            <Link href="/account" className="inline-block underline">
              Your account
            </Link>
          </>
        )}
        {error && (
          <p role="alert" className="text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
