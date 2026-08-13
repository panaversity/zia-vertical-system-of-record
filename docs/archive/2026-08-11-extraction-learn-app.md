> **ARCHIVED 2026-08-12 — not authoritative, not in the reading order.**
> Superseded by the consolidated set: `AGENTS.md` (durable), `docs/status.md` (weekly),
> `docs/extraction.md` (the join work list). Kept because the reasoning is real work.
> Known defects at archive time are corrected in the live set, not here.

---

# Extraction inventory — `learn-app` → the human door

Source: `~/Documents/code/panaversity-official/tutorsgpt/ag2/apps/learn-app`
Surveyed 2026-08-11. Companion to `docs/archive/2026-08-11-design-study.md` (archived — **not authoritative**; see `AGENTS.md` and `docs/status.md` for what is live).

---

## 0. The headline

**The site kernel is already half-extracted too.** `learn-app` is not a monolith to be carved
up — `ag2/libs/docusaurus/` already holds **14 shared packages** (an nx workspace) that
`learn-app` consumes as a *consumer*, not an owner.

That produces the cleanest statement of what the framework actually is:

> Two monorepos have each independently extracted half a kernel.
> `ag2/libs/docusaurus/*` is the **human door's** kernel (nx, JS, 14 packages).
> `sor-agentfactory/packages/*` is the **agent door's** kernel (uv, Python, 6 packages).
> They share a corpus and nothing else — not a config file, not a build, not a provenance
> chain. **The framework is the seam between them: one instance definition that drives both.**

That is a far smaller and more tractable job than "build a framework," and it explains why the
`rendered: base_url` provenance gap exists at all: there is no shared build to be hermetic to.

---

## 1. Already shared — `ag2/libs/docusaurus/` (14 packages)

These are already outside the app and are largely vertical-agnostic. They are the human door's
existing kernel and should move mostly intact.

| Package | Kind | Kernel? |
| :--- | :--- | :--- |
| `shared/siteConfig.js` | url/baseUrl from `SITE_URL`/`BASE_URL` env | ✅ generic (already the white-label seam) |
| `shared/normalizeToDocId.js` | doc-id normalization | ✅ generic |
| `shared/flashcardLoader.js` · `galleryLoader.js` | content loaders | ✅ generic |
| `plugin-og-image` | Satori/Sharp OG image generation (bundles Inter) | ✅ generic |
| `plugin-structured-data` | JSON-LD emission | ✅ generic |
| `chapter-manifest-plugin` | build-time content manifest | ✅ generic — **and the natural join point to the SoR bundle** |
| `summaries-plugin` | per-page summaries | ✅ generic |
| `remark-flashcards` (has tests) | `:::flashcard` → component | ✅ generic |
| `remark-content-enhancements` | admonition/content sugar | ✅ generic |
| `remark-gallery` | image galleries | ✅ generic |
| `remark-normalize-relative-links` | link rewriting | ✅ generic |
| `remark-interactive-python` | Pyodide code blocks | ⚠️ curriculum-flavoured; keep as opt-in |
| `remark-os-tabs` · `remark-tool-tabs` · `remark-deploy-tabs` · `remark-cowork-tabs` · `remark-channel-tabs` | five near-identical tab transforms | ⚠️ **collapse into one configurable `remark-tabs`** before extracting — five copies is exactly the entropy eve's "code is liability" principle warns about |

---

## 2. `docusaurus.config.ts` (43KB) — what is branded

Docusaurus **3.9.2**, `future.v4: true`, `experimental_faster` (SWC JS loader + minimizer, SWC
HTML minimizer, Lightning CSS, MDX cross-compiler cache). Rspack and SSG worker threads are
deliberately disabled with reasons recorded inline (CSS ordering; 8GB Vercel memory).

**Must be lifted into the instance definition:**

| Line | Value |
| :--- | :--- |
| 482 | `title: "The AI Agent Factory"` |
| 483 | `tagline: "The spec-driven, human-supervised process…"` |
| 485 | `favicon: "favicon.png"` |
| 528 | `organizationName: "panaversity"` |
| 529 | `projectName: "ai-native-software-development"` |
| 1017–1040 | OG/Twitter card: title, `https://agentfactory.panaversity.org/img/og-image.jpg`, og:url |
| 1053 | navbar `title: "Agent Factory"` |
| 1114–1178 | footer: four link groups, four social URLs, `Copyright © … Panaversity` |
| 623–633 | GA4 via `process.env.GA4_MEASUREMENT_ID` (already env-driven ✅) |

**Already extracted / already parameterized — do not redo:**

- `url` and `baseUrl` come from `libs/docusaurus/shared/siteConfig.js`, itself driven by
  `SITE_URL` / `BASE_URL`.
- **Runtime white-labeling already exists** (541–551). An inline head script sets
  `data-brand` from the hostname, because *"one build answers both agentfactory.panaversity.org
  and agentfactory.piaic.org, so the publisher brand cannot be baked in at build time."*
  It fails safe: no attribute means Panaversity. **This is a working multi-brand mechanism and
  the framework should generalize it rather than replace it.**
- `i18n: require("./i18n-config.json")` — already external.
- Search is `@easyops-cn/docusaurus-search-local` — **local index, no Algolia, no external
  service.** Correct for the "cost near zero" thesis; keep. Note the recorded caveat: it has no
  Urdu tokenizer, so Urdu pages index under `en`.

**`customFields` (488–502) — 12 product integrations, none of them kernel:** `authUrl`,
`oauthClientId`, `studyModeApiUrl`, `tokenMeteringApiUrl`, `chatkitDomainKey`, `progressApiUrl`,
`feedbackCampaignsEnabled`, `hypothesisTrialEnabled`, `learnerProfileApiUrl`, `practiceEnabled`,
`translationApiUrl`, `updates`. Each points at a sibling app in `ag2/apps/` (`sso`,
`study-mode-api`, `token-metering-api`, `progress-api`, `learner-profile-api`,
`practice-server`, `translation-worker`). **All of this is Panaversity's product layer and must
not enter the framework.**

---

## 3. `src/` — kernel vs product

~50 component directories. The split is lopsided, and that is good news: the kernel is small.

**Kernel — content primitives any vertical needs:**
`quiz/` · `flashcards/` · `ui/` (shadcn/Radix primitives) · `ExerciseCard/` · `HighlightTip/` ·
`ImageZoom/` (PhotoSwipe) · `ReadingProgress/` · `SearchBar/` · `gallery/` · `cheatsheets/` ·
`explorers/` · `LessonContent/` · `DocPageActions/` · `ModeToggle/`

**Product — Panaversity's, must not enter the framework:**
`NavbarAuth/` · `ContentGate/` · `GatedQuiz/` · `GatedSummary/` · `AICheck/` · `AdminFeedback/` ·
`Feedback/` · `TeachMePanel/` · `TeachingGuideSheet/` · `VoiceControlDock/` · `ThreeDBook/` ·
`HeroIDESimulation/` · `CapstoneWorkbook/` · `HypothesisTrial/` · `InteractivePython/` ·
`TerminalPanel/` · `SimPlayer/` · `Ecosystem/` · `certifications/` · `onboarding/` · `profile/` ·
`progress/` · `translation/` · `PracticeErrorCard/` · `PracticeSetupCard/` · `ProjectCard/` ·
`CoworkTabs/` · `ToolTabs/` · `WebAgentTabs/` · `pages/admin/` · `pages/auth/`

**Dependencies that leave with the product:** `better-auth`, `@openai/chatkit-react`,
`@chatscope/chat-ui-kit-*`, `@monaco-editor/react`, `@xterm/*`, `ts-fsrs`, `recharts`,
`@af/translation-shared` (workspace).

**Theme swizzles** (`src/theme/`): `DocItem`, `Footer`, `Layout`, `Navbar`, `NavbarItem`,
`SubmissionDialog`. Mixed — the Navbar/Footer swizzles carry auth and branding and need
unpicking; `DocItem` and `Layout` are closer to kernel.

**Styling:** Tailwind **v4** (`@tailwindcss/postcss`), shadcn via `components.json`,
`tailwindcss-animate`, `next-themes`, `framer-motion`. `DESIGN_SYSTEM.md` (22KB) documents it.

---

## 4. Content conventions

**Frontmatter** (from the Ecosystem Concept page): `title`, `sidebar_label`, `sidebar_position`,
`image`, `description`, `keywords[]`, and optionally `slug`. The SoR derives `stable_id` from
the *path*, not from `slug`, so a custom site slug does not move a document's identity — the two
sides already agree on this without sharing code.

**`<Quiz />` props** — clean and vertical-agnostic; a kernel primitive as-is:

```ts
interface QuizQuestion {
  question: string;
  options: [string, string, string, string];   // exactly four
  correctOption: 0 | 1 | 2 | 3;
  explanation?: string;
  source?: string;                              // e.g. "Lesson 1: Understanding Mutability"
}
interface QuizProps {
  title?: string;
  questions: QuizQuestion[];
  questionsPerBatch?: number;                   // default 15–20
}
```

The fixed arity of four options is a real constraint worth keeping — it makes questions
uniform, gradeable, and generatable.

`<Flashcards />` is fed by `remark-flashcards` + `shared/flashcardLoader.js` and validated by
`scripts/validate-flashcards.ts`.

---

## 5. `scripts/` (17) — promote, adapt, or drop

**Promote into `vsor check` / `vsor build`:**

| Script | What it does |
| :--- | :--- |
| `check-translation-drift.mjs` (18KB) | drift detection between locales — **the same shape as the SoR's declaration-drift gate**; unify them |
| `validate-flashcards.ts` | content validation |
| `check-jsonld-ssr.mjs` | asserts structured data survives SSR |
| `whats-new-links.mjs` | link checking |
| `generate-og-images.mjs`, `generate-ecosystem-og.mjs` | OG generation (Satori + Sharp) |
| `add-og-images-to-frontmatter.js`, `add-og-images-properly.js` | two scripts doing one job — **collapse** |
| `convert-images-to-webp.mjs` | asset optimization (has a migration manifest) |
| `build.sh` (12KB) | the real build; the natural place to add the SoR publish step |

**Adapt (i18n door, optional):** `cc-i18n.workflow.mjs`, `accept-translations.mjs`,
`sync-roman-urdu-docs.mjs`.
**Drop (product):** `build-zia-avatar.mjs`, `generate-anki-decks.js`,
`cleanup-vercel-cache.sh`.

---

## 6. Env (`.env.example`, 10 active vars)

`PANAVERSITY_SERVER_URL`, `PANAVERSITY_API_KEY`, `AUTH_URL`, `OAUTH_CLIENT_ID`,
`STUDY_MODE_API_URL`, `TOKEN_METERING_API_URL`, `PROGRESS_API_URL`,
`FEEDBACK_CAMPAIGNS_ENABLED`, `LEARNER_PROFILE_API_URL`, `TRANSLATION_API_URL`.

**Every one is a product integration.** The framework's site door needs approximately none of
them — `SITE_URL`, `BASE_URL`, and `GA4_MEASUREMENT_ID` are the whole surface, and all three are
already env-driven. That is a strong signal the kernel/product line is drawable.

---

## 7. Recommended sequence

1. **Collapse the five tab remark plugins into one** and the two OG-frontmatter scripts into
   one, *before* extracting. Do not carry known duplication across a seam.
2. **Promote `libs/docusaurus/*` to a publishable `sor-site` preset**, with `siteConfig`
   widened from `{url, baseUrl}` into the full branding block read from the instance definition.
   Generalize the `data-brand` hostname mechanism rather than replacing it.
3. **Fork `learn-app` to a bare template** carrying only the kernel components, no
   `customFields`, no `better-auth`.
4. **Join the two builds.** Have `build.sh` emit the corpus bundle the SoR ingests, so
   `rendered:` moves from `base_url` to `build_dir` and provenance becomes hermetic to the git
   SHA. **This is the single change that makes the two halves one framework.**
