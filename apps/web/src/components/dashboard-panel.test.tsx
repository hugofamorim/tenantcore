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
    const fetcher = vi.fn().mockImplementation(
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

  it("replaces stale metrics with loading and removes them after a denied refresh", async () => {
    let finishRefresh: (response: Response) => void = () => {};
    const refresh = new Promise<Response>((resolve) => {
      finishRefresh = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              members: 1,
              membersByRole: { OWNER: 1, ADMIN: 0, MEMBER: 0, VIEWER: 0 },
              pendingInvitations: 0,
              recentActivity: [],
            }),
          ),
        )
        .mockReturnValueOnce(refresh),
    );
    render(<DashboardPanel organizationId="a" />);
    await screen.findByRole("heading", { name: "Total members" });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Refresh dashboard" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard");
    expect(screen.queryByRole("heading", { name: "Total members" })).toBeNull();
    finishRefresh(new Response("private failure", { status: 403 }));
    await screen.findByRole("heading", { name: "Access denied" });
    expect(screen.queryByRole("heading", { name: "Total members" })).toBeNull();
  });
});
