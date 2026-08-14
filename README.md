# vsor

**Answers you can trace. Refusals you can trust.**

Point an AI assistant at your own files and get answers that name the file they came from — and a
plain *"that isn't in here"* when the question falls outside them.

```bash
vsor init my-sor      # a project in your own repo: markdown, config, git initialized
cd my-sor
vsor dev              # the live site on 127.0.0.1:3000, reloading as you write
vsor build            # → build/, ready to upload anywhere
```

## What you get

Write markdown. Run one command. You get a site like this — no theme to pick, no components to
wire, no build config. Both pictures are a real build of a real corpus, not a mockup:

![The generated homepage: the project's own name and tagline, and a panel counting the documents
and sections found in the folder](docs/images/home.jpg)

![A generated document page: sidebar built from the folder tree, breadcrumbs, reading time,
copy-as-markdown, and an in-page table of contents](docs/images/doc-page.jpg)

Your side of it is a folder. Sub-folders become sections; a line of frontmatter sets the title:

```
knowledge/
  about.md
  thesis.md
  ecosystem/
    the-ecosystem-concept.md
instance.md                   ← what this deployment is
site/docusaurus.config.ts     ← title, navbar, colours — the parts that are yours
```

## Why not just use a chatbot

A general-purpose assistant answers everything in the same confident voice: your rules and a
stranger's, this year's number and last year's, the part it checked and the part it made up. If
you are the one who has to stand behind the answer, that is not a rough edge. It is the reason you
cannot use it.

What fixes it is not a smarter model. It is having **one source everyone reads** — your people
through a website, your AI through a connector — where every answer points back to the document it
came from, and where "we don't cover that" is a real answer instead of an invented one.

## The two things vsor builds

Both come from the same folder, so they can never disagree:

- **A website your team reads.** Search, dark mode, quizzes and flashcards, self-hosted fonts, and
  **no calls to anyone else's server**. It works behind a firewall.
- **A connector your AI answers from** (MCP — the standard assistants like Claude use to reach
  outside tools). Every answer names its document; a question your files do not cover is declined.

Every build also writes `build.lock.json` — a record of exactly which documents went in, from
which commit, with which versions. When someone asks *why did it say that*, that file is how you
find out.

It is not an agent framework. It is the layer such frameworks read *from*. Your project stays
markdown and one config file; the machinery is installed rather than copied in, so it upgrades
underneath you without touching your work.

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
