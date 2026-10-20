import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { EmailActionForm } from "@/components/email-action-form";

export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };

export default function VerifyEmailPage() {
  return <AuthShell title="Confirm your email" description="Confirm that this address belongs to you. The link can be used once."><EmailActionForm mode="verify-email" /></AuthShell>;
}
