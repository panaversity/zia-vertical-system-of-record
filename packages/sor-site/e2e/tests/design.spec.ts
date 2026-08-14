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
 * B14 symmetry is kept literally — the file runs in both projects and asserts a
 * real property of each. Themed asserts the design system is live; stock asserts
 * the documented fallback is honest, i.e. removing @vsor/sor-site-theme leaves
 * *no* Tailwind runtime behind (a leak would mean the theme's CSS ships to sites
 * that deleted it, which is the same defect wearing the other mask).
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
import { test, expect, envFor, filesUnder } from "./harness";

/** Tailwind v4 defaults: --spacing 0.25rem (gap-2 = 8px), --text-sm 0.875rem. */
const UTILITIES = "flex items-center gap-2 text-sm";

/** Computed styles of a bare div carrying only `UTILITIES`, appended to body. */
async function probeUtilities(page: import("@playwright/test").Page) {
  return page.evaluate((classes) => {
    const el = document.createElement("div");
    el.className = classes;
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
  }, UTILITIES);
}

test("design system: Tailwind utilities compute (or, on stock, provably do not)", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.goto("/");
  const computed = await probeUtilities(page);

  if (env.variant === "themed") {
    // The engine reached the built CSS *through* node_modules — these rules can
    // only exist if @source covered the theme's own compiled files.
    expect(computed, "Tailwind v4 utilities are live in the built page").toEqual({
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "14px",
    });
  } else {
    // The fallback the scaffold config documents: delete the theme line and the
    // site is stock Docusaurus. A `flex` rule surviving here would mean the
    // theme's stylesheet leaks into sites that removed it.
    expect(computed.display, "stock carries no Tailwind runtime").toBe("block");
    const css = filesUnder(env.buildDir, (p) => p.endsWith(".css"))
      .map((f) => fs.readFileSync(f, "utf8"))
      .join("\n");
    expect(css, "no Tailwind custom properties in the stock build").not.toContain("--tw-");
  }
});

test("design system: the shadcn sheet is the mobile menu, and it is responsive", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  const trigger = page.getByRole("button", { name: "Open menu" });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(env.manifest.docRoute + "/");

  if (env.variant === "stock") {
    // Stock uses Docusaurus's own navbar; the theme's trigger must not exist.
    await expect(trigger, "stock has no theme chrome").toHaveCount(0);
    return;
  }

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
  await expect(sheet.getByRole("link", { name: "Biryani" })).toBeVisible();
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
 * So: one CSS-module-styled primitive, in BOTH projects, must keep its own box.
 * Stock is the control — it has no design system at all, so its numbers are
 * what the module asked for — and themed must match its shape, not its pixel.
 */
test("design system: a CSS-module primitive keeps its own box", async ({ page }, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.goto(env.manifest.docRoute + "/");

  // The quiz option: a <button> styled entirely by Quiz.module.css
  // (padding .75rem 1rem, 1px border). Both preflight rules that broke it —
  // the universal box-model reset and the button font/background reset — land
  // on this one element, so it is the cheapest possible sentinel.
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
  expect(box.borderTopWidth, "the module's 1px border survives").toBeGreaterThanOrEqual(1);
  expect(box.paddingTop, "the module's 0.75rem vertical padding survives").toBeCloseTo(12, 0);
  expect(box.paddingLeft, "the module's 1rem horizontal padding survives").toBeCloseTo(16, 0);
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
  await page.goto(env.manifest.docRoute + "/");
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.reload();
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
  if (env.variant === "stock") {
    await expect(icons, "stock ships no theme icons").toHaveCount(0);
    return;
  }
  // Tree-shaken named imports, rendered inline: the B8 guard on this same page
  // is what proves they cost no network request.
  expect(await icons.count(), "lucide icons render in the chrome").toBeGreaterThan(0);
});
