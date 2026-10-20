import { Suspense } from 'react';
import { OrganizationsPanel } from '@/components/organizations-panel';

async function Invitations({ params }: PageProps<'/organizations/[organizationId]/invitations'>) {
  const { organizationId } = await params;
  return <OrganizationsPanel key={`${organizationId}-invitations`} organizationId={organizationId} section="invitations" />;
}
export default function InvitationsPage(props: PageProps<'/organizations/[organizationId]/invitations'>) {
  return <Suspense fallback={<p role="status" className="p-8">Loading invitations…</p>}><Invitations {...props} /></Suspense>;
}
