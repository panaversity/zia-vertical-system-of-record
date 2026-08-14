/**
 * Shared harness for the browser tier (specs/sor-site/surface/spec.md).
 *
 * - envFor(project): the per-variant URLs, build dirs and assembly manifests
 *   exported by run.sh. The manifest (written by scripts/assemble.mjs) is the
 *   single source for the instance name, sentinel values and the old values
 *   they replaced — the tests hardcode none of it.
 * - `test`: extends @playwright/test with an always-on guard that turns every
 *   navigation into an enforcement of B8 (every request same-origin with a
 *   test server; zero responses >= 400) and B11 (zero console.error, zero
 *   pageerror) across all visited pages.
 */
import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export { expect };

export interface SentinelColor {
  hex: string;
  rgb: string;
}

export interface Manifest {
  variant: "site";
  sentinel: boolean;
  instanceName: string;
  year: string;
  siteUrl: string;
  docRoute: string;
  oldValues: {
    navTitle: string;
    footerCopyright: string;
    primaryLight: string;
    primaryDark: string;
  };
  sentinels: {
    navTitle: string;
    footerCopyright: string;
    primaryLight: SentinelColor;
    primaryDark: SentinelColor;
  };
}

export interface VariantEnv {
  variant: string;
  url: string;
  sentinelUrl: string;
  buildDir: string;
  sentinelBuildDir: string;
  manifest: Manifest;
  sentinelManifest: Manifest;
}

function need(name: string): string {
  const v = process.env[name];
  if (!v)
    throw new Error(
      `${name} is not set — run the suite via \`make surface\` (packages/sor-site/e2e/run.sh).`,
    );
  return v;
}

function readManifest(dir: string): Manifest {
  return JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as Manifest;
}

export function envFor(projectName: string): VariantEnv {
  const V = projectName.toUpperCase();
  const dir = need(`VSOR_E2E_${V}_DIR`);
  const sentinelDir = need(`VSOR_E2E_${V}_SENTINEL_DIR`);
  return {
    variant: projectName,
    url: need(`VSOR_E2E_${V}_URL`),
    sentinelUrl: need(`VSOR_E2E_${V}_SENTINEL_URL`),
    // The materialized shape: the shell IS the siteDir, so the build lands at
    // <out>/site-runtime/build. (It was <out>/site/build while the scaffold's
    // own site/ was the siteDir — see scripts/assemble.mjs.)
    buildDir: path.join(dir, "site-runtime", "build"),
    sentinelBuildDir: path.join(sentinelDir, "site-runtime", "build"),
    manifest: readManifest(dir),
    sentinelManifest: readManifest(sentinelDir),
  };
}

/**
 * A URL that loads in a named color mode, deterministically.
 *
 * found live 2026-08-14 (the fork, docusaurus 3.10.2): the suite used to force a
 * mode by writing `localStorage.theme` and reloading. The shell enables
 * `future.v4`, which NAMESPACES Docusaurus's storage keys — the built bootstrap
 * script reads `theme-aae`, a suffix derived from the site url/baseUrl — so the
 * write landed on a key nothing reads and every dark assertion measured a light
 * page. The same bootstrap reads `?docusaurus-theme` FIRST, before storage and
 * before prefers-color-scheme, and it runs before first paint. That is the seam
 * to use: no key to guess, no reload, no hydration race.
 */
export function inMode(url: string, mode: "light" | "dark"): string {
  const u = new URL(url);
  u.searchParams.set("docusaurus-theme", mode);
  return u.toString();
}

/** Recursively list files under dir whose name passes the filter. */
export function filesUnder(dir: string, keep: (p: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (keep(p)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use, testInfo) => {
      const env = envFor(testInfo.project.name);
      // B8's "same-origin with the test server": both the variant's server and
      // its sentinel server (B12 visits the latter) are test servers.
      const allowed = new Set([new URL(env.url).origin, new URL(env.sentinelUrl).origin]);
      const offenses: string[] = [];
      page.on("request", (r) => {
        let origin: string;
        try {
          origin = new URL(r.url()).origin;
        } catch {
          origin = `unparseable:${r.url()}`;
        }
        if (!allowed.has(origin)) offenses.push(`B8 cross-origin request: ${r.url()}`);
      });
      page.on("response", (r) => {
        if (r.status() >= 400) offenses.push(`B8 HTTP ${r.status()}: ${r.url()}`);
      });
      page.on("console", (m) => {
        if (m.type() === "error") offenses.push(`B11 console.error: ${m.text()}`);
      });
      page.on("pageerror", (e) => {
        offenses.push(`B11 pageerror: ${e.message}`);
      });
      await use();
      // found live (2026-08-13): React reports hydration mismatches (e.g.
      // minified error #418) through onRecoverableError, which logs its
      // console.error LAZILY after hydration completes — fast tests closed the
      // page before the message arrived, so this guard raced its own evidence
      // and `make surface` stayed green while every themed doc page logged
      // #418 for Mac readers. Settle before asserting: network idle plus two
      // animation frames is enough for the deferred log to land.
      try {
        await page.waitForLoadState("networkidle");
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
      } catch {
        // The test closed its page (or never navigated) — nothing to settle.
      }
      expect(offenses, "B8/B11: the theme phones no one, every asset resolves, zero page errors").toEqual([]);
    },
    { auto: true },
  ],
});
