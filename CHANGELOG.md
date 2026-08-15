# Changelog

## 0.1.4 — 2026-08-15

No user-visible behaviour changes. This closes the hole 0.1.3 was found through: the browser tier
was compiling with a different compiler than the one that ships, so it could not have seen the
defect it was supposed to catch. Nothing here is a fix to the product — it is the machinery that
decides whether the next defect is caught or shipped.

### Testing

- **The browser tier now installs the shipped dependency tree.** It used to copy
  `packages/sor-site/app` and let Node resolution walk up into the workspace's `node_modules`; a real
  `vsor build` runs `npm ci` against the lockfile the wheel carries. The two disagreed on **65
  packages**, and the disagreement landed on the compiler: `lightningcss` 1.32.0 against 1.33.0 (the
  CSS minimizer — the organ that lowers `@layer` against browserslist targets, i.e. the exact organ
  that shipped broken in 0.1.2), `@swc/core` and `@swc/html` 1.15.47 against 1.16.0 (the JS loader,
  JS minifier and HTML minifier), and browserslist's own target data. The fixture now takes the
  staged `package.json`, `package-lock.json` and nine library tarballs and `npm ci`s them in place —
  the same files, in the same order, as `site_runtime.materialize()`. Verified after the change: the
  fixture and a real build of the published 0.1.3 wheel agree on every one of those packages.
- **The fixture is assembled under `mktemp`, outside the repository.** Installing the shipped tree
  fixes what the fixture *has*; it does not stop a module the fixture *lacks* resolving silently from
  the workspace above it, which is the same failure in its quietest form. There is no longer an
  ancestor `node_modules` to fall through to. `VSOR_E2E_KEEP=1` preserves the tree for a post-mortem.
- **The tier no longer inherits `VSOR_*` from the caller.** `runtime_env()` strips them for a real
  build because six decide a site's published identity, so an ambient export could steer the fixture
  in a way it can never steer a user's build.
- `make surface` costs about four minutes more, and that is the price of testing the artifact.

### Supply chain

- **The shipped lockfile is committed and reviewed.** It was regenerated against the live registry on
  every `make wheel` — so the tree every user installs was a fresh resolution taken at whatever
  moment the wheel happened to be built, never committed, never read by anyone, and different on
  every machine that ran the target. This repository's own rule calls the lockfile the dependency
  review surface; this was the one dependency set nobody could review. `make wheel` now copies
  `templates/site_runtime/package-lock.json` instead of resolving, so CI, a release and a laptop pack
  the same tree. Safe because `npm pack` is byte-reproducible — verified by packing a library twice
  and comparing sha512, and by checking a fresh pack against the integrity the lock already records.
- **`make relock`** is the only way that tree changes: it re-resolves against the registry and leaves
  the diff for a human. A test asserts the committed lock is the committed manifest resolved, so the
  two cannot drift; it fails naming `make relock`.
- The reviewed lockfile is excluded from the wheel — only the staged copy ships, rather than 834 KB
  of the same JSON twice.

## 0.1.3 — 2026-08-15

The design system reached the browser in pieces, and the test suite could not see it. Every entry
here was measured on the deployed demo — the artifact `vsor build` produces, not the fixture the
browser tier assembles — which is the whole lesson of the release.

### Fixed

- **Every CSS module in the site shell lost its padding, margin and border.** The quiz rendered as
  unpadded slabs, the search overlay ignored its own `padding: 10vh 1rem 1rem` and sat flush against
  the top of the window, the flashcard became a tall empty box. Three facts had to line up: the
  materialized shell's `package.json` declared no `browserslist`, so a real build fell back to
  browserslist's defaults (`and_qq`, `and_uc`, `kaios` — none of which support cascade layers);
  Docusaurus installs `postcss-preset-env` with an empty options object, so its `cascade-layers`
  polyfill was on; and that polyfill rewrites every `@layer` into `:not(#\#)` chains. Tailwind's
  preflight — `*,::before,::after { margin: 0; padding: 0; border: 0 solid }` — therefore arrived at
  specificity **(2,0,0)**, which no CSS module's single class (0,1,0) can beat at any nesting depth.
  The shipped 0.1.2 stylesheet carried 6,451 of those selectors and zero `@layer`. Fixed at both
  ends: the shell manifest now mirrors the app's `browserslist`, and the site config disables the
  polyfill outright, because this design system requires cascade layers and every browser it targets
  has supported them since 2022.
- **The search dialog opened over an undimmed page, off-centre, pinned to the top.** The overlay is
  `position: fixed; inset: 0`, but it rendered inside a navbar that becomes `backdrop-blur-xl` once
  scrolled — and a non-none `backdrop-filter` makes an element the containing block for its fixed
  descendants, so `inset: 0` resolved against a 1193×64 bar. It is portalled to `<body>` now. The
  portal was lost when the shadcn/cmdk command dialog was replaced with a self-contained one.
- **`DocPageActions` was annotated with `ChapterLesson`,** an upstream type deleted on copy, inside
  the function that runs every time a reader downloads a section. Docusaurus compiles with SWC and
  strips types without reading them, so it built, deployed and served.

### Testing

- **The browser tier was certifying a different compiler than the one that ships.** It assembles its
  fixture by copying `packages/sor-site/app`, so it inherited that directory's `browserslist` and
  compiled correctly while the artifact did not: 42 checks green, including one written in response
  to this exact failure mode ("a CSS-module primitive keeps its own box") whose sentinel element
  measured `padding: 0px; border: 0px` on the live site. Reverting the fix and re-running the tier
  still produced 42 green. Three rows close it: the shipped stylesheet must keep its cascade layers
  (**deploy tier**, which reads the real `vsor build` output — red against 0.1.2), the same check in
  the surface tier, and the search overlay must measure as large as the window it claims to cover.
- **The shell manifest and the app must resolve the same browser targets** — asserted in
  `test_site_runtime.py`, next to the dependency mirror it sits beside. `browserslist` is not a
  dependency, but it decides how the CSS is compiled, and the shell manifest *replaces* the app's.
- **`make surface` now typechecks the shell's TypeScript** (`make typecheck-app`). No tier read it
  before; `gate` stays node-free.

## 0.1.2 — 2026-08-15

The pre-publish record audit. Every entry below is a defect measured on a real build with the real
wheel; the theme is that **`build.lock.json` had to stop claiming things it could not deliver**,
because every citation the MCP surface will return resolves through that file.

### Breaking

- **`build.lock.json` is format 2.** A format-1 reader must be updated. Two fields are added and
  one of them changes `build_id`, so every project's next build produces a new `build_id` for an
  unchanged corpus. Taken now, before the first PyPI release, because a format bump after one is a
  migration.
  - **`corpus.prefix`** — the project root's path inside the repository `corpus.git` names (`""` at
    the root, `"sor/"` one level below it). `documents[]` rows are project-relative while
    `corpus.git` names HEAD of the *enclosing* repository, so in the layout `vsor init` instructs
    the user into — inside an existing work tree — `<sha>:knowledge/x.md` was a path no commit
    contained. A citation resolves `<git>:<prefix><path>`, which the build acceptance now asserts
    per document.
  - **`site.app`** — the forked site application that rendered the site, also in the `build_id`
    preimage. The app is unpacked over the shell rather than installed, so no npm integrity hash
    covers it: two builds of one corpus by one vsor version, by two different forks, collided.
- **`build/build.lock.json`** — the deployable directory now carries a copy of the record that
  describes it, so "is the live site the one this record names" is answerable by comparing one
  `build_id`. Nothing in `build/` named the build before, which made a record/artifact divergence
  undetectable by any means.

### Fixed — the record

- **`corpus.git` named a commit that could not reproduce the build.** The clean-check covered
  `knowledge/` while `build_id` covers `knowledge/`, `site/` and `instance.md`. Editing
  `site/docusaurus.config.ts` — the documented customization surface, and the first thing every
  project does — left a record naming a commit that reproduces a different `build_id` and a
  different site. All three trees are now checked, and a dirty one nulls the commit exactly as a
  dirty corpus does.
- **`corpus.git` named a commit whose `knowledge/` is a symbolic link.** A linked corpus root stays
  legal — the copy and the walk both follow it, so the site and the record agree — but HEAD holds a
  link, not the corpus, so zero recorded documents could be fetched from the commit the record
  named. Now null, with a warning that says why.
- **A `draft: true` document was recorded with no page behind it.** Docusaurus drops drafts from a
  production build downstream of everything vsor measures, so the file was hashed, moved `build_id`
  and got a `documents[]` row while no route existed — a citation resolving to the record and 404ing
  on the site. Now refused: `error: knowledge-invalid`.
- **The site's published identity could come from the environment.** The shell config reads six
  `VSOR_*` variables (title, tagline, url, baseUrl, favicon, social image), so two builds with the
  same `build_id` could publish at different origins, differing in every canonical link, og:/twitter:
  URL, JSON-LD `@id` and sitemap entry. The environment is now a closed surface: `vsor` strips every
  `VSOR_*` key before the build, and `site/docusaurus.config.ts` is the only door.

### Fixed — safety

- **A `build/` that was not a directory half-completed the swap and then wedged the project.** A
  regular file or a symlink there made `shutil.rmtree` raise *between* the two renames: `build/` held
  the new site while `build.lock.json` still described the previous one, and every later run
  re-raised the same error before doing any work. All three shapes are now handled, the replacement
  is reported rather than silent, a link's target is never touched, and the (cosmetic) cleanup can
  no longer skip the record write.
- **`vsor dev` ignored SIGHUP**, so closing the terminal killed vsor and left the dev server alive,
  holding the port, with a lock naming a dead pid — which the next verb took over, straight into the
  shell that orphan was serving from. SIGHUP and SIGQUIT now shut down the way SIGINT does, the lock
  records the node process, and a live child holds the project even when its vsor is gone.
- **`superseded: yes` passed as a genuine supersession and rendered no notice.** PyYAML reads `yes`
  as a boolean; the site's own parser reads it as the string `"yes"` — so a withdrawn rule was
  served as current and recorded as validly superseded. `superseded` is now decided from the
  scalar's own characters: `true`/`false` only, the three spellings of each that both parsers share.
- **Frontmatter that PyYAML rejects and the site accepts switched the whole dating gate off** for
  that document, silently — a tab after the colon being the measured case, which shipped a
  supersession pointer naming nothing. An unreadable frontmatter block is now `knowledge-invalid`.
- **Ctrl-C during `vsor build` ended in a traceback** and a death by signal, with no `error: <slug>`
  first line and no exit code from the closed set. It is now a decided exit 0 — and the build's node
  process gets its own group and a sweep, so nothing survives the cancellation.
- **A named pipe (or socket, or device node) in `knowledge/` died inside `copytree`**, surfacing a
  raw Python `shutil.Error` repr under `io-failed`. The rule the record actually enforces — a
  document is a regular file — is now the rule the refusal states.
- **A `superseded_by` naming an accented filename was broken in both directions** (the build refused
  a correct corpus, or the page lost the link), because the record's paths are NFC-normalized and the
  pointer was not. Both ends now normalize.
- **A successor declaring `id:` in its frontmatter** validated at build time and rendered "No
  replacement is named" — the same observable outcome as the dangling pointer the build refuses
  outright. Now refused, naming the collision.
- Two rough edges on the lock: a reused pid could produce the remedy `kill 1`, and a directory at
  `.vsor/lock` wedged the project permanently. Both closed; the refusal now names the process that
  is actually running rather than the one that took the lock.
- `io-failed` for a two-path call named the source (a temp file that was fine) instead of the
  destination that was wrong. It prints `<src> -> <dst>` now.

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
