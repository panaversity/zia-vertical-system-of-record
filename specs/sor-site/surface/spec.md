---
status: draft
date: 2026-08-13
---

# `sor-site` — the website surface

**Business claim:** trust through simplicity. A professional's site carries no hidden product code,
its theme phones no one, and every seam an agent edits is one its training data already knows.
Each of those is a CI property below, not a slogan.

**Amendment, 2026-08-13 — the design system crosses whole (owner decision).** Shown the first
stripped build, the owner rejected it: "it shall give the feel of AF — that is the standard; this
is base Docusaurus." Corrected: upstream's look is not decoration on top of Docusaurus, it *is* a
design system — **Tailwind v4 + shadcn/ui primitives + OKLCH design tokens + lucide icons** — and
the first pass replaced it with bespoke CSS, which is why the result felt generic. That stack now
crosses the seam intact, for two reasons: it is the only way to reproduce the feel, and **shadcn is
the most agent-legible UI system in existence** — an agent asked to restyle a vsor site already
knows it, which serves the agent-first rule far better than anything we hand-roll. The full theme
is **on by default** in the scaffold; stock preset-classic is demoted to a fallback.

## Negative contract — binding first, because it is the risk

The theme package (and therefore every built site) contains **none** of the upstream product layer.
Excluded by name, enforced by test:

| Excluded | Includes |
| :--- | :--- |
| **Auth & gating** | `better-auth`, `NavbarAuth`, `ContentGate`, `GatedQuiz`, `GatedSummary` — browser gating is theater (content ships in static HTML regardless); real visibility is open decision B4 |
| **Tutor & AI panels** | `TeachMePanel`, `TeachingGuideSheet`, StudyMode (including its toggle), `VoiceControlDock`, `AICheck`, ChatKit |
| **Progress & gamification** | `progress/`, leaderboard, `HypothesisTrial` (`ReadingProgress` — the local scroll indicator — stays: no backend, content primitive) |
| **Feedback & admin** | `Feedback/`, `AdminFeedback`, `pages/admin/` |
| **Practice & simulation** | `PracticeErrorCard`, `PracticeSetupCard`, `TerminalPanel`, `SimPlayer`, `InteractivePython` (opt-in later at most) |
| **Marketing & product pages** | `ThreeDBook`, `HeroIDESimulation`, `certifications/`, `onboarding/`, `profile/`, authors data, `CapstoneWorkbook`, `ProjectCard`, `RequireProfile`, `SegmentEditOverlay`, `PDFViewer`, `TailwindTestComponent`. **Amended 2026-08-13:** the landing *page pattern* (hero + section cards, as `Ecosystem` and `pages/index.tsx` realize it) **crosses** as a content-driven primitive — what stays excluded is upstream's copy, its product links, and the sibling-app cards. A generic site needs a homepage; ours is that pattern with the project's own name, tagline and corpus sections |
| **Content-as-code** | `explorers/`, `cheatsheets/` — course artifacts, not machinery |
| **Product config & analytics** | all 12 `customFields` endpoints; the dual-brand runtime switch (branding is instance config at build time); GA4 and all analytics wiring, *even env-gated* (`AnalyticsTracker`) — the theme carries zero analytics code |
| **Tab-plugin companions** | `CoworkTabs`, `ToolTabs`, `WebAgentTabs`, `OSTabs` app components — superseded by the collapsed `remark-tabs` + the mdx package's `Tabs`/`TabItem` mapping |
| **Misc app chrome** | `DocEnhancements`, `SidebarToggle` — not copied, nothing references them (excluded 2026-08-13 closure pass; a later spec revision may re-audit); `LocaleDropdown`, `RomanUrduRouteEffects`, `TranslationBanner`, `TranslationEditor`, `UrduBidiIsolator`, `translation/` go with i18n |
| **Steering docs** | `DESIGN_SYSTEM.md` and successors — the token file is the documentation |
| **Translated content** | `docs-*` locale trees; i18n machinery is deferred wholesale post-v0 — the package ships and CI builds the default locale only |

**Closure rule:** kept ∪ excluded = the surveyed component set in `docs/extraction.md`. A surveyed
directory on neither side is a spec bug, fixed before extraction — the boundary list below is
exhaustive by construction, no ellipsis anywhere in this contract.

**The theme introduces no external requests.** Fonts self-hosted, no CDN scripts, no analytics.
The claim is theme-scoped: a user's corpus may embed external images; the *theme and shell* may not
initiate any request off-origin. An owner who wants analytics adds it through Docusaurus-native
config in *their* repo — never a framework default. Enforcement of record is the runtime
interception test (Acceptance B8), on a fixture whose corpus is asserted external-reference-free,
so anything found is theme-introduced.

**Dependency allowlist** (the manifest form of the same promise — allowlist gates, denylist
backstops): `packages/sor-site` direct runtime deps must appear in a committed allowlist —
`react`/`react-dom`, `@docusaurus/*` (peers), `@mdx-js/react`, `clsx`, `prism-react-renderer`,
`@easyops-cn/docusaurus-search-local`, the workspace-internal remark/loader packages, **and — added
2026-08-13 with the design system — `tailwindcss` v4 + `@tailwindcss/postcss` + `postcss` +
`autoprefixer` + `tailwindcss-animate`, `lucide-react`, `class-variance-authority`,
`tailwind-merge`, and the `@radix-ui/react-*` primitives that the kept shadcn components require
(each named individually, never a wildcard)**. Growth edits the allowlist in the same reviewed
commit — this amendment *is* that mechanism working, not an exception to it. `framer-motion`,
`cmdk`, `next-themes` and `sonner` stay out at v0 — `tailwindcss-animate` plus CSS covers the kept
chrome, and a kept component that provably needs one is reported, not quietly added. As of
2026-08-14 all four sit on the lockfile denylist too, so transitive arrival is caught. Backstop
unchanged: a lockfile-wide scan for the known-bad names (`better-auth`, `@openai/chatkit-react`,
`@chatscope/*`, `@monaco-editor/react`, `@xterm/*`, `ts-fsrs`, `recharts`) catches them even
transitively.

## Positive contract

- **Kept from upstream** (gated on copy authorization): quiz, flashcards, ui tokens, `ExerciseCard`,
  `HighlightTip`, `ImageZoom`, `ReadingProgress`, `SearchBar`, gallery, `LessonContent`
  (de-branded, the doc-page primitive), `ModeToggle` *only if* it is Docusaurus color-mode,
  `DocPageActions` with corpus-neutral actions only (audited at the pinned SHA) — plus the
  `libs/docusaurus` content-pipeline packages, the five duplicate tab plugins collapsed to one
  *before* crossing the seam.
- **The MDX vocabulary ships from slice 1**, preset-classic-compatible, as its own small package —
  **extracted from `learn-app`, never re-implemented as a lookalike** *(owner decision 2026-08-13:
  copy authorization for `ag2/apps/learn-app` granted in the owner's words — "copy and then
  rework"; this supersedes the review's fresh-author proposal — the real components cross the seam,
  stripped per the negative contract above)*. *(amended 2026-08-14: with the fork there is no
  separate "upgrade" and no stock configuration to build against — the vocabulary ships inside the
  shell. What survives of the old guarantee is that the primitives keep their own CSS-module boxes
  under the design system, which B15 measures directly.)*
- **Primitive contracts are pinned.** `<Quiz />` normatively: exactly four `options`,
  `correctOption` index, optional `explanation`/`source`. Exported prop types are diffed against a
  frozen baseline in package CI; changing a baseline requires touching this spec.
- **Native seams only, proven live:** `themeConfig` is live and *tested* live (Acceptance B12);
  `--ifm` tokens are **effective**, not merely defined; swizzles land in `site/src/theme/`.
  Components that render `themeConfig` data are **wrap-only**; a full ejection is legal only if the
  liveness suite still passes against it. Search stays the local index — no external service.
- **The chrome crosses** *(added 2026-08-13)*: `Navbar` (with its mobile sheet), `Footer`,
  `Layout`, `Root`, and the doc-page polish (`doc-pages.css`, `sidebar.css`) — de-branded and
  de-producted on the way (the navbar loses auth, locale dropdown, voice control, leaderboard and
  the updates badge; what remains is title, corpus nav, search, theme toggle). This is what makes a
  vsor site look like a product instead of a docs template, and it is why `themeConfig` liveness
  (B12) is now load-bearing rather than theoretical: these are full swizzles.
- **Token discipline** — restated for the shadcn architecture: raw color literals (oklch/hex/rgb/
  hsl) appear **only** in the token-definition layer (`:root` and the dark variant in
  `tokens.css`); every other rule consumes `var(--…)`. Docusaurus's `--ifm-*` variables are *bridged*
  onto those tokens, so an owner editing one token recolors both the theme and Docusaurus chrome —
  the defect upstream has, fixed on the way across rather than imported. Baseline zero, CI-enforced.
- **Whole, minus preflight** *(amended 2026-08-14, found live).* Tailwind's own `preflight.css` is
  deliberately not imported. Docusaurus's `postcss-preset-env` polyfills `@layer` into specificity
  hacks, which raises preflight above every single-class CSS-module rule: measured, the quiz options
  lost their 1px border and 12px/16px padding, the search dialog lost its offset, and Docusaurus's
  own `clean-btn` lost its padding — the design system un-styling the very primitives it was brought
  across to dress. The theme therefore resets nothing that belongs to somebody else; what preflight
  did for the kept chrome is stated on the components that need it. A modern `browserslist` (or
  `cascade-layers: false`) is **not** the remedy and is recorded as rejected with its measurement:
  with real layers the utilities lose to Infima's unlayered rules and the hero renders a teal label
  on a teal button. B15 is the enforcement.
- **The scaffold's `themeConfig` sets `prism` explicitly** — Docusaurus's default (palenight) is a
  *dark* theme while the doc CSS paints the code surface from `--muted`, so an unset `prism` key
  renders every fenced block at ~1.3:1 in light mode (measured).
- **There is one configuration, and it is the design system** *(amended 2026-08-14, superseding
  both the 2026-08-13 "on by default" wording and the original "stock preset-classic with the theme
  as an upgrade")*. Once the shell became a fork of the whole app, `themes` joined the shell-owned
  keys a project's config cannot set, so **no vsor project can opt out** and the stock fallback
  stopped existing. The guarantee it used to carry — "the theme changes look, never contract" — is
  now carried by B15's control probe instead: an unscanned utility class must compute to nothing,
  proving the design system reaches elements through the pipeline and not by accident. Reinstating
  a real fallback would need an opt-out seam in the shell and a second Playwright project; that is
  a design decision, not a wording one, and it is not in 0.1.0.

## Acceptance

Two phases, per the init spec's pattern: each lands in the same change as the thing it tests.

**Phase A — runs the day the package lands** (source + manifest only):

```
A1  every direct runtime dep of packages/sor-site is in the committed allowlist;
    the lockfile contains no denylisted name (transitives included)
A2  boundary test: parse the package's shipped source (src/, theme/, css) and the
    templates/ site shell (.ts/.tsx/.js/.css), PLUS — added 2026-08-14 — the
    scaffolded project's own prose: templates/scaffold/**/*.{md,json}, scanned
    with the same brand pattern and a curriculum word list (lesson|chapter|
    learner|student|curriculum|syllabus|classroom|coursework|course). Never a
    corpus, never specs/. The scaffold's 13 SKILL.md files and four rules crossed
    from an ~80-skill curriculum repo; prose is where that vocabulary survives a
    copy, and no other tier can see it. Assert zero matches of the committed
    exclusion list, which equals the table above row-for-row; word-boundary,
    case-sensitive; ReadingProgress carved out of any progress pattern. The
    framework's own home URL in the scaffolded AGENTS.md stays the one recorded
    brand exception — a structured entry exempting the line, not the file. The
    one committed list lives at
    packages/sor-site/e2e/tests/exclusions.json, consumed by this tier and B7;
    per-tier carve-outs are recorded inline there with their evidence. The
    framework's own home URL in scaffolded markdown is a recorded brand
    exception (a factual pointer, verified real — not corpus branding)
A3  token lint: zero raw color literals outside the designated token files —
    concretely two: packages/sor-site/theme/src/css/tokens.css and the
    scaffold's site/src/css/custom.css (the consuming site's token seam, the
    exact lines B12's sentinels patch)
A4  exported primitive prop types match the frozen baseline byte-for-byte
```

**Phase B — lands in the same change as the fixture-site build.** Build target:
`templates/` site shell + `tests/fixtures/tiny` as `knowledge/`, extended with one `<Quiz />` and one doc
carrying a unique search phrase; the fixture corpus is asserted to contain zero external
references. *(Amended at implementation, 2026-08-13: originally "every kept primitive appears at
least once" — the landed fixture proves the quiz end-to-end and search; per-primitive render
assertions for flashcards, gallery, ExerciseCard, HighlightTip and ImageZoom are named follow-up
work, added with the fixture extension that carries them.)*

```
B5  static scan of built HTML+CSS, all request-initiating positions (script src,
    link href across all rels, img/srcset, iframe/object/embed, svg href/use,
    css url() and @import, inline styles): zero non-local — fast pre-check
B6  route assertion against the Docusaurus route manifest / sitemap: no route
    outside /docs/** matches {admin, login, auth, signup, profile, onboarding,
    certifications, leaderboard}; corpus-generated /docs/** exempt by
    construction; the corresponding build/ directories do not exist
B7  the A2 exclusion list (same committed file) also returns zero matches
    against built JS bundles, plus a case-insensitive brand scan; recorded
    bundle-tier carve-outs: react-dom's own attribute tables (profile),
    theme-common's blog class tables (authors), Docusaurus's serialization of
    the customFields key itself
```

**Browser tier — the enforcement of record.** Deterministic by construction: production build
served by a plain static file server on `127.0.0.1` (an ephemeral port — *not* `vsor serve`);
Playwright with Chromium pinned in the lockfile; DOM-state auto-wait only; no screenshots, no
visual diffs, no timing-based waits.

```
B8   network interception: every request is same-origin with the test server;
     zero responses >= 400 — this enforces "phones no one" and "every asset
     resolves" at runtime, strictly stronger than B5
B9   GET / returns 200; document.title contains the instance name
B10  one doc page renders: h1 equals the fixture frontmatter title; body
     contains a phrase unique to that markdown file
B11  zero console.error and zero pageerror events across all visited pages
B12  seam liveness: build twice with sentinel themeConfig.navbar.title, footer
     copyright, and --ifm-color-primary; each sentinel appears in the built
     output and the old value is gone; a designated painted element's computed
     color derives from the token under both data-theme="light" and "dark"
B13  primitives: the quiz renders end-to-end — click one option and its
     feedback appears; type the unique phrase into SearchBar, a result links to
     that doc, click it, the page renders (amended 2026-08-13 with Phase B's
     build-target clause: remaining primitives' render assertions are named
     follow-up, landing with the fixture docs that exercise them)
B14  RETIRED 2026-08-14 — it asserted a stock configuration that can no
     longer be produced (see the positive contract). The two Playwright
     projects today are the fixture site and its sentinel twin, which is what
     B12 needs; they are not two theme configurations.
B15  design-system liveness (added 2026-08-14). A probe carrying only
     `flex items-center gap-2 text-sm` computes flex/center/8px/14px; the
     mobile trigger is hidden at 1440px and opens a Radix sheet carrying the
     corpus tree at 375px; lucide renders as inline SVG. The control, in place
     of the retired stock project: an UNSCANNED utility (`gap-[13px]`) must
     compute to `normal` and must not appear in the stylesheet — so a build
     where Tailwind emitted everything indiscriminately fails too. Also: a
     CSS-module-styled primitive keeps its own box (the quiz option's border
     and padding survive preflight), and a fenced code block clears 4.5:1 in
     light mode. Computed styles only — a class present in a stylesheet proves
     nothing about whether it reaches the element. This tier is load-bearing:
     every one of B5–B13 stayed green through a build where Tailwind emitted
     nothing, AND through a build where preflight had stripped every
     primitive's border and padding.
B16  admonitions render in BOTH syntaxes (added 2026-08-14). Docusaurus 3
     requires `:::tip[Title]`; the Docusaurus 2 form `:::tip Title` is not a
     directive at all and renders as literal text with a green build — 429
     occurrences in the corpus this shell was forked from. The shell migrates
     the v2 form in `markdown.preprocessor`, and the fixture carries one doc of
     each form so either path regressing is visible.
```

**Checklist — implement-time, not CI** (How-we-build #5; findings recorded beside the code):
resize to 375px and watch the navbar collapse · click the theme toggle · click every nav item ·
run one search by hand · load the site on a phone once. Visual judgment never graduates to
contract.

**Document corrections:** `docs/extraction.md`'s two JS-side keep lines (GA4; the `data-brand`
hostname switch) were corrected in the same commit as this revision — both are excluded above.
Ratification adds the **Surface** tier row to AGENTS.md's test-tier table so the browser suite has
a home in the repo's vocabulary.

## Open — pending the Node spike

How the preset and this package resolve with no `node_modules` in the user's project (managed
runtime vs prebuilt shell vs graceful skip); the exact `vsor build` wiring; `vsor eject site`
mechanics. Whatever the spike chooses, `sor-site` couples to the rest of the system **only via
`build.lock.json` and the corpus on disk** — the open question is the wiring, never the seam. The
negative contract and Phase A bind regardless of the outcome; Phase B's job is fully specified
above and lands when the build does.

## Out of scope

Visibility/gating (open decision B4) · i18n, machinery and content, post-v0 · analytics
integrations · the tutor surface · screenshot/visual-regression testing · accessibility/contrast
auditing beyond the token-applied assertion · mobile-viewport CI assertions (checklist only).
