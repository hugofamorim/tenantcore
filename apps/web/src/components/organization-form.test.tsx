import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OrganizationForm } from "./organization-form";
import type { Organization } from "@/lib/organizations";

const organization: Organization = { id: "id", name: "Acme", slug: "acme", role: "OWNER", createdAt: "2026-10-20T12:00:00Z", updatedAt: "2026-10-20T12:00:00Z" };

describe("organization forms", () => {
  it("creates a workspace with only its public input fields", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ organization }, { status: 201 })); vi.stubGlobal("fetch", fetch);
    const complete = vi.fn(); render(<OrganizationForm onComplete={complete} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Organization name"), "Acme");
    await user.type(screen.getByLabelText("Organization slug"), "acme");
    await user.click(screen.getByRole("button", { name: "Create organization" }));
    expect(complete).toHaveBeenCalledWith(organization);
    expect(fetch).toHaveBeenCalledWith("/api/organizations", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Acme", slug: "acme" }) }));
  });

  it.each(["MEMBER", "VIEWER"] as const)("renders read-only settings for %s", (role) => {
    render(<OrganizationForm existing={{ ...organization, role }} onComplete={vi.fn()} />);
    expect(screen.getByLabelText("Organization name")).toBeDisabled();
    expect(screen.getByLabelText("Organization slug")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("owner or admin");
  });

  it("keeps entered values and shows a safe slug conflict", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('internal tenant data', { status: 409 })));
    const complete = vi.fn(); render(<OrganizationForm existing={organization} onComplete={complete} />);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("slug is unavailable");
    expect(screen.getByLabelText("Organization name")).toHaveValue("Acme");
    expect(complete).not.toHaveBeenCalled(); expect(screen.queryByText(/internal tenant/)).not.toBeInTheDocument();
  });
});
