# The vsor site runtime

If you found this file inside a project's `.vsor/site-runtime/`, this directory
is **generated**, and `vsor build` and `vsor dev` own it. They rewrite the copies
of your `site/` and `knowledge/` in here on **every** invoke, and they wipe and
rebuild the whole directory whenever the vsor version, its pinned dependencies or
the shell itself changes. Nothing in it is a file you edit: an edit to the copies
is gone on the very next run, and an edit anywhere else survives only until the
next upgrade — silently, and without a diff either time.

It is scratch, not source. Deleting `.vsor/` costs one dependency install on the
next run; it never costs work.

## What you edit instead

| To change | Edit, in your own project |
| :--- | :--- |
| the documents the site serves | `knowledge/` |
| title, tagline, navbar, footer, code theme | `site/docusaurus.config.ts` |
| colour and type — the design tokens | `site/src/css/custom.css` |
| the homepage | `site/src/pages/index.tsx` |
| one component's markup | `site/src/theme/<Component>/`, via `docusaurus swizzle` |

`site/` and `knowledge/` are copied in here on every invoke. That is exactly why
your edit to the authored file is always what the next build sees, and why an
edit to the copy is not. Your project's own `AGENTS.md` documents these seams —
that is the file to read, not this one.

## What this directory holds

A complete Docusaurus site: its config, its React source, its stylesheets, and
the typefaces the design system uses. The typefaces are vendored beside the
stylesheet that declares them (`src/css/fonts/`, with their licences) and
referenced by relative URL, because this shell requests nothing off-origin —
no font CDN, no analytics, no telemetry, nothing.

`vsor` unpacks the shell here, installs its pinned dependencies into
`node_modules/`, and stamps `.materialized.json` so the next run can reuse that
install instead of repeating it. `vsor dev` then serves from here; `vsor build`
emits into your project, as `build/` beside the `build.lock.json` recording what
was built.

## Working on the shell itself

You are in the framework repository rather than a generated directory if there is
a `lib/` and an `e2e/` one level up — a materialized shell has neither. The
contributor notes (the contract this shell must satisfy, and how to build it by
hand) live in the `sor-site` README up there, deliberately: that file does not
ship, so it can name repository paths without misleading anyone who meets this
shell in `.vsor/`.
