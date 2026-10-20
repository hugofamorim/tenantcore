import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Organization } from "@/lib/organizations";
import { WorkspaceShell } from "./workspace-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/organizations/first/settings",
}));

const first: Organization = {
  id: "first",
  name: "Northstar",
  slug: "northstar",
  role: "OWNER",
  createdAt: "2026-10-20T00:00:00Z",
  updatedAt: "2026-10-20T00:00:00Z",
};
const second: Organization = {
  ...first,
  id: "second",
  name: "Harbor",
  slug: "harbor",
};

function setup(organization = first) {
  const onSelectOrganization = vi.fn();
  const onLoadMore = vi.fn();
  render(
    <WorkspaceShell
      user={{
        id: "owner",
        name: "Avery",
        email: "avery@example.test",
        emailVerifiedAt: first.createdAt,
      }}
      organization={organization}
      organizations={[organization, second]}
      hasMore
      pending={false}
      onSelectOrganization={onSelectOrganization}
      onLoadMore={onLoadMore}
      onSignOut={vi.fn()}
    >
      <h1>Workspace content</h1>
    </WorkspaceShell>,
  );
  return { onSelectOrganization, onLoadMore };
}

describe("workspace navigation", () => {
  it("marks the exact active page and exposes manager destinations", () => {
    setup();
    const navigation = within(
      screen.getByRole("navigation", { name: "Workspace navigation" }),
    );
    expect(navigation.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      navigation.getByRole("link", { name: "Overview" }),
    ).not.toHaveAttribute("aria-current");
    expect(navigation.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/organizations/first/dashboard",
    );
    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#workspace-content");
  });

  it("keeps manager links out of a viewer's navigation", () => {
    setup({ ...first, role: "VIEWER" });
    const navigation = within(
      screen.getByRole("navigation", { name: "Workspace navigation" }),
    );
    for (const name of ["Dashboard", "Members", "Invitations", "Audit log"]) {
      expect(navigation.queryByRole("link", { name })).toBeNull();
    }
    expect(navigation.getByRole("link", { name: "Settings" })).toBeVisible();
  });

  it("delegates tenant selection and pagination without storing tenant state", async () => {
    const { onSelectOrganization, onLoadMore } = setup();
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Active organization" }),
      "second",
    );
    expect(onSelectOrganization).toHaveBeenCalledWith("second");
    await user.click(
      screen.getByRole("button", { name: "Load more organizations" }),
    );
    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});
