"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authMutation, currentUser, type PublicUser } from "@/lib/auth";
import { navigateAfterAuth } from "@/lib/auth-navigation";
import {
  getOrganization,
  listOrganizations,
  OrganizationRequestError,
  type Organization,
  type OrganizationPage,
} from "@/lib/organizations";
import { OrganizationForm } from "./organization-form";
import { MembershipPanel, type ManagementSection } from "./membership-panel";
import { DashboardPanel } from "./dashboard-panel";
import { Badge } from "@/components/ui/badge";
import { WorkspaceShell } from "./workspace-shell";
import { AccessProblem } from "./access-problem";

export function OrganizationsPanel({
  organizationId,
  settings = false,
  section,
  dashboard = false,
}: {
  organizationId?: string;
  settings?: boolean;
  section?: ManagementSection;
  dashboard?: boolean;
}) {
  const router = useRouter();

  const [user, setUser] = useState<PublicUser | null>(null);
  const [page, setPage] = useState<OrganizationPage | null>(null);
  const [selected, setSelected] = useState<Organization | null>(null);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number>();
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const identity = await currentUser();
      if (!active) return;
      if (!identity) {
        navigateAfterAuth("/login");
        return;
      }
      setUser(identity);
      if (!identity.emailVerifiedAt) return;
      const [memberships, organization] = await Promise.all([
        listOrganizations(),
        organizationId
          ? getOrganization(organizationId)
          : Promise.resolve(null),
      ]);
      if (active) {
        setPage(memberships);
        setSelected(organization);
      }
    }
    void load().catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof OrganizationRequestError && cause.status === 401)
        navigateAfterAuth("/login");
      else {
        setError(cause instanceof Error ? cause.message : "Please try again.");
        setErrorStatus(
          cause instanceof OrganizationRequestError ? cause.status : undefined,
        );
      }
    });
    return () => {
      active = false;
    };
  }, [organizationId]);

  async function more() {
    if (!page) return;
    setPending(true);
    setError("");
    try {
      const next = await listOrganizations(page.offset + page.limit);
      setPage({
        ...next,
        items: [
          ...page.items,
          ...next.items.filter(
            (item) => !page.items.some((prior) => prior.id === item.id),
          ),
        ],
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    setError("");
    try {
      await authMutation("logout");
      navigateAfterAuth("/login");
    } catch {
      setPending(false);
      setError("Could not sign out. Please try again.");
    }
  }

  function saved(organization: Organization) {
    setSelected(organization);
    setNotice("Organization settings updated.");
    setPage((prior) =>
      prior
        ? {
            ...prior,
            items: prior.items.map((item) =>
              item.id === organization.id ? organization : item,
            ),
          }
        : prior,
    );
  }

  const options = page?.items ?? [];
  const choices =
    selected && !options.some((item) => item.id === selected.id)
      ? [selected, ...options]
      : options;
  return (
    <WorkspaceShell
      user={user}
      organization={selected}
      organizations={choices}
      hasMore={page?.hasMore ?? false}
      pending={pending}
      onSelectOrganization={(id) => router.push(`/organizations/${id}`)}
      onLoadMore={() => void more()}
      onSignOut={() => void logout()}
    >
      {error && (
        <div className="mb-6">
          <AccessProblem status={errorStatus} message={error} />
          <button
            className="mt-3 text-sm underline"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-green-500 p-3 text-sm"
        >
          {notice}
        </p>
      )}
      {!user && !error && <p role="status">Loading your workspace…</p>}
      {user && !user.emailVerifiedAt && (
        <section className="rounded-xl border border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h1 className="text-2xl font-semibold">Verify your email</h1>
          <p className="mt-3">
            Confirm your email address before creating or accessing
            organizations.
          </p>
          <Link
            href="/account"
            className="mt-5 inline-block text-blue-700 underline dark:text-blue-300"
          >
            Go to your account to verify
          </Link>
        </section>
      )}
      {user?.emailVerifiedAt && !page && !error && (
        <p role="status">Loading organizations…</p>
      )}
      {page && !organizationId && (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">
            Your organizations
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Choose a workspace or create a new one.
          </p>
          <section
            aria-label="Organization list"
            className="mt-7 grid gap-4 sm:grid-cols-2"
          >
            {page.items.map((item) => (
              <Link
                key={item.id}
                href={`/organizations/${item.id}`}
                className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <h2 className="text-lg font-semibold">{item.name}</h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {item.slug}
                </p>
                <span className="mt-4 inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium dark:bg-zinc-800">
                  {item.role}
                </span>
              </Link>
            ))}
            {page.items.length === 0 && (
              <p className="text-zinc-600 dark:text-zinc-400">
                You have no organizations yet. Create your first workspace
                below.
              </p>
            )}
          </section>
          <section
            className="mt-9 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900"
            aria-labelledby="create-heading"
          >
            <h2 id="create-heading" className="mb-5 text-xl font-semibold">
              Create an organization
            </h2>
            <OrganizationForm
              onComplete={(organization) =>
                router.push(`/organizations/${organization.id}`)
              }
            />
          </section>
        </>
      )}
      {selected && (
        <>
          <div className="mb-7 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {dashboard
                ? "Dashboard"
                : section
                  ? section === "audit"
                    ? "Audit log"
                    : section === "members"
                      ? "Organization members"
                      : "Organization invitations"
                  : settings
                    ? "Organization settings"
                    : selected.name}
            </h1>
            <Badge
              variant="secondary"
              className="border border-primary/10 bg-accent text-accent-foreground"
            >
              {selected.role}
            </Badge>
          </div>
          {dashboard ? (
            <DashboardPanel key={selected.id} organizationId={selected.id} />
          ) : section && user ? (
            <MembershipPanel
              key={`${selected.id}-${section}`}
              organization={selected}
              userId={user.id}
              section={section}
            />
          ) : settings ? (
            <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
              <OrganizationForm
                key={selected.updatedAt}
                existing={selected}
                onComplete={saved}
              />
            </section>
          ) : (
            <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold">Organization details</h2>
              <dl className="mt-5 space-y-4">
                <div>
                  <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                    Slug
                  </dt>
                  <dd className="mt-1">{selected.slug}</dd>
                </div>
                <div>
                  <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                    Your role
                  </dt>
                  <dd className="mt-1">{selected.role}</dd>
                </div>
                <div>
                  <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                    Created
                  </dt>
                  <dd className="mt-1">
                    {new Date(selected.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/organizations/${selected.id}/settings`}
                className="mt-6 inline-block font-medium text-blue-700 underline dark:text-blue-300"
              >
                View settings
              </Link>
            </section>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}
