import { expect, test, type BrowserContext } from "@playwright/test";
import { emailFragment } from "./helpers/mailpit";

test("invited new account, limited access, member lifecycle, atomic ownership and tenant audit", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120_000);
  const unique = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const ownerEmail = `m3-owner-${unique}@example.test`;
  const invitedEmail = `m3-invited-${unique}@example.test`;
  const password = "a membership browser test passphrase";
  const headers = { Origin: "http://127.0.0.1:3300" };
  async function account(client: BrowserContext, email: string, name: string) {
    expect(
      (
        await client.request.post("/api/auth/register", {
          headers,
          data: { email, name, password },
        })
      ).status(),
    ).toBe(202);
    const fragment = await emailFragment(email, "Verify your TenantCore email");
    expect(
      (
        await client.request.post("/api/auth/verify-email", {
          headers,
          data: { token: new URLSearchParams(fragment.slice(1)).get("token") },
        })
      ).status(),
    ).toBe(204);
    expect(
      (
        await client.request.post("/api/auth/login", {
          headers,
          data: { email, password },
        })
      ).status(),
    ).toBe(204);
  }
  await account(context, ownerEmail, "Workspace Owner");
  const response = await context.request.post("/api/organizations", {
    headers,
    data: { name: "Collaboration Studio", slug: `m3-${unique}` },
  });
  expect(response.status()).toBe(201);
  const { organization } = (await response.json()) as {
    organization: { id: string };
  };
  const base = `/organizations/${organization.id}`;
  await page.goto(`${base}/invitations`);
  await page.getByLabel("Invited email address").fill(invitedEmail);
  await page.getByLabel("Invitation role").selectOption("VIEWER");
  await page
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Invitation sent");
  const fragment = await emailFragment(
    invitedEmail,
    "Your TenantCore organization invitation",
  );
  const invited = await browser.newContext({
    baseURL: "http://127.0.0.1:3300",
  });
  try {
    const guest = await invited.newPage();
    await guest.goto(`/invitations/accept${fragment}`);
    await expect(
      guest.getByRole("link", { name: "Create account", exact: true }),
    ).toBeVisible();
    expect(new URL(guest.url()).hash).toBe("");
    await account(invited, invitedEmail, "Invited Collaborator");
    await guest.goto(base);
    await expect(guest.getByRole("main").getByRole("alert")).toContainText(
      "Organization not found",
    );
    await guest.goto(`/invitations/accept${fragment}`);
    await expect(guest.getByText(invitedEmail, { exact: true })).toBeVisible();
    expect(new URL(guest.url()).hash).toBe("");
    await guest
      .getByRole("button", { name: "Accept invitation", exact: true })
      .click();
    await expect(
      guest.getByRole("heading", { name: "Collaboration Studio", exact: true }),
    ).toBeVisible();
    expect((await invited.request.get(`/api${base}/members`)).status()).toBe(
      403,
    );
    expect(
      (
        await invited.request.patch(`/api${base}`, {
          headers,
          data: { name: "Forbidden edit" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await invited.request.post("/api/invitations/accept", {
          headers,
          data: { token: new URLSearchParams(fragment.slice(1)).get("token") },
        })
      ).status(),
    ).toBe(400);
    await guest.goto(`${base}/settings`);
    await expect(
      guest.getByRole("textbox", { name: "Organization name", exact: true }),
    ).toBeDisabled();

    await page.goto(`${base}/members`);
    let row = page.getByRole("row").filter({ hasText: invitedEmail });
    await expect(row).toBeVisible();
    await row.getByRole("combobox").selectOption("MEMBER");
    await row.getByRole("button", { name: "Save role" }).click();
    let dialog = page.getByRole("dialog", { name: "Change member role" });
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(
      row.getByRole("cell", { name: "VIEWER", exact: true }),
    ).toBeVisible();
    await row.getByRole("button", { name: "Save role" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(
      row.getByRole("cell", { name: "MEMBER", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Find a member").fill("Invited Collaborator");
    await page.getByRole("button", { name: "Search members" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Member filter updated",
    );
    await expect(
      page.getByRole("row").filter({ hasText: ownerEmail }),
    ).toHaveCount(0);
    await page.getByLabel("Find a member").fill("");
    await page.getByRole("button", { name: "Search members" }).click();
    await expect(
      page.getByRole("row").filter({ hasText: ownerEmail }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/members.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/members-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 720 });

    row = page.getByRole("row").filter({ hasText: invitedEmail });
    await row.getByRole("button", { name: "Transfer ownership" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "You will become ADMIN",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: ownerEmail })
        .getByRole("cell", { name: "ADMIN", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: invitedEmail })
        .getByRole("cell", { name: "OWNER", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Transfer ownership" }),
    ).toHaveCount(0);
    await guest.goto(`${base}/members`);
    await guest
      .getByRole("row")
      .filter({ hasText: ownerEmail })
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await guest
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(guest.getByRole("status")).toContainText(
      "Organization updated",
    );
    expect((await context.request.get(`/api${base}`)).status()).toBe(404);
    await guest.goto(`${base}/audit`);
    for (const action of [
      "invitation.created",
      "invitation.accepted",
      "membership.role_changed",
      "organization.ownership_transferred",
      "membership.removed",
    ])
      await expect(
        guest.getByRole("heading", { name: action, exact: true }),
      ).toBeVisible();

    await guest.goto(`${base}/invitations`);
    await guest
      .getByLabel("Invited email address")
      .fill(`next-${unique}@example.test`);
    await guest
      .getByRole("button", { name: "Send invitation", exact: true })
      .click();
    await expect(guest.getByRole("status")).toContainText("Invitation sent");
    row = guest
      .getByRole("row")
      .filter({ hasText: `next-${unique}@example.test` });
    await row.getByRole("button", { name: "Reissue", exact: true }).click();
    dialog = guest.getByRole("dialog");
    await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(guest.getByRole("status")).toContainText(
      "Organization updated",
    );
    await row.getByRole("button", { name: "Revoke", exact: true }).click();
    await guest
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(row.getByText("REVOKED", { exact: true })).toBeVisible();
  } finally {
    await invited.close();
  }
});
