import { Suspense } from 'react';
import { OrganizationsPanel } from '@/components/organizations-panel';

async function Audit({ params }: PageProps<'/organizations/[organizationId]/audit'>) {
  const { organizationId } = await params;
  return <OrganizationsPanel key={`${organizationId}-audit`} organizationId={organizationId} section="audit" />;
}
export default function AuditPage(props: PageProps<'/organizations/[organizationId]/audit'>) {
  return <Suspense fallback={<p role="status" className="p-8">Loading audit log…</p>}><Audit {...props} /></Suspense>;
}
