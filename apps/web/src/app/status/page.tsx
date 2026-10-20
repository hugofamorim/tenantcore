
import { Suspense } from 'react';
import { connection } from 'next/server';
import { getApiHealth, type HealthResponse } from '@/lib/api';

async function checkHealth(): Promise<HealthResponse | null> {
  await connection();

  try {
    return await getApiHealth();
  } catch {
    return null;
  }
}

async function StatusContent() {
  const health = await checkHealth();
  const isHealthy = health !== null;

  return (
    <div
      className={`rounded-xl border p-6 ${
        isHealthy
          ? 'border-green-500/30'
          : 'border-red-500/30'
      }`}
    >
      <p
        className={`font-semibold ${
          isHealthy ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {isHealthy
          ? 'All systems operational'
          : 'Service unavailable'}
      </p>

      {health ? (
        <dl className="mt-4 space-y-2">
          <div>
            <dt className="text-sm text-gray-500">API</dt>
            <dd>{health.service}</dd>
          </div>

        </dl>
      ) : (
        <p className="mt-2 text-sm text-gray-500">
          The service could not be reached. Please try again shortly.
        </p>
      )}
    </div>
  );
}

export default function StatusPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-3xl font-bold">
        TenantCore Status
      </h1>

      <Suspense
        fallback={
          <div className="rounded-xl border p-6">
            <p className="text-gray-500">
              Checking services...
            </p>
          </div>
        }
      >
        <StatusContent />
      </Suspense>
    </main>
  );
}
