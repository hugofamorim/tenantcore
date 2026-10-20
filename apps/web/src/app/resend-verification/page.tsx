import { AuthShell } from "@/components/auth-shell";
import { EmailRequestForm } from "@/components/email-request-form";

export default function ResendVerificationPage() {
  return <AuthShell title="Verify your email" description="Request a fresh verification link."><EmailRequestForm mode="resend-verification" /></AuthShell>;
}
