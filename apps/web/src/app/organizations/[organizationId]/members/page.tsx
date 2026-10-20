import { Suspense } from 'react';
import { OrganizationsPanel } from '@/components/organizations-panel';

async function Members({ params }: PageProps<'/organizations/[organizationId]/members'>) {
  const { organizationId } = await params;
  return <OrganizationsPanel key={`${organizationId}-members`} organizationId={organizationId} section="members" />;
}
export default function MembersPage(props: PageProps<'/organizations/[organizationId]/members'>) {
  return <Suspense fallback={<p role="status" className="p-8">Loading members…</p>}><Members {...props} /></Suspense>;
}
