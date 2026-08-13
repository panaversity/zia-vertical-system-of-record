---
status: draft
date: 2026-08-13
---

# `sor-site` — the website surface

**Business claim:** trust through simplicity. A professional's site carries no hidden product code,
its theme phones no one, and every seam an agent edits is one its training data already knows.
Each of those is a CI property below, not a slogan.

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
| **Marketing & product pages** | `ThreeDBook`, `HeroIDESimulation`, `Ecosystem`, `certifications/`, `onboarding/`, `profile/`, authors data, `CapstoneWorkbook`, `ProjectCard`, `RequireProfile`, `SegmentEditOverlay`, `PDFViewer`, `TailwindTestComponent` |
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
backstops): `packages/sor-site` direct runtime deps must appear in a committed allowlist — initially
`react`/`react-dom`, `@docusaurus/*` (peers), `@mdx-js/react`, `clsx`, `prism-react-renderer`,
`@easyops-cn/docusaurus-search-local`, and the workspace-internal remark/loader packages. Growth
edits the allowlist in the same reviewed commit. Backstop: a lockfile-wide scan for the known-bad
names (`better-auth`, `@openai/chatkit-react`, `@chatscope/*`, `@monaco-editor/react`, `@xterm/*`,
`ts-fsrs`, `recharts`) catches them even transitively.

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
  stripped per the negative contract above)*. The theme upgrade only restyles it. So "changes look,
  never contract" is literal: a corpus using `<Quiz />` builds under both stock and themed
  configurations, and the identical acceptance suite passes against both. The upgrade may change
  any pixel the suite does not pin; it may not change an assertion.
- **Primitive contracts are pinned.** `<Quiz />` normatively: exactly four `options`,
  `correctOption` index, optional `explanation`/`source`. Exported prop types are diffed against a
  frozen baseline in package CI; changing a baseline requires touching this spec.
- **Native seams only, proven live:** `themeConfig` is live and *tested* live (Acceptance B12);
  `--ifm` tokens are **effective**, not merely defined; swizzles land in `site/src/theme/`.
  Components that render `themeConfig` data are **wrap-only**; a full ejection is legal only if the
  liveness suite still passes against it. Search stays the local index — no external service.
- **Token discipline:** no raw color literals (hex/oklch/rgb/hsl) in package CSS outside the
  designated token file(s); everything else consumes `var(--ifm-*)`/theme tokens. Baseline zero
  after extraction cleanup — reducing upstream's 212 literals is a named work-list item in
  `docs/extraction.md`.
- **Slice 1 ships on stock `@docusaurus/preset-classic`**; this package arrives as an upgrade.

## Acceptance

Two phases, per the init spec's pattern: each lands in the same change as the thing it tests.

**Phase A — runs the day the package lands** (source + manifest only):

```
A1  every direct runtime dep of packages/sor-site is in the committed allowlist;
    the lockfile contains no denylisted name (transitives included)
A2  boundary test: parse the package's shipped source (src/, theme/, css) and the
    templates/ site shell — .ts/.tsx/.js/.css only, never markdown, specs, or any
    corpus — and assert zero matches of the committed exclusion list, which equals
    the table above row-for-row; word-boundary, case-sensitive; ReadingProgress
    carved out of any progress pattern. The one committed list lives at
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
`templates/` site shell + `fixtures/tiny` as `knowledge/`, extended with one `<Quiz />` and one doc
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
B14  the identical B-suite passes against the stock preset-classic
     configuration and the themed configuration
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
