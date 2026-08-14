# e2e — the browser tier of the surface spec

Implements Acceptance **B5–B15** of [`specs/sor-site/surface/spec.md`](../../../specs/sor-site/surface/spec.md)
(the Phase-B static checks and the browser tier, the spec's enforcement of record).

Run it as `make surface` from the repo root. One-time prerequisite:

```
(cd packages/sor-site && npm ci && npx playwright install chromium)
```

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
| `tests/design.spec.ts` | B15 — design-system liveness AND the regression net |
| `tests/harness.ts` | the always-on guard that makes every visited page enforce B8 (same-origin, zero ≥ 400) and B11 (zero console.error / pageerror); plus `inMode()`, the one place that knows how a color mode is forced |

Determinism: Chromium pinned via the committed `package-lock.json`, DOM-state
auto-wait only, no screenshots, no visual diffs, retries 0. The only wait
outside Playwright is `run.sh`'s bounded poll for the server's "port NNNN"
startup line.

## Decisions recorded here

- **One configuration, not two** (2026-08-14, the fork). This harness built
  `stock` and `themed` variants until the forked app became the runtime shell.
  "Stock preset-classic" meant a scaffold that deleted `@vsor/sor-site-theme`
  from its own `themes` array; a project can no longer write `themes` at all (it
  is one of the six keys the shell owns and drops with a warning), the design
  system is imported by the shell's own `src/css/custom.css`, and the chrome it
  dresses is the shell's `src/theme`. There is no seam by which a vsor project
  produces a site without it, so building one here would certify a configuration
  no user can have. B14 ("the identical B-suite passes against the stock
  preset-classic configuration and the themed configuration") and B15's stock
  half are therefore queued for the lead; the code is written so restoring a
  second configuration is one entry in `playwright.config.ts` plus one `--out`
  in `run.sh`.
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
- **B7 list:** `tests/exclusions.json` mirrors the spec's exclusion table
  row-for-row; its `$comment` records the two rows enforced elsewhere
  (`customFields`, locale trees) so the closure rule holds.
- **`design.spec.ts` — B15.** B5–B14 pin the *contract*, and the whole of it
  stays green through a build where Tailwind emits nothing: the utility classes
  are still in the markup, no request fails, no console error is logged, the page
  just silently reverts to unstyled boxes. That is the exact failure the design
  system was brought across to fix, and its most likely cause is one line
  drifting — Tailwind v4 does not scan `node_modules` and skips gitignored paths,
  and in every real install the shell is materialized into a gitignored `.vsor/`.
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
