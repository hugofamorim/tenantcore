import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardPanel } from "./dashboard-panel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("administrative dashboard", () => {
  it("shows real zero counts and an explicit empty activity state, then refreshes", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              members: 0,
              membersByRole: { OWNER: 0, ADMIN: 0, MEMBER: 0, VIEWER: 0 },
              pendingInvitations: 0,
              recentActivity: [],
            }),
          ),
      );
    vi.stubGlobal("fetch", fetcher);
    render(<DashboardPanel organizationId="a" />);
    await screen.findByText("No recent activity.");
    expect(screen.getByRole("heading", { name: "Total members" })).toBeTruthy();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Refresh dashboard" }));
    await screen.findByText("No recent activity.");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("shows a forbidden state instead of metrics when the API denies access", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("private failure", { status: 403 })),
    );
    render(<DashboardPanel organizationId="a" />);
    await screen.findByRole("heading", { name: "Access denied" });
    expect(screen.queryByRole("heading", { name: "Total members" })).toBeNull();
    expect(screen.getByRole("alert").textContent).not.toContain(
      "private failure",
    );
  });
});
