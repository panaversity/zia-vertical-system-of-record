---
name: deploy
description: Publish the built site to a real URL — either a git-connected host that runs the build, or an upload of a locally built build/. Load before the first deploy, and before changing where the site is served from.
---

# Deploying this site

`vsor build` writes `build/`: an ordinary directory of static files. Every static host serves it,
and vsor deploys the way every non-Node static generator does — a build command and an output
directory. Nothing here is custom.

Two paths. The difference is who runs the build.

## First: set the site's address

Docusaurus bakes `url` and `baseUrl` into the output — the sitemap, the canonical link, the
hreflang links, the Open Graph tags, the structured data. A build made with the scaffolded
placeholder publishes a site whose machine-readable metadata says every page lives at
`http://localhost:3000`. Nothing *looks* broken, which is why it survives to production.

In `site/docusaurus.config.ts`:

| Served at | `url` | `baseUrl` |
| :--- | :--- | :--- |
| its own domain, or a host-assigned subdomain | `https://docs.yourcompany.com` — origin only, no trailing slash, no path | `"/"` |
| a subpath (a project page on GitHub Pages is the usual case) | `https://yourcompany.github.io` — the origin | `"/<repo-name>/"` — leading **and** trailing slash |

Use a domain you actually control. `example.com`, `example.org`, anything under
`.test`/`.invalid`/`.example` are reserved by standard and resolve nowhere, and `vsor build`
reports them as placeholders for that reason.

A wrong `baseUrl` on a subpath host 404s every stylesheet, script and image: those paths are
written into the HTML at build time, not resolved at request time. `vsor build` warns while `url`
is the placeholder — fix it rather than working around the warning. Rebuild after changing either
value; nothing else in the project reads them.

## Path 1 — the host builds it (git-connected)

Push, and the site updates. This needs one config file at the repository root, in the shape the
host you chose expects. **vsor does not scaffold these** — a framework has no business putting a
vendor's file into every project, and you would delete the one you do not use. Write the one you
need; the command inside it is the same either way:

```
curl -LsSf https://astral.sh/uv/install.sh | env UV_UNMANAGED_INSTALL=/tmp/uv sh && /tmp/uv/uvx vsor build
```

uv brings its own Python, so a host image shipping only Node runs this fine: the installer fetches
uv, `uvx` fetches the Python vsor needs. The install path is pinned instead of added to `PATH`
because the installer cannot change the `PATH` of the shell already running it — the shorter
`... | sh && uvx vsor build` exits 127, `command not found`.

**Vercel** — `vercel.json` (or just set Build Command and Output Directory in the project settings;
the file is only so the setting travels with the repository):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "installCommand": "",
  "buildCommand": "curl -LsSf https://astral.sh/uv/install.sh | env UV_UNMANAGED_INSTALL=/tmp/uv sh && /tmp/uv/uvx vsor build",
  "outputDirectory": "build"
}
```

`framework: null` and the empty `installCommand` matter: with no `package.json` at the repository
root there is nothing for Vercel to auto-detect, and left to itself it would try an install step
that has nothing to install.

**Netlify** — `netlify.toml`:

```toml
[build]
  command = "curl -LsSf https://astral.sh/uv/install.sh | env UV_UNMANAGED_INSTALL=/tmp/uv sh && /tmp/uv/uvx vsor build"
  publish = "build"

[build.environment]
  NODE_VERSION = "24"
```

**Cloudflare Pages** — the same two values in the dashboard: build command as above, output
directory `build`.

Add the matching directory to `.gitignore` when you adopt one — `.vercel/` or `.netlify/`; both
CLIs write local project state there after a first run.

**The one precondition, plainly: `vsor` must be installable from PyPI** — the host installs it by
name, so an unpublished package cannot be fetched. Check it in one command, `uvx vsor --version`:
`vsor was not found in the package registry` means this path cannot work yet, and path 2 below is
the one to use. That check is the answer at every version; nothing here asserts a publication
state it cannot observe.

Two things these files cannot set:

- **Node.** `vsor build` needs Node ≥ 20, or it exits 3 `error: missing-runtime`. Netlify takes
  `NODE_VERSION` as above; on Vercel the version is a project setting whose default is already
  newer than 20.
- **Which vsor.** The command floats to the newest release. `build.lock.json` records the version
  that ran and whether it satisfied `instance.md`'s `vsor.requires` pin. To pin the host too:
  `uvx vsor@<version> build`.

Delete the file for the host you are not using. An unanswerable file in a repository is a cost.

## Path 2 — you build, then upload (works today)

Run `vsor build`, then hand `build/` to anything:

| Target | Command |
| :--- | :--- |
| Netlify | `netlify deploy --dir=build --prod` |
| Vercel | below — `--prebuilt` reads one specific directory, so `build/` is staged into it |
| Cloudflare Pages | `npx wrangler pages deploy build --project-name <name>` |
| GitHub Pages | publish `build/` to the Pages branch or artifact — it already contains the `.nojekyll` that makes Pages serve the `assets/` directory as-is; set `baseUrl` for a project site (above) |
| a bucket — S3, R2, GCS | sync `build/` and enable website serving |
| your own server | copy `build/` behind nginx or Caddy; it is files, it needs no runtime |

Vercel's `--prebuilt` uploads `.vercel/output`, not an arbitrary directory, so put `build/` there
in the layout Vercel's Build Output API documents:

```
vsor build
rm -rf .vercel/output && mkdir -p .vercel/output
cp -R build .vercel/output/static
printf '{"version":3}' > .vercel/output/config.json
vercel deploy --prebuilt --prod
```

**Choose this path on purpose, not only as a fallback:** the corpus never leaves the machine that
built it. The host receives rendered HTML and nothing else — no markdown, no git history, no
sources. For a corpus under a confidentiality obligation that is the difference between a
deployment and a disclosure.

Both CLIs write local project state — and, after a first run, the project and org ids — into
`.vercel/` and `.netlify/`. Both are already in this project's `.gitignore`; nothing to add.

Neither deploy CLI is pre-permitted in `.claude/settings.json`, unlike the vsor verbs. Publishing
is not a routine action, so it asks first.

## What is committed, and what is not

`build/` is git-ignored; `build.lock.json` is committed. The record travels with the repository —
which documents, at which hashes, built by which versions — and the output is reproducible from it
by anyone who can run `vsor build`. Committing the output would add a second copy of every
document, in a form nobody edits and every rebuild churns.

## Verify — never report a URL you have not fetched

A deploy that returned a URL is not a deploy that worked. In order — and with `-L` throughout,
which is not decoration: the sitemap writes extensionless directory URLs (`…/docs/example`) while
the build emits `docs/example/index.html`, so a host either redirects to the trailing-slash form
or 404s. Measured against a correct deploy on a plain static server: `…/docs/example` → **301**,
`…/docs/example/` → 200. Without `-L` step 2 reports a healthy site as broken.

1. **Homepage:** `curl -sSL -o /dev/null -w '%{http_code}\n' <url>/` → `200`.
2. **A document page:** take a real path out of `build/sitemap.xml`, fetch the page itself, and
   look for that document's title in what comes back:

   ```
   curl -sSL "<url>/docs/<slug>/" | grep -q "<the document's title>" && echo ok
   ```

   A homepage can serve while every document 404s — that is exactly what a wrong `baseUrl` looks
   like. (Fetch the body: `-o /dev/null` throws away the half of the answer this step is about.)
3. **The sitemap's host:** `curl -sSL <url>/sitemap.xml | head -c 400`. Every `<loc>` must carry the
   deployed origin, and under a subpath host the prefix too. If they say `localhost`, the site was
   built before `url` was set: fix `site/docusaurus.config.ts`, rebuild, redeploy.

Then open the homepage once in a browser: read the console for errors, click through to a
document. Report the URL and what you checked, not the URL alone.
