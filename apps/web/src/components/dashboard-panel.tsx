"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDashboard, type Dashboard } from "@/lib/dashboard";
import { MembershipRequestError } from "@/lib/members";
import { AccessProblem } from "./access-problem";

const labels: Record<string, string> = {
  "organization.created": "Organization created",
  "organization.updated": "Organization settings updated",
  "invitation.created": "Invitation created",
  "invitation.accepted": "Invitation accepted",
  "invitation.reissued": "Invitation reissued",
  "invitation.revoked": "Invitation revoked",
  "invitation.expired": "Invitation expired",
  "invitation.delivery_failed": "Invitation delivery failed",
  "membership.role_changed": "Member role changed",
  "membership.removed": "Member removed",
  "organization.ownership_transferred": "Ownership transferred",
  "demo.initialized": "Fictional demo initialized",
};
export function DashboardPanel({ organizationId }: { organizationId: string }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<{
    message: string;
    status?: number;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(true);
  useEffect(() => {
    let active = true;
    getDashboard(organizationId)
      .then((value) => {
        if (active) {
          setData(value);
          setError(null);
          setPending(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setData(null);
          setError({
            message:
              cause instanceof Error ? cause.message : "Please try again.",
            status:
              cause instanceof MembershipRequestError
                ? cause.status
                : undefined,
          });
          setPending(false);
        }
      });
    return () => {
      active = false;
    };
  }, [organizationId, revision]);
  return (
    <div className="space-y-7" aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Live organization metrics. Refresh to load the latest activity.
        </p>
        <button
          disabled={pending}
          className="rounded-lg border border-zinc-400 px-4 py-2 text-sm disabled:opacity-50"
          onClick={() => {
            setPending(true);
            setRevision((value) => value + 1);
          }}
        >
          Refresh dashboard
        </button>
      </div>
      {pending && <p role="status">Loading dashboard…</p>}
      {error && <AccessProblem status={error.status} message={error.message} />}
      {data && !error && (
        <>
          <section
            aria-label="Organization metrics"
            className="grid gap-4 sm:grid-cols-2"
          >
            <article className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Total members
              </h2>
              <p className="mt-3 text-4xl font-semibold tabular-nums">
                {data.members}
              </p>
              <Link
                href={`/organizations/${organizationId}/members`}
                className="mt-4 inline-block text-sm text-blue-700 underline dark:text-blue-300"
              >
                Manage members
              </Link>
            </article>
            <article className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Pending invitations
              </h2>
              <p className="mt-3 text-4xl font-semibold tabular-nums">
                {data.pendingInvitations}
              </p>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                Pending records whose links have not expired.
              </p>
              <Link
                href={`/organizations/${organizationId}/invitations`}
                className="mt-3 inline-block text-sm text-blue-700 underline dark:text-blue-300"
              >
                Manage invitations
              </Link>
            </article>
          </section>
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Members by role</h2>
            <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
              {Object.entries(data.membersByRole).map(([role, total]) => (
                <div key={role}>
                  <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {role}
                  </dt>
                  <dd className="mt-2 text-2xl font-semibold tabular-nums">
                    {total}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <Link
                href={`/organizations/${organizationId}/audit`}
                className="text-sm text-blue-700 underline dark:text-blue-300"
              >
                View audit log
              </Link>
            </div>
            {data.recentActivity.length ? (
              <ol
                aria-label="Recent activity"
                className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-700"
              >
                {data.recentActivity.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap justify-between gap-3 py-4 text-sm"
                  >
                    <p>{labels[item.action] ?? "Organization activity"}</p>
                    <time
                      className="text-zinc-600 dark:text-zinc-400"
                      dateTime={item.createdAt}
                    >
                      {new Date(item.createdAt).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                No recent activity.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
