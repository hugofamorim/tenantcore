import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export default function RegisterPage() {
  return <AuthShell title="Create your account" description="Your personal identity, ready for your next workspace."><AuthForm mode="register" /></AuthShell>;
}
