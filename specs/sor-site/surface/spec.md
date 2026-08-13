---
status: draft
date: 2026-08-13
---

# `sor-site` — the website surface

**Business claim:** trust through simplicity. A professional's site carries no hidden product code,
phones no one, and every seam an agent edits is one its training data already knows.

## Negative contract — binding first, because it is the risk

The theme package (and therefore every built site) contains **none** of the upstream product layer.
Excluded by name, enforced by test:

| Excluded | Includes |
| :--- | :--- |
| **Auth & gating** | `better-auth`, `NavbarAuth`, `ContentGate`, `GatedQuiz`, `GatedSummary` — gating in the browser is theater (content ships in the static HTML regardless); real visibility is open decision B4, at the build/MCP layer |
| **Tutor & AI panels** | `TeachMePanel`, `TeachingGuideSheet`, StudyMode, `VoiceControlDock`, `AICheck`, ChatKit |
| **Progress & gamification** | `progress/`, leaderboard, `HypothesisTrial` (`ReadingProgress` — the local scroll indicator — stays: no backend, content primitive) |
| **Feedback & admin** | `Feedback/`, `AdminFeedback`, `pages/admin/` |
| **Practice & simulation** | `PracticeErrorCard`, `PracticeSetupCard`, `TerminalPanel`, `SimPlayer`, `InteractivePython` (opt-in later at most) |
| **Marketing & product pages** | `ThreeDBook`, `HeroIDESimulation`, `Ecosystem`, `certifications/`, `onboarding/`, `profile/`, authors data |
| **Content-as-code** | `explorers/`, `cheatsheets/` — course artifacts, not machinery |
| **Product config** | all 12 `customFields` API endpoints; the dual-brand runtime switch |
| **Translated content** | `docs-*` locale trees; i18n *machinery* survives as an optional feature |

**No external requests.** The built site loads **zero** third-party resources: fonts self-hosted, no
CDN scripts (no ChatKit, no FontAwesome CDN, no Google Fonts), no analytics by default. An owner who
wants analytics adds it through Docusaurus's own native config — a rung-1 edit in *their* repo,
never a framework default.

**Dependency denylist** (the manifest form of the same promise): `better-auth`,
`@openai/chatkit-react`, `@chatscope/*`, `@monaco-editor/react`, `@xterm/*`, `ts-fsrs`, `recharts`.

## Positive contract

- **Kept from upstream** (the theme upgrade, gated on copy authorization): the content primitives —
  quiz, flashcards, ui tokens, `ExerciseCard`, `HighlightTip`, `ImageZoom`, `ReadingProgress`,
  `SearchBar`, gallery — and the `libs/docusaurus` content-pipeline packages, with the five
  duplicate tab plugins collapsed to one *before* crossing the seam.
- **Native seams only:** `themeConfig` live (never dead-decoy config), `--ifm` tokens defined,
  swizzles land in `site/src/theme/`. Search stays the local index — no external service.
- **Slice 1 ships on the stock `@docusaurus/preset-classic`**; this package arrives as an upgrade
  that changes look, never contract.

## Acceptance

Mechanical, in the package's CI:

```
- the dependency manifest contains no denylisted package
- a source grep for the excluded identifiers (AuthContext, chatkit, leaderboard,
  ContentGate, TeachMe…) returns nothing
- the built fixtures/tiny site is scanned: zero external URLs in script/link/font
  references; every asset resolves inside build/
- the built site's pages contain no admin/, leaderboard, or auth routes
```

## Open — pending the Node spike

How the preset and this package resolve with no `node_modules` in the user's project (managed
runtime vs prebuilt shell vs graceful skip); the exact `vsor build` wiring; `vsor eject site`
mechanics. The negative contract above binds regardless of the outcome.

## Out of scope

Visibility/gating (open decision B4) · i18n content workflows · analytics integrations ·
the tutor surface (a future product composition, never part of this package).
