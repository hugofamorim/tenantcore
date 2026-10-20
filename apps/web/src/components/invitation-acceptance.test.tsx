import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { InvitationAcceptance } from "./invitation-acceptance";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});
describe("invitation link handling", () => {
  it("clears the fragment before any identity request and never consumes on GET", async () => {
    const token = "a".repeat(43);
    window.history.replaceState(null, "", `/invitations/accept#token=${token}`);
    const fetcher = vi.fn().mockImplementation(async () => {
      expect(window.location.hash).toBe("");
      return new Response(
        JSON.stringify({
          user: {
            id: "u",
            name: "User",
            email: "invited@example.test",
            emailVerifiedAt: "2026-10-20",
          },
        }),
      );
    });
    vi.stubGlobal("fetch", fetcher);
    render(<InvitationAcceptance />);
    await screen.findByText("invited@example.test");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("/api/auth/me");
    expect(
      screen.getByRole("button", { name: "Accept invitation" }),
    ).toBeTruthy();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
  it("rechecks the signed-in account when an invitation is reopened in the same tab", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    window.history.replaceState(
      null,
      "",
      `/invitations/accept#token=${"a".repeat(43)}`,
    );
    render(<InvitationAcceptance />);
    await screen.findByRole("link", { name: "Create account" });
    fetcher.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            user: {
              id: "u",
              name: "User",
              email: "new@example.test",
              emailVerifiedAt: "2026-10-20",
            },
          }),
        ),
    );
    window.history.replaceState(
      null,
      "",
      `/invitations/accept#token=${"b".repeat(43)}`,
    );
    fireEvent(window, new HashChangeEvent("hashchange"));
    await screen.findByText("new@example.test");
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(
      fetcher.mock.calls.some(([url]) => url === "/api/invitations/accept"),
    ).toBe(false);
  });
});
