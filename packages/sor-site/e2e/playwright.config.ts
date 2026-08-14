/**
 * Browser tier of specs/sor-site/surface/spec.md.
 *
 * One suite, one project. It was two — `stock` and `themed`, B14's structural
 * reading — until the fork made the shell the site: `themes` is a key the shell
 * owns and drops from a project's config, and the design system is imported by
 * the shell's own stylesheet, so "stock preset-classic" names a configuration a
 * vsor project can no longer produce. The project list is the place that fact
 * shows, so it is recorded here rather than papered over; B14/B15's stock half
 * is queued for the lead. Adding a second configuration back is one entry here
 * plus one `--out` in run.sh, because everything below the project name reads
 * its URLs and dirs out of the environment.
 *
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
      name: "site",
      use: { ...devices["Desktop Chrome"], baseURL: need("VSOR_E2E_SITE_URL") },
    },
  ],
});
