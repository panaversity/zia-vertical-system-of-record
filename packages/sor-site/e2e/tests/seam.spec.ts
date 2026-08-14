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
