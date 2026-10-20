"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronsUpDown,
  LayoutDashboard,
  Layers3,
  LogOut,
  Mail,
  Menu,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { PublicUser } from "@/lib/auth";
import type { Organization } from "@/lib/organizations";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeMenu } from "./theme-menu";

interface WorkspaceShellProps {
  user: PublicUser | null;
  organization: Organization | null;
  organizations: Organization[];
  hasMore: boolean;
  pending: boolean;
  onSelectOrganization: (id: string) => void;
  onLoadMore: () => void;
  onSignOut: () => void;
  children: ReactNode;
}

type SidebarProps = Omit<WorkspaceShellProps, "children"> & {
  onNavigate?: () => void;
};

function WorkspaceSidebar({
  user,
  organization,
  organizations,
  hasMore,
  pending,
  onSelectOrganization,
  onLoadMore,
  onSignOut,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const selectorId = useId();
  const organizationPath = organization
    ? `/organizations/${organization.id}`
    : "";
  const canManage =
    organization?.role === "OWNER" || organization?.role === "ADMIN";
  const links = [
    { href: "/organizations", label: "Organizations", icon: Building2 },
    ...(organization
      ? [
          { href: organizationPath, label: "Overview", icon: Layers3 },
          ...(canManage
            ? [
                {
                  href: `${organizationPath}/dashboard`,
                  label: "Dashboard",
                  icon: LayoutDashboard,
                },
              ]
            : []),
          {
            href: `${organizationPath}/settings`,
            label: "Settings",
            icon: Settings2,
          },
          ...(canManage
            ? [
                {
                  href: `${organizationPath}/members`,
                  label: "Members",
                  icon: Users,
                },
                {
                  href: `${organizationPath}/invitations`,
                  label: "Invitations",
                  icon: Mail,
                },
                {
                  href: `${organizationPath}/audit`,
                  label: "Audit log",
                  icon: Activity,
                },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-6 pb-7 pt-7">
        <Link
          href="/organizations"
          onClick={onNavigate}
          className="inline-flex items-center gap-3 rounded-md text-lg font-semibold tracking-tight text-foreground"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Layers3 className="size-5" aria-hidden="true" />
          </span>
          TenantCore
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">
          Your team. A shared workspace.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {organizations.length > 0 && (
          <div className="mb-7 rounded-xl border bg-background/70 p-3">
            <label
              htmlFor={selectorId}
              className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              Active organization
            </label>
            <div className="relative">
              <select
                id={selectorId}
                value={organization?.id ?? ""}
                className="w-full min-w-0 appearance-none rounded-md border border-input bg-card py-2.5 pl-3 pr-8 text-sm font-medium text-foreground"
                onChange={(event) => {
                  if (event.target.value) {
                    onSelectOrganization(event.target.value);
                    onNavigate?.();
                  }
                }}
              >
                <option value="" disabled>
                  Select an organization
                </option>
                {organizations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.slug}
                  </option>
                ))}
              </select>
              <ChevronsUpDown
                className="pointer-events-none absolute right-2.5 top-3 size-4 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            {hasMore && (
              <Button
                variant="link"
                size="sm"
                className="mt-1 h-auto p-0 text-xs"
                disabled={pending}
                onClick={onLoadMore}
              >
                Load more organizations
              </Button>
            )}
          </div>
        )}
        <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        <nav aria-label="Workspace navigation" className="space-y-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
                  active &&
                    "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
                {active && (
                  <span
                    className="ml-auto size-1.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 rounded-xl border border-dashed p-3.5">
          <ShieldCheck
            className="mb-2 size-4 text-primary"
            aria-hidden="true"
          />
          <p className="text-xs font-medium text-foreground">
            A role for every workspace
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Your access is specific to the organization you select.
          </p>
        </div>
      </div>

      {user && (
        <div className="border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start gap-3 px-2 py-3 text-left"
                aria-label="Account menu"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
                  aria-hidden="true"
                >
                  {user.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {user.name}
                  </span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                </span>
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-60">
              <DropdownMenuLabel>Your account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/account" onClick={onNavigate}>
                  Account settings
                  <ArrowUpRight className="ml-auto" aria-hidden="true" />
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={pending} onSelect={onSignOut}>
                <LogOut aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

export function WorkspaceShell({
  children,
  ...sidebarProps
}: WorkspaceShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#workspace-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <aside
        aria-label="Workspace sidebar"
        className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-sidebar-border lg:block"
      >
        <WorkspaceSidebar {...sidebarProps} />
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-20 items-center gap-3 border-b bg-card px-4 sm:px-8">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Open workspace navigation"
                className="shrink-0 lg:hidden"
              >
                <Menu className="size-4" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[min(20rem,calc(100vw-2rem))] gap-0 p-0"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Workspace navigation</SheetTitle>
                <SheetDescription>
                  Choose an organization or workspace page.
                </SheetDescription>
              </SheetHeader>
              <WorkspaceSidebar
                {...sidebarProps}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {sidebarProps.organization?.name ?? "Your workspaces"}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {sidebarProps.organization
                ? "Organization workspace"
                : "Organizations and access"}
            </p>
          </div>
          <ThemeMenu />
        </header>
        <main
          id="workspace-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl p-5 outline-none sm:p-8 xl:px-10 xl:py-9"
          aria-busy={sidebarProps.pending}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
