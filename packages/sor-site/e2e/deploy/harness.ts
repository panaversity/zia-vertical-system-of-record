/**
 * Shared harness for the hosting-layout acceptance (tests/acceptance/deploy.sh).
 *
 * - deployEnv(project): the per-shape facts the driver exports — where the
 *   static server listens, the path the site is served under, the public origin
 *   the build was configured with, and the build directory. Nothing about a
 *   shape or a corpus is hardcoded in a spec.
 * - `corpus`: the routes, heading and phrase the driver's project happens to
 *   have, so the same specs run against a scaffold's own documents and against
 *   tests/fixtures/tiny.
 * - `test`: @playwright/test extended with an always-on guard that turns every
 *   navigation into an assertion that the site asks only for things under the
 *   path this host serves it from, same-origin, with no 4xx and no page errors.
 *
 * Structure mirrors tests/harness.ts + tests/{static,surface}.spec.ts: the rows
 * that never open a page use the plain `test`, so no browser is launched for a
 * filesystem scan.
 */
import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export { expect };

export interface DeployEnv {
  /** "root" | "subpath" — the shape under test. */
  name: string;
  /** Where the static server actually listens: http://127.0.0.1:<ephemeral>. */
  served: string;
  /** The path the site is served under: "/" or "/<name>/". Always trailing-slashed. */
  base: string;
  /** The public origin the build was CONFIGURED with — never where it is served from. */
  host: string;
  /** The public root: host + base. What the built metadata must claim. */
  publicRoot: string;
  /** The build/ directory this shape is serving, for the file-tier rows. */
  dir: string;
}

export function need(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is not set — run this suite via \`bash tests/acceptance/deploy.sh\`.`);
  return value;
}

export function deployEnv(projectName: string): DeployEnv {
  const prefix = projectName.toUpperCase();
  const deployBase = need(`VSOR_DEPLOY_${prefix}_BASE`);
  const host = need(`VSOR_DEPLOY_${prefix}_HOST`);
  return {
    name: projectName,
    served: need(`VSOR_DEPLOY_${prefix}_URL`),
    base: deployBase,
    host,
    publicRoot: new URL(deployBase, host).toString(),
    dir: need(`VSOR_DEPLOY_${prefix}_DIR`),
  };
}

/** A literal string used as a regex fragment — paths and origins carry `.` and `/`. */
export function escapeRe(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The corpus facts, supplied by the driver so no spec here knows a fixture. */
export const corpus = {
  title: () => need("VSOR_DEPLOY_TITLE"),
  docA: () => need("VSOR_DEPLOY_DOC_A"),
  docB: () => need("VSOR_DEPLOY_DOC_B"),
  docBHeading: () => need("VSOR_DEPLOY_DOC_B_H1"),
  phrase: () => need("VSOR_DEPLOY_PHRASE"),
};

/** Recursively list files under dir whose path passes the filter. */
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

/**
 * Every url-ish value in a request-initiating position of an HTML document.
 * Deliberately the same positions the surface tier's B5 scan reads (script src,
 * link href across all rels, img/source src+srcset, iframe/object/embed, svg
 * use/image href): there the question is "is it off-origin", here it is "is it
 * under the path this host serves the site from", and both are answered by the
 * same list of places a browser goes on its own.
 */
export function requestUrls(html: string): string[] {
  const urls: string[] = [];
  const tagRe = /<(script|link|img|source|iframe|object|embed|use|image)\b([^>]*)>/gi;
  for (const [, tag, attrs] of html.matchAll(tagRe)) {
    const attrRe = /\b(src|href|data|srcset|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
    for (const [, attr, dq, sq, uq] of attrs.matchAll(attrRe)) {
      const value = dq ?? sq ?? uq ?? "";
      if (attr.toLowerCase() === "data" && tag.toLowerCase() !== "object") continue;
      if (attr.toLowerCase() === "srcset") {
        for (const entry of value.split(","))
          if (entry.trim()) urls.push(entry.trim().split(/\s+/)[0]);
      } else {
        urls.push(value);
      }
    }
  }
  return urls;
}

/**
 * Click a link in the doc sidebar, after proving a human could.
 *
 * The reachability check is not ceremony — it was written because the click
 * failed (found live 2026-08-14, against a real `vsor build`, not against this
 * repo's assembled harness): the fixed navbar covers the top of the sidebar, so
 * the FIRST document in the tree sits behind it and neither Playwright nor a
 * person can click it. Measured on the same page, same corpus, same source:
 *
 *   vsor build output      .theme-doc-sidebar-container margin-top -64px
 *                          -> aside top 1px, first link centre y≈57, and
 *                             document.elementFromPoint() there returns the navbar
 *   assembled harness      margin-top 0px -> aside top 65px, first link at y≈85
 *
 * Without this check the symptom is a 30-second `locator.click` timeout whose
 * call log has to be read backwards; with it, the row says which element is in
 * the way, in about a second. Asserting reachability before acting is also the
 * honest form of the claim — "a reader can follow the sidebar" is what D4 is
 * for, and an unreachable link fails that whether or not a synthetic click
 * could be forced through with `{ force: true }`.
 */
export async function clickSidebarLink(
  page: import("@playwright/test").Page,
  name: string,
): Promise<void> {
  const link = page.locator("nav.menu").getByRole("link", { name, exact: true }).first();
  await expect(link, "the sidebar lists the document").toBeVisible();
  const box = await link.boundingBox();
  expect(box, "the sidebar link has a box").toBeTruthy();
  const covering = await page.evaluate(
    ({ x, y, width, height }) => {
      const el = document.elementFromPoint(x + width / 2, y + height / 2);
      if (!el) return "nothing (the point is outside the viewport)";
      if (el.closest("a")) return null;
      return `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 80)}">`;
    },
    box!,
  );
  expect(
    covering,
    `the sidebar link is reachable — nothing overlays its click point (found: ${covering})`,
  ).toBeNull();
  await link.click();
}

/**
 * The always-on browser guard. Three properties, on every page any row visits:
 * every request same-origin with THIS shape's static server; every request path
 * under the deployed base (the assertion that makes the subpath shape real);
 * zero responses >= 400, zero console.error, zero pageerror.
 *
 * The settle step before asserting is the surface harness's found-live lesson,
 * kept deliberately: React reports hydration mismatches through
 * onRecoverableError, whose console.error lands AFTER hydration completes, so a
 * fast row can close its page before its own evidence arrives.
 */
export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use, testInfo) => {
      const env = deployEnv(testInfo.project.name);
      const servedOrigin = new URL(env.served).origin;
      const offenses: string[] = [];
      page.on("request", (request) => {
        let url: URL;
        try {
          url = new URL(request.url());
        } catch {
          offenses.push(`unparseable request url: ${request.url()}`);
          return;
        }
        if (url.origin !== servedOrigin) {
          offenses.push(`off-origin request: ${request.url()}`);
          return;
        }
        if (!url.pathname.startsWith(env.base))
          offenses.push(
            `request outside baseUrl ${env.base}: ${url.pathname} — that path is not this site's to ask for`,
          );
      });
      page.on("response", (response) => {
        if (response.status() >= 400) offenses.push(`HTTP ${response.status()}: ${response.url()}`);
      });
      page.on("console", (message) => {
        if (message.type() === "error") offenses.push(`console.error: ${message.text()}`);
      });
      page.on("pageerror", (error) => {
        offenses.push(`pageerror: ${error.message}`);
      });
      await use();
      try {
        await page.waitForLoadState("networkidle");
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
      } catch {
        // The row closed its page (or never navigated) — nothing to settle.
      }
      expect(
        offenses,
        "every request resolves under the deployed baseUrl, same-origin, with no page errors",
      ).toEqual([]);
    },
    { auto: true },
  ],
});
