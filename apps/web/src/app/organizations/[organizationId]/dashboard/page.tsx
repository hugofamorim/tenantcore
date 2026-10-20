import { Suspense } from 'react';
import { OrganizationsPanel } from '@/components/organizations-panel';

async function Dashboard({ params }: PageProps<'/organizations/[organizationId]/dashboard'>) {
  const { organizationId } = await params;
  return <OrganizationsPanel key={`${organizationId}-dashboard`} organizationId={organizationId} dashboard />;
}
export default function DashboardPage(props: PageProps<'/organizations/[organizationId]/dashboard'>) {
  return <Suspense fallback={<p role="status" className="p-8">Loading dashboard…</p>}><Dashboard {...props} /></Suspense>;
}
