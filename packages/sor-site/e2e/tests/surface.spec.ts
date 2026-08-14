/**
 * Browser tier — Acceptance B9, B10, B11, B13 of specs/sor-site/surface/spec.md.
 *
 * B8 (all requests same-origin, zero >= 400) and B11 (zero console.error /
 * pageerror) are enforced by the harness guard on EVERY page these tests visit —
 * each navigation below is also a B8/B11 assertion. B14's two-configuration
 * reading no longer applies: there is one configuration a vsor project can
 * produce (see playwright.config.ts).
 */
import { test, expect, envFor } from "./harness";

const PHRASE = "abstention floor"; // the fixture's unique search phrase (fixtures/tiny/vertical-sor.md)

test("B9: GET / returns 200 and the title carries the instance name", async ({ page }, testInfo) => {
  const env = envFor(testInfo.project.name);
  const response = await page.goto("/");
  expect(response, "GET / returned a response").toBeTruthy();
  expect(response!.status()).toBe(200);
  await expect(page).toHaveTitle(new RegExp(env.manifest.instanceName));
});

test("B10: the vertical-sor doc renders — h1 from frontmatter, unique phrase in body", async ({ page }) => {
  await page.goto("/docs/vertical-sor/");
  await expect(page.locator("h1")).toHaveText("The Vertical System of Record");
  await expect(page.locator("article").getByText(PHRASE).first()).toBeVisible();
});

test("B11: the main pages load clean (guard asserts zero console.error/pageerror)", async ({ page }) => {
  // The guard fixture collects console.error/pageerror and any B8 offense on
  // every page; this test walks the surface so "across all visited pages"
  // includes home, a doc page, and a client-side navigation between them.
  await page.goto("/");
  // The homepage derives its call to action from the corpus itself (the
  // docs plugin's mainDocId), so the destination is the corpus's own main
  // document, not a route this harness picks — the old hardcoded title would
  // now assert the fixture's shape rather than the site's behaviour. Derive it
  // instead, and keep the check strong: the client-side navigation must land on
  // exactly the advertised href AND render the same document a cold load of
  // that href renders. That catches a broken CTA, a routing mismatch, and a
  // hydration-only doc page, none of which a bare "some h1 is visible" would.
  // .first(): the landing page states its call to action twice — once in the
  // hero, once in the closing band — and they are the same derived link. The
  // walk below only needs one of them.
  const ctaName = "Read the knowledge base";
  const href = await page.getByRole("link", { name: ctaName }).first().getAttribute("href");
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
  await page.getByRole("link", { name: ctaName }).first().click();
  await expect(page).toHaveURL(new RegExp(`${href}/?$`));
  await expect(page.locator("h1"), "the click routes to the document it advertises").toHaveText(
    coldTitle,
  );
  await page.goto("/docs/system-of-record/");
  await expect(page.locator("h1")).toBeVisible();
});

test("B13: the quiz renders and a click shows feedback", async ({ page }) => {
  await page.goto("/docs/one-source-two-surfaces/");
  // Anchored on the QUESTION, not the quiz's own <h2>: Quiz.module.css sets
  // `.quizTitle { display: none }` (the doc's own heading already names the
  // quiz), so the title is rendered-but-hidden by design and asserting it
  // visible would fail for a styling decision rather than a broken primitive.
  await expect(page.getByText("What makes a system of record different")).toBeVisible();
  // The Quiz contract: exactly four options (spec, positive contract).
  const feedback = page.getByRole("region", { name: "Question feedback" });
  await expect(feedback).toHaveCount(0);
  await page.getByRole("button", { name: /authoritative source/ }).click();
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText("Authority is the distinguishing property"); // the fixture's explanation text
});

/**
 * Search is the shell's own SearchBar (src/components/SearchBar) over the local
 * lunr index — the shadcn command dialog, not Docusaurus's navbar input. It used
 * to branch per variant, because the stock configuration exposed the
 * search-local plugin's own UI instead; with one configuration the interaction
 * is one path, and the data hooks it drives (`data-vsor="search-*"`, the results
 * listbox) are the shell's own attributes rather than class names a restyle
 * could move.
 */
test("B13: search finds the unique phrase and the result renders the doc", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-vsor="search-button"]').click();
  await page.locator('[data-vsor="search-input"]').fill(PHRASE);
  await page
    .getByRole("listbox", { name: "Search results" })
    .getByRole("link", { name: /Vertical System of Record/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/docs\/vertical-sor/);
  await expect(page.locator("h1")).toHaveText("The Vertical System of Record");
  await expect(page.locator("article").getByText(PHRASE).first()).toBeVisible();
});
