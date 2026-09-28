import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4173;

// End-to-end tests against the real app: the built frontend (frontend/dist)
// served by the Go backend, with generated calendars (see e2e/global-setup.js).
// iPhone/Safari (WebKit) is the primary target: ~70% of users are on iOS.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.js",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    { name: "iphone-webkit", use: { ...devices["iPhone 14"] } },
    { name: "android-chromium", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "go run ./cmd/server",
    cwd: path.join(here, ".."),
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      DATA_DIR: path.join(here, "e2e", ".data"),
      OUTPUT_DIR: path.join(here, "e2e", ".data", "output"),
      ROOMS_OUTPUT_DIR: path.join(here, "e2e", ".data", "rooms"),
      STATIC_DIR: path.join(here, "dist"),
      SYNC_ON_STARTUP: "false",
      SYNC_INTERVAL: "24h",
      SYNC_CERCLE: "false",
      SYNC_RU: "false",
      LOG_LEVEL: "warn",
    },
  },
});
