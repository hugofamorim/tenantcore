import { test, expect, type BrowserContext } from "@playwright/test";
import { emailFragment } from "./helpers/mailpit";

test("real dashboard metrics, tenant isolation, profile settings and accessible failure states", async ({
  page,
  context,
  browser,
}) => {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 14);
  const ownerEmail = `dash-owner-${suffix}@example.test`;
  const viewerEmail = `dash-viewer-${suffix}@example.test`;
  const headers = { Origin: "http://127.0.0.1:3300" };
  const password = "a dashboard browser test passphrase";
  async function register(client: BrowserContext, email: string) {
    expect(
      (
        await client.request.post("/api/auth/register", {
          headers,
          data: { name: "Dashboard Evaluator", email, password },
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
  await register(context, ownerEmail);
  await page.goto("/account");
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Dashboard Owner");
  await page.getByRole("button", { name: "Save display name" }).click();
  await expect(page.getByRole("status")).toContainText(
    "display name has been updated",
  );
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Dashboard Owner",
  );
  async function create(name: string, slug: string) {
    const response = await context.request.post("/api/organizations", {
      headers,
      data: { name, slug },
    });
    expect(response.status()).toBe(201);
    return ((await response.json()) as { organization: { id: string } })
      .organization.id;
  }
  const first = await create("Northstar Metrics", `dash-${suffix}-a`);
  const second = await create("Harbor Metrics", `dash-${suffix}-b`);
  await page.goto(`/organizations/${first}/dashboard`);
  const total = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: "Total members", exact: true }),
    });
  const pending = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Pending invitations",
        exact: true,
      }),
    });
  await expect(total.getByText("1", { exact: true })).toBeVisible();
  expect(
    (
      await context.request.post(`/api/organizations/${first}/invitations`, {
        headers,
        data: { email: viewerEmail, role: "VIEWER" },
      })
    ).status(),
  ).toBe(201);
  await page.getByRole("button", { name: "Refresh dashboard" }).click();
  await expect(pending.getByText("1", { exact: true })).toBeVisible();
  const fragment = await emailFragment(
    viewerEmail,
    "Your TenantCore organization invitation",
  );
  const viewer = await browser.newContext({ baseURL: "http://127.0.0.1:3300" });
  try {
    await register(viewer, viewerEmail);
    expect(
      (
        await viewer.request.post("/api/invitations/accept", {
          headers,
          data: { token: new URLSearchParams(fragment.slice(1)).get("token") },
        })
      ).status(),
    ).toBe(200);
    await page.getByRole("button", { name: "Refresh dashboard" }).click();
    await expect(total.getByText("2", { exact: true })).toBeVisible();
    await expect(pending.getByText("0", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Recent activity" }),
    ).toContainText("Invitation accepted");
    const guest = await viewer.newPage();
    await guest.goto(`/organizations/${first}/dashboard`);
    await expect(
      guest.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
    await expect(
      guest.getByRole("heading", { name: "Total members" }),
    ).toHaveCount(0);
    await guest.goto(`/organizations/${second}/dashboard`);
    await expect(
      guest
        .getByRole("main")
        .getByRole("heading", { name: "Organization not found" }),
    ).toBeVisible();
    await expect(
      guest.getByRole("heading", { name: "Total members" }),
    ).toHaveCount(0);
  } finally {
    await viewer.close();
  }
  await page.goto(`/organizations/${second}/dashboard`);
  await expect(total.getByText("1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Recent activity" }),
  ).not.toContainText("Invitation accepted");
  await page.goto(`/organizations/${first}/dashboard`);
  await expect(total.getByText("2", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page.route("**/api/organizations/*/dashboard", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page.getByRole("button", { name: "Refresh dashboard" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(
    page.getByRole("heading", { name: "Total members" }),
  ).toHaveCount(0);
  await page.goto("/an-unknown-page");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Your organizations\.\s*Clear boundaries\./,
    }),
  ).toBeVisible();
});
