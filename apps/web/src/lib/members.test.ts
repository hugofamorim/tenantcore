import { afterEach, describe, expect, it, vi } from "vitest";
import { acceptInvitation, listMembers, membershipRequest } from "./members";

afterEach(() => vi.unstubAllGlobals());
describe("membership HTTP client", () => {
  it("scopes member filters to the URL tenant without trusting ambient headers", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [], limit: 20, offset: 0, hasMore: false }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    await listMembers("tenant-a", 0, "a+b@example.test");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/organizations/tenant-a/members?limit=20&offset=0&search=a%2Bb%40example.test",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        method: "GET",
      }),
    );
  });
  it("sends acceptance secret only in a JSON POST with no caller-supplied tenant or role", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ organizationId: "server-tenant" })),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await acceptInvitation("one-use-secret")).toBe("server-tenant");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/invitations/accept",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "one-use-secret" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  it("sends JSON on destructive requests and accepts an empty 204 response", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      membershipRequest("/organizations/a/members/b", "DELETE"),
    ).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  it("does not retry authorization errors or reveal transport details", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("private diagnostic", { status: 403 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(listMembers("a")).rejects.toThrow(
      "You do not have permission",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects unknown roles instead of granting an assumed permission", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: "a",
                  role: "SUPERADMIN",
                  user: { id: "u", email: "u@example.test", name: "User" },
                  createdAt: "",
                },
              ],
              limit: 20,
              offset: 0,
              hasMore: false,
            }),
          ),
        ),
    );
    await expect(listMembers("a")).rejects.toThrow("Invalid role");
  });
});
