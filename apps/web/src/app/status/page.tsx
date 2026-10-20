
import { getApiHealth } from '@/lib/api';

export default async function StatusPage() {
  try {
    const health = await getApiHealth();

    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="mb-6 text-3xl font-bold">
          TenantCore Status
        </h1>

        <div className="rounded-xl border border-green-500/30 p-6">
          <p className="font-semibold text-green-600">
            All systems operational
          </p>

          <dl className="mt-4 space-y-2">
            <div>
              <dt className="text-sm text-gray-500">API</dt>
              <dd>{health.service}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Database</dt>
              <dd>{health.database}</dd>
            </div>
          </dl>
        </div>
      </main>
    );
  } catch {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="mb-6 text-3xl font-bold">
          TenantCore Status
        </h1>

        <div className="rounded-xl border border-red-500/30 p-6">
          <p className="font-semibold text-red-600">
            Service unavailable
          </p>

          <p className="mt-2 text-sm text-gray-500">
            The API or database could not be reached.
          </p>
        </div>
      </main>
    );
  }
}
