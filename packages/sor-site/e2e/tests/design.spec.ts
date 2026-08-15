/**
 * Design-system liveness — Acceptance B15 (and B16, below) of
 * specs/sor-site/surface/spec.md: the amendment of 2026-08-13 ("the design
 * system crosses whole"), made into an assertion.
 *
 * Why this file exists. B5–B13 pin the *contract* (no external requests, no
 * product routes, the primitives render, the seams paint) and every one of them
 * stayed green through a build in which Tailwind emitted nothing at all. The
 * amendment's actual claim — Tailwind v4 + shadcn/ui + lucide reach the built
 * page — had no enforcement, and its most likely failure is silent: the utility
 * classes are still in the HTML, the build still succeeds, no console error is
 * logged, and the page just quietly reverts to unstyled boxes. That is
 * precisely the failure the owner rejected once.
 *
 *   Restated 2026-08-14 for the fork. This paragraph used to name `@source` in
 *   theme/src/css/tailwind.css and the compiled chrome under node_modules; that
 *   package was deleted the same day and the fork has no `@source` directive at
 *   all — app/src/css/custom.css:15 is a bare `@import "tailwindcss"`, so v4's
 *   AUTOMATIC source detection is the whole mechanism. Which relocates the
 *   risk rather than removing it: auto-detection skips paths git ignores, and
 *   in every real install the shell is materialized into a gitignored `.vsor/`.
 *
 *   found live 2026-08-14: that risk does not fire here, measured rather than
 *   assumed. This suite's own shell (e2e/.scratch/site/site-runtime/src) is
 *   gitignored too — packages/sor-site/.gitignore:4 — and the built stylesheet
 *   still carries `.flex{`, `.items-center{` and `.gap-2{` while carrying no
 *   `gap-[13px]`. So a gitignored materialization is the configuration this
 *   file already runs against, and the control below is what keeps that true.
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
 * Acceptance B16 — admonitions, both syntaxes; the gap that shipped silently
 * until 2026-08-14. (Named here because it is the one B-row this file owns that
 * is not B15; the file-to-row map is otherwise in e2e/README.md.)
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

/**
 * The hero's display register — the design system reaching the one heading
 * whose text an OWNER typed.
 *
 * Added 2026-08-14 by the green driver, closing a hole rather than a spec row:
 * the hero landed with a recorded `found live` (Hero.tsx) and no assertion. The
 * finding was that `text-transform: uppercase` alone breaks the promise it was
 * chosen to keep. The promise: the display register is upstream's, but the TEXT
 * stays exactly as authored, because ours is not a fixed brand — it is whatever
 * an owner typed, and "Pakistan Tax Law" is not ours to case-mangle. Rendering
 * the capitals in CSS keeps the DOM node authored; it does NOT keep the
 * ACCESSIBLE NAME authored, because that is computed from rendered text. The
 * heading whose DOM text is "fixture" reported an accessible name of "FIXTURE",
 * and a screen reader may then spell a short all-caps string letter by letter.
 * `aria-label={title}` is the fix.
 *
 * So the regression this guards is two-sided and neither side is visible to any
 * other check: drop the aria-label and the accessible name silently re-mangles;
 * drop the `uppercase` utility and the aria-label becomes a redundant lie about
 * an element that no longer transforms. Both are asserted below, on the built
 * page, from the instance name the manifest owns rather than a literal.
 */
test("the hero capitalizes in CSS only — authored text, authored accessible name", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  const authored = env.manifest.instanceName; // "fixture" — lower-case as authored
  const mangled = authored.toUpperCase();
  expect(mangled, "the fixture's instance name must differ in case, or this test is vacuous").not.toBe(
    authored,
  );

  await page.goto(env.url);
  const h1 = page.locator("h1").first();

  // 1. The design system reaches it: the register is upstream's, in CSS.
  await expect(h1, "the hero h1 renders in upstream's all-caps display register").toHaveCSS(
    "text-transform",
    "uppercase",
  );

  // 2. The DOM keeps what the owner typed — pixels are capitals, text is not.
  expect(
    (await h1.textContent())?.trim(),
    "the hero h1's DOM text is the authored instance name, never a transformed string",
  ).toBe(authored);

  // 3. The accessible name is the authored string too — read from CHROMIUM'S
  //    OWN accessibility tree over CDP.
  //
  //    found live 2026-08-14, and the reason this is not a `getByRole` call:
  //    the obvious spelling — `getByRole("heading", { name, exact: true })` —
  //    is VACUOUS here, measured on a build with the aria-label deliberately
  //    removed. Playwright computes accessible names with its own injected
  //    engine, from DOM text, and it does not apply `text-transform`; it
  //    reported "fixture" for the very heading Chromium was exposing as
  //    "FIXTURE", and both halves of the assertion passed while the defect was
  //    present. The AX tree is the only instrument that can see this, so it is
  //    the one used. (Chromium-only — this suite pins Chromium; see
  //    playwright.config.ts.)
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Accessibility.enable");
  const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as {
    nodes: { role?: { value?: string }; name?: { value?: string } }[];
  };
  const headings = nodes
    .filter((n) => n.role?.value === "heading" && n.name?.value)
    .map((n) => n.name!.value!);
  expect(headings, "the AX tree exposes the hero heading at all").toContain(authored);
  expect(
    headings,
    `no heading is exposed as ${mangled} — text-transform mangles the accessible name unless ` +
      "Hero.tsx's aria-label restores the authored one",
  ).not.toContain(mangled);
});

/**
 * The mechanism behind the box, asserted at its source.
 *
 * The sentinel above measures ONE element, and on 2026-08-15 that turned out to
 * be exactly one element too few. The deployed demo shipped with `padding`,
 * `margin` and `border` dead in all thirteen of the shell's CSS modules — the
 * quiz counter and its Submit button rendered as unpadded slabs, the search
 * overlay ignored its own `padding: 10vh 1rem 1rem` — while this suite stayed
 * green, because `.optionButton` happens to carry the one workaround that had
 * been applied when the sentinel was written.
 *
 * The cause was never the elements. Docusaurus hands postcss-preset-env an
 * empty options object, which leaves its `cascade-layers` polyfill on, and that
 * polyfill rewrites every `@layer` into `:not(#\#)` chains. Tailwind's preflight
 * — `*,::before,::after { margin: 0; padding: 0; border: 0 solid }` — therefore
 * arrives at specificity (2,0,0), and a CSS module's single class (0,1,0) cannot
 * beat it at any nesting depth. Every module in the shell loses its box at once,
 * silently, in a build that succeeds and logs nothing.
 *
 * So this asserts the mechanism rather than another element: cascade layers must
 * survive the build. It is the cheapest total check available — one regression
 * in docusaurus.config.ts's `configurePostCss` turns it red, instead of thirteen
 * modules quietly flattening and one sentinel happening to notice.
 */
test("design system: cascade layers survive the build, unpolyfilled", async ({}, testInfo) => {
  const env = envFor(testInfo.project.name);
  const sheets = filesUnder(env.buildDir, (p) => p.endsWith(".css"));
  expect(sheets.length, "the build emits at least one stylesheet").toBeGreaterThan(0);

  const css = sheets.map((p) => fs.readFileSync(p, "utf8")).join("\n");

  // The polyfill's fingerprint. `#\#` is an id selector that matches nothing, so
  // `:not(#\#)` is a no-op that costs one id of specificity — the only reason to
  // write it is to emulate layer order with specificity.
  const boosted = css.match(/:not\(#\\?#\)/g) ?? [];
  expect(
    boosted.length,
    "postcss-preset-env's cascade-layers polyfill is rewriting @layer into specificity hacks, " +
      "which lifts Tailwind's preflight above every CSS module in the shell",
  ).toBe(0);

  // And the layers are really there, so the assertion above cannot pass merely
  // because the stylesheet lost its layers some other way.
  expect(css, "Tailwind's own layers reach the built stylesheet").toMatch(/@layer[^{;]*\bbase\b/);
});

/**
 * The search overlay, measured against the window it claims to cover.
 *
 * found live 2026-08-15 on the deployed demo. The overlay is `position: fixed;
 * inset: 0`, which everyone reads as "the viewport" — but the navbar it renders
 * inside is `sticky` and, once scrolled, `backdrop-blur-xl`. A non-none
 * backdrop-filter makes an element the containing block for its fixed
 * descendants, so `inset: 0` resolved against a 1193x64 navbar: the backdrop
 * dimmed only the navbar strip and the dialog hung off-centre at the top of the
 * page, over undimmed content. Nothing about the search BEHAVIOUR changed, which
 * is why B13 — "search finds the phrase and the result renders the doc" — passed
 * throughout, and why this measures geometry instead.
 *
 * The scroll is load-bearing: the blur is conditional on `isScrolled`, so an
 * unscrolled page cannot reproduce it. The fix is a portal to <body>, and the
 * parent assertion is what keeps it from being quietly reverted.
 */
test("design system: the search overlay covers the window, not the navbar", async ({
  page,
}, testInfo) => {
  const env = envFor(testInfo.project.name);
  await page.goto(env.manifest.docRoute + "/");

  // Put the navbar into its blurred state — the condition under which the bug exists.
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForFunction(() => window.scrollY > 0);

  await page.locator("[data-vsor='search-button']").first().click();
  await expect(page.locator("[data-vsor='search-input']")).toBeVisible();

  const measured = await page.evaluate(() => {
    const overlay = document.querySelector("[class*='overlay_']") as HTMLElement | null;
    if (!overlay) return null;
    const r = overlay.getBoundingClientRect();
    return {
      parent: overlay.parentElement?.tagName ?? null,
      width: r.width,
      height: r.height,
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  });

  expect(measured, "the overlay is in the DOM once search is open").not.toBeNull();
  expect(
    measured!.parent,
    "the overlay is portalled to <body> — rendered in place it inherits the blurred navbar as " +
      "its containing block",
  ).toBe("BODY");
  expect(measured!.height, "the overlay is as tall as the window (it was navbar-tall)").toBeCloseTo(
    measured!.viewport.h,
    0,
  );
  expect(measured!.width, "the overlay is as wide as the window").toBeCloseTo(
    measured!.viewport.w,
    0,
  );
});
