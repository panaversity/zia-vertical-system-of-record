/**
 * B17 — effective dating and supersession, in a browser.
 *
 * Numbered B17 in code; the spec wording is queued with the lead (specs/ is not edited in
 * this change). It is the browser half of the level-0 answer to the framework's own second
 * design test, "provenance is not correctness": the case that hurts a regulated vertical is
 * not an uncited claim but a correctly cited rule that stopped being true, served with a
 * perfect citation. A citation cannot catch it and an abstention gate cannot either — the
 * corpus does cover the question. So the document says so itself, and this tier is what
 * proves a reader can SEE it.
 *
 * The corpus side is two fixture documents in tests/fixtures/tiny:
 *
 *   when-a-record-changes.md   `effective: 2026-02-01` — the dated document
 *   when-a-record-changed.md   `effective: 2024-03-15` + `superseded_by:` the one above
 *
 * `packages/vsor/tests/test_knowledge.py` gates the same pair from the python side: it
 * asserts the fixture still carries the keys (so these assertions cannot quietly start
 * passing against nothing) and that `vsor build` would accept this corpus (so this tier
 * cannot certify a corpus the verb refuses).
 *
 * What is measured, and why in this shape:
 *
 *   - ABOVE THE CONTENT, by document order rather than by pixels. A notice below the text
 *     is a notice that arrives after the damage, and "above" is the only part of this
 *     feature that is a promise rather than a decoration.
 *   - THE LINK RESOLVES AND IS WALKED. The successor's URL comes from the docs plugin's
 *     own global data, so a broken resolution renders a notice with no link at all —
 *     which looks fine and is the exact failure this feature exists to prevent. Clicking
 *     through is the only assertion that separates the two.
 *   - IT KEEPS ITS BOX, by computed style, in BOTH themes. B15's lesson: Tailwind's
 *     preflight, boosted over single-class module rules by Docusaurus's cascade-layer
 *     polyfill, zeroes borders and padding while every other tier stays green — and a
 *     token declared only in `:root` paints nothing in dark mode with no console error.
 *   - THE CONTROL. A document carrying neither key renders neither element. Without it
 *     every assertion here would also pass against a build that showed the notice on
 *     every page of the corpus.
 *
 * B8 (same-origin, zero >= 400) and B11 (zero console.error / pageerror) ride on every
 * navigation through the harness guard — which is also what catches the hydration
 * mismatch a locale-formatted date would cause.
 *
 * Falsified 2026-08-15 before being trusted: rebuilt with the two components unmounted from
 * `theme/DocItem/Content/index.tsx` and nothing else changed. The three assertions above
 * went red; the control passed, which is the point of it — an absence test proves nothing
 * on its own and is only worth having beside tests that fail when the feature is gone.
 */
import { test, expect } from "./harness";

/** The superseded document, and the one that replaced it. */
const SUPERSEDED = "/docs/when-a-record-changed/";
const CURRENT = "/docs/when-a-record-changes/";
/** A document that carries neither key — the control. */
const UNDATED = "/docs/system-of-record/";

const NOTICE = "[data-vsor-superseded='true']";
const EFFECTIVE = "[data-vsor-effective]";

test("B17: a dated document shows the day its content took effect", async ({ page }) => {
  await page.goto(CURRENT);

  const effective = page.locator(EFFECTIVE);
  await expect(effective, "the effective date reaches the page").toBeVisible();
  // The authored value, verbatim. An unquoted YAML day arrives in the bundle as a real
  // Date, so this also proves the normalization: rendered raw it would be an object React
  // refuses to render, and formatted by locale it would differ between the build machine
  // and the browser (a hydration mismatch B11 fails on).
  await expect(effective).toContainText("Effective");
  await expect(effective).toContainText("2026-02-01");
  await expect(
    effective.locator("time"),
    "the day is machine-readable as well as legible",
  ).toHaveAttribute("datetime", "2026-02-01");

  await expect(page.locator(NOTICE), "a current document carries no notice").toHaveCount(0);
});

test("B17: a superseded document says so above its content, and the link is walkable", async ({
  page,
}) => {
  await page.goto(SUPERSEDED);

  const notice = page.locator(NOTICE);
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Superseded");
  await expect(notice).toContainText("no longer current");

  // ABOVE the content, asserted as document order — the promise is "before the first
  // sentence a reader can quote", which is a DOM fact and not a layout one.
  const heading = page.locator("article h1").first();
  await expect(heading).toBeVisible();
  const precedes = await page.evaluate(
    ([noticeSel, headingSel]) => {
      const a = document.querySelector(noticeSel);
      const b = document.querySelector(`${headingSel} h1`) ?? document.querySelector("h1");
      if (!a || !b) return false;
      // DOCUMENT_POSITION_FOLLOWING: b comes after a in document order.
      return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    },
    [NOTICE, "article"],
  );
  expect(precedes, "the notice precedes the document's own heading").toBe(true);

  // The date it took effect stays on a superseded document: it is what lets a reader
  // decide whether this page answers a question about the year it covered.
  await expect(page.locator(EFFECTIVE)).toContainText("2024-03-15");

  // The successor, resolved through the docs plugin's own data — its label is the
  // successor's TITLE, which proves the resolution rather than an echo of the raw path.
  const link = notice.getByRole("link");
  await expect(link, "a named successor is a link, not prose").toHaveCount(1);
  await expect(link).toHaveText("When a Record Changes");

  // …and it LOOKS like one. found live 2026-08-15 against a real `vsor build`: Tailwind's
  // base `a { text-decoration: inherit }` arrives boosted to (2,0,1) by the cascade-layer
  // polyfill, CSS modules are not boosted at all, and the successor rendered as plain bold
  // text — a link nobody could tell was a link, in the one band whose whole job is to send
  // the reader somewhere else. Every other assertion in this file stayed green through it.
  const decoration = await link.evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(decoration, "the successor is visibly a link, not colour-only bold text").toContain(
    "underline",
  );

  await link.click();
  await expect(
    page.locator("article h1").first(),
    "the link lands on the document that replaced this one",
  ).toHaveText("When a Record Changes");
  await expect(page.locator(NOTICE), "…which is itself current").toHaveCount(0);
});

test("B17: the notice keeps its own box in both themes", async ({ page }) => {
  for (const theme of ["light", "dark"] as const) {
    await page.goto(`${SUPERSEDED}?docusaurus-theme=${theme}`);
    const box = await page.locator(NOTICE).evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        display: cs.display,
        borderLeftWidth: parseFloat(cs.borderLeftWidth),
        paddingTop: parseFloat(cs.paddingTop),
        paddingLeft: parseFloat(cs.paddingLeft),
        background: cs.backgroundColor,
        height: el.getBoundingClientRect().height,
      };
    });
    // EffectiveDating.module.css: a flex row with a 4px accent rule and 0.875rem/1rem
    // padding. Floors, not equalities — this catches a stripped box, it does not freeze a
    // decoration.
    expect(box.display, `${theme}: the icon and the text lay out on a row`).toBe("flex");
    expect(box.borderLeftWidth, `${theme}: the 4px rule survives preflight`).toBeGreaterThanOrEqual(4);
    expect(box.paddingTop, `${theme}: the vertical padding survives`).toBeCloseTo(14, 0);
    expect(box.paddingLeft, `${theme}: the horizontal padding survives`).toBeGreaterThanOrEqual(16);
    // A token declared only under `:root` computes to nothing in dark mode: the build is
    // green, no console error is logged, and the band is invisible.
    expect(
      box.background,
      `${theme}: the notice paints a background from a token declared in this theme`,
    ).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(box.height, `${theme}: an unstyled notice collapses to a bare line`).toBeGreaterThan(40);
  }
});

test("B17: a document carrying neither key renders neither element", async ({ page }) => {
  // The control. Without it, a build that mounted the notice unconditionally — or one
  // where `isSuperseded` always answered true — would pass every assertion above.
  await page.goto(UNDATED);
  await expect(page.locator("article h1").first()).toBeVisible();
  await expect(page.locator(NOTICE)).toHaveCount(0);
  await expect(page.locator(EFFECTIVE)).toHaveCount(0);
});
