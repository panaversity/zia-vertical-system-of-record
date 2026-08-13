# e2e — the browser tier of the surface spec

Implements Acceptance **B5–B14** of [`specs/sor-site/surface/spec.md`](../../../specs/sor-site/surface/spec.md)
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
   - `stock` — stock preset-classic + `@vsor/sor-site-mdx` (+ the local search
     theme, see decisions below)
   - `themed` — stock + `@vsor/sor-site-theme` layered on top
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
- **Homepage link retarget:** the scaffold homepage links to `/docs/example`
  (it ships with `knowledge/example.md`); with `fixtures/tiny` as the corpus,
  `assemble.mjs` retargets that single link to `/docs/karahi` (exact-count
  checked) so Docusaurus's own broken-link check stays armed.
- **B7 list:** `tests/exclusions.json` mirrors the spec's exclusion table
  row-for-row; its `$comment` records the two rows enforced elsewhere
  (`customFields`, locale trees) so the closure rule holds.
