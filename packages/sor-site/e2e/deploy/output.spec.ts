/**
 * File tier of the hosting-layout acceptance — what the build committed to,
 * before anything is served. Driver: tests/acceptance/deploy.sh.
 *
 * Plain @playwright/test rather than the guarded `test` from ./harness: these
 * rows never open a page, and the guard fixture would launch a browser for a
 * filesystem scan. (Same division as tests/static.spec.ts in the surface tier.)
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { corpus, deployEnv, filesUnder, requestUrls } from "./harness";

test.describe("file tier", () => {
  /**
   * S1 — the defect this suite was written for, in its most direct form.
   *
   * `url` in docusaurus.config.ts is baked into sitemap.xml, every page's
   * canonical and alternate links, the og:/twitter: image URLs, the JSON-LD
   * graph and the serialized siteConfig in the client bundle. Ship it still
   * saying localhost and the site looks perfect while its machine-readable half
   * tells search engines, answer engines and link previews that the site lives
   * on the machine that built it.
   *
   * The pattern is an ORIGIN, not the bare word, and that is measured rather
   * than fastidious (2026-08-14): a bare `localhost` scan over .js flags
   * `assets/js/2911.*.js`, whose only hit is a vendored Node polyfill's error
   * string — `File URL host must be "localhost" or empty on darwin`. Matching
   * `//localhost` / `//127.0.0.1` keeps the row exact-zero against the thing
   * that actually ships a wrong address (`url:"http://localhost:3000"` in the
   * serialized siteConfig, `<loc>http://localhost:3000/…</loc>` in the sitemap)
   * while ignoring prose that merely contains the word.
   *
   * The positive half matters as much: a build that emitted no host at all would
   * pass a zero-count assertion trivially, so the configured origin must also
   * appear in the client bundle.
   */
  test("S1: no built page names localhost or the machine that served it", ({}, testInfo) => {
    const env = deployEnv(testInfo.project.name);
    const wrongHost = /(https?:)?\/\/(localhost|127\.0\.0\.1)(:\d+)?/;
    const offenders: string[] = [];
    const scripts: string[] = [];
    for (const file of filesUnder(
      env.dir,
      (p) => p.endsWith(".html") || p.endsWith(".xml") || p.endsWith(".js"),
    )) {
      const text = fs.readFileSync(file, "utf8");
      const hit = text.match(wrongHost);
      if (hit) offenders.push(`${path.relative(env.dir, file)} names ${JSON.stringify(hit[0])}`);
      if (file.endsWith(".js") && text.includes(env.host)) scripts.push(file);
    }
    expect(
      offenders,
      "a deployed build must not carry the build machine's address in its metadata",
    ).toEqual([]);
    expect(
      scripts.length,
      `the client bundle carries the configured origin ${env.host} — otherwise the row above passes on a build that emitted no host at all`,
    ).toBeGreaterThan(0);
  });

  /**
   * S2 — the subpath half, at the file tier. Every root-relative reference must
   * start with the path the host serves the site under; anything at "/" is a
   * request into a document root that belongs to somebody else.
   *
   * In the root shape the row is nearly free but not vacuous: it still rejects a
   * protocol-relative or absolute reference that names an origin the build was
   * not configured with.
   */
  test("S2: every root-relative reference is under the deployed baseUrl", ({}, testInfo) => {
    const env = deployEnv(testInfo.project.name);
    const offenders: string[] = [];
    for (const file of filesUnder(env.dir, (p) => p.endsWith(".html"))) {
      for (const raw of requestUrls(fs.readFileSync(file, "utf8"))) {
        const url = raw.trim();
        if (!url || url.startsWith("#")) continue;
        if (/^(data|about|javascript|mailto):/i.test(url)) continue;
        if (url.startsWith("//") || /^[a-zA-Z][\w+.-]*:/.test(url)) {
          // Absolute references are the metadata's business (S1, D6, D7); the
          // only thing to check here is that they name the configured host.
          if (!url.startsWith(env.host))
            offenders.push(`${path.relative(env.dir, file)}: absolute reference ${url}`);
          continue;
        }
        if (!url.startsWith("/")) continue; // document-relative: correct by construction
        if (!url.startsWith(env.base))
          offenders.push(`${path.relative(env.dir, file)}: ${url} is not under ${env.base}`);
      }
    }
    expect(
      offenders,
      `a site served at ${env.base} may not reference anything above it — those paths belong to the host, not to this site`,
    ).toEqual([]);
  });

  /**
   * S3 — the JSON-LD graph, which is the third copy of "where does this site live"
   * and the only one nothing else in this suite reads.
   *
   * Two defects it was written for, both found live 2026-08-14 on a real `vsor build`
   * and both invisible in a browser:
   *
   *   - the plugin extracted `<meta name=description>` and `<link rel=canonical>` with
   *     quotes-required regexes, while Docusaurus's production minifier emits
   *     `name=description` and `href=https://… ` unquoted. Both missed, so EVERY doc
   *     page's Article carried the site tagline as its description and dropped
   *     `mainEntityOfPage` — under a green `✓ Structured data injected` tick.
   *   - every id and url was built from `siteConfig.url` with no `baseUrl` join, so a
   *     subpath deploy announced its identity and its search endpoint at the origin
   *     root — on github.io, somebody else's page.
   */
  test("S3: the JSON-LD graph names this page and this deployment", ({}, testInfo) => {
    const env = deployEnv(testInfo.project.name);
    const root = env.publicRoot.replace(/\/$/, "");
    const read = (relative: string) => fs.readFileSync(path.join(env.dir, relative), "utf8");
    const jsonLd = (html: string, id: string) => {
      const m = html.match(
        new RegExp(`<script type="application/ld\\+json" id="${id}">([\\s\\S]*?)</script>`),
      );
      expect(m, `the page carries a ${id} block`).toBeTruthy();
      return JSON.parse(m![1].replace(/\\u003c/g, "<"));
    };

    // The homepage's identity nodes live at the site's public root, prefix included.
    const home = read("index.html");
    const website = jsonLd(home, "jsonld-website");
    expect(website["@id"], "the WebSite @id is the deployed site, not the origin root").toBe(
      `${root}/#website`,
    );
    expect(website.url).toBe(root);
    expect(
      website.potentialAction.target.urlTemplate,
      "the advertised search endpoint is the one this site actually serves",
    ).toBe(`${root}/search?q={search_term_string}`);
    expect(jsonLd(home, "jsonld-organization")["@id"]).toBe(`${root}/#organization`);

    // ...and each document's Article describes THAT document.
    const descriptions = new Set<string>();
    for (const route of [corpus.docA(), corpus.docB()]) {
      const html = read(path.join(route, "index.html"));
      const article = jsonLd(html, "jsonld-article");
      const canonical = html.match(/\brel=["']?canonical["']?[^>]*\bhref=["']?([^"'\s>]+)/i);
      expect(canonical, `${route} declares a canonical link`).toBeTruthy();
      expect(
        article.mainEntityOfPage?.["@id"],
        "mainEntityOfPage is the page's own canonical — absent means the extractor missed it",
      ).toBe(canonical![1]);
      expect(article.isPartOf["@id"]).toBe(`${root}/#website`);
      expect(article.description, `${route} has a description`).toBeTruthy();
      descriptions.add(article.description);
    }
    expect(
      descriptions.size,
      "each document's Article carries its OWN description — one value across every page is the site tagline leaking through a failed extraction",
    ).toBe(2);
  });

  /**
   * S6 — the design system, measured on the artifact rather than on the fixture.
   *
   * This row exists because the surface tier could not have caught what shipped in
   * 0.1.2. That tier assembles its fixture by copying packages/sor-site/app, so it
   * inherits the app's own `browserslist`; a real `vsor build` materializes the
   * shell from templates/site_runtime/package.json, which carried none, and
   * browserslist fell back to defaults that include and_qq, and_uc and kaios.
   * postcss-preset-env (installed by Docusaurus with an empty options object) then
   * polyfills every `@layer` into `:not(#\#)` chains, which lifts Tailwind's
   * preflight — `*,::before,::after { margin:0; padding:0; border:0 solid }` — to
   * specificity (2,0,0). No CSS module in the shell can beat that with its single
   * class, so all thirteen lost padding, margin and border at once: the quiz
   * rendered as slabs, the search overlay ignored its `padding: 10vh`, the
   * flashcard became an empty box. 42 browser checks stayed green throughout,
   * because every one of them ran against the fixture.
   *
   * found live 2026-08-15 on the deployed demo. Two fixes hold it shut — the shell
   * manifest now mirrors the app's browserslist, and docusaurus.config.ts disables
   * the polyfill outright — and this row is the one that reads the shipped bytes.
   */
  test("S6: the shipped stylesheet keeps its cascade layers", ({}, testInfo) => {
    const env = deployEnv(testInfo.project.name);
    const sheets = filesUnder(env.dir, (p) => p.endsWith(".css"));
    expect(sheets.length, "the deployable build emits at least one stylesheet").toBeGreaterThan(0);

    const css = sheets.map((p) => fs.readFileSync(p, "utf8")).join("\n");

    // `#\#` is an id selector that matches nothing: `:not(#\#)` is a no-op that buys
    // one id of specificity, and emulating layer order is the only reason to write it.
    const boosted = css.match(/:not\(#\\?#\)/g) ?? [];
    expect(
      boosted.length,
      "the cascade-layer polyfill ran on the SHIPPED build — Tailwind's preflight now " +
        "outranks every CSS module in the shell, and every primitive loses its box",
    ).toBe(0);

    expect(css, "the built stylesheet really carries layers").toMatch(/@layer[^{;]*\bbase\b/);
  });
});
