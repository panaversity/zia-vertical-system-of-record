# e2e — the browser tier of the surface spec

Implements Acceptance **B5–B15** of [`specs/sor-site/surface/spec.md`](../../../specs/sor-site/surface/spec.md)
(the Phase-B static checks and the browser tier, the spec's enforcement of record).

Run it as `make surface` from the repo root. One-time prerequisite:

```
(cd packages/sor-site && npm ci && npx playwright install chromium)
```

There is a **second suite in this directory** with a different question:
`deploy/` + `playwright.deploy.config.ts` ask whether the *deployable output*
works on the two shapes a static host has. It is driven by
[`tests/acceptance/deploy.sh`](../../../tests/acceptance/deploy.sh), not by
`run.sh`, and it is documented at the bottom of this file.

## How it works

`run.sh` (the driver, invoked by `make surface`):

1. **Assemble** two fixture sites with `scripts/assemble.mjs`, each in the
   MATERIALIZED shape — the layout `vsor build` creates under
   `.vsor/site-runtime/`:
   - `<out>/site-runtime/` — the forked app (`packages/sor-site/app`), which *is*
     the siteDir: its `docusaurus.config.ts`, `src/`, `static/`, `sidebars.ts`
   - `<out>/site-runtime/site/` — the project's authored site, i.e.
     `packages/vsor/src/vsor/templates/scaffold/site` with placeholders stamped
     (`__VSOR_NAME__` → `fixture`, `__VSOR_YEAR__` → `2026`)
   - `<out>/site-runtime/knowledge/` — `fixtures/tiny`
   - `site-sentinel` is the same site rebuilt with sentinel values in exactly
     three seams of the authored site: `themeConfig.navbar.title`, footer
     copyright, `--ifm-color-primary` (distinct colors for the light and dark
     blocks). This pair-of-builds is how **B12 seam liveness** is tested without
     rebuilding mid-suite: both builds exist up front, the suite compares them
     statically and drives the sentinel build in the browser. Each assembly
     writes a `manifest.json` recording the sentinels *and* the old values they
     replaced — the tests read that manifest and hardcode nothing.
2. **Build** each with the workspace's `docusaurus build`, run from inside the
   shell with `VSOR_SITE_DIR=./site VSOR_KNOWLEDGE_DIR=./knowledge` — the same
   two env seams `site_runtime.runtime_env()` sets, because the shell defaults to
   *sibling* `../site` and `../knowledge` (what it has in its own workspace).
   Dependency resolution walks up from the scratch dir into the committed
   workspace; the scratch sites are never `npm install`ed themselves.
3. **Serve** each `build/` with `python3 -u -m http.server` on an ephemeral
   `127.0.0.1` port (bind port 0, parse the reported port; `trap` cleanup).
4. **Run** the Playwright suite once.

| File | Assertions |
| :--- | :--- |
| `tests/static.spec.ts` | B5 (static scan of built HTML+CSS, zero non-local), B6 (route/sitemap + build-dir assertion), B7 (`tests/exclusions.json` vs built JS bundles) |
| `tests/surface.spec.ts` | B9, B10, B11 walk, B13 (quiz feedback + search to the doc) |
| `tests/seam.spec.ts` | B12 (sentinels present / old gone, token paints in light and dark) |
| `tests/primitives.spec.ts` | B13, the rest of the vocabulary — ExerciseCard, HighlightTip, flashcards, gallery, tabs, mermaid, ImageZoom — each against `fixtures/tiny/document-primitives.md`. Computed-style *floors* (a rule width, a padding, a hairline), never equalities: a stripped box fails, decoration stays free to change |
| `tests/design.spec.ts` | B15 — design-system liveness AND the regression net; B16 (admonitions in both the v2 and v3 syntaxes); and the hero's CSS-only capitalization, read from Chromium's AX tree |
| `tests/chrome.spec.ts` | B13, the chrome on every page and the landing bands under the hero — the four unread `data-vsor` hooks (`mode-toggle`, `reading-progress`, `doc-page-actions`, `search-no-results`), `LessonContent`'s two-view tabs, and SectionCards / Surfaces / Closing. Added 2026-08-14; two of these had already regressed silently (see the decision below) |
| `tests/harness.ts` | the always-on guard that makes every visited page enforce B8 (same-origin, zero ≥ 400) and B11 (zero console.error / pageerror); plus `inMode()`, the one place that knows how a color mode is forced |

Determinism: Chromium pinned via the committed `package-lock.json`, DOM-state
auto-wait only, no screenshots, no visual diffs, retries 0. The only wait
outside Playwright is `run.sh`'s bounded poll for the server's "port NNNN"
startup line.

## Decisions recorded here

- **One configuration, not two** (2026-08-14, the fork). This harness built
  `stock` and `themed` variants until the forked app became the runtime shell.
  "Stock preset-classic" meant a scaffold that deleted the separate
  design-system theme package from its own `themes` array; a project can no
  longer write `themes` at all (it is one of the six keys the shell owns and
  drops with a warning), the design system is imported by the shell's own
  `src/css/custom.css`, and the chrome it dresses is the shell's `src/theme`.
  That theme package (`@vsor/sor-site-theme`, with the `@vsor/sor-site-mdx`
  vocabulary package beside it) was deleted from the workspace later the same
  day. There is no seam by which a vsor project produces a site without the
  design system, so building one here would certify a configuration no user can
  have. B14 ("the identical B-suite passes against the stock preset-classic
  configuration and the themed configuration") is retired in the spec; the code
  is still written so that restoring a second configuration would be one entry
  in `playwright.config.ts` plus one `--out` in `run.sh` — but it would also
  need an opt-out seam in the shell, which does not exist.
- **The control B15 lost, replaced in-build.** Stock was the control that kept
  the themed numbers from being vacuous. In its place `design.spec.ts` probes an
  arbitrary utility that appears in no source file (`gap-[13px]`) and asserts it
  computes to nothing — which is the claim stock was standing in for: these
  rules exist because Tailwind scanned *this shell's own* `src/`, not because a
  blanket stylesheet shipped.
- **Source, not tarball.** The shell is copied from the working tree, while
  `tests/acceptance/build.sh` drives the real `vsor build` against the packed
  wheel. `make surface` runs build-acceptance first, so the shipped artifact and
  the source are both certified and a red run here names a file you can open.
- **Forcing a color mode** (found live 2026-08-14): the suite used to write
  `localStorage.theme` and reload. The shell enables `future.v4`, which
  namespaces Docusaurus's storage keys (the built bootstrap reads `theme-aae`),
  so that write landed on a key nothing reads and every dark assertion silently
  measured a light page. The bootstrap reads `?docusaurus-theme` first, before
  storage and before `prefers-color-scheme`, and runs before first paint — so
  `inMode()` in `tests/harness.ts` is the single seam, with no key to guess and
  no reload race.
- **Drift detection at assembly.** The old harness counted-replaced the
  scaffold's `themes` block, so a scaffold edit failed loudly. The scaffold has
  no themes block now; the property that replaced it is guarded instead — the
  scaffold config must still be a `Partial<Config>` and must set none of the six
  shell-owned keys, and the scaffold homepage must still import
  `@theme/Landing` (which resolves only because the shell ships
  `src/theme/Landing`).
- **A hook no test reads is an invitation** (2026-08-14). The shell declares
  seven `data-vsor` attributes — deliberate handles a restyle cannot move — and
  only three were ever read (`search-button`, `search-input`, `search-results`).
  The other four rendered in every build this suite called green, including the
  search empty state, which no test had ever reached. Two of them had already
  regressed: `--vsor-reading-progress` was documented as a token and declared
  nowhere, so the progress bar painted nothing, and the doc-action tooltip had
  neither a background nor a foreground for the same reason. Twenty-six
  custom properties were in that state; a declaration naming an undeclared
  property is invalid at computed-value time, which is silent in every direction
  a test usually looks. `chrome.spec.ts` reads computed styles off those
  elements, and the static half of the same claim is
  `tests/test_surface_contract.py::test_a3_every_custom_property_reference_resolves`.
- **`LessonContent` needed a fixture, not a test** (2026-08-14). Its tab nav
  carries `role="tablist" aria-label="Content view"` and that string appeared in
  0 of 7 built HTML files: the Summary branch renders only when a co-located
  `.summary.md` exists, and no fixture had one.
  `fixtures/tiny/vertical-sor.summary.md` is that fixture. It is deliberately on
  `vertical-sor` rather than `document-primitives`, so the doc that
  `primitives.spec.ts` searches for a single `tablist` still has exactly one.
- **B7 list:** `tests/exclusions.json` mirrors the spec's exclusion table
  row-for-row; its `$comment` records the two rows enforced elsewhere
  (`customFields`, locale trees) so the closure rule holds.
- **`design.spec.ts` — B15.** B5–B13 pin the *contract*, and the whole of it
  stays green through a build where Tailwind emits nothing: the utility classes
  are still in the markup, no request fails, no console error is logged, the page
  just silently reverts to unstyled boxes. That is the exact failure the design
  system was brought across to fix, and its most likely cause is one line
  drifting — the fork carries no `@source`, so v4's automatic source detection is
  the whole mechanism, and it skips gitignored paths while every real install
  materializes the shell into a gitignored `.vsor/`. Measured 2026-08-14: this
  suite's own shell is gitignored as well and the utilities still emit, so the
  gitignored case is the one already under test (see the file's header).
  So this file asserts *computed styles*, never stylesheet greps: Tailwind
  utilities resolve on an injected probe element, the responsive variant
  hides/shows the trigger, the Radix sheet opens carrying the corpus tree, lucide
  renders inline SVG.

  Two of its checks ask the opposite question — not "did Tailwind arrive?" but
  "did Tailwind destroy what was already here?". That is the failure that
  actually shipped: Docusaurus's cascade-layer polyfill raised Tailwind's
  preflight to (0,2,0), above every single-class CSS-module rule, and the quiz's
  options rendered 800x28 with no border and no padding while all of B5–B14
  stayed green (B13 asserts only that feedback text appears). So one CSS-module
  primitive must keep its own box, and a fenced code block must clear 4.5:1 in
  light mode.

---

# deploy/ — the hosting-layout suite

A second, separate suite in this directory. `make surface` does not run it and
`run.sh` does not know about it: its driver is
[`tests/acceptance/deploy.sh`](../../../tests/acceptance/deploy.sh) and its
config is `playwright.deploy.config.ts` (`testDir: ./deploy`).

```
bash tests/acceptance/deploy.sh              # from the repo root
VSOR_WHEEL=dist/vsor-0.1.0-py3-none-any.whl bash tests/acceptance/deploy.sh
```

**The question is different from the surface suite's.** That one asks whether
the *site* is right, against one build assembled from source. This one asks
whether the *deployable output* is right, against the two shapes a static host
actually has — built by the real `vsor build` from the real wheel, the way a
user gets it:

| Project | Shape | Served how |
| :--- | :--- | :--- |
| `root` | Vercel, Netlify, S3+CloudFront, nginx — `baseUrl: "/"` | the build *is* the document root |
| `subpath` | a GitHub Pages project site, an internal path — `baseUrl: "/<name>/"` | the build sits at `<docroot>/<name>/` and the server serves the **parent** |

The parent-serving is the point. A subpath run that served the build directory
itself and pretended the prefix existed would pass every prefix assertion
without proving anything; `D9` is the row that proves the harness is honest —
the document root answers with a marker file the driver put there, and an asset
path with the prefix stripped must 404.

**They fail differently, which is why both are here.** The root shape fails
*quietly*, in the machine-readable half: `url` in `site/docusaurus.config.ts` is
baked into `sitemap.xml`, every `<link rel=canonical>`, `og:url`, the og:/twitter:
image URLs and the JSON-LD, so a build made with the scaffold's placeholder
renders perfectly while telling crawlers and link previews that the site lives
on the machine that built it. The subpath shape fails *loudly*: Docusaurus
prefixes every asset, route and router link with `baseUrl`, so a mismatch 404s
the whole site.

| File | Rows |
| :--- | :--- |
| `deploy/output.spec.ts` | S1 (no built page names localhost or the serving machine, and the client bundle does carry the configured origin), S2 (every root-relative reference is under the deployed baseUrl) |
| `deploy/hosting.spec.ts` | D1 homepage 200 + title · D2 a doc renders · D3 CSS+JS respond 200 *and* the CSS computes · D4 a sidebar link navigates client-side under the prefix · D5 search finds the phrase and its result renders · D6 sitemap names the real host · D7 canonical/og:url in the served bytes **and** in the DOM after a client-side navigation · D8 every declared asset resolves 200 · D9 the prefix is real |
| `deploy/harness.ts` | the per-shape environment, the corpus facts (nothing about a fixture is hardcoded), and the always-on guard: same-origin, **every request path under the deployed baseUrl**, zero ≥ 400, zero console.error/pageerror |
| `tests/acceptance/deploy.sh` | the driver, plus the two rows that need both builds at once: the record distinguishes them (`build_id` covers the site tree), and the two shapes publish the same route set modulo the prefix |

## Decisions recorded here

- **A headless browser does not fetch declared favicons** (measured 2026-08-14).
  The subpath build shipped `<link rel=icon href="/img/favicon.svg">` — a 404 on
  every page for every real visitor — and the browser guard never saw it,
  because Chromium in this harness never requested it. That is why `D8` fetches
  every declared URL itself with `page.request` instead of trusting what the
  browser happened to ask for, and why `S2` scans the built HTML statically. A
  browser-only proof of "every asset loads" is not one.
- **The route set is compared across shapes, not just within one.** Anything
  whose *inclusion* depends on `baseUrl` — a sitemap ignore pattern written as
  an absolute path, a route emitted only at "/" — is invisible to any per-shape
  assertion, because each shape looks internally consistent. The set difference
  in `deploy.sh` is the only row that can see it.
- **Independent rows accumulate rather than exit.** The driver's rows are
  cross-shape and Playwright's are per-shape; one failing says nothing about the
  others, so `deploy.sh` records them and exits 1 at the end with all of them
  listed. Structural problems (a build that did not build, a server that did not
  start) still exit immediately — nothing after them is worth measuring.
- **Canonical's trailing slash is Docusaurus's, not ours** (measured
  2026-08-14). The SSG pass emits the slashless form; the hydrated head mirrors
  the URL the visitor actually requested, so `/docs/x/` self-canonicalizes *with*
  the slash. D7 therefore pins the served bytes exactly and compares the DOM
  slash-insensitively, rather than pinning behaviour this framework does not own.
- **This suite builds through the wheel, and that turned out to matter**
  (found live 2026-08-14). The surface suite assembles the shell from the
  working tree; this one runs the real `vsor build`, and the two do not produce
  the same stylesheet. Same source, same corpus, same page, measured:

  | | assembled (`make surface`) | `vsor build` output |
  | :--- | :--- | :--- |
  | `build/assets/css/styles.*.css` | 220,135 bytes | 347,962 bytes |
  | native `@layer` blocks | 12 | 0 |
  | selectors carrying the `:not(#\#_x):not(#\#_x)` cascade-layer polyfill | 0 | 6,753 |
  | `.theme-doc-sidebar-container` computed `margin-top` | `0px` | `-64px` |
  | first sidebar link, y | 85 (below the 65px navbar) | 23 (behind it) |

  The last row is a user-visible defect: in a site a user actually deploys, the
  first document in the sidebar is underneath the fixed navbar and cannot be
  clicked — `document.elementFromPoint()` at its centre returns the navbar. D4
  and D7 fail on it through `clickSidebarLink`'s reachability check, which is
  why that check exists.

  One confirmed input difference: the materialized shell's `package.json`
  (generated from `packages/vsor/src/vsor/templates/site_runtime/package.json`)
  carries no `browserslist`, while the app's own does — and that template's
  description says it "must carry everything the app imports", because the app
  tarball is unpacked over it. Adding the field to a materialized shell and
  rebuilding moved the pipeline a long way (6,753 → 1,356 polyfilled selectors,
  0 → 5 `@layer` blocks) but did not restore the sidebar offset, so it is one
  cause and not the whole one. Recorded rather than fixed: the fix is in
  `packages/vsor` and `packages/sor-site/app`, not in a test directory.
