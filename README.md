# vsor

**Answers you can trace. Refusals you can trust.**

Point an AI assistant at your own body of professional knowledge and get answers that name the
document they came from — and an honest *"that isn't in here"* when the question falls outside it.

```bash
vsor init my-sor      # a project in your own repo: markdown, config, git initialized
cd my-sor
vsor dev              # the live site on 127.0.0.1:3000, reloading as you write
vsor build            # → build/, ready to upload anywhere
```

## What you get, out of the box

Four markdown files in `knowledge/` produce this — no theme to pick, no components to wire, no
build config to write. Both screenshots are the fixture corpus this repository tests against, not
a mockup.

![The generated homepage: a hero built from the project's own name and tagline, and a panel
counting the documents in the corpus](docs/images/home.jpg)

![A generated document page: sidebar, breadcrumbs, reading time, copy-as-markdown, an
in-page table of contents, and an admonition](docs/images/doc-page.jpg)

Your corpus is just a folder. Sub-folders become sections; frontmatter sets titles and order:

```
knowledge/
  one-source-two-surfaces.md
  system-of-record.md
  vertical-sor.md
  document-primitives.md      ← <Quiz />, flashcards and callouts, if a document wants them
instance.md                   ← what this deployment is
site/docusaurus.config.ts     ← title, navbar, colours — the parts that are yours
```

## The problem this exists for

A general-purpose assistant answers everything in the same confident voice: your firm's rules and
a stranger's, this year's threshold and last year's, the part it checked and the part it invented.
If you are accountable for the answer, that is not a quirk to work around. It is the reason you
cannot use it.

The fix is not a better model. It is a **system of record** — one governed source that both your
people and your machines read, where every answer can be traced back to a document, and where the
correct response to an uncovered question is to say so.

## What vsor does

You write markdown in `knowledge/`. One command compiles it into two surfaces that never disagree,
because they are built from the same source:

- **A website your people read** — search, dark mode, quizzes and flashcards, self-hosted fonts,
  and **no external requests at all**. It works behind a firewall.
- **An MCP server your AI answers from** — every answer names its document and the numbered
  version it came from; a question the corpus does not cover is declined, not guessed.

Every build also writes `build.lock.json`: a committed record of exactly which documents were
built, from which commit, with which tool versions. When someone asks why the assistant said what
it said, that file is how you find out.

It is not an agent framework. It is the knowledge layer such frameworks read *from* — for people
who own knowledge they are accountable for, and for the engineers and agents who build on it.
Your project stays markdown and one config file; the machinery is installed rather than copied,
so it upgrades underneath you.

## Status

**The website surface ships today.** `vsor init`, `vsor dev` and `vsor build` are implemented and
tested — 189 unit tests, 36 browser checks against a real build, and a hosting tier that deploys
to both shapes a static host can have and drives the result in a browser.

**The MCP surface is next.** `vsor serve` exits 2 and says so rather than pretending. The
retrieval kernel it will use runs in production elsewhere; bringing it across is the current work.

[CHANGELOG.md](CHANGELOG.md) is what shipped. [docs/status.md](docs/status.md) is what is still
missing, including the measurements we would rather you heard from us — the corpus size where a
flat folder starts to cost you, and the fact that nothing has yet run on a machine that is not
ours.

## Install

**Needs:** Python 3.14+, and Node 20+ with npm (the first `dev` or `build` installs a site runtime
under `.vsor/` — one time, a minute or two, network required).

Not yet on PyPI, so build the wheel and run from it:

```bash
make wheel
uvx --from dist/vsor-0.1.1-py3-none-any.whl vsor init my-sor
```

Once the name is claimed that becomes `uvx vsor init my-sor`.

## Deploy

`vsor build` writes `build/` — plain static files, no server and no runtime. Any host serves it.

**Set `url` in `site/docusaurus.config.ts` before your first deploy.** Docusaurus bakes it into the
sitemap, canonical links and social tags at build time, so an unedited config publishes a site
whose metadata points at your laptop. `vsor build` warns while the placeholder is there.

Then upload the directory — `netlify deploy --dir=build --prod`, a bucket, GitHub Pages, your own
nginx — or wire a host to build on push. Every host's exact command, the subpath case, and how to
*verify* a deploy rather than trust it, ship inside each project at
`.agents/skills/deploy/SKILL.md`.

## Built on

The website surface is a fork of the Agent Factory learn-app, with three shadcn/ui components and
two SIL OFL typefaces. Who owns what, under which licence, is in **[NOTICE](NOTICE)** — which
travels inside the wheel.

Security reporting and the supply-chain properties a project inherits: **[SECURITY.md](SECURITY.md)**.

## Contributing

Start with **[AGENTS.md](AGENTS.md)** — how this is built and the decisions behind it — then
**[docs/status.md](docs/status.md)** and **[CONTRIBUTING.md](CONTRIBUTING.md)**.

`make gate` runs lint, typecheck, unit, boundary and the init acceptance. `make surface` runs the
build acceptance and the browser tier. `make deploy-acceptance` runs the hosting tier: both shapes
a static host can have, through the real wheel and a real browser. The three node-lane targets
stage the same paths, so they cannot run concurrently on one checkout.

Apache-2.0.
