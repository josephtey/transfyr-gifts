import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 60000,
  use: { headless: true, viewport: { width: 1440, height: 1050 } },
  workers: 1,
  reporter: "list",
});
