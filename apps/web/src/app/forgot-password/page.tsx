import { AuthShell } from "@/components/auth-shell";
import { EmailRequestForm } from "@/components/email-request-form";

export default function ForgotPasswordPage() {
  return <AuthShell title="Recover your account" description="Request a link to choose a new password."><EmailRequestForm mode="forgot-password" /></AuthShell>;
}
