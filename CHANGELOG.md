# Changelog

## 0.1.1 — 2026-08-14

Everything since the 0.1.0 tag. The theme of it is **publishability**: 0.1.0 could be built and
run, and this is the work of making it something a stranger can be handed. It is 0.1.1 rather than
a patch on 0.1.0 because the scaffold's file list is a contract and it changed (28 files to 29).

### Breaking

- **The scaffold grew from 28 files to 29.** `vsor init` now also writes
  `.agents/skills/deploy/SKILL.md`. A project scaffolded by 0.1.0 will not have it; nothing
  breaks, but a diff against a fresh scaffold is no longer empty. The scaffold's file list is a
  contract (`tests/acceptance/init.sh` diffs it byte for byte), which is why a scaffold addition
  is recorded here as a breaking change rather than as a feature.
- `.gitignore` gained `.vercel/` and `.netlify/` inside its `# vsor` marker block. The merge is
  idempotent, so re-running `init` over an existing project adds them without duplicating.

### Deploying is now a thing the product tells you about

- **`.agents/skills/deploy/SKILL.md`** — the first of the five deferred vsor skills to land, and it
  landed as a document rather than a verb: `vsor build` already emits an ordinary static directory,
  so what was missing was knowledge, not code. It carries the `url`/`baseUrl` edit, both deploy
  shapes, a command for each host, and a verification recipe that fetches rather than trusts.
- **The host configs live in the skill, not in the scaffold** — Vercel, Netlify and Cloudflare
  Pages, each as a copy-paste block an agent writes when the owner picks a host. They were
  scaffolded first and then withdrawn on the owner's challenge, which was right: a framework has
  no business putting a vendor's file into every project, two of the three would always be
  deleted, and neither could work until vsor is on PyPI. What a project needs is the knowledge,
  which now ships in `.agents/skills/deploy/SKILL.md` — offline, and pinned to the version that
  scaffolded it.
- **`vsor build` warns when the site it just built carries a placeholder origin.** Measured from
  the emitted `sitemap.xml`, never from the config text, because the shell's own default is the
  same placeholder — a project that deletes `url` still ships `localhost`. Two prose forms, because
  a loopback address and a reserved documentation name are wrong in different ways.
- **`make deploy-acceptance`** — a new hosting test tier: one scaffolded project, built twice
  through the real wheel (root host and subpath host), each served in the shape its host would
  have, then a real browser over both. It found three product defects on its first honest run and
  all three are fixed below.

### Fixed

- **The first document in the sidebar could not be clicked.** Docusaurus tucks the sidebar under
  the navbar with a negative margin and pays it back with padding; the fork deleted the padding and
  compensated with `position: sticky` instead, which only works while the page is tall enough to
  give sticky slack. On any page shorter than the window the first link sat behind the navbar —
  in every `vsor build` output, invisible to the surface tier, which builds an assembled fixture.
- **A subpath deploy asked for its favicon above its own site.** `headTags` composed the icon href
  from the shell's own `BASE_URL` rather than the merged config, so a GitHub Pages project site
  shipped `/img/favicon.svg` — a 404 on every page load that no headless browser requests, and so
  no browser tier could see.
- **A subpath deploy advertised its search page to crawlers and a root deploy did not.** The
  sitemap's `/search` ignore pattern was written absolute; a route path carries `baseUrl`.
- **Every doc page's JSON-LD carried the site tagline as its description**, and none carried
  `mainEntityOfPage`. The structured-data plugin extracted `<meta name=description>` and
  `<link rel=canonical>` with quotes-required patterns, and Docusaurus's production minifier emits
  both unquoted. The build printed a green tick over wrong data.
- **The structured-data graph dropped `baseUrl`**, so a subpath site announced its identity and its
  search endpoint at the origin root — on `github.io`, somebody else's page.
- **`vsor init --help` was refused as a bad project name**, and the remedy it printed
  (`Try: vsor init help`) scaffolded a 31-file project called `help`. `init` is the one verb
  argparse never sees, so it now owns `-h`/`--help` itself; and no suggestion is ever derived from
  a string starting with `-`.
- **`vsor serve`'s honest refusal named two paths that do not exist** — `specs/vsor/serve/spec.md`
  has never been written, and neither it nor `docs/status.md` is in the wheel or in a scaffolded
  project. It now names the scaffold's own command table and this file.
- **`vsor --help` taught nothing**: no per-verb summary, and `vsor build --help` listed neither
  flags nor where its output goes. Both now do.

### Attribution and governance

- **A root `NOTICE`**, shipped inside the wheel beside `LICENSE` (`license-files = ["LICENSE",
  "NOTICE"]`): the forked upstream app, the three shadcn/ui components used essentially as
  published, and the two vendored OFL typefaces.
- **Every shipped npm package carries the licence it declares.** Ten tarballs land in a user's
  `.vsor/site-runtime/` declaring `Apache-2.0`; none of them contained a word of licence text.
  Asserted by content in `test_wheel_contents.py`, the way the two OFL files already were.
- **`SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`.** The security document exists because
  the scaffold now ships a `curl … | sh` build command to two hosts and a floating `uvx vsor`:
  both are deliberate, both are documented, and neither had a file a security reader could be
  pointed at.
- `docs/extraction.md` said copy permission was ungranted while the granted half had already
  shipped in a tagged wheel. Corrected — the JS side was authorized 2026-08-13; the Python kernel
  still is not.

### The site, since 0.1.0

- **Upstream's brand survived the fork under neutral names.** The navy that painted emphasis, `h2`
  rules, table headers and link hover is now composed from `--primary`, with a browser assertion
  (B12) proving the derivation rather than the constant.
- **Two dead packages deleted** — `@vsor/sor-site-mdx` and `@vsor/sor-site-theme`, 63 source files,
  diffed one by one against the fork before removal. The shell manifest referenced neither, so they
  reached no user while still reading like the place to edit a Navbar.
- **Per-primitive render coverage**: flashcards, gallery, `ExerciseCard`, `HighlightTip`,
  `ImageZoom`, tabs and mermaid now have render assertions, with a fixture document that exercises
  them. The browser tier went 21 → 28 → 36 checks.
- **The Agent Factory hero was adopted**, which took the one-word-project-name defect with it (the
  uppercase is a CSS transform now, not a colour split).
- **Vendored fonts and both OFL licences are enforced by the wheel-contents test**, by content.
- **Lineage**: no shipped package's README or description names the repository it was forked from —
  widened from two packages to all ten.
- **The corpus-scale ceiling is measured and warned about.** Docusaurus writes the whole sidebar
  into every page, so a flat corpus costs O(n²) output: 2,000 flat documents build to 806 MB, the
  same 2,000 in twenty folders to 155 MB. `vsor build` says so at 300 flat documents.
- `vsor --version` reported `0.0.0`; it reports the distribution version.
- Packaging: `packages/vsor/LICENSE`, PEP 639 `license-files`, trove classifiers, keywords and
  project URLs; `release.yml`.

### Still open

`make deploy-acceptance` is a real target with a real red history and is now wired into CI. The
two closed 0.1.0 "Known gaps" below are marked closed where they stand.

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

~~Flashcards, gallery, `ExerciseCard`, `HighlightTip` and `ImageZoom` render but have no automated
render assertion.~~ **Closed after 0.1.0** — see Unreleased.

~~A one-word project name puts the whole hero title in the brand colour.~~ **Closed after
0.1.0** — the hero was adopted and the uppercase became a CSS transform.

CI is configured but its jobs do not start — a GitHub billing state on the account, not a code
failure; `make gate`, `make build-acceptance` and `make surface` are the same checks and pass
locally. (A fourth target, `make deploy-acceptance`, arrived after this release.)

### Not published

`vsor` is not yet claimed on PyPI, so this release is a tag, not an upload. Install from the built
wheel: `uvx --from dist/vsor-0.1.0-py3-none-any.whl vsor init <name>`.
