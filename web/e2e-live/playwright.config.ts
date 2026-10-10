import { defineConfig } from "@playwright/test";

// Live run against the deployed site + BOT Chain Testnet (see e2e-live/testnet.spec.ts).
export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "../test-results/live",
  use: { actionTimeout: 60_000, screenshot: "only-on-failure" },
});
