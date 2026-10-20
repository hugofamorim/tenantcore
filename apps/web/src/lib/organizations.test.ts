import { describe, expect, it, vi } from "vitest";
import { getOrganization, listOrganizations, updateOrganization } from "./organizations";

describe("organization client boundaries", () => {
  it("addresses the organization in the URL and never an ambient header", async () => {
    const organization = { id: "org-id", name: "Acme", slug: "acme", role: "ADMIN", createdAt: "now", updatedAt: "now" };
    const fetch = vi.fn().mockResolvedValue(Response.json({ organization })); vi.stubGlobal("fetch", fetch);
    await updateOrganization("org-id", { name: "Acme", slug: "acme" });
    expect(fetch).toHaveBeenCalledWith("/api/organizations/org-id", expect.objectContaining({ method: "PATCH", headers: { "Content-Type": "application/json" }, cache: "no-store" }));
  });

  it("renews expired access before retrying a scoped request", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({ items: [], offset: 0, limit: 20, hasMore: false }));
    vi.stubGlobal("fetch", fetch);
    expect(await listOrganizations()).toEqual({ items: [], offset: 0, limit: 20, hasMore: false });
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/auth/refresh", expect.objectContaining({ method: "POST" }));
  });

  it("does not retry forbidden requests or expose backend error details", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('secret tenant info', { status: 403 })); vi.stubGlobal("fetch", fetch);
    await expect(getOrganization("foreign")).rejects.toThrow("do not have permission");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects unexpected server role data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ organization: { id: "id", name: "Name", slug: "slug", role: "SUPERUSER", createdAt: "now", updatedAt: "now" } })));
    await expect(getOrganization("id")).rejects.toThrow("Invalid organization response");
  });
});
