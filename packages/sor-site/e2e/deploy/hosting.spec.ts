/**
 * The hosting-layout acceptance, browser tier. Driver: tests/acceptance/deploy.sh,
 * which builds ONE project twice with the real `vsor build` — once configured for
 * a ROOT host and once for a SUBPATH host — serves each in the shape that host
 * actually has, and runs this file against both (playwright.deploy.config.ts
 * names the two projects `root` and `subpath`).
 *
 * Why two shapes, stated once so this does not become a second copy of the
 * surface suite: a static site has exactly two deploy shapes and they break
 * differently.
 *
 *   - The ROOT shape (Vercel, Netlify, S3+CloudFront, nginx; baseUrl "/") breaks
 *     quietly, in its machine-readable half — sitemap, canonical, og:url naming
 *     whatever `url` said at build time. That half is S1/D6/D7.
 *   - The SUBPATH shape (a GitHub Pages project site, an internal path; baseUrl
 *     "/<name>/") breaks loudly and completely: Docusaurus prefixes every asset,
 *     route and router link with baseUrl, so a mismatch 404s the entire site.
 *     That half is S2/D1–D5/D8/D9.
 *
 * Both families run against both shapes, because either can pass in one shape
 * and fail in the other. The subpath server serves the PARENT directory, so the
 * site genuinely lives under the prefix rather than being pretend-nested by a
 * rewrite — D9 proves that about the harness itself.
 */
import {
  test,
  expect,
  clickSidebarLink,
  corpus,
  deployEnv,
  escapeRe,
  need,
  requestUrls,
} from "./harness";

// ── D1–D5: the site works where it is served ────────────────────────────────

test("D1: the homepage answers 200 and carries the project name", async ({ page }) => {
  const response = await page.goto("");
  expect(response, "GET of the deployed root returned a response").toBeTruthy();
  expect(response!.status()).toBe(200);
  await expect(page).toHaveTitle(new RegExp(escapeRe(corpus.title())));
});

test("D2: a document page renders — its heading and its own text", async ({ page }) => {
  await page.goto(`${corpus.docB()}/`);
  await expect(page.locator("h1")).toHaveText(corpus.docBHeading());
  await expect(page.locator("article").getByText(corpus.phrase()).first()).toBeVisible();
});

test("D3: the stylesheet and the scripts load, and the stylesheet reaches the page", async ({
  page,
}) => {
  const loaded = { css: [] as string[], js: [] as string[] };
  page.on("response", (response) => {
    if (response.status() !== 200) return;
    const type = (response.headers()["content-type"] ?? "").toLowerCase();
    if (type.includes("text/css")) loaded.css.push(response.url());
    else if (type.includes("javascript")) loaded.js.push(response.url());
  });
  await page.goto("");

  // Counting 200s, not <link> tags: a 404 also has a tag. This is the row the
  // subpath shape exists to make — a build carrying baseUrl "/" served under
  // "/name/" asks for /assets/css/… from a document root that has no assets/.
  expect(loaded.css.length, "at least one stylesheet responded 200").toBeGreaterThan(0);
  expect(loaded.js.length, "at least one script responded 200").toBeGreaterThan(0);

  // ...and it reached the document. A 200 proves the bytes were served; only a
  // computed value proves the browser applied them. --ifm-color-primary is
  // declared by the project's own site/src/css/custom.css, so an empty value
  // means the project's stylesheet never arrived even if the runtime's did.
  const primary = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--ifm-color-primary").trim(),
  );
  expect(primary, "--ifm-color-primary computes, so the built CSS applied").not.toBe("");
});

test("D4: a sidebar link navigates client-side, under the deployed prefix", async ({
  page,
}, testInfo) => {
  const env = deployEnv(testInfo.project.name);
  await page.goto(`${corpus.docA()}/`);

  const link = page
    .locator("nav.menu")
    .getByRole("link", { name: corpus.docBHeading(), exact: true })
    .first();
  await expect(link, "the sidebar lists the other document").toBeVisible();

  // The href a crawler follows must ALREADY carry the prefix: a router that
  // fixed it up at click time would still hand a crawler — and a right-click
  // "open link in new tab" — a 404.
  const href = await link.getAttribute("href");
  expect(href, "the sidebar link is prefixed with the deployed baseUrl").toMatch(
    new RegExp(`^${escapeRe(env.base)}`),
  );

  // A flag that survives only if the click did NOT reload the document: the
  // proof that the JS bundle hydrated and the router took the click, which no
  // amount of served-bytes checking can show.
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__vsorSpa = true;
  });
  await clickSidebarLink(page, corpus.docBHeading());
  await expect(page).toHaveURL(new RegExp(`${escapeRe(env.base + corpus.docB())}/?$`));
  await expect(page.locator("h1"), "the click routes to the document it advertises").toHaveText(
    corpus.docBHeading(),
  );
  expect(
    await page.evaluate(() => (window as unknown as Record<string, unknown>).__vsorSpa === true),
    "the navigation was client-side — the bundle hydrated and the router handled the click",
  ).toBe(true);
});

test("D5: search finds the phrase and its result renders", async ({ page }) => {
  await page.goto("");
  // The search index is fetched at runtime from a path the component derives
  // from window.location — the one piece of this site that has to work out the
  // deployed prefix by itself, and therefore the one most likely to work only
  // at baseUrl "/".
  await page.locator('[data-vsor="search-button"]').click();
  await page.locator('[data-vsor="search-input"]').fill(corpus.phrase());
  await page
    .getByRole("listbox", { name: "Search results" })
    .getByRole("link", { name: new RegExp(escapeRe(corpus.docBHeading())) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(escapeRe(corpus.docB())));
  await expect(page.locator("h1")).toHaveText(corpus.docBHeading());
});

// ── D6–D7: the site says where it lives ─────────────────────────────────────

test("D6: sitemap.xml names the real host, never the machine that served it", async ({
  page,
}, testInfo) => {
  const env = deployEnv(testInfo.project.name);
  const response = await page.request.get(`${env.base}sitemap.xml`);
  expect(response.status(), "sitemap.xml is served").toBe(200);
  const locations = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(
    locations.length,
    "the sitemap has routes — an empty one would make this row vacuous",
  ).toBeGreaterThan(0);

  expect(
    locations.filter((loc) => !loc.startsWith(env.publicRoot)),
    `every <loc> is under ${env.publicRoot} — a sitemap naming the build machine, or naming the ` +
      "origin root instead of the deployed subdirectory, is the defect this row exists for",
  ).toEqual([]);
  expect(
    locations.filter((loc) => /localhost|127\.0\.0\.1/.test(loc)),
    "no <loc> names localhost — the scaffold placeholder must not survive a deploy",
  ).toEqual([]);
});

test("D7: canonical and og:url name the real host — in the served bytes and in the DOM", async ({
  page,
}, testInfo) => {
  const env = deployEnv(testInfo.project.name);
  const expected = `${env.publicRoot}${corpus.docA()}`;

  // 1 — the served bytes: what a crawler that runs no JavaScript reads. Exact,
  // because the SSG pass emits exactly one form.
  const served = await (await page.request.get(`${env.base}${corpus.docA()}/`)).text();
  const attr = (re: RegExp) => (served.match(re) ?? [])[1] ?? null;
  expect(
    attr(/<link [^>]*rel="?canonical"?[^>]*href="?([^"\s>]+)"?/),
    "canonical in the served HTML",
  ).toBe(expected);
  expect(
    attr(/<meta [^>]*property="?og:url"?[^>]*content="?([^"\s>]+)"?/),
    "og:url in the served HTML",
  ).toBe(expected);
  expect(
    attr(/<meta [^>]*property="?og:image"?[^>]*content="?([^"\s>]+)"?/),
    "og:image is absolute on the real host — a link preview fetches it from there",
  ).toMatch(new RegExp(`^${escapeRe(env.publicRoot)}`));

  // 2 — the DOM, after hydration and again after a client-side navigation. The
  // router rebuilds the head through react-helmet rather than the SSG pass, so
  // it can regress on its own; a stale canonical is how two routes end up
  // claiming to be one page.
  //
  // Trailing slash, measured 2026-08-14: the SSG pass emits the slashless form
  // while the hydrated head mirrors the URL the visitor actually requested, so
  // `/docs/x/` self-canonicalizes WITH the slash. Both name the same page and
  // the difference is Docusaurus's own, so the DOM half compares
  // slash-insensitively rather than pinning behaviour this framework does not own.
  const head = async () => ({
    canonical: await page.locator('link[rel="canonical"]').getAttribute("href"),
    ogUrl: await page.locator('meta[property="og:url"]').getAttribute("content"),
  });
  const trim = (value: string | null) => (value ?? "").replace(/\/$/, "");

  await page.goto(`${corpus.docA()}/`);
  const onLoad = await head();
  expect(trim(onLoad.canonical), "canonical after hydration").toBe(expected);
  expect(trim(onLoad.ogUrl), "og:url after hydration").toBe(expected);

  await clickSidebarLink(page, corpus.docBHeading());
  await expect(page.locator("h1")).toHaveText(corpus.docBHeading());
  const routed = await head();
  expect(trim(routed.canonical), "the router rewrote canonical to the page actually shown").toBe(
    `${env.publicRoot}${corpus.docB()}`,
  );
  expect(trim(routed.ogUrl), "og:url was rewritten with it").toBe(trim(routed.canonical));
});

// ── D8–D9: the host's own view ──────────────────────────────────────────────

test("D8: every asset a page declares resolves 200 from the host's document root", async ({
  page,
}, testInfo) => {
  const env = deployEnv(testInfo.project.name);
  // Fetched rather than browsed, on purpose. Measured 2026-08-14: a headless
  // browser does not request declared favicons, so the guard above cannot see a
  // broken <link rel=icon> at all — a real 404 on every page load for every
  // visitor passed the browser tier untouched. This row asks for each declared
  // URL itself, so "the browser happened not to fetch it" stops being a defence.
  const failures: string[] = [];
  for (const route of ["", `${corpus.docA()}/`, `${corpus.docB()}/`]) {
    const pageUrl = `${env.base}${route}`;
    const html = await (await page.request.get(pageUrl)).text();
    const seen = new Set<string>();
    for (const raw of requestUrls(html)) {
      const url = raw.trim();
      if (!url || url.startsWith("#")) continue;
      if (/^(data|about|javascript|mailto):/i.test(url)) continue;
      if (url.startsWith("//") || /^[a-zA-Z][\w+.-]*:/.test(url)) continue; // off-host: S2's business
      const absolute = new URL(url, `${env.served}${pageUrl}`).pathname;
      if (seen.has(absolute)) continue;
      seen.add(absolute);
      const status = (await page.request.get(absolute)).status();
      if (status !== 200) failures.push(`${pageUrl} -> ${absolute}: HTTP ${status}`);
    }
  }
  expect(failures, "every declared asset is where this host would serve it from").toEqual([]);
});

test("D9: the deployed prefix is real — the host's document root is above the site", async ({
  page,
}, testInfo) => {
  const env = deployEnv(testInfo.project.name);
  test.skip(
    env.base === "/",
    "the root shape has no prefix to prove — the build IS the document root",
  );

  // The parent really is what the server hands out at "/": the driver put a
  // marker there. Without this row a "subpath" run could be a root run with a
  // cosmetic path, and every prefix assertion above would be theatre.
  const marker = await page.request.get(`/${need("VSOR_DEPLOY_PARENT_MARKER")}`);
  expect(marker.status(), "the static server's document root is the site's PARENT").toBe(200);

  // ...and the site is not also reachable without its prefix: strip the base
  // from a real asset path and the host must 404 — which is exactly what a build
  // whose baseUrl did not match the host would be asking for.
  const html = await (await page.request.get(env.base)).text();
  const asset = requestUrls(html).find((u) => u.startsWith(env.base) && u.endsWith(".js"));
  expect(asset, "the homepage references a prefixed script to test with").toBeTruthy();
  const unprefixed = `/${asset!.slice(env.base.length)}`;
  expect(
    (await page.request.get(unprefixed)).status(),
    `${unprefixed} must 404 — the site lives under ${env.base}, and a build that got baseUrl wrong would be asking for exactly this`,
  ).toBe(404);
});
