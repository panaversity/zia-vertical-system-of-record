/**
 * Design-system liveness — the amendment of 2026-08-13 ("the design system
 * crosses whole"), made into an assertion.
 *
 * Why this file exists. B5–B14 pin the *contract* (no external requests, no
 * product routes, the primitives render, the seams paint) and every one of them
 * stayed green through a build in which Tailwind emitted nothing at all. The
 * amendment's actual claim — Tailwind v4 + shadcn/ui + lucide reach the built
 * page — had no enforcement, and its single most likely failure is silent:
 *
 *   Tailwind v4 does not scan node_modules. The theme's compiled chrome lives
 *   there in every real install, so if `@source` in theme/src/css/tailwind.css
 *   stops covering it, the utility classes are still in the HTML, the build
 *   still succeeds, no console error is logged — the page just quietly reverts
 *   to unstyled boxes. That is precisely the failure the owner rejected once.
 *
 * So: computed styles, not stylesheet greps. A class name present in the CSS
 * proves nothing about whether it reaches the element.
 *
 * The control used to be the stock build: a second configuration with no design
 * system at all, whose numbers proved the themed ones were not vacuous. The fork
 * removed that configuration from existence (see playwright.config.ts), so the
 * control moved INSIDE the one build and got narrower rather than weaker — an
 * arbitrary utility that appears in no source file must compute to nothing. That
 * is the actual claim the stock half was standing in for: these rules exist
 * because the engine scanned this shell's own src/, not because some blanket
 * stylesheet shipped every utility in the language.
 *
 * found live 2026-08-14 (themed fixture build, docusaurus 3.10.2): the probe
 * element is injected rather than sampled from the chrome on purpose. Sampling
 * `document.querySelector('.text-sm')` reads whatever the cascade finally gave
 * that element — docs.css, Infima and the utility all land on it — so the
 * assertion would pass or fail for reasons that have nothing to do with
 * Tailwind. A detached-from-the-cascade div with only utility classes on it
 * isolates the one question being asked.
 */
import fs from "node:fs";
import { test, expect, envFor, filesUnder, inMode } from "./harness";

/** Tailwind v4 defaults: --spacing 0.25rem (gap-2 = 8px), --text-sm 0.875rem. */
const UTILITIES = "flex items-center gap-2 text-sm";

/**
 * The control (see the header). `gap-[13px]` is a perfectly legal Tailwind
 * candidate that appears in no file of this repo, so it can only reach the
 * built CSS if the stylesheet is not the product of scanning real source. Its
 * `gap` must therefore compute to the initial value.
 */
const UNSCANNED_UTILITY = "gap-[13px]";

/** Computed styles of a bare div carrying only `classes`, appended to body. */
async function probe(page: import("@playwright/test").Page, classes: string) {
  return page.evaluate((cls) => {
    const el = document.createElement("div");
    el.className = cls;
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const out = {
      display: cs.display,
      alignItems: cs.alignItems,
      gap: cs.gap,
      fontSize: cs.fontSize,
    };
    el.remove();
    return out;
  }, classes);
}

test("design system: Tailwind utilities compute, and only the scanned ones", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.goto("/");

  // Tailwind v4 does not scan node_modules and skips gitignored paths, and the
  // shell is materialized into a gitignored .vsor/ in every real install — so
  // these four numbers are the whole question of whether the site arrives
  // styled at all.
  expect(await probe(page, UTILITIES), "Tailwind v4 utilities are live in the built page").toEqual({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
  });

  // The control: an unscanned candidate paints nothing, so the assertion above
  // is evidence about this shell's source rather than about Tailwind shipping.
  const control = await probe(page, UNSCANNED_UTILITY);
  expect(control.gap, `${UNSCANNED_UTILITY} appears in no source file, so it must not compute`).toBe(
    "normal",
  );

  // ...and the emitted stylesheet really is Tailwind's, not a stray class from
  // a CSS module that happens to be named the same thing.
  const css = filesUnder(env.buildDir, (p) => p.endsWith(".css"))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
  expect(css, "the built CSS carries Tailwind's own custom properties").toContain("--tw-");
  expect(css, "the unscanned candidate never reached the stylesheet").not.toContain("gap-\\[13px\\]");
});

test("design system: the shadcn sheet is the mobile menu, and it is responsive", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  const trigger = page.getByRole("button", { name: "Open menu" });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(env.manifest.docRoute + "/");

  // Desktop: the trigger is hidden by the `min-[997px]:hidden` variant — which
  // is itself a Tailwind assertion (an arbitrary responsive variant compiling
  // and applying), stronger than checking the class attribute.
  await expect(trigger, "the mobile trigger is hidden on desktop").toBeHidden();

  // Mobile: the trigger appears and opens a real Radix dialog carrying the doc
  // tree. This is @radix-ui/react-dialog + tailwindcss-animate + ui/sheet +
  // ui/button + lucide, all proven by one interaction.
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(trigger, "the mobile trigger appears below 997px").toBeVisible();
  await trigger.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet, "the sheet carries the corpus tree, not a hardcoded menu").toContainText(
    "Contents",
  );
  await expect(sheet.getByRole("link", { name: "What a System of Record Is" })).toBeVisible();
  await page.getByRole("button", { name: "Close menu" }).click();
  await expect(sheet).toBeHidden();
});

/**
 * The other half of the question, and the one that actually shipped broken.
 *
 * Everything above asks "did Tailwind ARRIVE?". Nothing asked "did Tailwind
 * destroy what was already here?" — and on 2026-08-14 the answer was yes, in
 * both builds this suite calls green: Tailwind's preflight, boosted to (0,2,0)
 * by Docusaurus's cascade-layer polyfill, outranked every single-class
 * CSS-module rule in the corpus's primitives. The quiz options measured
 * 800x28 with zero border and zero padding; the search dialog was jammed
 * against the top of the window; Docusaurus's own clean-btn lost its padding.
 * Every one of B5-B14 passed, including B13, which asserts only that the quiz's
 * feedback text appears.
 *
 * So: one CSS-module-styled primitive must keep its own box. The numbers below
 * are the module's own declarations (Quiz.module.css: padding .75rem 1rem, 1px
 * border), which is what the stock build used to supply as a live control; with
 * one configuration they are read off the stylesheet instead, and the height
 * floor is the part that actually catches a stripped box.
 */
test("design system: a CSS-module primitive keeps its own box", async ({ page }, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.goto(env.manifest.docRoute + "/");

  // The quiz option: a <button> styled entirely by Quiz.module.css — in the fork
  // `padding: 0.75rem 0.9rem; border: 2px` (the extracted theme's numbers, which
  // the spec text still quotes, were 0.75rem/1rem and 1px; the fork is upstream's
  // own declaration and the assertions below are floors, not equalities, so the
  // test measures the failure rather than the decoration). Both preflight rules
  // that broke it — the universal box-model reset and the button font/background
  // reset — land on this one element, so it is the cheapest possible sentinel.
  const option = page.locator("[class*='optionButton']").first();
  await expect(option).toBeVisible();
  const box = await option.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      borderTopWidth: parseFloat(cs.borderTopWidth),
      paddingTop: parseFloat(cs.paddingTop),
      paddingLeft: parseFloat(cs.paddingLeft),
      fontSize: cs.fontSize,
      height: el.getBoundingClientRect().height,
    };
  });
  expect(box.borderTopWidth, "the module's border survives (preflight zeroes it)").toBeGreaterThanOrEqual(1);
  expect(box.paddingTop, "the module's 0.75rem vertical padding survives").toBeCloseTo(12, 0);
  expect(box.paddingLeft, "the module's horizontal padding survives").toBeGreaterThanOrEqual(12);
  expect(box.height, "an unstyled option collapses to ~28px").toBeGreaterThan(40);
});

/**
 * Code blocks, light mode. The theme forces the code surface onto --muted;
 * Docusaurus's default Prism theme (palenight) is a DARK theme, so without a
 * `prism` key in themeConfig every fenced block rendered pale-on-pale —
 * measured at 1.3:1 on the plain-text colour. The mechanism crossed the seam
 * from upstream; the config half that makes it work did not. Asserted on the
 * <pre>'s own colour pair rather than on every token, because the darkest and
 * lightest tokens of a legitimate light theme (comments especially) do not all
 * clear 4.5:1 — but a theme drawn for a dark ground fails on the plain text
 * first and by a mile.
 */
function contrast(fg: string, bg: string): number {
  const lum = (css: string) => {
    const [r, g, b] = css.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const ch = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

test("design system: fenced code is legible in light mode", async ({ page }, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.goto(inMode(`${env.url}${env.manifest.docRoute}/`, "light"));
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  const pre = page.locator(".markdown pre").first();
  await expect(pre, "the fixture doc carries a fenced code block").toBeVisible();
  const { color, background } = await pre.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.color, background: cs.backgroundColor };
  });
  expect(
    contrast(color, background),
    `code text ${color} on ${background} — a Prism theme drawn for a dark ground on a light code surface`,
  ).toBeGreaterThanOrEqual(4.5);
});

test("design system: lucide icons render as inline SVG (no icon font, no request)", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.goto(env.manifest.docRoute + "/");
  const icons = page.locator("svg.lucide");
  // Tree-shaken named imports, rendered inline: the B8 guard on this same page
  // is what proves they cost no network request.
  expect(await icons.count(), "lucide icons render in the chrome").toBeGreaterThan(0);
});

/**
 * The reading rhythm — the thing a reader actually sees, and the thing this
 * suite could not see at all until 2026-08-14.
 *
 * The base `.markdown` typography block (1.75 leading, 1.25rem paragraph
 * spacing, a 75ch measure) had been deleted along with the product code it sat
 * between upstream, so every doc body ran its paragraphs together: measured at
 * 1440x900, two consecutive <p> had a 0px gap and 24px line-height where
 * upstream had 20px and 28px. Every contract test stayed green — nothing here
 * had ever read a paragraph's box. So this asserts the rhythm directly, with
 * an injected pair of paragraphs rather than sampled corpus prose, so the
 * numbers are the stylesheet's rather than some document's markup.
 */
test("doc typography: paragraphs get their leading, spacing and measure", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(env.manifest.docRoute + "/");

  const rhythm = await page.evaluate(() => {
    const md = document.querySelector(".markdown");
    if (!md) return null;
    const host = document.createElement("div");
    host.innerHTML = "<p>first paragraph</p><p>second paragraph</p>";
    md.appendChild(host);
    // The measure rule is `.markdown > p`, so probe a direct child too.
    const direct = document.createElement("p");
    direct.textContent = "measured";
    md.appendChild(direct);
    const [a, b] = [...host.querySelectorAll("p")];
    const cs = getComputedStyle(a);
    const out = {
      lineHeight: cs.lineHeight,
      marginBottom: cs.marginBottom,
      gap: b.getBoundingClientRect().top - a.getBoundingClientRect().bottom,
      measure: getComputedStyle(direct).maxWidth,
    };
    host.remove();
    direct.remove();
    return out;
  });

  expect(rhythm, "the doc page has a .markdown body").not.toBeNull();
  expect(rhythm!.lineHeight, "1.75 leading on a 16px base").toBe("28px");
  expect(rhythm!.marginBottom, "1.25rem between paragraphs").toBe("20px");
  expect(rhythm!.gap, "consecutive paragraphs are actually separated").toBeCloseTo(20, 0);
  expect(rhythm!.measure, "the 75ch reading measure applies to direct children").not.toBe("none");
});

/**
 * ...and the mobile type scale, whose whole section had also been deleted:
 * headings ran 29-39% larger than upstream on a phone. The 375px block is the
 * narrowest one, so it is the one worth pinning.
 */
test("doc typography: the mobile type scale applies at 375px", async ({ page }, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(env.manifest.docRoute + "/");

  const h1 = page.locator(".markdown h1").first();
  await expect(h1, "the doc page has an h1").toBeVisible();
  await expect(h1, "1.75rem at 375px, not the 2.25rem desktop size").toHaveCSS(
    "font-size",
    "28px",
  );
});

/**
 * Admonitions, both syntaxes — the gap that shipped silently until 2026-08-14.
 *
 * Docusaurus 3 requires `:::tip[Title]`. The Docusaurus 2 form `:::tip Title`
 * is not a directive at all, so it renders as the literal text ":::tip Title"
 * with no warning, no error and a green build. No fixture had ever contained an
 * admonition, so nothing here could see it. The shell now migrates the v2 form
 * in `markdown.preprocessor` (a corpus written for Docusaurus 2 is the normal
 * case when importing, not the exception), and this asserts BOTH forms land as
 * real admonitions — the v2 doc proves the preprocessor, the v3 doc proves the
 * native path, and either one regressing is a visible defect on a reader's page.
 */
test("doc content: admonitions render in both the v2 and v3 syntaxes", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);

  for (const [route, kind] of [
    ["/docs/one-source-two-surfaces", "tip"], // written `:::tip Title` (v2)
    ["/docs/system-of-record", "warning"], // written `:::warning[Title]` (v3)
  ] as const) {
    await page.goto(`${env.url}${route}/`);
    const admonition = page.locator(`.theme-admonition-${kind}`).first();
    await expect(
      admonition,
      `${route} renders its ${kind} admonition rather than literal ":::" text`,
    ).toBeVisible();
    // The literal marker must not survive anywhere in the rendered body.
    await expect(page.locator("article")).not.toContainText(":::");
  }
});
