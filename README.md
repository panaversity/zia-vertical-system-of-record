# vsor

**Answers you can trace. Refusals you can trust.**

**[See a site vsor built →](https://vsor-demo.vercel.app)** — four markdown files, one command.

Point an AI assistant at your own files and get answers that name the file they came from — and a
plain *"that isn't in here"* when the question falls outside them.

```bash
uvx vsor init my-sor  # a project in your own repo: markdown, config, git initialized
cd my-sor
vsor dev              # the live site on 127.0.0.1:3000, reloading as you write
vsor build            # → build/, ready to upload anywhere
```

## What vsor builds

One folder of markdown. Two surfaces, built from it, that can never disagree:

- **A website your team reads.** Search, dark mode, quizzes and flashcards, self-hosted fonts, and
  **no calls to anyone else's server** — it works behind a firewall.
- **A connector your AI answers from** (MCP — the standard assistants like Claude use to reach
  outside tools). Every answer names the document it came from; a question your files do not cover
  is declined instead of guessed.

Every build also writes `build.lock.json` — a record of exactly which documents went in, from
which commit, with which versions. When someone asks *why did it say that*, that file is how you
find out.

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

Here is the website surface, from a real build of real content — no theme to pick, no components
to wire, no build config:

![The generated homepage: the project's own name and tagline, and a panel counting the documents
and sections found in the folder](docs/images/home.jpg)

![A generated document page: sidebar built from the folder tree, breadcrumbs, reading time,
copy-as-markdown, and an in-page table of contents](docs/images/doc-page.jpg)

## What a system of record is, in the AI era

A system of record is the one place the official version lives. When the ledger and a spreadsheet
disagree, the ledger wins. Businesses have had them for decades. AI never did — it answers from
everything it has ever read, which is exactly why it cannot tell you which sentences were checked
and which were invented.

A **vertical** system of record is one profession's version of that: your rules, your thresholds,
your documents — one governed source that your people and your AI both read.

**It is vendor-free by design.** The connector speaks MCP, the open standard for giving assistants
access to outside tools, so the same knowledge answers in Claude, in ChatGPT, inside an agent
framework, or in a worker you wrote yourself. You are not building on one company's platform, and
you are not re-doing this work when you change models. What you own is the source; the runtimes
are interchangeable.

That is the part worth your attention. Retrieval plumbing is a solved, commodity problem. Whether
an AI agent can be trusted in your field is not — and it is decided by the quality and the
governance of what it reads.

## Built for agents first

You are not meant to operate this yourself. Tell the coding agent you already use — Claude Code,
Codex, Cursor, whichever — and it does the work. Every scaffolded project ships the instructions
that agent needs: **skills** for the jobs that recur (adding sources, converting a Word document or
a deck, checking format, writing a quiz, deploying) and **rules** for working a corpus somebody is
accountable for — provenance, abstention, review, and what lives where.

So out of the box, the only thing you touch is the knowledge itself. Documents are plain markdown,
written in English or whatever language you work in.

**Nothing is hidden when you want to go further.** What you edit directly is `site/` — a real
Docusaurus project, whose config, design tokens, homepage and sidebar are ordinary files your agent
already knows. And the machinery is not a black box either: after a build, the entire site
application sits in `.vsor/site-runtime/` as readable source — the actual navbar, footer and page
components — so an agent can open the real thing to understand it before changing anything. That
directory is regenerated on upgrade, so treat it as reference rather than as your copy; a verb to
take durable ownership of a component is designed and named in the changelog, not yet built. The
framework itself is Apache-2.0, so the machinery can also be forked and improved directly.

## Status

**The website surface ships today.** `vsor init`, `vsor dev` and `vsor build` are implemented and
tested — 330 unit tests, 28 boundary checks, 42 browser checks against a real build, and a hosting
tier that deploys to both shapes a static host can have and drives the result in a browser.

**The MCP surface is next.** `vsor serve` exits 2 and says so rather than pretending. The
retrieval kernel it will use runs in production elsewhere; bringing it across is the current work.

[CHANGELOG.md](CHANGELOG.md) is what shipped. [docs/status.md](docs/status.md) is what is still
missing, including the measurements we would rather you heard from us — the corpus size where a
flat folder starts to cost you, and the fact that CI has never executed a single job — an account
billing state, not a code fault. The code itself has now been cloned and run green on a machine
that is not ours.

## Install

**Needs:** Python 3.14+, and Node 20+ with npm (the first `dev` or `build` installs a site runtime
under `.vsor/` — one time, a minute or two, network required).

```bash
uvx vsor init my-sor
```

That is the whole install — [uv](https://docs.astral.sh/uv/) fetches vsor and runs it; nothing is
added to your system. `pip install vsor` works too if you would rather have the command on your
PATH.

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

The shell's dependency tree is pinned in `packages/vsor/src/vsor/templates/site_runtime/package-lock.json`
and every tier installs *that* tree, so the browser tests compile with the same compiler your
`vsor build` will. To change it, edit the manifest beside it and run `make relock`, which
re-resolves against the registry and leaves the diff for review.

Apache-2.0.
