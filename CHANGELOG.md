# Changelog

## 0.1.0 — 2026-08-14

The first release where the site half works end to end: `vsor init` → write markdown →
`vsor dev` → `vsor build` → a deployable site. The MCP surface is not in this release.

**Why 0.1.0 and not 0.0.1:** three verbs are implemented, tested and walked live, so 0.0.1 would
undersell it; and 0.x still says what is true — the API is not yet stable, and the second surface
has not landed. The version pin a scaffold writes derives from this number by one rule
(`>=0.1.0,<0.2`), so minor versions are the unit of change.

### Verbs

- **`vsor init`** — scaffolds a project into the user's own repo: corpus, `instance.md`, a real
  Docusaurus `site/`, an agent kit, and one git commit. Atomic (a failed init leaves the filesystem
  as it found it), deterministic, no network, stable error slugs on stderr.
- **`vsor dev`** — the live site on 127.0.0.1, hot-reloading from `knowledge/`. Validated port,
  no interactive prompts, signals forwarded to the child's process group, Ctrl-C exits 0.
- **`vsor build`** — the deployable `build/` plus a committed `build.lock.json` whose `build_id`
  identifies the *inputs* (corpus tree, site tree, `instance.md`, tool versions).
- `vsor serve` — the MCP surface, arriving in a later release; running it says so and exits 2.

### The site

The website surface is a fork of the Agent Factory learn-app: the design system crossed whole —
Tailwind v4, shadcn/ui primitives, OKLCH design tokens, lucide icons, the doc-page and sidebar
typography, the navbar and its mobile sheet, and a content-driven landing page. The product layer
did not cross: no auth or gating, no tutor panels, no progress or leaderboard, no feedback or
admin, no practice or simulation, no analytics — enforced by tests, not intention.

The content vocabulary ships with it: `<Quiz />`, `<Flashcards />`, gallery, `ExerciseCard`,
`HighlightTip`, `ImageZoom`, plus local search over the corpus. A project rebrands by editing
design tokens in `site/src/css/custom.css`; everything else follows.

### The agent kit

A scaffolded project is equipped, not empty: `.claude/settings.json` (the vsor verbs
pre-permitted, `.env` reads denied), four rules for working a governed corpus (provenance,
abstention, review, repository map), and 13 corpus-generic skills — source conversion, knowledge
extraction, clarity and refinement, format checking, and generators for the content primitives.

### Found live, fixed, and now guarded

- Docusaurus 3 requires `:::tip[Title]`; the Docusaurus 2 form `:::tip Title` is not a directive at
  all and renders as literal text with a green build. The shell migrates the old syntax on the way
  in, because "bring your existing markdown" is the promise. Both forms are asserted.
- The scaffold shipped no `sidebars.ts`, so its sidebar was named `defaultSidebar` while every
  `create-docusaurus` site names it `tutorialSidebar` — any imported corpus failed the build.
- Tailwind's preflight, boosted above CSS modules by Docusaurus's `@layer` polyfill, silently
  un-styled the primitives the design system exists to dress.
- A React hydration error fired on every doc page for Mac readers, and the build host's OS was
  baked into the shipped HTML: Node ≥21 defines a global `navigator`, so `typeof navigator` guards
  are dead code.
- npm keys `file:` tarballs by integrity hash, so a warm cache silently installs stale bytes unless
  the shell lockfile is regenerated unconditionally.

### Known gaps

Flashcards, gallery, `ExerciseCard`, `HighlightTip` and `ImageZoom` render but have no automated
render assertion. A one-word project name puts the whole hero title in the brand colour. CI is
configured but its jobs do not start — a GitHub billing state on the account, not a code failure;
`make gate`, `make build-acceptance` and `make surface` are the same checks and pass locally.

### Not published

`vsor` is not yet claimed on PyPI, so this release is a tag, not an upload. Install from the built
wheel: `uvx --from dist/vsor-0.1.0-py3-none-any.whl vsor init <name>`.
