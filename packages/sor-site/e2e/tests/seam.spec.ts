/**
 * Acceptance B12 — seam liveness (specs/sor-site/surface/spec.md).
 *
 * The driver builds every variant twice: once normally and once with sentinel
 * values stamped into exactly three native seams — themeConfig.navbar.title,
 * footer copyright, and --ifm-color-primary (distinct sentinel colors for the
 * light and dark blocks). assemble.mjs records both the sentinels and the old
 * values it replaced in the build's manifest.json; this file asserts against
 * that manifest, so the sentinel definition lives in exactly one place.
 *
 * Static half: sentinels present in the built output, old values gone.
 * Live half: the seams *paint* — navbar/footer text in the DOM, and a
 * designated element's computed color derives from the token under both
 * data-theme="light" and "dark" (theme choice is forced via the localStorage
 * key Docusaurus reads before first paint — deterministic, no toggle race).
 */
import fs from "node:fs";
import path from "node:path";
import { test, expect, envFor, filesUnder } from "./harness";

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
  const docUrl = `${env.sentinelUrl}${env.sentinelManifest.homeDocRoute}/`;

  await page.goto(docUrl);
  await expect(page.locator(".navbar__title")).toHaveText(sentinels.navTitle);
  await expect(page.locator(".navbar__title")).not.toContainText(oldValues.navTitle);
  await expect(page.locator(".footer__copyright")).toContainText(sentinels.footerCopyright);
  await expect(page.locator(".footer__copyright")).not.toContainText(oldValues.footerCopyright);

  // Designated painted element: the active sidebar item — infima paints it with
  // --ifm-menu-color-active: var(--ifm-color-primary).
  const painted = page.locator(".menu__link--active").first();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(painted, "computed color derives from the light token").toHaveCSS("color", sentinels.primaryLight.rgb);

  // Force dark deterministically: Docusaurus reads localStorage.theme before
  // first paint, so a reload renders dark from the start (no hydration race).
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(painted, "computed color derives from the dark token").toHaveCSS("color", sentinels.primaryDark.rgb);
});
