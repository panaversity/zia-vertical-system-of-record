/**
 * Static tier over the built output — Acceptance B5, B6, B7 of
 * specs/sor-site/surface/spec.md. Pure filesystem checks (no browser); they run
 * inside the Playwright suite so they scan the same build the browser half
 * drives — and, since the fork, that build is the materialized shell: the forked
 * app as siteDir with the init scaffold as its site/. B14's second
 * configuration is gone with the stock/themed axis (see playwright.config.ts).
 *
 * Uses the plain Playwright `test` (not the guarded harness one) because the
 * B8/B11 guard fixture would launch a browser these tests never use.
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { envFor, filesUnder } from "./harness";

/**
 * The committed exclusion list — ONE file shared with the Phase A source scan
 * (tests/test_surface_contract.py). A bare-string pattern runs in both tiers;
 * an object entry narrows to one tier and records why. This scan takes the
 * "bundle" tier plus the brand pattern (case-insensitive, so AgentFactory/
 * agent-factory cannot slip past a case-exact scan — found 2026-08-13: the
 * previous hand-maintained copy here had drifted from A2's at birth).
 */
type PatternEntry = string | { pattern: string; tiers?: string[]; flags?: string; why?: string };
const exclusions = JSON.parse(
  fs.readFileSync(path.join(__dirname, "exclusions.json"), "utf8"),
) as {
  carveOuts: { tokens: string[] };
  brand: { pattern: string; flags?: string };
  rows: { row: string; patterns: PatternEntry[] }[];
};

/** (row label, regex) for every exclusion entry active in the bundle tier, plus brand. */
const bundlePatterns: { row: string; re: RegExp }[] = exclusions.rows.flatMap((row) =>
  row.patterns
    .map((entry) =>
      typeof entry === "string" ? { pattern: entry, tiers: ["source", "bundle"], flags: "" } : entry,
    )
    .filter((entry) => (entry.tiers ?? ["source", "bundle"]).includes("bundle"))
    .map((entry) => ({ row: row.row, re: new RegExp(entry.pattern, entry.flags ?? "") })),
);
bundlePatterns.push({
  row: "De-brand (branding comes from the consuming site's config)",
  re: new RegExp(exclusions.brand.pattern, exclusions.brand.flags ?? ""),
});

/** Every url-ish value in request-initiating positions of an HTML document. */
function htmlUrls(html: string): string[] {
  const urls: string[] = [];
  // script src, link href (all rels), img/source src+srcset, iframe/object/embed,
  // svg use/image href and xlink:href.
  const tagRe = /<(script|link|img|source|iframe|object|embed|use|image)\b([^>]*)>/gi;
  for (const [, tag, attrs] of html.matchAll(tagRe)) {
    // quoted or unquoted attribute values — the HTML minifier may drop quotes
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
  // inline style attributes and <style> blocks
  for (const [, dq, sq] of html.matchAll(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi))
    urls.push(...cssUrls(dq ?? sq ?? ""));
  for (const [, block] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi))
    urls.push(...cssUrls(block));
  return urls;
}

/** url() and @import targets in CSS text. */
function cssUrls(css: string): string[] {
  const urls: string[] = [];
  for (const m of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/gi))
    urls.push(m[1] ?? m[2] ?? m[3] ?? "");
  for (const m of css.matchAll(/@import\s+(?!url\()\s*(?:"([^"]*)"|'([^']*)')/gi))
    urls.push(m[1] ?? m[2] ?? "");
  return urls;
}

/**
 * Local = relative, root-relative, fragment, or data:/about: (initiate no
 * network fetch). A scheme'd or protocol-relative URL is legal only when its
 * origin is the site's own configured url (the canonical/sitemap origin the
 * build stamps into its own pages) — anything else is theme-introduced.
 */
function isLocal(raw: string, allowedOrigins: Set<string>): boolean {
  const u = raw.trim();
  if (!u || u.startsWith("#")) return true;
  if (/^(data|about|javascript|mailto):/i.test(u)) return true;
  if (u.startsWith("//")) {
    try {
      return allowedOrigins.has(new URL(`http:${u}`).origin) || allowedOrigins.has(new URL(`https:${u}`).origin);
    } catch {
      return false;
    }
  }
  if (/^[a-zA-Z][\w+.-]*:/.test(u)) {
    try {
      return allowedOrigins.has(new URL(u).origin);
    } catch {
      return false;
    }
  }
  return true;
}

const ROUTE_WORDS = ["admin", "login", "auth", "signup", "profile", "onboarding", "certifications", "leaderboard"];

test.describe("static tier", () => {
  test("B5 static scan: zero non-local references in built HTML+CSS", ({}, testInfo) => {
    const env = envFor(testInfo.project.name);
    const allowed = new Set([new URL(env.manifest.siteUrl).origin]);
    const offenders: string[] = [];
    for (const file of filesUnder(env.buildDir, (p) => p.endsWith(".html") || p.endsWith(".css"))) {
      const text = fs.readFileSync(file, "utf8");
      const urls = file.endsWith(".html") ? htmlUrls(text) : cssUrls(text);
      for (const u of urls)
        if (!isLocal(u, allowed)) offenders.push(`${path.relative(env.buildDir, file)}: ${u}`);
    }
    expect(offenders, "the theme introduces no external requests (spec, negative contract)").toEqual([]);
  });

  test("B6 route assertion: no product routes outside /docs/**", ({}, testInfo) => {
    const env = envFor(testInfo.project.name);
    const sitemapPath = path.join(env.buildDir, "sitemap.xml");
    expect(fs.existsSync(sitemapPath), `sitemap.xml missing at ${sitemapPath} — the route manifest this assertion reads`).toBe(true);
    const locs = [...fs.readFileSync(sitemapPath, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length, "sitemap has routes — an empty sitemap would make this test vacuous").toBeGreaterThan(0);
    const wordRe = new RegExp(`(^|[^a-z0-9])(${ROUTE_WORDS.join("|")})([^a-z0-9]|$)`, "i");
    const offenders = locs
      .map((loc) => new URL(loc).pathname)
      .filter((p) => !p.startsWith("/docs/") && p !== "/docs")
      .filter((p) => wordRe.test(p));
    expect(offenders, "no admin/login/auth/signup/profile/onboarding/certifications/leaderboard routes outside /docs/**").toEqual([]);
    // ...and the corresponding build/ directories do not exist.
    const dirs = ROUTE_WORDS.filter((w) => fs.existsSync(path.join(env.buildDir, w)));
    expect(dirs, "no product route directories in build/").toEqual([]);
  });

  test("B7 exclusion list: zero matches in built JS bundles", ({}, testInfo) => {
    const env = envFor(testInfo.project.name);
    const jsDir = path.join(env.buildDir, "assets", "js");
    expect(fs.existsSync(jsDir), `no JS bundles at ${jsDir} — build layout changed?`).toBe(true);
    const bundles = filesUnder(jsDir, (p) => p.endsWith(".js"));
    expect(bundles.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of bundles) {
      // A2 carve-out: ReadingProgress (and its token spelling) is a kept
      // content primitive; scrub it so no progress pattern can match its name.
      let text = fs.readFileSync(file, "utf8");
      for (const token of exclusions.carveOuts.tokens) text = text.replaceAll(token, "");
      for (const { row, re } of bundlePatterns) {
        const m = text.match(re);
        if (m)
          offenders.push(
            `${path.relative(env.buildDir, file)}: /${re.source}/${re.flags} (${row}) matched ${JSON.stringify(m[0])}`,
          );
      }
    }
    expect(offenders, "the built site contains none of the excluded product layer").toEqual([]);
  });

  // Added 2026-08-14. B7 above reads build/assets/js only, and every defect the
  // fidelity/contract audit of that date found in built output was CSS-resident:
  // 45 lines of `.tool-tabs` (the kebab form of an excluded component), eight
  // `:not(.project-card)` guards, and `.doc-actions-item--locked` — the
  // signed-out lock state of a gate whose code was deliberately removed. All
  // three reached every user's stylesheet unchallenged because no tier looked
  // at CSS. Stylesheets carry no corpus prose, so this half needs no carve-outs
  // and runs the brand pattern too.
  test("B7 exclusion list: zero matches in built CSS", ({}, testInfo) => {
    const env = envFor(testInfo.project.name);
    const cssDir = path.join(env.buildDir, "assets", "css");
    expect(fs.existsSync(cssDir), `no stylesheets at ${cssDir} — build layout changed?`).toBe(true);
    const sheets = filesUnder(cssDir, (p) => p.endsWith(".css"));
    expect(sheets.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of sheets) {
      let text = fs.readFileSync(file, "utf8");
      for (const token of exclusions.carveOuts.tokens) text = text.replaceAll(token, "");
      for (const { row, re } of bundlePatterns) {
        const m = text.match(re);
        if (m)
          offenders.push(
            `${path.relative(env.buildDir, file)}: /${re.source}/${re.flags} (${row}) matched ${JSON.stringify(m[0])}`,
          );
      }
    }
    expect(offenders, "the built stylesheets contain none of the excluded product layer").toEqual([]);
  });

  // The brand half over built HTML. HTML does carry corpus prose, so this is
  // scoped to the fixture build, whose corpus Phase A asserts is brand-free —
  // anything found is therefore theme-introduced, the same argument B8 makes.
  test("B7 brand scan: no upstream brand strings in built HTML", ({}, testInfo) => {
    const env = envFor(testInfo.project.name);
    const brandRe = new RegExp(exclusions.brand.pattern, exclusions.brand.flags ?? "");
    const offenders: string[] = [];
    for (const file of filesUnder(env.buildDir, (p) => p.endsWith(".html"))) {
      const m = fs.readFileSync(file, "utf8").match(brandRe);
      if (m) offenders.push(`${path.relative(env.buildDir, file)}: matched ${JSON.stringify(m[0])}`);
    }
    expect(offenders, "no upstream brand strings in built HTML").toEqual([]);
  });
});
