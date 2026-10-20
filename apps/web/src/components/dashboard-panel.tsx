"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Mail,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  LazyMotion,
  domAnimation,
  m,
  MotionConfig,
  useReducedMotion,
} from "motion/react";
import { getDashboard, type Dashboard } from "@/lib/dashboard";
import { MembershipRequestError } from "@/lib/members";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessProblem } from "./access-problem";

const activityLabels: Record<string, string> = {
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

const roleDescriptions = {
  OWNER: "Workspace ownership",
  ADMIN: "Team administration",
  MEMBER: "Workspace membership",
  VIEWER: "Read-only access",
};
const organizationRoles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;

function MetricCard({
  title,
  value,
  description,
  href,
  linkLabel,
  icon,
}: {
  title: string;
  value: number;
  description: string;
  href: string;
  linkLabel: string;
  icon: ReactNode;
}) {
  return (
    <article>
      <Card className="h-full gap-4 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-accent text-primary">
            {icon}
          </span>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          <Link
            href={href}
            className="mt-5 inline-flex items-center gap-2 rounded-sm text-sm font-medium text-primary hover:underline"
          >
            {linkLabel}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>
    </article>
  );
}

function DashboardLoading() {
  return (
    <div>
      <p role="status" className="mb-4 text-sm text-muted-foreground">
        Loading dashboard…
      </p>
      <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2">
        {[0, 1].map((item) => (
          <Card key={item} className="gap-4 shadow-xs">
            <CardContent className="space-y-5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-28" />
            </CardContent>
          </Card>
        ))}
        <Skeleton className="h-80 rounded-xl sm:col-span-2" />
      </div>
    </div>
  );
}

function DashboardContent({
  data,
  organizationId,
}: {
  data: Dashboard;
  organizationId: string;
}) {
  const reduceMotion = useReducedMotion();
  const organizationPath = `/organizations/${organizationId}`;

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <m.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          className="space-y-6"
        >
          <section
            aria-label="Organization metrics"
            className="grid gap-5 sm:grid-cols-2"
          >
            <MetricCard
              title="Total members"
              value={data.members}
              description="People with access to this workspace."
              href={`${organizationPath}/members`}
              linkLabel="Manage members"
              icon={<Users className="size-5" aria-hidden="true" />}
            />
            <MetricCard
              title="Pending invitations"
              value={data.pendingInvitations}
              description="Pending records whose links have not expired."
              href={`${organizationPath}/invitations`}
              linkLabel="Manage invitations"
              icon={<Mail className="size-5" aria-hidden="true" />}
            />
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card className="min-w-0 gap-0 shadow-xs">
              <CardHeader className="gap-3 border-b pb-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <Activity
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Recent activity
                  </h2>
                  <Link
                    href={`${organizationPath}/audit`}
                    className="rounded-sm text-xs font-medium text-primary hover:underline"
                  >
                    View audit log
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground">
                  The latest changes in your organization.
                </p>
              </CardHeader>
              <CardContent className="pt-2">
                {data.recentActivity.length ? (
                  <ol aria-label="Recent activity" className="divide-y">
                    {data.recentActivity.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 py-5">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
                          <Activity
                            className="size-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {activityLabels[item.action] ??
                              "Organization activity"}
                          </p>
                          <time
                            className="mt-1 block text-xs leading-5 text-muted-foreground"
                            dateTime={item.createdAt}
                          >
                            {new Date(item.createdAt).toLocaleString()}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="py-10 text-center">
                    <Activity
                      className="mx-auto mb-3 size-6 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-medium">No recent activity.</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Organization changes will appear here.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 gap-0 shadow-xs">
              <CardHeader className="gap-3 border-b pb-5">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <ShieldCheck
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Members by role
                </h2>
                <p className="text-sm text-muted-foreground">
                  Access within this workspace.
                </p>
              </CardHeader>
              <CardContent className="pt-1">
                <dl className="divide-y">
                  {organizationRoles.map((role) => (
                    <div
                      key={role}
                      className="flex items-center justify-between gap-4 py-4"
                    >
                      <dt>
                        <span className="block text-xs font-semibold tracking-wide">
                          {role}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {roleDescriptions[role]}
                        </span>
                      </dt>
                      <dd className="rounded-md bg-muted px-2.5 py-1 text-sm font-semibold tabular-nums">
                        {data.membersByRole[role]}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </div>
        </m.div>
      </MotionConfig>
    </LazyMotion>
  );
}

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

  function refresh() {
    setPending(true);
    setError(null);
    setRevision((value) => value + 1);
  }

  return (
    <div className="space-y-6" aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          A clear view of your team, access and recent changes.
        </p>
        <Button variant="outline" disabled={pending} onClick={refresh}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh dashboard
        </Button>
      </div>
      {pending && <DashboardLoading />}
      {error && <AccessProblem status={error.status} message={error.message} />}
      {data && !pending && !error && (
        <DashboardContent data={data} organizationId={organizationId} />
      )}
    </div>
  );
}
