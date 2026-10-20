import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MembershipPanel } from "./membership-panel";
import type { Organization } from "@/lib/organizations";

const organization: Organization = {
  id: "org",
  name: "Workspace",
  slug: "workspace",
  role: "ADMIN",
  createdAt: "",
  updatedAt: "",
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("organization management interface", () => {
  it("limits administrator invitations to MEMBER/VIEWER and submits only email and role", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(
        async (_url: string, init: RequestInit) =>
          new Response(
            JSON.stringify(
              init.method === "POST"
                ? {}
                : { items: [], offset: 0, limit: 20, hasMore: false },
            ),
          ),
      );
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(
      <MembershipPanel
        organization={organization}
        userId="self"
        section="invitations"
      />,
    );
    await screen.findByText("No invitations yet.");
    expect(screen.queryByRole("option", { name: "ADMIN" })).toBeNull();
    expect(screen.queryByRole("option", { name: "OWNER" })).toBeNull();
    await user.type(
      screen.getByLabelText("Invited email address"),
      "new@example.test",
    );
    await user.selectOptions(
      screen.getByLabelText("Invitation role"),
      "VIEWER",
    );
    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    await screen.findByText(/Invitation sent/);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/organizations/org/invitations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "new@example.test", role: "VIEWER" }),
      }),
    );
  });
  it("keeps current owner and administrator memberships out of administrator controls", async () => {
    const members = [
      {
        id: "o",
        role: "OWNER",
        user: { id: "owner", name: "Owner", email: "owner@example.test" },
        createdAt: "",
      },
      {
        id: "a",
        role: "ADMIN",
        user: { id: "self", name: "Admin", email: "admin@example.test" },
        createdAt: "",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              items: members,
              offset: 0,
              limit: 20,
              hasMore: false,
            }),
          ),
        ),
    );
    render(
      <MembershipPanel
        organization={organization}
        userId="self"
        section="members"
      />,
    );
    await screen.findByText("owner@example.test");
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Transfer ownership" }),
    ).toBeNull();
    expect(screen.getByText("Your membership")).toBeTruthy();
  });
  it("keeps search results rather than replacing them with an unfiltered refresh", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ items: [], offset: 0, limit: 20, hasMore: false }),
          ),
      );
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(
      <MembershipPanel
        organization={organization}
        userId="self"
        section="members"
      />,
    );
    await screen.findByText("No members match this filter.");
    await user.type(screen.getByLabelText("Find a member"), "viewer");
    await user.click(screen.getByRole("button", { name: "Search members" }));
    await screen.findByText("Member filter updated.");
    expect(fetcher.mock.calls.at(-1)?.[0]).toContain("search=viewer");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
