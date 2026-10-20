import { defineConfig, devices } from "@playwright/test";

const database = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!database || new URL(database).pathname !== "/tenantcore_test") {
  throw new Error("Browser tests require the isolated tenantcore_test database");
}

export default defineConfig({
  testDir: "./test/e2e", fullyParallel: false, workers: 1, timeout: 60_000,
  retries: process.env.CI ? 1 : 0, reporter: "list",
  // The script invokes projects separately so each gets a fresh API rate-limit
  // store. Browser contexts alone share the same loopback IP and server limits.
  projects: [
    { name: "identity-and-organizations", testIgnore: ["**/members.spec.ts", "**/dashboard.spec.ts"] },
    { name: "collaboration", testMatch: "**/members.spec.ts" },
    { name: "operations", testMatch: "**/dashboard.spec.ts" },
  ],
  use: { baseURL: "http://127.0.0.1:3300", ...devices["Desktop Chrome"] },
  webServer: [
    {
      command: "pnpm --dir ../api start:prod", url: "http://127.0.0.1:3301/health", reuseExistingServer: false,
      env: { DATABASE_URL: database, NODE_ENV: "test", PORT: "3301", WEB_ORIGIN: "http://127.0.0.1:3300", SMTP_PORT: process.env.SMTP_PORT ?? "11025" },
    },
    {
      command: "pnpm exec next dev --hostname 127.0.0.1 -p 3300", url: "http://127.0.0.1:3300/login", reuseExistingServer: false,
      env: { NODE_ENV: "development", API_URL: "http://127.0.0.1:3301" },
      timeout: 120_000,
    },
  ],
});
