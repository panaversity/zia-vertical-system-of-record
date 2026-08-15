/**
 * B13, the other half — every shipped content primitive, rendered and worked.
 *
 * Why this file exists. `specs/sor-site/surface/spec.md` amended B13 at
 * implementation time: the landed fixture proved the quiz and search end to end
 * and named "per-primitive render assertions for flashcards, gallery,
 * ExerciseCard, HighlightTip and ImageZoom" as follow-up, "added with the
 * fixture extension that carries them". This is that fixture extension's half of
 * the contract, and the reason it could not wait: those five primitives are in
 * `src/theme/MDXComponents.tsx` and `src/theme/Root.tsx`, so a corpus can write
 * them and a reader can meet them — while nothing in any tier had ever rendered
 * one. The admonition defect of 2026-08-14 is the precedent: a primitive with no
 * fixture is a primitive whose failure is silent, green build included.
 *
 * Two more are covered here than the spec's follow-up clause names, by the same
 * argument rather than by a separate one: the `::::os-tabs` directive vocabulary
 * (`@vsor/lib-remark-tabs` + the `Tabs`/`TabItem` mapping) and mermaid fences are
 * both wired into the shell's own `docusaurus.config.ts`, so a corpus may write
 * them and a reader may meet them, and neither had a fixture either.
 *
 * What each test asserts, and why in this shape:
 *
 *   - RENDERS. Three of the five (Flashcards, ConversationGallery, and
 *     PhotoSwipe's core inside ImageZoom) reach the page through
 *     BrowserOnly + lazy + a dynamic import, so "renders" here means the client
 *     chunk resolved and mounted — the exact failure mode found live on
 *     2026-08-13, when CJS emit broke these two modules' exports under webpack
 *     while the build stayed green.
 *   - WORKS. Every primitive is interactive or it is decoration: the deck flips
 *     and advances, the gallery opens a conversation, the aside dismisses, the
 *     figure zooms. A render-only assertion would have passed against a deck
 *     whose flip timer never fires.
 *   - PAINTS ITS OWN BOX, by computed style. B15's lesson, applied to the rest of
 *     the vocabulary: Tailwind's preflight — boosted over every single-class
 *     CSS-module rule by Docusaurus's cascade-layer polyfill — stripped the
 *     quiz's border and padding while B5-B14 stayed green. Each primitive below
 *     therefore measures its module's own declarations (border, padding, the
 *     flex axis, the shell's min-height) as FLOORS, not equalities: the test is
 *     meant to catch a stripped box, not to freeze a decoration.
 *
 * The corpus side is `tests/fixtures/tiny/document-primitives.md` plus its two
 * co-located YAML files. The deck and the gallery are loaded by
 * `@vsor/lib-remark-flashcards` / `@vsor/lib-remark-gallery` from
 * `<stem>.flashcards.yaml` / `<stem>.gallery.yaml`, which is the authoring
 * contract those plugins define — so this suite also proves that pairing, not
 * just the components.
 *
 * B8 (same-origin, zero >= 400) and B11 (zero console.error / pageerror) ride on
 * every navigation here through the harness guard, so the lazy chunks and
 * PhotoSwipe's dynamically imported core are covered by them too.
 *
 * Falsified 2026-08-14 before being trusted: assembled into a throwaway build
 * with the seven usages stripped out of the copied corpus and the two YAML files
 * deleted, every test in this file went red — none of them passes on a page that
 * merely loads.
 */
import fs from "node:fs";

import { test, expect, envFor, filesUnder } from "./harness";

/** The fixture doc that carries every primitive named above. */
const ROUTE = "/docs/document-primitives/";

test("B13: ExerciseCard renders its marker and keeps its own box", async ({ page }) => {
  await page.goto(ROUTE);

  // The id is the component's contract: `exercise-${id}`, so the rest of a
  // corpus can link at a task. Asserting on it rather than on text proves the
  // props reached the component.
  const card = page.locator("#exercise-EX-01");
  await expect(card).toBeVisible();
  await expect(card).toContainText("EX-01");
  await expect(card).toContainText("Write one abstention note for a document you own");

  const box = await card.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      borderLeftWidth: parseFloat(cs.borderLeftWidth),
      borderTopWidth: parseFloat(cs.borderTopWidth),
      paddingTop: parseFloat(cs.paddingTop),
      paddingLeft: parseFloat(cs.paddingLeft),
      height: el.getBoundingClientRect().height,
    };
  });
  // ExerciseCard.module.css: flex row, 1px border with a 4px primary left rule,
  // 0.75rem/1rem padding. Preflight zeroes borders and padding on everything.
  expect(box.display, "the card lays its badge and title out on a row").toBe("flex");
  expect(box.borderLeftWidth, "the 4px accent rule survives").toBeGreaterThanOrEqual(4);
  expect(box.borderTopWidth, "the 1px hairline survives").toBeGreaterThanOrEqual(1);
  expect(box.paddingTop, "the 0.75rem vertical padding survives").toBeCloseTo(12, 0);
  expect(box.paddingLeft, "the 1rem horizontal padding survives").toBeGreaterThanOrEqual(16);
  expect(box.height, "an unstyled card collapses to a bare line of text").toBeGreaterThan(30);
});

test("B13: HighlightTip renders after hydration, keeps its box, and dismisses", async ({
  page,
}) => {
  await page.goto(ROUTE);

  // The component renders null on the server and on the first client render,
  // then reads localStorage in an effect — deliberately, so it cannot cause a
  // hydration mismatch. Visible here therefore means "the effect ran", which is
  // the only thing that makes this primitive appear at all.
  const tip = page.locator("[class*='highlightTip_']");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Highlight text to");

  const box = await tip.evaluate((el) => {
    const cs = getComputedStyle(el);
    const icon = el.querySelector("svg");
    const rect = icon?.getBoundingClientRect();
    return {
      display: cs.display,
      gap: cs.gap,
      alignItems: cs.alignItems,
      iconWidth: rect?.width ?? 0,
      iconHeight: rect?.height ?? 0,
    };
  });
  // HighlightTip.module.css: an inline-flex row, 5px gap, a 12px lucide icon.
  // The icon size is the interesting number — lucide's own default is 24px, so
  // 12 proves the module's rule reached the SVG rather than the icon's default.
  expect(box.display, "the aside is an inline row, not a block").toBe("inline-flex");
  expect(box.alignItems).toBe("center");
  expect(box.gap, "the module's 5px gap survives").toBe("5px");
  expect(box.iconWidth, "the module sizes the lucide icon to 12px").toBeCloseTo(12, 0);
  expect(box.iconHeight).toBeCloseTo(12, 0);

  // ...and it is dismissible, which is the whole of its behaviour.
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(tip, "dismissing removes the aside").toBeHidden();
});

test("B13: the flashcard deck loads from its co-located YAML, flips, and advances", async ({
  page,
}) => {
  await page.goto(ROUTE);

  // Three cards, from document-primitives.flashcards.yaml. A deck the remark
  // plugin failed to find renders the fallback ("Flashcards are not available
  // for this page yet") instead of a card, so the count in this label is also
  // the assertion that the YAML pairing worked.
  const front = page.getByRole("region", { name: "Flashcard 1 of 3, question" });
  await expect(front, "the lazy, browser-only deck mounted").toBeVisible();
  await expect(front).toContainText("When two versions of a governed document disagree");

  // The deck's own container: 1px border, 1.5rem padding, and a 260px card
  // shell. `.last()` because an outer layout container may also carry a
  // `container_*` module class; the innermost match is the deck's.
  const deck = page
    .locator("[class*='container_']")
    .filter({ has: page.locator("[class*='cardShell_']") })
    .last();
  const box = await deck.evaluate((el) => {
    const cs = getComputedStyle(el);
    const shell = el.querySelector("[class*='cardShell_']");
    return {
      borderTopWidth: parseFloat(cs.borderTopWidth),
      paddingTop: parseFloat(cs.paddingTop),
      shellHeight: shell?.getBoundingClientRect().height ?? 0,
    };
  });
  expect(box.borderTopWidth, "the deck's 1px frame survives").toBeGreaterThanOrEqual(1);
  expect(box.paddingTop, "the deck's 1.5rem padding survives").toBeCloseTo(24, 0);
  expect(box.shellHeight, "the card shell's 260px minimum survives").toBeGreaterThanOrEqual(260);

  // Flip. The card animates over ~580ms with a content swap at its midpoint;
  // the aria-label is what changes, so the wait is DOM state, never a timer.
  await front.click();
  const back = page.getByRole("region", { name: "Flashcard 1 of 3, answer" });
  await expect(back, "clicking the card turns it over").toBeVisible();
  await expect(back).toContainText("Authority");
  await expect(back, "the card's `why` note shows on the answer side").toContainText(
    "separates a record from a well-written draft",
  );

  // Rating is what advances the deck — and it is the half that replaced the
  // denylisted spaced-repetition scheduler, so it is worth walking.
  const rating = page.getByRole("group", { name: "Rate your recall" });
  await expect(rating, "the rating row appears once the answer is showing").toBeVisible();
  await rating.getByRole("button", { name: "Got it" }).click();
  await expect(
    page.getByRole("region", { name: "Flashcard 2 of 3, question" }),
    "rating advances to the next card, front side up",
  ).toBeVisible();
});

test("B13: the gallery opens a conversation and compares the two", async ({ page }) => {
  await page.goto(ROUTE);

  // Collapsed by default: the conversation body must not be in the page before
  // the trigger is used, or "opens" would be asserting nothing.
  const answer = page.getByText("Provenance proves who said something and when");
  await expect(answer).toHaveCount(0);

  const trigger = page.getByRole("button", { name: /See how others approached/ });
  await expect(trigger, "the lazy, browser-only gallery mounted").toBeVisible();
  await expect(trigger, "the count comes from the co-located YAML").toContainText("2 examples");
  await trigger.click();

  // Open the strong conversation. Each card is its own disclosure, so this is a
  // second interaction rather than a side effect of the first.
  const strong = page.getByRole("button", { name: /answered from the record/ });
  await expect(strong).toBeVisible();
  await strong.click();
  await expect(answer.first(), "the conversation body renders its AI response").toBeVisible();
  await expect(page.getByRole("region", { name: "Score Card" }).first()).toBeVisible();

  // The strong card's 4px success rule — the module's own paint, keyed off the
  // label prefix the YAML supplies.
  const card = page
    .locator("[class*='convCard_']")
    .filter({ has: page.getByRole("button", { name: /answered from the record/ }) })
    .first();
  const borderLeft = await card.evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth));
  expect(borderLeft, "the strong card's 4px quality rule survives").toBeGreaterThanOrEqual(4);

  // The comparison view exists only because the YAML labels one conversation
  // "Strong" and the other "Weak" — the component derives the pairing itself.
  await page.getByRole("button", { name: "Compare Strong vs Weak" }).click();
  await expect(page.getByText("Side-by-Side Comparison")).toBeVisible();
  await expect(page.getByText("Strong Prompt")).toBeVisible();
  await expect(page.getByText("Weak Prompt")).toBeVisible();
});

test("B13: the tab vocabulary compiles to real Docusaurus tabs and switches", async ({ page }) => {
  await page.goto(ROUTE);

  // `::::os-tabs` is this framework's own directive vocabulary — the collapse of
  // upstream's five near-identical tab plugins into `@vsor/lib-remark-tabs`,
  // registered in the shell's config with the `osTabs` preset. It reaches the
  // page only if Docusaurus's own directive pass still produces the
  // containerDirective/leafDirective nodes the plugin consumes, and that pass is
  // exactly what the 2026-08-14 admonition fix touched: a second directive
  // extension in the chain silently un-handled directives. A regression there
  // renders the raw "::::os-tabs" text with a green build, which is the
  // admonition defect again in a different vocabulary.
  const tablist = page.getByRole("tablist");
  await expect(tablist, "the directive compiled to a tab list").toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.locator("article"), "no raw directive markers survive").not.toContainText(
    "::os-tabs",
  );

  // The preset's `default: true` decides the open tab, and the panel content is
  // the markdown that followed the leaf directive.
  await expect(page.getByRole("tab", { name: "Windows", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel")).toContainText("from the file explorer");

  await page.getByRole("tab", { name: "macOS" }).click();
  await expect(page.getByRole("tab", { name: "macOS" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel"), "switching tabs swaps the panel").toContainText(
    "open build/index.html",
  );
});

test("B13: mermaid is opt-in — a fence stays a code block and ships no renderer", async ({
  page,
}, testInfo) => {
  await page.goto(ROUTE);

  // Measured 2026-08-15 (an external reviewer on a clean machine, confirmed here): with mermaid
  // on, the renderer is 83 MB of a project's install and ~3,440 KB of a ~4,500 KB client bundle —
  // three quarters of it — and it resolves into the COMMON chunk, so every page of every corpus
  // paid for a diagram renderer whether or not any document had a diagram. It is off by default
  // now; a corpus that wants diagrams sets markdown.mermaid and adds the theme in its own config.
  //
  // This test guards the payload decision rather than the feature: the fence must degrade to an
  // honest code block, and the renderer must be absent from the build. Without the second half a
  // regression that silently re-enabled mermaid would still pass.
  await expect(
    page.locator("pre").filter({ hasText: "flowchart LR" }),
    "the fence renders as a code block, which is what an un-rendered diagram honestly is",
  ).toBeVisible();
  await expect(
    page.locator(".docusaurus-mermaid-container"),
    "no mermaid container is emitted when the feature is off",
  ).toHaveCount(0);

  const env = envFor(testInfo.project.name);
  const js = filesUnder(env.buildDir, (f) => f.endsWith(".js"));
  const jsBytes = js.map((f) => fs.readFileSync(f, "utf8")).join("");

  // Not a search for the WORD mermaid: it survives as a config key and a theme name in the
  // serialized siteConfig even with the feature off (measured — two chunks contain it). What must
  // be absent is the renderer, so this looks for its own runtime signatures.
  for (const signature of ["docusaurus-mermaid-container", "flowchart-v2", "sequenceDiagram"]) {
    expect(jsBytes.includes(signature), `no mermaid renderer in the bundle (${signature})`).toBe(
      false,
    );
  }

  // And a budget, because the point of this test is a payload the owner never asked to carry.
  // Measured 2026-08-15: 1,021 KB with mermaid off, ~4,500 KB with it on. The ceiling sits well
  // above today and far below a re-enabled renderer, so it catches the regression without
  // failing on ordinary growth.
  const totalKB = Math.round(js.reduce((n, f) => n + fs.statSync(f).size, 0) / 1024);
  expect(
    totalKB,
    `client JS budget: ${totalKB} KB. Mermaid alone is ~3,440 KB of it — if this fails, something ` +
      "re-enabled a renderer every page pays for whether or not a document has a diagram",
  ).toBeLessThan(1800);
});

test("B13: ImageZoom makes the figure focusable and opens it full-screen", async ({ page }) => {
  await page.goto(ROUTE);

  // ImageZoom renders nothing — it is mounted headless from src/theme/Root.tsx
  // and works by marking content images. The tabindex it adds is therefore the
  // only evidence that the component is alive at all, and it is also the
  // accessibility half of the primitive: images are not focusable by default.
  const figure = page.locator(".markdown img").first();
  await expect(figure).toBeVisible();
  await expect(figure, "the headless component marked the figure focusable").toHaveAttribute(
    "tabindex",
    "0",
  );

  const lightbox = page.locator(".pswp.vsor-image-zoom");
  await expect(lightbox, "no lightbox before the reader asks for one").toHaveCount(0);

  await figure.click();
  await expect(lightbox, "clicking the figure opens the lightbox").toBeVisible();

  // Its box: a fixed overlay filling the viewport, carrying the same image.
  // PhotoSwipe's core is a dynamic import, so this is also the proof that the
  // chunk resolved (and the B8 guard proves it came from this origin).
  const overlay = await lightbox.evaluate((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      position: cs.position,
      width: rect.width,
      height: rect.height,
      // documentElement.clientWidth, NOT window.innerWidth: a `position: fixed` box is
      // laid out in the initial containing block, which excludes a classic scrollbar,
      // while innerWidth includes it. found live 2026-08-15 on ubuntu-latest — 1265
      // against 1280, exactly the GTK scrollbar — where macOS overlay scrollbars are
      // 0px wide and the row had always passed.
      viewport: {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      },
    };
  });
  expect(overlay.position, "the lightbox is a fixed overlay").toBe("fixed");
  expect(overlay.width, "it fills the viewport width").toBeGreaterThanOrEqual(
    overlay.viewport.width - 1,
  );
  expect(overlay.height, "it fills the viewport height").toBeGreaterThanOrEqual(
    overlay.viewport.height - 1,
  );

  // The FULL image, explicitly not the placeholder PhotoSwipe paints first from
  // the thumbnail's own bytes — asserting on the placeholder would pass against
  // a lightbox that never loaded anything.
  //
  // found live 2026-08-14: this wait is also what makes the Escape below
  // deterministic, and it is a DOM-state wait rather than the timer the spec's
  // browser tier forbids. PhotoSwipe binds its keyboard handler in the
  // `openingAnimationEnd` callback, immediately after the same callback appends
  // this element — so a suite that pressed Escape as soon as `.pswp` appeared
  // raced the opening animation and the key went nowhere, with the lightbox left
  // open and the failure looking like a broken product. Waiting for the appended
  // image waits for that callback to have run.
  const zoomed = lightbox.locator("img.pswp__img:not(.pswp__img--placeholder)");
  await expect(zoomed, "the lightbox loads the full image, not just its placeholder").toBeVisible();
  expect(
    await zoomed.getAttribute("src"),
    "the lightbox shows the figure from the document, not an image of its own",
  ).toBe(await figure.getAttribute("src"));

  // Escape is the way out a reader will reach for; PhotoSwipe tears the element
  // down rather than hiding it.
  await page.keyboard.press("Escape");
  await expect(lightbox, "Escape closes the lightbox").toBeHidden();
});
