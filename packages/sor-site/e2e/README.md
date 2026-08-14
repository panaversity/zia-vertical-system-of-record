# e2e — the browser tier of the surface spec

Implements Acceptance **B5–B15** of [`specs/sor-site/surface/spec.md`](../../../specs/sor-site/surface/spec.md)
(the Phase-B static checks and the browser tier, the spec's enforcement of record).

Run it as `make surface` from the repo root. One-time prerequisite:

```
(cd packages/sor-site && npm ci && npx playwright install chromium)
```

## How it works

`run.sh` (the driver, invoked by `make surface`):

1. **Assemble** four fixture sites with `scripts/assemble.mjs`, each =
   `packages/vsor/src/vsor/templates/scaffold/site` (placeholders stamped:
   `__VSOR_NAME__` → `fixture`, `__VSOR_YEAR__` → `2026`) + `fixtures/tiny`
   copied beside it as `../knowledge`:
   - `themed` — the scaffold verbatim: `@vsor/sor-site-mdx` + the local search
     theme + `@vsor/sor-site-theme`. This is the default a `vsor init` project
     gets, so the harness certifies the exact site `vsor build` emits
   - `stock` — the documented fallback: the same scaffold with the theme line
     deleted, leaving stock preset-classic + `@vsor/sor-site-mdx` (+ the local
     search theme, see decisions below)
   - `stock-sentinel`, `themed-sentinel` — the same two, rebuilt with sentinel
     values in exactly three seams: `themeConfig.navbar.title`, footer
     copyright, `--ifm-color-primary` (distinct colors for the light and dark
     blocks). This pair-of-builds is how **B12 seam liveness** is tested without
     rebuilding mid-suite: both builds exist up front, the suite compares them
     statically and drives the sentinel build in the browser. Each assembly
     writes a `manifest.json` recording the sentinels *and* the old values they
     replaced — the tests read that manifest and hardcode nothing.
2. **Build** each with the workspace's `docusaurus build` (dependency
   resolution walks up from the scratch dir into the committed workspace — the
   scratch sites are never `npm install`ed themselves).
3. **Serve** each `build/` with `python3 -u -m http.server` on an ephemeral
   `127.0.0.1` port (bind port 0, parse the reported port; `trap` cleanup).
4. **Run** the Playwright suite once, with a project per variant — **B14** is
   structural: the identical spec files run against both configs.

| File | Assertions |
| :--- | :--- |
| `tests/static.spec.ts` | B5 (static scan of built HTML+CSS, zero non-local), B6 (route/sitemap + build-dir assertion), B7 (`tests/exclusions.json` vs built JS bundles) |
| `tests/surface.spec.ts` | B9, B10, B11 walk, B13 (quiz feedback + search to the doc) |
| `tests/seam.spec.ts` | B12 (sentinels present / old gone, token paints in light and dark) |
| `tests/design.spec.ts` | B15 — design-system liveness AND the regression net (added 2026-08-14, see below) |
| `tests/harness.ts` | the always-on guard that makes every visited page enforce B8 (same-origin, zero ≥ 400) and B11 (zero console.error / pageerror) |

Determinism: Chromium pinned via the committed `package-lock.json`, DOM-state
auto-wait only, no screenshots, no visual diffs, retries 0. The only wait
outside Playwright is `run.sh`'s bounded poll for the server's "port NNNN"
startup line.

## Decisions recorded here

- **Search in the stock config:** B13 requires typing into a SearchBar and B14
  requires the identical suite to pass on stock, so both variants wire
  `@easyops-cn/docusaurus-search-local` (allowlisted, local index,
  `hashed: false` so the themed SearchBar finds `/search-index.json`). The
  themed package shadows its SearchBar; the search *interaction* branches per
  variant in one helper, the assertions are identical.
- **The homepage, per variant** (amended 2026-08-14, when the theme became the
  scaffold default): the scaffold homepage renders the theme's `@theme/Landing`,
  whose call to action is derived from the corpus itself (the docs plugin's
  `mainDocId`) — so `themed` uses it verbatim and there is no link to retarget at
  the fixture. `stock` cannot render it (no theme, no `@theme/Landing`), so
  `assemble.mjs` substitutes the preset-classic page the scaffold config's own
  comment prescribes for that case — which makes that advice tested rather than
  asserted. Both substitutions are exact-count checked against the scaffold, so a
  scaffold edit fails the assembly loudly instead of silently testing something
  else.
- **B7 list:** `tests/exclusions.json` mirrors the spec's exclusion table
  row-for-row; its `$comment` records the two rows enforced elsewhere
  (`customFields`, locale trees) so the closure rule holds.
- **`design.spec.ts` — B15** (added 2026-08-14; spec wording queued, so the
  letter is provisional here). B5–B14 pin the *contract*, and the whole of it stays
  green through a build where Tailwind emits nothing: the utility classes are
  still in the markup, no request fails, no console error is logged, the page
  just silently reverts to unstyled boxes. That is the exact failure the design
  system was brought across to fix, and its most likely cause is one line
  drifting — Tailwind v4 does not scan `node_modules`, where the theme's
  compiled chrome lives in every real install. So this file asserts *computed
  styles*, never stylesheet greps: Tailwind utilities resolve on an injected
  probe element, the responsive variant hides/shows the trigger, the Radix sheet
  opens carrying the corpus tree, lucide renders inline SVG. B14 symmetry is
  kept literally — the same file runs on `stock` and asserts the mirror
  property, that the documented fallback leaves *no* Tailwind runtime behind.

  Two of its five checks run in BOTH projects and ask the opposite question —
  not "did Tailwind arrive?" but "did Tailwind destroy what was already here?".
  That is the failure that actually shipped: Docusaurus's cascade-layer polyfill
  raised Tailwind's preflight to (0,2,0), above every single-class CSS-module
  rule, and the quiz's options rendered 800x28 with no border and no padding
  while all of B5–B14 stayed green (B13 asserts only that feedback text
  appears). So one CSS-module primitive must keep its own box in both builds,
  and a fenced code block must clear 4.5:1 in light mode — stock is the control,
  themed must match its shape.
