# sor-site — the website surface

The Node side of the framework: everything that turns a governed corpus into a static site.
**The contract is [`specs/sor-site/surface/spec.md`](../../specs/sor-site/surface/spec.md)** — its
negative contract (no auth, no tutor/AI panels, no progress backends, no analytics, no external
requests from the theme) is binding and CI-enforced; read it before adding anything here.

## Workspace layout

| Package | Name | Job |
| :--- | :--- | :--- |
| `app/` | `@vsor/sor-site-app` | the runtime shell — the whole forked Docusaurus site, chrome and MDX vocabulary together. `make wheel` packs it as `sor-site-app.tgz`; `vsor build`/`vsor dev` unpack it over `.vsor/site-runtime/` |
| `lib/*` | `@vsor/lib-*` | the content-pipeline packages (remark plugins, loaders, site plugins) |
| `e2e/` | `@vsor/sor-site-e2e` | the browser tier (`make surface`) — assembles the materialized shape and runs the Playwright acceptance against it |

Components are **extracted from the upstream app at the pinned survey SHA**
(see `docs/extraction.md`), stripped per the spec's exclusion table, and de-branded — never
re-implemented as lookalikes.

**Two packages were deleted on 2026-08-14**: `mdx/` (`@vsor/sor-site-mdx`) and `theme/`
(`@vsor/sor-site-theme`), the first-pass extraction that shipped the vocabulary and the design
system as installable Docusaurus themes. The fork superseded both — the shell manifest
(`packages/vsor/src/vsor/templates/site_runtime/package.json`) referenced neither, so they
reached no user, while still reading like the place to edit a Navbar. They are in git history;
the surviving copy of every file they held is under `app/src`.

Node >= 20, npm workspaces, `package-lock.json` committed.

## Building the runtime shell (`app/`) by hand

`app/` is the forked Docusaurus site `make wheel` packs as `sor-site-app.tgz` and
`vsor build`/`vsor dev` unpack over a project's `.vsor/site-runtime/`. Its own
`README.md` ships inside that tarball and therefore addresses whoever meets the shell
in `.vsor/` — which is why these two contributor notes live here instead, in a file
that does not ship:

All three from `app/`, unchanged from the notes that used to sit in that directory:

```sh
cp -r ../../../fixtures/tiny ../knowledge   # a real directory, see below
npm run build --workspace app
npx docusaurus serve --dir build
```

- **`../knowledge` must be a real directory, not a symlink.** Docusaurus's MDX loader
  decides a file is a doc by comparing its path against the configured content path;
  through a symlink the resolved real path does not match, no `metadata` export is
  attached, and every doc page dies in SSG with
  `Cannot read properties of undefined (reading 'id')`. Found live 2026-08-14. The same
  finding is what made `vsor` copy the authored trees on every invoke rather than link
  them — `packages/vsor/src/vsor/site_runtime.py::copy_authored` is that fact's home.
- **Serve it with a server that resolves extension-less routes** (`docusaurus serve`
  does; `python3 -m http.server` does not). Opening `/docs/x.html` directly makes the
  client router miss the route, hydrate a not-found page over a doc page, and log a
  React #418 hydration error that has nothing to do with this code.

The shell reads a sibling `../knowledge` and `../site` when it is developed here;
`vsor` repoints both with `VSOR_KNOWLEDGE_DIR` / `VSOR_SITE_DIR`. Identity overrides:
`VSOR_SITE_TITLE`, `VSOR_SITE_TAGLINE`, `VSOR_SITE_URL`, `VSOR_BASE_URL`.

The negative contract is `specs/sor-site/surface/spec.md`; its machine-readable form is
`e2e/tests/exclusions.json`. Both the source tier and the built-bundle tier scan for the
excluded identifiers, so the shell's source deliberately does not spell them out even in
comments — a comment naming an excluded component fails the same test the component
would.
