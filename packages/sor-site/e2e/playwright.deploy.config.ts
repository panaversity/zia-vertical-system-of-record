/**
 * Browser tier of the HOSTING-LAYOUT acceptance (tests/acceptance/deploy.sh).
 *
 * Separate from playwright.config.ts on purpose. That suite proves the *surface*
 * (specs/sor-site/surface) against one site assembled from source; this one
 * proves the *deployable output* against the two shapes a static host actually
 * has, built by the real `vsor build` from the real wheel:
 *
 *   root     — Vercel / Netlify / S3+CloudFront / nginx: the build IS the
 *              document root, baseUrl "/"
 *   subpath  — a GitHub Pages project site or an internal path: the build sits
 *              at <docroot>/<name>/ and is reached at /<name>/, baseUrl
 *              "/<name>/". The driver serves the PARENT directory, so the site
 *              genuinely lives under the prefix rather than being pretend-nested
 *              by a rewrite.
 *
 * One spec file drives both: every fact that differs between the shapes — the
 * serving origin, the deployed base path, the public origin the build was
 * configured with, the corpus's own routes and phrases — arrives in the
 * environment from the driver. Nothing about a fixture is hardcoded here, which
 * is what lets the same suite run against the probe builds during development
 * and against a real `vsor build` in the acceptance.
 *
 * Determinism, matching the surface tier: Chromium pinned via the committed
 * lockfile, DOM-state auto-wait only, no screenshots, no visual diffs, retries 0.
 */
import { defineConfig, devices } from "@playwright/test";

function need(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `${name} is not set. This suite runs against static servers started by its driver — ` +
        "run `bash tests/acceptance/deploy.sh`, never bare `playwright test`.",
    );
  return value;
}

/**
 * The deployed root of one shape: the static server's origin joined with the
 * path the site is served under. Every navigation in the spec is relative to
 * this, so `page.goto("docs/x/")` lands under the prefix in the subpath shape
 * and at the root in the root shape without a single branch in the test.
 */
function deployedRoot(prefix: string): string {
  return new URL(need(`VSOR_DEPLOY_${prefix}_BASE`), need(`VSOR_DEPLOY_${prefix}_URL`)).toString();
}

export default defineConfig({
  testDir: "./deploy",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: { screenshot: "off", video: "off", trace: "off" },
  projects: [
    { name: "root", use: { ...devices["Desktop Chrome"], baseURL: deployedRoot("ROOT") } },
    { name: "subpath", use: { ...devices["Desktop Chrome"], baseURL: deployedRoot("SUBPATH") } },
  ],
});
