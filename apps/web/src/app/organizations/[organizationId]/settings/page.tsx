import { Suspense } from "react";
import { OrganizationsPanel } from "@/components/organizations-panel";

async function Settings({ params }: PageProps<"/organizations/[organizationId]/settings">) {
  const { organizationId } = await params;
  return <OrganizationsPanel key={`${organizationId}-settings`} organizationId={organizationId} settings />;
}

export default function OrganizationSettingsPage(props: PageProps<"/organizations/[organizationId]/settings">) {
  return <Suspense fallback={<p role="status" className="p-8">Loading settings…</p>}><Settings {...props} /></Suspense>;
}
