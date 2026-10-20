import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AccountPanel } from "@/components/account-panel";

async function AccountSession() {
  const jar = await cookies();
  const prefix = process.env.NODE_ENV === "production" ? "__Host-" : "";
  // Optimistic redirect only. The API validates the session before exposing data.
  if (!jar.has(`${prefix}tc_access`) && !jar.has(`${prefix}tc_refresh`)) redirect("/login");
  return <AccountPanel />;
}

export default function AccountPage() {
  return <AuthShell title="Your account" description="Manage your TenantCore session.">
    <Suspense fallback={<p role="status">Loading your account…</p>}><AccountSession /></Suspense>
  </AuthShell>;
}
