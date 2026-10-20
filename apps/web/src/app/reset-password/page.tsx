import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { EmailActionForm } from "@/components/email-action-form";

export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <AuthShell title="Choose a new password" description="This will sign out every existing session for your account."><EmailActionForm mode="reset-password" /></AuthShell>;
}
