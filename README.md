# vsor

Repo: `zia-vertical-system-of-record-framework` · PyPI package and binary: `vsor` · Apache-2.0

`vsor` is a command-line tool for anyone who owns a body of professional knowledge — an accountant,
a lawyer, a teacher. You put your material in a folder as markdown files and run one command. From
that content it builds **a static website people browse**. In a later release the same content will
be loaded into Postgres and served to AI assistants over MCP, where every answer names its source
file and the numbered content version it came from, and where a question the files do not cover is
answered "the material does not cover this" instead of from the model's own knowledge.

> ## Status — 0.1.0: the site half ships
>
> `vsor init`, `vsor dev` and `vsor build` are implemented, tested and walked live. `vsor serve` —
> the MCP surface, and the Postgres half behind it — is not in this release: running it says so and
> exits 2. See [CHANGELOG.md](CHANGELOG.md) for what landed and what is still missing.
>
> **Not yet on PyPI.** Install from a built wheel — see [Install](#install).

```
knowledge/*.md   instance.md          ← you write these
                       │
                  vsor build           validate · render
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
   build.lock.json                 build/
   (committed — the record          static site
    of what was built)                 │
                                       ▼
                                  a website
                                  people browse

  later release ─ the same corpus is chunked, embedded and loaded into
  Postgres under a numbered generation, and `vsor serve` answers AI
  assistants over MCP: every answer names its document and generation,
  and a question the corpus does not cover is declined, not guessed.
```

**It is not an agent framework.** It is the knowledge layer such frameworks read *from*.

Your project stays yours and stays simple — markdown and one config file, no toolchain. When you (or
your coding agent) want to customize deeper, `vsor eject <component>` will put the actual source in
your repo, recorded in the build so a modified build is distinguishable from a stock one.

## Install

**Requirements:** Python 3.14+ · Node 20+ and npm on PATH (`dev` and `build` install a Docusaurus
runtime under `.vsor/` on first run — one time, ~1–2 minutes, network required).

`vsor` is not yet claimed on PyPI, so 0.1.0 is a tag, not an upload. Build the wheel and run from it:

```bash
make wheel                                                  # packs the site runtime, then builds the wheel
uvx --from dist/vsor-0.1.0-py3-none-any.whl vsor init my-sor
```

After the name is claimed, that becomes `uvx vsor init my-sor`.

## Five minutes

```bash
vsor init my-sor          # scaffolds a project into your own repo, git initialized
cd my-sor
vsor dev                  # the live site on 127.0.0.1:3000, hot-reloading from knowledge/
# write markdown into knowledge/ — the page reloads as you save
vsor build                # emits build/ (the deployable site) and build.lock.json (the record)
```

## Deploy

`vsor build` writes **`build/`** — a plain directory of static HTML, CSS, JS and JSON. There is no
server, no runtime, no environment variable to set at serve time. Any static host serves it, and
"deploying" means uploading that directory.

**Do these two things first — they are baked into the output at build time, not read at serve time.**
In `site/docusaurus.config.ts`:

| Key | Set it to | What breaks if you don't |
| :--- | :--- | :--- |
| `url` | the real origin the site will be served from, scheme and host, no path — e.g. `https://sor.acme.dev`. Use a domain you control: `example.com`, `.test`, `.invalid` and `.example` are reserved by standard and resolve nowhere, which is why `vsor build` reports them as placeholders too | `sitemap.xml`, every canonical `<link>` and every `og:url` in the shipped HTML name whatever `url` said. The scaffold ships the placeholder `http://localhost:3000`, so an unedited config publishes a site whose machine-readable half points at the machine that built it. `vsor build` warns while the placeholder is still there; `vsor dev` does not, because a local preview belongs on localhost |
| `baseUrl` | `/` for a domain root; `/<repo>/` if the site lives in a subpath (GitHub Pages project sites) | every asset is requested from the wrong path and the page loads unstyled |

Then rebuild — `vsor build` — and upload. Run these from the project root, where `build/` is:

| Host | Command |
| :--- | :--- |
| Netlify | `netlify deploy --dir=build --prod` |
| Cloudflare Pages | `npx wrangler pages deploy build --project-name <name>` |
| Vercel | `vercel --prebuilt` reads one specific directory, so stage `build/` into it first: `rm -rf .vercel/output && mkdir -p .vercel/output && cp -R build .vercel/output/static && printf '{"version":3}' > .vercel/output/config.json && vercel deploy --prebuilt --prod` |
| GitHub Pages | upload `build/` as the Pages artifact (`actions/upload-pages-artifact` with `path: build`), then `actions/deploy-pages`. `build/` already contains the `.nojekyll` Pages needs |
| S3 / nginx / anything | copy the directory (`aws s3 sync build s3://<bucket>`, `rsync -a build/ host:/var/www/<site>/`) |

Each is that host's own documented command for pushing a prebuilt directory; the first run is
interactive, because that is where the host asks which project the upload belongs to. None of them
needs Python, Node or vsor on the far side — what you are uploading is finished HTML.

**The same table, plus the verification recipe and both git-connected paths, ships inside every
scaffolded project** at `.agents/skills/deploy/SKILL.md`. That copy is the one to reach for: it is
the one that travels with the project and works offline. This one is here so a reader of this page
does not have to scaffold to find out.

**Notes that save an hour.**

- **`build/` is gitignored by the scaffold and stays that way.** Deploy by uploading the directory,
  or by building in CI. What you commit is `build.lock.json` — the record of *which* corpus was
  built, from which commit, with which tool versions.
- **Two shapes of deploy, and they cost different things.** Uploading a locally built directory (the
  table above) asks nothing of the host. Wiring the host to your git repository and letting *it* run
  `vsor build` means that host needs Python 3.14+, Node 20+ and network for the one-time runtime
  install on every cold build — and it is what buys you a site that redeploys when the corpus is
  pushed.
- **`.vsor/` is scratch** — the installed site runtime lives there (796 MB for the one-document
  scaffold, measured 2026-08-14) while `build/` for the same project is 4.9 MB. Never upload it,
  never commit it; deleting it costs a re-install and nothing else.
- **The site makes no external requests** — fonts are self-hosted, search is a local index, there is
  no analytics and no CDN. It works behind a firewall and on an intranet host.

## Built on

The website surface is a fork of the Agent Factory learn-app, and it carries three shadcn/ui
components and two SIL OFL typefaces. Who owns what, and under which licence, is in
**[NOTICE](NOTICE)** — which ships inside the wheel beside the licence, so it travels to anyone who
installs this.

## Security

Reporting, what is in scope, and the two supply-chain properties a scaffolded project inherits on
purpose: **[SECURITY.md](SECURITY.md)**.

## For contributors

Start with **[AGENTS.md](AGENTS.md)** (how this is built), then **[docs/status.md](docs/status.md)**
(where things stand this week), then **[docs/extraction.md](docs/extraction.md)** (the work list for
the join), and **[CONTRIBUTING.md](CONTRIBUTING.md)** for the shape of a change. `make gate` runs
lint, typecheck, unit, boundary and the init acceptance; `make surface` runs the build acceptance
and the browser tier; `make deploy-acceptance` runs the hosting tier — the two shapes a static host
has, through the real wheel and a real browser. The three node-lane targets stage the same paths,
so they cannot run concurrently on one checkout.
