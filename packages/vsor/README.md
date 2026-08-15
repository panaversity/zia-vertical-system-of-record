# vsor

**Compile a folder of governed markdown into a website and — in a later release — an MCP server,
with cited answers and honest abstention.**

You own a body of professional knowledge: tax rules, case notes, a syllabus, an operations manual.
`vsor` turns the folder it lives in into surfaces other people and other software can use, without
you owning a toolchain. You write markdown. Everything else derives from it.

## Status — 0.1.0

The site half ships. `vsor init`, `vsor dev` and `vsor build` are implemented, tested and walked
live end to end. `vsor serve` — the MCP surface, and the Postgres half behind it — is not in this
release: running it says so and exits 2. The API is not stable until 1.0.

## Install

```bash
uv tool install vsor          # or, without installing: uvx vsor init my-sor
```

**Requirements:** Python 3.14+ · Node 20+ and npm on PATH. The first `vsor dev` or `vsor build`
installs a Docusaurus runtime under `.vsor/` — one time, ~1–2 minutes, network required. Nothing is
installed into your project outside `.vsor/`: no `node_modules`, no `package.json`, no `pyproject`.
macOS and Linux; on Windows, use WSL.

## Five minutes

```bash
vsor init my-sor     # scaffolds a project into your own repo, git initialized
cd my-sor
vsor dev             # the live site on 127.0.0.1:3000, hot-reloading from knowledge/
vsor build           # emits build/ (the deployable site) + build.lock.json (the record)
```

`vsor init` writes a project that is content and config only — your corpus, one `instance.md`, a
real (thin) Docusaurus `site/` whose every key is a live seam, four rules and fourteen skills for
the coding agent you already use, a host config for Vercel and one for Netlify, and a first commit. No machinery, nothing frozen, nothing rented.

## What you get

- **A website that looks like a product**, not a docs template: Tailwind v4, shadcn/ui primitives,
  OKLCH design tokens, lucide icons, local search over your corpus, and a content vocabulary your
  markdown can use — `<Quiz />`, `<Flashcards />`, galleries, callouts. Rebrand by editing design
  tokens in one file.
- **No external requests.** Fonts self-hosted, search a local index, zero analytics, zero CDN.
- **`build.lock.json`** — the committed record of a build: a `build_id` derived from the inputs, the
  commit it came from, one row per document, the tool versions. Same inputs, same `build_id`.

## Deploy

`build/` is a plain directory of static files — upload it to any static host. There is no server,
no runtime, no serve-time environment variable.

**First, in `site/docusaurus.config.ts`, set the two values that are baked in at build time and
never read at serve time:**

| Key | Set it to |
| :--- | :--- |
| `url` | the origin the site will be served from — scheme and host, no path, e.g. `https://sor.acme.dev`. It ends up in `sitemap.xml`, every canonical `<link>`, every `og:url` and the JSON-LD, so an unedited config publishes a site whose machine-readable half names the machine that built it. `vsor build` warns while it is still the placeholder |
| `baseUrl` | `"/"` for a domain root; `"/<repo>/"` — leading **and** trailing slash — if the site lives in a subpath, as a GitHub Pages project site does. Get it wrong and every asset 404s |

Rebuild, then upload. From the project root, where `build/` is:

| Host | Command |
| :--- | :--- |
| Netlify | `netlify deploy --dir=build --prod` |
| Cloudflare Pages | `npx wrangler pages deploy build --project-name <name>` |
| Vercel | `--prebuilt` reads one specific directory, so stage into it: `rm -rf .vercel/output && mkdir -p .vercel/output && cp -R build .vercel/output/static && printf '{"version":3}' > .vercel/output/config.json && vercel deploy --prebuilt --prod` |
| GitHub Pages | publish `build/` as the Pages artifact (`actions/upload-pages-artifact` with `path: build`, then `actions/deploy-pages`). It already contains the `.nojekyll` Pages needs |
| S3 / R2 / GCS | `aws s3 sync build s3://<bucket>`, then enable website serving on the bucket |
| your own server | `rsync -a build/ host:/var/www/<site>/` behind nginx or Caddy — it is files, it needs no runtime |

Or let the host build it: `vsor init` writes a `vercel.json` and a `netlify.toml` carrying the same
build command and output directory, so a connected repository deploys on push. That path needs
`vsor` installable from PyPI — check with `uvx vsor --version`.

**Then verify rather than trust the URL a CLI printed** — with `-L`, because the sitemap writes
extensionless directory URLs while the build emits `index.html` files, so a host either redirects
or 404s:

```bash
curl -sSL -o /dev/null -w '%{http_code}\n' <url>/          # 200
curl -sSL "<url>/docs/<slug>/" | grep -q "<its title>"     # the document really renders
curl -sSL <url>/sitemap.xml | head -c 400                  # every <loc> names the deployed origin
```

A scaffolded project carries all of this, plus the reasoning, at
`.agents/skills/deploy/SKILL.md` — offline, and pinned to the version that scaffolded it.

## More

- Repository, specs and CHANGELOG:
  <https://github.com/panaversity/zia-vertical-system-of-record>
- Everything needed to *use* vsor ships in this package and in what `vsor init` writes; the
  repository is for how it is built.

Apache-2.0. Third-party attribution — the forked upstream app, the shadcn/ui components and the two
OFL typefaces — is in the `NOTICE` file shipped in this distribution.
