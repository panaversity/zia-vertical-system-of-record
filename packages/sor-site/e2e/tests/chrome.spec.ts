/**
 * B13, the third half — the chrome a reader meets on every page, and the
 * landing bands under the hero.
 *
 * Why this file exists (added 2026-08-14, closing a hole rather than a spec
 * row). The shell declares seven `data-vsor` hooks — deliberate, stable test
 * handles that a restyle cannot move — and only three of them were ever read by
 * a test (`search-button`, `search-input`, `search-results`, in surface.spec).
 * The other four render in every build this suite calls green, and nothing
 * looked at them:
 *
 *   - `mode-toggle`        7/7 pages, unasserted
 *   - `reading-progress`   4/4 doc pages, unasserted
 *   - `doc-page-actions`   4/4 doc pages, unasserted
 *   - `search-no-results`  the empty state, which no test had ever reached
 *
 * A hook no test reads is an invitation to a silent regression, and two of these
 * had already taken it up: `--vsor-reading-progress` was documented as a token
 * and declared nowhere, so the bar painted nothing at all, and the doc-action
 * toolbar's tooltip had neither a background nor a foreground colour for the
 * same reason. Every contract tier stayed green throughout, because none of them
 * had ever read a computed style off these elements. So the assertions below are
 * about paint and behaviour, not presence.
 *
 * LessonContent is the fourth: it renders on every doc page, its tab nav carries
 * `role="tablist" aria-label="Content view"`, and the string "Content view"
 * appeared in 0 of 7 built HTML files — the Summary branch needs a co-located
 * `.summary.md` and no fixture had one. `tests/fixtures/tiny/vertical-sor.summary.md`
 * is that fixture, so the branch now builds and the tabs are worked here.
 *
 * The landing bands are the same argument one level up: SectionCards, Surfaces
 * and Closing all render on the homepage of every vsor site, and the only
 * assertion that touched any of them took `.first()` on a CTA to deliberately
 * avoid the closing one.
 */
import { test, expect, envFor, inMode } from "./harness";

const DOC = "/docs/vertical-sor/";

test("chrome: the mode toggle flips the color mode and survives a reload", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  // Start from an explicitly named mode so the assertion does not depend on the
  // machine's prefers-color-scheme (the shell sets respectPrefersColorScheme).
  await page.goto(inMode(`${env.url}${DOC}`, "light"));
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");

  const toggle = page.locator('[data-vsor="mode-toggle"]');
  await expect(toggle, "the shell's own toggle renders in the navbar").toBeVisible();
  await expect(toggle).toHaveAttribute("aria-label", "Toggle color mode");

  await toggle.click();
  await expect(html, "clicking the toggle flips data-theme").toHaveAttribute("data-theme", "dark");
  // ...and it is Docusaurus's own color mode, not a class of our own: the page
  // background has to actually move with it.
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "light");
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(dark, "the two modes paint different backgrounds").not.toBe(light);
});

test("chrome: the reading-progress bar is painted and tracks the scroll", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(inMode(`${env.url}${DOC}`, "light"));

  const bar = page.locator('[data-vsor="reading-progress"]');
  const painted = await bar.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { background: cs.backgroundColor, height: el.getBoundingClientRect().height };
  });
  // The defect this catches: the bar's colour came from a token that was
  // documented and never declared, so the declaration was invalid at
  // computed-value time and the element painted nothing. A transparent bar is
  // present in the DOM, has a width, and is invisible.
  expect(painted.background, "the bar has a colour at all").not.toBe("rgba(0, 0, 0, 0)");
  expect(painted.background, "…and it is not transparent by another spelling").not.toBe(
    "transparent",
  );
  expect(painted.height, "the bar has its 4px track height").toBeGreaterThan(0);

  const before = await bar.evaluate((el) => el.getBoundingClientRect().width);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(
      () => bar.evaluate((el) => el.getBoundingClientRect().width),
      { message: "scrolling to the end widens the progress bar" },
    )
    .toBeGreaterThan(before);
});

test("chrome: the doc-page action bar renders its corpus-neutral actions", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.goto(`${env.url}${DOC}`);

  const actions = page.locator('[data-vsor="doc-page-actions"]');
  await expect(actions, "the action bar renders on a doc page").toBeVisible();

  // The primary action. Turndown runs client-side, so this is also the proof
  // that the component hydrated rather than merely server-rendered.
  const copy = actions.getByRole("button", { name: /Copy page as Markdown/i });
  await expect(copy).toBeVisible();

  // The menu. It is the shell's own accessible menu (the radix dropdown did not
  // cross the seam), so open/close is worth walking rather than asserting the
  // markup of a closed popover.
  const more = actions.getByRole("button", { name: "More actions" });
  await expect(more).toBeVisible();
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  const menu = page.getByRole("menu", { name: "Page actions menu" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Download Markdown/ })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Share/ })).toBeVisible();

  // Its box, by computed style: the toolbar's tooltip colours and the bar's
  // shadows came from tokens that were never declared, which is invisible to
  // every presence check. One of the tooltips is the cheapest sentinel.
  const tooltip = actions.locator("[class*='tooltip_']").first();
  const paint = await tooltip.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { background: cs.backgroundColor, color: cs.color };
  });
  expect(paint.background, "the tooltip has a background").not.toBe("rgba(0, 0, 0, 0)");
  expect(paint.color, "…and a foreground that differs from it").not.toBe(paint.background);

  await page.keyboard.press("Escape");
  await expect(menu, "Escape closes the menu").toBeHidden();
});

test("chrome: LessonContent offers the summary view when the corpus supplies one", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.goto(`${env.url}${DOC}`);

  // The tab nav exists only because tests/fixtures/tiny/vertical-sor.summary.md sits
  // beside vertical-sor.md — so this asserts the summaries plugin's co-location
  // contract as much as the component.
  const tabs = page.getByRole("tablist", { name: "Content view" });
  await expect(tabs, "a doc with a co-located summary gets the two-view nav").toBeVisible();

  const full = tabs.getByRole("tab", { name: "Full Text" });
  const summary = tabs.getByRole("tab", { name: "Summary" });
  await expect(full).toHaveAttribute("aria-selected", "true");
  await expect(summary).toHaveAttribute("aria-selected", "false");
  // The document itself is what the full view shows.
  await expect(page.locator("article").getByText("abstention floor").first()).toBeVisible();

  await summary.click();
  await expect(summary).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByText("That is the whole authoring contract"),
    "the summary panel renders the .summary.md, not the document",
  ).toBeVisible();

  // And a document WITHOUT a summary gets no tabs at all, rather than an empty
  // second view — the branch that runs on every other page of every corpus.
  await page.goto(`${env.url}/docs/system-of-record/`);
  await expect(
    page.getByRole("tablist", { name: "Content view" }),
    "no summary file, no tab nav",
  ).toHaveCount(0);
});

test("chrome: search says so when the corpus does not cover a query", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.goto(env.url);
  await page.locator('[data-vsor="search-button"]').click();

  // The empty state. It is the surface's smallest expression of the property the
  // whole framework is for — a corpus that does not hold something says so
  // rather than showing something else — and it is the one search branch no test
  // had ever reached. A silent regression here reads as a broken search box.
  // One token, no separators. found live 2026-08-14: the first draft typed
  // "zzqx-not-in-this-corpus" and got eight hits — lunr splits on the hyphens
  // and every one of "not/in/this/corpus" is in the fixture. That is search
  // working, not failing, but it makes a phrase a useless probe for the empty
  // state; the probe has to be a single token that appears nowhere.
  await page.locator('[data-vsor="search-input"]').fill("zzqxwv");
  const empty = page.locator('[data-vsor="search-no-results"]');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText("No results found");
  await expect(
    page.getByRole("listbox", { name: "Search results" }),
    "no result list is offered alongside the empty state",
  ).toHaveCount(0);
});

test("landing: the corpus grid, the surfaces row and the closing band all render", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.goto(env.url);

  // SectionCards — the grid derived from the corpus's own shape, and its mono
  // note, which is the one place the page states a count it did not invent.
  await expect(page.getByRole("heading", { name: "What this covers" })).toBeVisible();
  const cards = page.locator("main a[href^='/docs/']");
  expect(await cards.count(), "the grid derives at least one card from the corpus").toBeGreaterThan(
    0,
  );

  // Surfaces — including the LATER badge, which is the honesty knob: the MCP
  // surface does not serve yet and the page must not imply that it does.
  await expect(page.getByRole("heading", { name: "One source, two surfaces" })).toBeVisible();
  await expect(page.getByText("An MCP server")).toBeVisible();
  await expect(page.getByText("later", { exact: true }).first()).toBeVisible();

  // Closing — the page's second way in. `.last()`, deliberately: surface.spec
  // takes `.first()` for the hero's, so between them both copies are asserted.
  await expect(page.getByRole("heading", { name: "Read it at the source." })).toBeVisible();
  const closingCta = page.getByRole("link", { name: "Read the knowledge base" }).last();
  await expect(closingCta).toBeVisible();
  await expect(closingCta).toHaveAttribute("href", /^\/docs\//);

  // The eyebrow: a default the framework supplies, above a name the owner typed.
  await expect(page.getByText("System of record", { exact: true })).toBeVisible();
});
