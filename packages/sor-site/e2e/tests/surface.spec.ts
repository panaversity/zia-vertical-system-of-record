/**
 * Browser tier — Acceptance B9, B10, B11, B13 of specs/sor-site/surface/spec.md.
 *
 * B8 (all requests same-origin, zero >= 400) and B11 (zero console.error /
 * pageerror) are enforced by the harness guard on EVERY page these tests visit —
 * each navigation below is also a B8/B11 assertion. B14 is the config: the
 * identical file runs as the `stock` and `themed` Playwright projects.
 */
import type { Page } from "@playwright/test";
import { test, expect, envFor } from "./harness";

const PHRASE = "shorba-x7q1"; // the fixture's unique search phrase (fixtures/tiny/karahi.md)

test("B9: GET / returns 200 and the title carries the instance name", async ({ page }, testInfo) => {
  const env = envFor(testInfo.project.name);
  const response = await page.goto("/");
  expect(response, "GET / returned a response").toBeTruthy();
  expect(response!.status()).toBe(200);
  await expect(page).toHaveTitle(new RegExp(env.manifest.instanceName));
});

test("B10: the karahi doc renders — h1 from frontmatter, unique phrase in body", async ({ page }) => {
  await page.goto("/docs/karahi/");
  await expect(page.locator("h1")).toHaveText("Karahi");
  await expect(page.getByText(PHRASE)).toBeVisible();
});

test("B11: the main pages load clean (guard asserts zero console.error/pageerror)", async ({ page }) => {
  // The guard fixture collects console.error/pageerror and any B8 offense on
  // every page; this test walks the surface so "across all visited pages"
  // includes home, a doc page, and a client-side navigation between them.
  await page.goto("/");
  // The themed homepage derives its call to action from the corpus itself (the
  // docs plugin's mainDocId), so the destination is the corpus's own main
  // document, not a route this harness picks — the old hardcoded "Karahi" would
  // now assert the fixture's shape rather than the site's behaviour. Derive it
  // instead, and keep the check strong: the client-side navigation must land on
  // exactly the advertised href AND render the same document a cold load of
  // that href renders. That catches a broken CTA, a routing mismatch, and a
  // hydration-only doc page, none of which a bare "some h1 is visible" would.
  const ctaName = "Read the knowledge base";
  const href = await page.getByRole("link", { name: ctaName }).getAttribute("href");
  expect(href, "the call to action carries a corpus route").toMatch(/^\/docs\//);

  // Cold-load the advertised destination first and learn what it renders, so
  // the routed assertion below has something exact to compare against without
  // hardcoding a fixture title.
  await page.goto(href!);
  const coldTitle = (await page.locator("h1").innerText()).trim();
  expect(coldTitle, "the destination renders a title on a cold load").not.toBe("");

  // Now the walk: home -> click -> the SPA must arrive at the same document.
  //
  // found live 2026-08-14: this assertion must be the auto-retrying `expect`
  // form, never a one-shot innerText() after `toHaveURL`. Client-side routing
  // updates the URL *before* the new route renders, so a bare read here returns
  // the landing page's hero h1 and the test fails against its own race rather
  // than against the site. Written this way it waits for the render, which is
  // also the thing worth asserting.
  await page.goto("/");
  await page.getByRole("link", { name: ctaName }).click();
  await expect(page).toHaveURL(new RegExp(`${href}/?$`));
  await expect(page.locator("h1"), "the click routes to the document it advertises").toHaveText(
    coldTitle,
  );
  await page.goto("/docs/biryani/");
  await expect(page.locator("h1")).toBeVisible();
});

test("B13: the quiz renders and a click shows feedback", async ({ page }) => {
  await page.goto("/docs/karahi/");
  await expect(page.getByText("Karahi check")).toBeVisible();
  // The Quiz contract: exactly four options (spec, positive contract).
  const feedback = page.getByRole("region", { name: "Question feedback" });
  await expect(feedback).toHaveCount(0);
  await page.getByRole("button", { name: "Onions" }).click();
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText("no onions"); // the fixture's explanation text
});

/**
 * The two configs expose different SearchBar UIs by design — the theme package
 * shadows the stock one ("changes look, never contract") — so the *interaction*
 * branches per variant while the assertion is identical: type the unique
 * phrase, a result links to the karahi doc, click it, the doc renders.
 */
async function searchFor(page: Page, variant: string, phrase: string): Promise<void> {
  if (variant === "themed") {
    await page.locator('[data-vsor="search-button"]').click();
    await page.locator('[data-vsor="search-input"]').fill(phrase);
    await page
      .getByRole("listbox", { name: "Search results" })
      .getByRole("link", { name: /Karahi/ })
      .first()
      .click();
  } else {
    const input = page.locator(".navbar__search-input");
    await input.click();
    await input.fill(phrase);
    // found live (2026-08-13): pressing Enter immediately raced the
    // autocomplete's debounced suggestion fetch — the keydown landed before
    // the dropdown existed and navigated nowhere. The dropdown's own
    // "See all results" link is DOM state Playwright can await, and it goes
    // to the same local-index search page the Enter path targets.
    await page.getByRole("link", { name: "See all results" }).click();
    await expect(page).toHaveURL(/search/);
    // found live: the local-index search page titles each hit by its SECTION
    // heading ("Serving"), with the page title as a sub-line — so assert
    // B13's own wording directly: a result LINKS TO that doc; click it.
    await page.locator('article a[href*="/docs/karahi"]').first().click();
  }
}

test("B13: search finds the unique phrase and the result renders the doc", async ({ page }, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.goto("/");
  await searchFor(page, env.variant, PHRASE);
  await expect(page).toHaveURL(/\/docs\/karahi/);
  await expect(page.locator("h1")).toHaveText("Karahi");
  await expect(page.getByText(PHRASE)).toBeVisible();
});
