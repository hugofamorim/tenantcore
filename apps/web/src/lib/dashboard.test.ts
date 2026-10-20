import { afterEach, describe, expect, it, vi } from "vitest";
import { getDashboard } from "./dashboard";

const payload = {
  members: 2,
  pendingInvitations: 1,
  membersByRole: { OWNER: 1, ADMIN: 0, MEMBER: 0, VIEWER: 1 },
  recentActivity: [],
};
afterEach(() => vi.unstubAllGlobals());
describe("dashboard contract and tenant scope", () => {
  it("loads the selected tenant with no-store and no client role claim", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(payload)));
    vi.stubGlobal("fetch", fetcher);
    expect(await getDashboard("tenant-a")).toEqual(payload);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/organizations/tenant-a/dashboard",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      }),
    );
  });
  it.each([
    { ...payload, members: -1 },
    { ...payload, members: 99 },
    { ...payload, membersByRole: { OWNER: 2 } },
  ])("rejects invalid or inconsistent metric responses %#", async (data) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(data))),
    );
    await expect(getDashboard("tenant-a")).rejects.toThrow();
  });
});
