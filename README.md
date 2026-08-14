# vsor

**A Vertical System of Record: one folder of governed markdown, compiled into two surfaces — a
website people browse, and an MCP server AI agents can cite.**

```bash
vsor init my-sor      # a project in your own repo: markdown, config, git initialized
cd my-sor
vsor dev              # the live site on 127.0.0.1:3000, reloading as you write
vsor build            # → build/, ready to upload anywhere
```

You write markdown in `knowledge/`. One command compiles it into a real website — search, dark
mode, quizzes and flashcards, self-hosted fonts, **no external requests at all** — and into
Postgres rows an MCP server answers from, where every answer names the document it came from and a
question the corpus does not cover is declined rather than guessed. Both surfaces derive from the
same source, so adding one never means editing the knowledge.

Every build also writes `build.lock.json`: a committed record of exactly which documents were
built, from which commit, with which tool versions.

It is not an agent framework; it is the knowledge layer such frameworks read *from*. It is for
people who own a body of professional knowledge and are accountable for it — a tax practice, a
clinic, a school. Your project stays markdown and one config file. The machinery is
installed rather than copied into your repo, so it upgrades underneath you.

## Status

**0.1.x ships the website half.** `vsor init`, `vsor dev` and `vsor build` are implemented, tested
and walked live on a real corpus.

`vsor serve` — the MCP server that answers AI assistants with cited sources and declines what the
corpus does not cover — **is not in this release.** Running it says so and exits 2. That half is
where the interesting claim lives, and it is next; see [CHANGELOG.md](CHANGELOG.md) for what
landed and [docs/status.md](docs/status.md) for what is honestly still missing.

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
