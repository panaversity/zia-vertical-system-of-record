/**
 * Acceptance B12 — seam liveness (specs/sor-site/surface/spec.md).
 *
 * The driver builds the site twice: once normally and once with sentinel values
 * stamped into exactly three native seams of the PROJECT's authored site —
 * themeConfig.navbar.title, footer copyright, and --ifm-color-primary (distinct
 * sentinel colors for the light and dark blocks). Since the fork that is a
 * stronger statement than it was: all three now have to survive the shell's
 * config merge and stylesheet order to reach the page at all, so this file is
 * also the enforcement of that merge. assemble.mjs records both the sentinels
 * and the old values it replaced in the build's manifest.json; this file asserts
 * against that manifest, so the sentinel definition lives in exactly one place.
 *
 * Static half: sentinels present in the built output, old values gone.
 * Live half: the seams *paint* — navbar/footer text in the DOM, and a
 * designated element's computed color derives from the token under both
 * data-theme="light" and "dark" (forced by the `?docusaurus-theme` parameter the
 * bootstrap script reads before first paint — see inMode in harness.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { test, expect, envFor, filesUnder, inMode } from "./harness";

test("B12 static: sentinels present in built output, old values gone", ({}, testInfo) => {
  const env = envFor(testInfo.project.name);
  const { sentinels, oldValues } = env.sentinelManifest;

  const htmlFiles = filesUnder(env.sentinelBuildDir, (p) => p.endsWith(".html"));
  expect(htmlFiles.length).toBeGreaterThan(0);
  const allHtml = htmlFiles.map((f) => fs.readFileSync(f, "utf8"));
  expect(allHtml.some((h) => h.includes(sentinels.navTitle)), "sentinel navbar title appears").toBe(true);
  expect(allHtml.some((h) => h.includes(sentinels.footerCopyright)), "sentinel footer copyright appears").toBe(true);
  // Deliberate asymmetry: the nav title's OLD value is asserted gone only in
  // the live half, scoped to .navbar__title — the old nav title equals the
  // instance name, which legitimately survives file-wide as the site <title>
  // (B9 asserts on exactly that), so a file-level "old value gone" check would
  // fail by design, not by defect.
  const staleFooter = htmlFiles.filter((_, i) => allHtml[i].includes(oldValues.footerCopyright));
  expect(staleFooter, "the old footer copyright is gone from every page").toEqual([]);

  const cssFiles = filesUnder(env.sentinelBuildDir, (p) => p.endsWith(".css"));
  const allCss = cssFiles.map((f) => fs.readFileSync(f, "utf8").toLowerCase()).join("\n");
  expect(allCss, "sentinel light primary in built CSS").toContain(sentinels.primaryLight.hex.toLowerCase());
  expect(allCss, "sentinel dark primary in built CSS").toContain(sentinels.primaryDark.hex.toLowerCase());
  expect(allCss, "old light primary gone").not.toContain(oldValues.primaryLight.toLowerCase());
  expect(allCss, "old dark primary gone").not.toContain(oldValues.primaryDark.toLowerCase());

  // Sanity in the other direction: the normal build carries no sentinel values,
  // so the pair of builds really differs only by the three seams.
  const normalHtml = filesUnder(env.buildDir, (p) => p.endsWith(".html"))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
  expect(normalHtml).not.toContain(sentinels.navTitle);
  expect(normalHtml).not.toContain(sentinels.footerCopyright);
});

test("B12 live: navbar/footer sentinels render; token paints in light and dark", async ({ page }, testInfo) => {
  const env = envFor(testInfo.project.name);
  const { sentinels, oldValues } = env.sentinelManifest;
  const docUrl = `${env.sentinelUrl}${env.sentinelManifest.docRoute}/`;

  await page.goto(inMode(docUrl, "light"));
  await expect(page.locator(".navbar__title")).toHaveText(sentinels.navTitle);
  await expect(page.locator(".navbar__title")).not.toContainText(oldValues.navTitle);
  await expect(page.locator(".footer__copyright")).toContainText(sentinels.footerCopyright);
  await expect(page.locator(".footer__copyright")).not.toContainText(oldValues.footerCopyright);

  // Designated painted element: the active sidebar item — infima paints it with
  // --ifm-menu-color-active: var(--ifm-color-primary).
  const painted = page.locator(".menu__link--active").first();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(painted, "computed color derives from the light token").toHaveCSS("color", sentinels.primaryLight.rgb);

  // ...and so does the pill BEHIND it. Added 2026-08-14: --sidebar-active-bg-subtle
  // was carried from upstream as a literal navy, so a rebranded site painted its
  // own primary text on an upstream-coloured background — red text on a blue pill.
  // The text assertion above could not see it; only the fill can. The expected
  // value is resolved BY THE SAME ENGINE from the sentinel, so the comparison is
  // format-agnostic (Chrome may serialize a color-mix as rgba() or color(srgb …)).
  await expect(painted, "the active pill derives from the light token").toHaveCSS(
    "background-color",
    await resolveMix(page, sentinels.primaryLight.rgb, "10%"),
  );

  await page.goto(inMode(docUrl, "dark"));
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".menu__link--active").first(), "computed color derives from the dark token").toHaveCSS("color", sentinels.primaryDark.rgb);
  await expect(
    page.locator(".menu__link--active").first(),
    "the active pill derives from the dark token",
  ).toHaveCSS("background-color", await resolveMix(page, sentinels.primaryDark.rgb, "16%"));
});

/**
 * What `color-mix(in srgb, <color> <pct>, transparent)` computes to in THIS
 * browser — used as the expected value so the assertion compares meaning
 * rather than serialization.
 */
async function resolveMix(
  page: import("@playwright/test").Page,
  color: string,
  pct: string,
): Promise<string> {
  return page.evaluate(
    ([c, p]) => {
      const el = document.createElement("div");
      el.style.backgroundColor = `color-mix(in srgb, ${c} ${p}, transparent)`;
      document.body.appendChild(el);
      const out = getComputedStyle(el).backgroundColor;
      el.remove();
      return out;
    },
    [color, pct],
  );
}

/**
 * What a CSS expression computes to in THIS browser, read off a probe element.
 *
 * The comparison is then between two values the same engine serialized from the
 * same construction, which is the only way to assert a `color-mix()` or a
 * gradient without guessing at Chrome's serialization (rgb? oklab? color(srgb)?)
 * and without hardcoding a colour the sentinel is supposed to be moving.
 */
async function computedFrom(
  page: import("@playwright/test").Page,
  property: string,
  value: string,
): Promise<string> {
  return page.evaluate(
    ([prop, val]) => {
      const el = document.createElement("div");
      el.style.setProperty(prop, val);
      document.body.appendChild(el);
      const out = getComputedStyle(el).getPropertyValue(prop);
      el.remove();
      return out;
    },
    [property, value],
  );
}

/**
 * B12, third painted family — the DOC-PAGE chrome, added 2026-08-14.
 *
 * The two tests above read the sidebar pill and the hero's call to action. Both
 * are places where the bridge was already known to be load-bearing. The reading
 * chrome was not, and that is where upstream's brand survived the fork: the
 * accent tokens carried upstream's own navy as literals inside the designated
 * token file, so A3 saw no violation (the literals were where literals belong)
 * and the A2/B7 brand scans saw no hex to match — while the italic in every
 * paragraph, the rule under every H2, the second stop of every table header and
 * some forty rules of the quiz painted a colour no project could reach.
 *
 * The sentinel build is what proves it now, and it is what could have proved it
 * all along: with `--ifm-color-primary` set to a red, the table header used to
 * sweep RED to NAVY. Nothing looked. These three elements are the cheapest
 * sample of the family — one text colour, one gradient, one CSS-module tint —
 * and each reads a different composition (oklab darken, gradient stop, srgb
 * alpha), so a regression in any one of the three token shapes is visible.
 */
test("B12 live: the doc-page accents derive from the token, not from a carried brand", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  const primary = env.sentinelManifest.sentinels.primaryLight.rgb;
  // The fixture doc that carries an <em>, a table and the quiz at once.
  await page.goto(inMode(`${env.sentinelUrl}/docs/one-source-two-surfaces/`, "light"));
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // 1. Text: --vsor-accent-deep, an oklab darken of the primary.
  const em = page.locator(".markdown em").first();
  await expect(em, "the fixture doc sets a phrase in italics").toBeVisible();
  await expect(em, "italics take the accent DERIVED from the project's primary").toHaveCSS(
    "color",
    await computedFrom(page, "color", `color-mix(in oklab, ${primary} 65%, black)`),
  );

  // 2. A gradient: primary at 0%, the same darken at 100%. Asserted whole, so a
  //    build where only the first stop moved (the actual 2026-08-14 defect —
  //    red-to-navy) fails on the string it produced.
  const thead = page.locator(".markdown thead").first();
  await expect(thead, "the fixture doc carries a table").toBeVisible();
  await expect(thead, "both stops of the table header sweep derive from the primary").toHaveCSS(
    "background-image",
    await computedFrom(
      page,
      "background-image",
      `linear-gradient(135deg, ${primary} 0%, color-mix(in oklab, ${primary} 65%, black) 100%)`,
    ),
  );

  // 3. A CSS-module tint: --vsor-accent-a020, the primary at 20% alpha. This is
  //    the family that covers the quiz — ~40 rules, all of one shape.
  const option = page.locator("[class*='optionButton']").first();
  await expect(option).toBeVisible();
  await expect(option, "the quiz option's border derives from the primary").toHaveCSS(
    "border-top-color",
    await computedFrom(page, "color", `color-mix(in srgb, ${primary} 20%, transparent)`),
  );
});

/**
 * B12, second painted element — added 2026-08-14 with the design system.
 *
 * The sidebar item above is painted by Infima, from --ifm-menu-color-active.
 * That proves the Docusaurus half of the token bridge and nothing else. The
 * design system introduced a second, longer chain in the other direction:
 * --primary reads var(--ifm-color-primary) (tokens.css), Tailwind maps
 * --color-primary onto it (tailwind.css), and `bg-primary` on the hero's call
 * to action paints with it. Nothing asserted that chain, so the shadcn half of
 * the seam could have gone dead — every colour on the page still moving, one
 * FILL silently stuck — and B12 would have stayed green.
 *
 * found live 2026-08-14 (the fork): this test is what caught the bridge going
 * missing. The forked app's tokens.css was tokenized with upstream's colours
 * preserved verbatim, so `--primary` was a baked oklch blue rather than
 * `var(--ifm-color-primary)` — the site rendered Infima's chrome in the
 * project's brand colour and every shadcn surface in upstream's, and the only
 * rebrand path the scaffold documents moved half the page. A fill, not a text
 * colour: the sidebar assertion above reads a colour Infima derives, this one
 * reads a colour the design system composes, and the two failure modes are
 * different.
 */
test("B12 live: the primary token paints a filled surface, both themes", async ({ page }, testInfo) => {
  const env = envFor(testInfo.project.name);
  const { sentinels } = env.sentinelManifest;

  await page.goto(inMode(`${env.sentinelUrl}/`, "light"));
  const cta = page.getByRole("link", { name: "Read the knowledge base" }).first();
  await expect(cta, "the homepage's call to action").toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(cta, "filled from the light token").toHaveCSS("background-color", sentinels.primaryLight.rgb);

  await page.goto(inMode(`${env.sentinelUrl}/`, "dark"));
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("link", { name: "Read the knowledge base" }).first(),
    "filled from the dark token",
  ).toHaveCSS("background-color", sentinels.primaryDark.rgb);
});
