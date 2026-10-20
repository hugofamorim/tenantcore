import { expect, test } from "@playwright/test";
import { emailFragment } from "./helpers/mailpit";

test("verify email and recover access through actual SMTP messages", async ({ page, browser }) => {
  const email = `recovery-${crypto.randomUUID()}@example.test`;
  const password = "the original browser passphrase";
  const replacement = "the replacement browser passphrase";
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Recovery User");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("You can now sign in");

  const verification = await emailFragment(email, "Verify your TenantCore email");
  const response = await page.goto(`/verify-email${verification}`);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await page.getByRole("button", { name: "Verify email address" }).click();
  await expect(page.getByRole("status")).toHaveText("Your email address is now verified.");
  expect(new URL(page.url()).hash).toBe("");
  await page.getByRole("link", { name: "Continue to your account" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();

  const other = await browser.newContext({ baseURL: "http://127.0.0.1:3300" });
  try {
    expect((await other.request.post("/api/auth/login", { headers: { Origin: "http://127.0.0.1:3300" }, data: { email, password } })).status()).toBe(204);
    expect((await other.request.get("/api/auth/me")).status()).toBe(200);
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send recovery email" }).click();
    await expect(page.getByRole("status")).toContainText("If this account is eligible");
    const recovery = await emailFragment(email, "Reset your TenantCore password");
    await page.goto(`/reset-password${recovery}`);
    await page.getByLabel("New password", { exact: true }).fill(replacement);
    await page.getByLabel("Confirm new password").fill(replacement);
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("status")).toContainText("all sessions have been signed out");
    expect(new URL(page.url()).hash).toBe("");
    expect((await other.request.get("/api/auth/me")).status()).toBe(401);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    await page.screenshot({ path: "test-results/recovery.png", fullPage: true });
    await page.getByRole("link", { name: "Continue to sign in" }).click();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("was not accepted");
    await page.getByLabel("Password", { exact: true }).fill(replacement);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await page.goto(`/reset-password${recovery}`);
    await page.getByLabel("New password", { exact: true }).fill("another sufficiently long phrase");
    await page.getByLabel("Confirm new password").fill("another sufficiently long phrase");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("invalid or expired");
  } finally { await other.close(); }
});
