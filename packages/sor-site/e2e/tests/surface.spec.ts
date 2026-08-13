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
  await page.getByRole("link", { name: "Read the knowledge base" }).click();
  await expect(page.locator("h1")).toHaveText("Karahi");
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
