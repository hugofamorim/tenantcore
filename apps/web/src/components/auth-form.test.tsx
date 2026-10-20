import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("@/lib/auth-navigation", () => ({ navigateAfterAuth: replace }));

describe("account forms", () => {
  it("submits a registration with accessible fields and safe confirmation", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetch);
    render(<AuthForm mode="register" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Full name"), "Test User");
    await user.type(screen.getByLabelText("Email address"), "user@example.test");
    await user.type(screen.getByLabelText("Password"), "a long test passphrase");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If this email is available");
    expect(fetch).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({ method: "POST", credentials: "same-origin" }));
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows safe errors without exposing the API response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"passwordHash":"secret"}', { status: 401 })));
    render(<AuthForm mode="login" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email address"), "user@example.test");
    await user.type(screen.getByLabelText("Password"), "a wrong long passphrase");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("was not accepted");
    expect(screen.queryByText(/secret/)).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("navigates to the account after a successful login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    render(<AuthForm mode="login" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email address"), "user@example.test");
    await user.type(screen.getByLabelText("Password"), "a long test passphrase");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(replace).toHaveBeenCalledWith("/account");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });
});
