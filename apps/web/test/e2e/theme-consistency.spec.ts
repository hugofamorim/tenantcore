import { expect, test, type Locator } from "@playwright/test";
import { emailFragment } from "./helpers/mailpit";
import { expectAccessiblePage } from "./helpers/accessibility";

test("content surfaces and native option lists follow the chosen theme across screens", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const suffix = crypto.randomUUID().slice(0, 12);
  const email = `theme-${suffix}@example.test`;
  const headers = { Origin: "http://127.0.0.1:3300" };
  const password = "a fictional theme review passphrase";
  expect(
    (
      await context.request.post("/api/auth/register", {
        headers,
        data: { name: "Theme Reviewer", email, password },
      })
    ).status(),
  ).toBe(202);
  const fragment = await emailFragment(email, "Verify your TenantCore email");
  expect(
    (
      await context.request.post("/api/auth/verify-email", {
        headers,
        data: { token: new URLSearchParams(fragment.slice(1)).get("token") },
      })
    ).status(),
  ).toBe(204);
  expect(
    (
      await context.request.post("/api/auth/login", {
        headers,
        data: { email, password },
      })
    ).status(),
  ).toBe(204);
  const response = await context.request.post("/api/organizations", {
    headers,
    data: { name: "Theme Studio", slug: `theme-${suffix}` },
  });
  expect(response.status()).toBe(201);
  const { organization } = (await response.json()) as {
    organization: { id: string };
  };
  const base = `/organizations/${organization.id}`;

  for (const theme of ["dark", "light"] as const) {
    await page.goto(`${base}/dashboard`);
    await expect(
      page.getByRole("heading", { name: "Total members" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    await page
      .getByRole("menuitemradio", {
        name: theme === "dark" ? "Dark" : "Light",
        exact: true,
      })
      .click();
    await expect(page.locator("html")).toHaveCSS("color-scheme", theme);
    const card = page.locator('[data-slot="card"]').first();
    const cardBackground = await card.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    const cardForeground = await card.evaluate(
      (element) => getComputedStyle(element).color,
    );
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    const popoverBackground = await page
      .getByRole("menu")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.keyboard.press("Escape");

    async function expectSurface(surface: Locator) {
      await expect(surface).toBeVisible();
      await expect(surface).toHaveCSS("background-color", cardBackground);
      await expect(surface).toHaveCSS("color", cardForeground);
    }
    async function expectThemedOptions(control: Locator) {
      await expect(control).toHaveCSS("background-color", cardBackground);
      await expect(control).toHaveCSS("color-scheme", theme);
      await expect(control.locator("option:not(:checked)").first()).toHaveCSS(
        "background-color",
        popoverBackground,
      );
    }
    await expectThemedOptions(
      page.getByRole("combobox", { name: "Active organization" }),
    );
    await page.goto(base);
    await expectSurface(
      page
        .getByRole("heading", { name: "Organization details", exact: true })
        .locator(".."),
    );
    await page.goto(`${base}/settings`);
    await expectSurface(
      page
        .getByRole("textbox", { name: "Organization name", exact: true })
        .locator("xpath=ancestor::section[1]"),
    );
    if (theme === "dark")
      await page.screenshot({
        path: "test-results/settings-dark.png",
        fullPage: true,
      });
    await page.goto(`${base}/invitations`);
    await expectSurface(
      page
        .getByRole("heading", { name: "Invite a member", exact: true })
        .locator(".."),
    );
    await expectThemedOptions(
      page.getByRole("combobox", { name: "Invitation role" }),
    );
    await expectSurface(
      page
        .getByRole("table", { name: "Organization invitations" })
        .locator(".."),
    );
    await expectAccessiblePage(page);
    if (theme === "dark") {
      const roleControl = page.getByRole("combobox", {
        name: "Invitation role",
      });
      await roleControl.focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowUp");
      await page.screenshot({
        path: "test-results/invitations-dark.png",
        fullPage: true,
      });
    }
    await page.goto(`${base}/members`);
    await expectSurface(
      page.getByRole("table", { name: "Organization members" }).locator(".."),
    );
    await page.goto(`${base}/audit`);
    await expectSurface(
      page
        .getByRole("heading", { name: "organization.created", exact: true })
        .locator(".."),
    );
    await page.goto("/organizations");
    const organizationList = page.getByRole("region", {
      name: "Organization list",
    });
    await expectSurface(
      organizationList.getByRole("link").filter({
        has: page.getByRole("heading", { name: "Theme Studio", exact: true }),
      }),
    );
    await expectSurface(
      page
        .getByRole("heading", { name: "Create an organization", exact: true })
        .locator(".."),
    );
    await page.goto("/account");
    await expect(
      page.getByRole("textbox", { name: "Display name", exact: true }),
    ).toBeVisible();
    await expectSurface(
      page
        .getByRole("heading", { name: "Your account", exact: true })
        .locator(".."),
    );
    await expectAccessiblePage(page);
    if (theme === "dark")
      await page.screenshot({
        path: "test-results/account-dark.png",
        fullPage: true,
      });
    for (const [path, title] of [
      ["/login", "Welcome back"],
      ["/register", "Create your account"],
    ]) {
      await page.goto(path);
      await expectSurface(
        page.getByRole("heading", { name: title, exact: true }).locator(".."),
      );
    }
    await page.goto("/invitations/accept");
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expectSurface(page.getByRole("main"));
    await page.goto("/status");
    await expectSurface(
      page
        .getByRole("main")
        .getByText("All systems operational", { exact: true })
        .locator(".."),
    );
    await page.goto("/");
    await expectSurface(
      page
        .getByRole("heading", { name: "Verified identity", exact: true })
        .locator(".."),
    );
  }
});
