import { describe, expect, it, vi } from "vitest";
import { authMutation, currentUser, renewSession } from "./auth";

describe("session client", () => {
  it("shares one in-flight refresh between callers", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    await Promise.all([renewSession(), renewSession()]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("renews expired access before re-reading the user", async () => {
    const user = { id: "user-id", name: "User", email: "user@example.test", emailVerifiedAt: null };
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({ user }));
    vi.stubGlobal("fetch", fetch);
    expect(await currentUser()).toEqual(user);
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/auth/refresh", expect.objectContaining({ method: "POST" }));
  });

  it("returns unauthenticated when refresh is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    expect(await currentUser()).toBeNull();
  });

  it("provides rate-limit feedback without exposing internal details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    await expect(authMutation("login", {})).rejects.toThrow("wait a minute");
  });
});
