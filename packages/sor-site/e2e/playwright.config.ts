/**
 * Browser tier of specs/sor-site/surface/spec.md.
 *
 * One suite, two projects — B14 is structural: the identical spec files run
 * against the stock (preset-classic + mdx) and themed (+ theme package) builds.
 * URLs/dirs come from run.sh, which owns assembly, builds and static serving;
 * running `playwright test` without it fails fast with the remedy.
 *
 * Determinism (spec, Browser tier preamble): Chromium pinned via the committed
 * lockfile, DOM-state auto-wait only, no screenshots, no visual diffs, retries 0.
 */
import { defineConfig, devices } from "@playwright/test";

function need(name: string): string {
  const v = process.env[name];
  if (!v)
    throw new Error(
      `${name} is not set. This suite runs against servers started by the driver — run \`make surface\` (or bash packages/sor-site/e2e/run.sh), never bare \`playwright test\`.`,
    );
  return v;
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    screenshot: "off",
    video: "off",
    trace: "off",
  },
  projects: [
    {
      name: "stock",
      use: { ...devices["Desktop Chrome"], baseURL: need("VSOR_E2E_STOCK_URL") },
    },
    {
      name: "themed",
      use: { ...devices["Desktop Chrome"], baseURL: need("VSOR_E2E_THEMED_URL") },
    },
  ],
});
