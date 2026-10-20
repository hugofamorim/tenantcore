import { Suspense } from "react";
import { OrganizationsPanel } from "@/components/organizations-panel";

async function Organization({ params }: PageProps<"/organizations/[organizationId]">) {
  const { organizationId } = await params;
  return <OrganizationsPanel key={organizationId} organizationId={organizationId} />;
}

export default function OrganizationPage(props: PageProps<"/organizations/[organizationId]">) {
  return <Suspense fallback={<p role="status" className="p-8">Loading your workspace…</p>}><Organization {...props} /></Suspense>;
}
