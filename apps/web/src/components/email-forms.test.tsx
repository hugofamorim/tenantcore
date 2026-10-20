import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmailRequestForm } from "./email-request-form";
import { EmailActionForm } from "./email-action-form";

describe("email identity forms", () => {
  it("shows a generic recovery confirmation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 202 })));
    render(<EmailRequestForm mode="forgot-password" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email address"), "user@example.test");
    await user.click(screen.getByRole("button", { name: "Send recovery email" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If this account is eligible");
  });

  it("requires explicit confirmation and removes the fragment after verification", async () => {
    window.history.replaceState(null, "", `/verify-email#token=${"a".repeat(43)}`);
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    render(<EmailActionForm mode="verify-email" />);
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Verify email address" }));
    expect(await screen.findByRole("status")).toHaveTextContent("now verified");
    expect(window.location.hash).toBe("");
    expect(window.localStorage.length).toBe(0);
  });

  it("rejects a missing token without submitting a request", async () => {
    window.history.replaceState(null, "", "/verify-email");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    render(<EmailActionForm mode="verify-email" />);
    await userEvent.click(screen.getByRole("button", { name: "Verify email address" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid or expired");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("checks password confirmation and reports rejected links safely", async () => {
    window.history.replaceState(null, "", `/reset-password#token=${"b".repeat(43)}`);
    const fetch = vi.fn().mockResolvedValue(new Response('internal details', { status: 400 })); vi.stubGlobal("fetch", fetch);
    render(<EmailActionForm mode="reset-password" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New password", { exact: true }), "a long test passphrase");
    await user.type(screen.getByLabelText("Confirm new password"), "a different long phrase");
    await user.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("do not match");
    expect(fetch).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Confirm new password"));
    await user.type(screen.getByLabelText("Confirm new password"), "a long test passphrase");
    await user.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid or expired");
    expect(screen.queryByText(/internal details/)).not.toBeInTheDocument();
  });
});
